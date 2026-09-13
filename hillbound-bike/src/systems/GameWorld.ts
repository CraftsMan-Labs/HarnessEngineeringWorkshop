import {
  BOUNDS,
  COLLISION,
  CRASH,
  DEPENDENCY_FINGERPRINT_SOURCE,
  FINISH,
  FINISH_DISTANCE_M,
  FINISH_X_PX,
  FIXED_DT_MS,
  FUEL,
  HASH_INTERVAL_TICKS,
  OUT_OF_FUEL,
  PX_PER_METER,
  SIM_HZ,
  SPEC_VERSION,
  SPAWN,
  START_X_PX,
  TERRAIN,
  clamp,
  distanceFromChassisX,
  metersToPixels,
  terrainXpx,
  terrainYpx,
} from "../config/gameConfig";
import { getLevel } from "../config/levels";
import { createBike, isFiniteBody, syncHeadFromChassis, type BikeBodies } from "../bike/Bike";
import { BikeContactTracker } from "../bike/BikeContactTracker";
import {
  applyAirControl,
  applyGroundDrive,
  clampBodySpeed,
  clampChassisSpin,
  pixelsPerTickToMps,
} from "../bike/BikeController";
import { Matter, applyEngineSettings, clearWorld, createMatterEngine, setGravity, type MatterBody, type MatterEngine } from "../physics/matter";
import { buildTerrainGeometry, type TerrainSample } from "../terrain/terrainGeometry";
import { terrainHeightM } from "../terrain/terrainHeight";
import type {
  CanonicalState,
  ControlState,
  FloatingLabel,
  LevelId,
  PickupManifestEntry,
  ReplayTape,
  ResultReason,
  RunState,
  RunSummary,
  TestBikePose,
} from "../types/game";
import { hashCanonicalState, serializeCanonicalState, snapshotBody } from "./canonicalState";
import { FuelSystem } from "./FuelSystem";
import { PickupSystem } from "./PickupSystem";
import { ReplaySystem } from "./ReplaySystem";
import { RunStateMachine } from "./RunStateMachine";
import { ScoreSystem } from "./ScoreSystem";
import { StuntSystem } from "./StuntSystem";
import { Telemetry } from "./Telemetry";

export interface GameWorldOptions {
  engine?: MatterEngine;
  testMode?: boolean;
  manual?: boolean;
  strictTransitions?: boolean;
  viewport?: { width: number; height: number };
  userAgent?: string;
}

function pairBodies(pair: { bodyA: MatterBody; bodyB: MatterBody }, labelA: string, labelB: string): boolean {
  return (
    (pair.bodyA.label === labelA && pair.bodyB.label === labelB) ||
    (pair.bodyA.label === labelB && pair.bodyB.label === labelA)
  );
}

function otherBody(pair: { bodyA: MatterBody; bodyB: MatterBody }, label: string): MatterBody {
  return pair.bodyA.label === label ? pair.bodyB : pair.bodyA;
}

export class GameWorld {
  readonly engine: MatterEngine;
  readonly machine = new RunStateMachine();
  readonly fuel = new FuelSystem();
  readonly score = new ScoreSystem();
  readonly stunt = new StuntSystem();
  readonly pickups = new PickupSystem();
  readonly contacts = new BikeContactTracker();
  readonly replay = new ReplaySystem();
  readonly telemetry = new Telemetry();
  readonly testMode: boolean;
  readonly manual: boolean;
  readonly strictTransitions: boolean;

  tick = 0;
  levelId: LevelId = "green-hills";
  input: ControlState = { throttle: 0, brake: 0 };
  keyboard: ControlState = { throttle: 0, brake: 0 };
  touch: ControlState = { throttle: 0, brake: 0 };
  bike: BikeBodies | null = null;
  terrainBodies: MatterBody[] = [];
  pickupBodies = new Map<string, MatterBody>();
  samples: TerrainSample[] = [];
  labels: FloatingLabel[] = [];
  lastHash = "";
  playingReplay = false;
  dependencyFingerprint = DEPENDENCY_FINGERPRINT_SOURCE;
  fallTicks = 0;
  viewport = { width: 1280, height: 720 };
  userAgent = "node";
  notifications: FloatingLabel[] = [];

  private finishBody: MatterBody | null = null;
  private previousChassisX = START_X_PX;
  private listenersBound = false;

  constructor(options: GameWorldOptions = {}) {
    this.engine = options.engine ?? createMatterEngine();
    applyEngineSettings(this.engine);
    this.testMode = options.testMode ?? false;
    this.manual = options.manual ?? false;
    this.strictTransitions = options.strictTransitions ?? this.testMode;
    if (options.viewport) this.viewport = options.viewport;
    if (options.userAgent) this.userAgent = options.userAgent;
  }

  get state(): RunState {
    return this.machine.state;
  }

  get level() {
    return getLevel(this.levelId);
  }

  startRun(levelId: LevelId): void {
    this.buildLevel(levelId);
    this.machine.startPlaying();
    this.emitRunStarted();
  }

  restartRun(): void {
    this.buildLevel(this.levelId);
    this.machine.startPlaying();
    this.emitRunStarted();
  }

  buildLevel(levelId: LevelId): void {
    this.teardownPhysics();
    this.levelId = levelId;
    const level = getLevel(levelId);
    applyEngineSettings(this.engine);
    setGravity(this.engine, level.gravityX, level.gravityY, level.gravityScale);
    this.engine.timing.timeScale = 1;

    this.tick = 0;
    this.input = { throttle: 0, brake: 0 };
    this.keyboard = { throttle: 0, brake: 0 };
    this.touch = { throttle: 0, brake: 0 };
    this.fuel.reset();
    this.score.reset();
    this.stunt.reset(level.airtimeScoreMultiplier);
    this.pickups.reset(levelId);
    this.contacts.reset();
    this.replay.start(levelId, level.seed, this.dependencyFingerprint);
    this.telemetry.reset(createRunId());
    this.labels = [];
    this.notifications = [];
    this.lastHash = "";
    this.fallTicks = 0;
    this.machine.presentationTicks = 0;
    this.machine.resultReason = null;
    this.playingReplay = false;

    const geometry = buildTerrainGeometry(levelId);
    this.samples = geometry.samples;
    this.terrainBodies = [];
    for (let i = 0; i < geometry.segments.length; i += TERRAIN.CHUNK_SIZE) {
      const chunk = geometry.segments.slice(i, i + TERRAIN.CHUNK_SIZE).map((segment) =>
        Matter.Bodies.rectangle(segment.x, segment.y, segment.width, segment.height, {
          isStatic: true,
          angle: segment.angle,
          label: "terrain",
          friction: level.terrainFriction,
          frictionStatic: level.terrainStaticFriction,
          restitution: level.terrainRestitution,
          collisionFilter: {
            category: COLLISION.TERRAIN,
            mask: COLLISION.BIKE | COLLISION.HEAD_SENSOR,
          },
        }),
      );
      this.terrainBodies.push(...chunk);
      Matter.World.add(this.engine.world, chunk);
    }

    const padWidth = metersToPixels(28);
    const padHeight = metersToPixels(TERRAIN.THICKNESS_M);
    const startPad = Matter.Bodies.rectangle(
      terrainXpx(4),
      terrainYpx(0) + padHeight / 2,
      padWidth,
      padHeight,
      {
        isStatic: true,
        label: "terrain",
        friction: level.terrainFriction,
        frictionStatic: level.terrainStaticFriction,
        restitution: level.terrainRestitution,
        collisionFilter: {
          category: COLLISION.TERRAIN,
          mask: COLLISION.BIKE | COLLISION.HEAD_SENSOR,
        },
      },
    );
    this.terrainBodies.push(startPad);
    Matter.World.add(this.engine.world, startPad);

    const wallX = terrainXpx(BOUNDS.LEFT_WALL_DISTANCE_M);
    Matter.World.add(
      this.engine.world,
      Matter.Bodies.rectangle(wallX, terrainYpx(0), metersToPixels(2), metersToPixels(80), {
        isStatic: true,
        label: "left-wall",
        friction: 0,
        collisionFilter: {
          category: COLLISION.TERRAIN,
          mask: COLLISION.BIKE,
        },
      }),
    );

    const finishHeight = terrainHeightM(levelId, FINISH_DISTANCE_M);
    this.finishBody = Matter.Bodies.rectangle(
      FINISH_X_PX,
      terrainYpx(finishHeight),
      metersToPixels(1),
      metersToPixels(FINISH.SENSOR_HALF_HEIGHT_M * 2),
      {
        isStatic: true,
        isSensor: true,
        label: "finish",
        collisionFilter: {
          category: COLLISION.FINISH,
          mask: COLLISION.BIKE,
        },
      },
    );
    Matter.World.add(this.engine.world, this.finishBody);

    this.pickupBodies.clear();
    for (const entry of this.pickups.manifest) {
      const body = Matter.Bodies.circle(
        terrainXpx(entry.distanceM),
        terrainYpx(entry.heightM),
        metersToPixels(entry.radiusM),
        {
          isStatic: true,
          isSensor: true,
          label: `pickup:${entry.id}`,
          collisionFilter: {
            category: COLLISION.PICKUP,
            mask: COLLISION.BIKE,
          },
        },
      );
      this.pickupBodies.set(entry.id, body);
      Matter.World.add(this.engine.world, body);
    }

    this.bike = createBike(this.engine, level);
    this.previousChassisX = this.bike.chassis.position.x;
    this.bindCollisionEvents();
  }

  setCombinedInput(): void {
    this.input = {
      throttle: Math.max(this.keyboard.throttle, this.touch.throttle),
      brake: Math.max(this.keyboard.brake, this.touch.brake),
    };
  }

  setInput(partial: Partial<ControlState>): void {
    const next = {
      throttle: clamp(partial.throttle ?? this.input.throttle, 0, 1),
      brake: clamp(partial.brake ?? this.input.brake, 0, 1),
    };
    this.input = next;
    this.keyboard = { ...next };
  }

  releaseAllInput(): void {
    this.keyboard = { throttle: 0, brake: 0 };
    this.touch = { throttle: 0, brake: 0 };
    this.input = { throttle: 0, brake: 0 };
  }

  pause(): void {
    if (this.machine.pause()) {
      this.telemetry.emit(this.tick, "run_paused");
    }
  }

  resume(): void {
    if (this.machine.resume()) {
      this.telemetry.emit(this.tick, "run_resumed");
    }
  }

  abandonToMenu(): void {
    if (this.state === "PAUSED") this.machine.resume();
    if (this.state === "PLAYING" || this.state === "OUT_OF_FUEL_COASTING") {
      this.machine.resultReason = "abandoned";
      this.machine.transition("ABANDONED", {
        strict: this.strictTransitions,
        onInvalid: () => this.invalidTransition(),
      });
      void this.emitRunEnded();
      this.machine.transition("MENU", {
        strict: this.strictTransitions,
        onInvalid: () => this.invalidTransition(),
      });
    }
  }

  stepTicks(count: number): void {
    for (let i = 0; i < count; i += 1) this.stepTick();
  }

  stepTick(): void {
    if (this.state === "PAUSED" || this.state === "MENU" || this.state === "RESULTS" || this.state === "BOOT") {
      return;
    }
    if (!this.bike) return;

    if (this.playingReplay) {
      this.input = this.replay.inputAt(this.tick);
    } else {
      this.setCombinedInput();
      this.replay.record(this.tick, this.input);
    }

    const scoring = this.machine.isScoring();
    const motorEnabled = scoring && this.fuel.value > 0 && this.state !== "OUT_OF_FUEL_COASTING";
    const driveInput = motorEnabled ? this.input : { throttle: 0, brake: 0 };

    if (this.state === "PLAYING" || this.state === "OUT_OF_FUEL_COASTING") {
      applyGroundDrive(this.bike.rearWheel, this.bike.frontWheel, this.bike.chassis, driveInput, motorEnabled);
      applyAirControl(this.bike.chassis, driveInput, this.contacts.airborne, motorEnabled);
    }

    syncHeadFromChassis(this.bike.chassis, this.bike.head);
    Matter.Engine.update(this.engine, FIXED_DT_MS);
    syncHeadFromChassis(this.bike.chassis, this.bike.head);
    clampChassisSpin(this.bike.chassis);

    let clamped = false;
    for (const body of [this.bike.chassis, this.bike.rearWheel, this.bike.frontWheel]) {
      if (clampBodySpeed(body)) clamped = true;
    }
    if (clamped) this.telemetry.emit(this.tick, "speed_clamped");

    if (![this.bike.chassis, this.bike.rearWheel, this.bike.frontWheel, this.bike.head].every(isFiniteBody)) {
      this.telemetry.emit(this.tick, "simulation_fault");
      this.endRun("simulation_fault");
      return;
    }

    this.detectHeadCrash();
    const contact = this.contacts.step();

    if (scoring) {
      this.score.observeChassisX(this.bike.chassis.position.x);
      this.collectOverlappingPickups();
      this.updateStunts(contact);
      if (this.machine.isBurningFuel()) {
        const { emptiedThisTick } = this.fuel.burn(this.fuel.value > 0 ? this.input : { throttle: 0, brake: 0 });
        if (emptiedThisTick) this.enterOutOfFuel();
      }
      this.checkFinish();
      this.checkOutOfFuelEnd();
      this.checkBounds();
    }

    if (this.state === "CRASHED" || this.state === "COMPLETED") {
      this.machine.presentationTicks += 1;
      const needed = this.state === "CRASHED" ? CRASH.PRESENTATION_TICKS : FINISH.PRESENTATION_TICKS;
      if (this.machine.presentationTicks >= needed) {
        this.machine.transition("RESULTS", {
          strict: this.strictTransitions,
          onInvalid: () => this.invalidTransition(),
        });
      }
    }

    this.tick += 1;
    if (this.tick > 0 && this.tick % HASH_INTERVAL_TICKS === 0) {
      void this.emitHash();
    }
    this.previousChassisX = this.bike.chassis.position.x;
  }

  getCanonicalState(): CanonicalState {
    const bike = this.requireBike();
    return {
      tick: this.tick,
      levelId: this.levelId,
      seed: this.level.seed,
      runState: this.state,
      chassis: snapshotBody(bike.chassis),
      rearWheel: snapshotBody(bike.rearWheel),
      frontWheel: snapshotBody(bike.frontWheel),
      fuel: this.fuel.value,
      score: this.score.totalScore,
      maxDistanceM: this.score.maxDistanceM,
      collectedPickupIds: this.pickups.collectedIds(),
      stunt: this.stunt.snapshot(),
    };
  }

  getSnapshot(): CanonicalState & RunSummary {
    return {
      ...this.getCanonicalState(),
      resultReason: this.machine.resultReason,
      scoreComponents: this.score.snapshot(),
      displayDistanceM: this.score.displayDistanceM,
      rawGrounded: this.contacts.rawGrounded,
      gameplayGrounded: this.contacts.gameplayGrounded,
      airborneTicks: this.stunt.airtimeTicks,
      rotationAccumulator: this.stunt.rotationAccumulator,
    };
  }

  async getStateHash(): Promise<string> {
    const hash = await hashCanonicalState(this.getCanonicalState());
    this.lastHash = hash;
    return hash;
  }

  serializeState(): string {
    return serializeCanonicalState(this.getCanonicalState());
  }

  setBikePose(pose: TestBikePose): void {
    const bike = this.requireBike();
    const x =
      pose.x ??
      (pose.distanceM !== undefined ? START_X_PX + pose.distanceM * PX_PER_METER : bike.chassis.position.x);
    const y =
      pose.y ??
      (pose.distanceM !== undefined
        ? terrainYpx(terrainHeightM(this.levelId, pose.distanceM)) - metersToPixels(SPAWN.chassisHeightM)
        : bike.chassis.position.y);
    const angle = pose.angle ?? bike.chassis.angle;
    const dx = x - bike.chassis.position.x;
    const dy = y - bike.chassis.position.y;
    for (const body of [bike.chassis, bike.rearWheel, bike.frontWheel, bike.head]) {
      Matter.Body.setPosition(body, { x: body.position.x + dx, y: body.position.y + dy });
    }
    Matter.Body.setAngle(bike.chassis, angle);
    if (pose.vx !== undefined || pose.vy !== undefined) {
      Matter.Body.setVelocity(bike.chassis, {
        x: pose.vx ?? bike.chassis.velocity.x,
        y: pose.vy ?? bike.chassis.velocity.y,
      });
    }
    if (pose.angularVelocity !== undefined) {
      Matter.Body.setAngularVelocity(bike.chassis, pose.angularVelocity);
    }
    if (pose.rearWheelOmega !== undefined) Matter.Body.setAngularVelocity(bike.rearWheel, pose.rearWheelOmega);
    if (pose.frontWheelOmega !== undefined) Matter.Body.setAngularVelocity(bike.frontWheel, pose.frontWheelOmega);
    if (pose.rearWheelVx !== undefined) {
      Matter.Body.setVelocity(bike.rearWheel, { x: pose.rearWheelVx, y: bike.rearWheel.velocity.y });
    }
    if (pose.frontWheelVx !== undefined) {
      Matter.Body.setVelocity(bike.frontWheel, { x: pose.frontWheelVx, y: bike.frontWheel.velocity.y });
    }
    syncHeadFromChassis(bike.chassis, bike.head);
    this.previousChassisX = bike.chassis.position.x;
    if (this.machine.isScoring()) this.score.observeChassisX(bike.chassis.position.x);
  }

  setFuel(value: number): void {
    this.fuel.set(value);
  }

  triggerPickup(pickupId: string): void {
    this.applyCollections(this.pickups.collect([pickupId]));
  }

  beginSyntheticAirborneSequence(): void {
    this.contacts.airborne = true;
    this.contacts.ticksSinceRaw = 6;
    this.contacts.rearContacts.clear();
    this.contacts.frontContacts.clear();
    this.stunt.reset(this.level.airtimeScoreMultiplier);
    this.stunt.airborne = true;
    this.stunt.airtimeTicks = 0;
    this.stunt.previousAngle = this.bike?.chassis.angle ?? 0;
    this.telemetry.emit(this.tick, "airtime_started");
  }

  setSyntheticChassisAngle(angleRadians: number): void {
    if (this.bike) Matter.Body.setAngle(this.bike.chassis, angleRadians);
    const awards = this.stunt.applySyntheticTick(angleRadians);
    this.applyAwards(awards);
  }

  endSyntheticAirborneSequence(): void {
    this.stunt.land();
    this.contacts.airborne = false;
    this.contacts.setRawForTest(true, true);
    this.contacts.ticksSinceRaw = 0;
    this.telemetry.emit(this.tick, "landed");
  }

  playReplay(tape: ReplayTape): void {
    this.buildLevel(tape.levelId);
    this.replay.changes = tape.changes.map((change) => ({ ...change }));
    this.playingReplay = true;
    this.machine.startPlaying();
    this.emitRunStarted();
  }

  private bindCollisionEvents(): void {
    if (this.listenersBound) {
      Matter.Events.off(this.engine, "collisionStart");
      Matter.Events.off(this.engine, "collisionActive");
      Matter.Events.off(this.engine, "collisionEnd");
    }
    Matter.Events.on(this.engine, "collisionStart", (event: { pairs: { bodyA: MatterBody; bodyB: MatterBody }[] }) => {
      this.handlePairs(event.pairs, "start");
    });
    Matter.Events.on(this.engine, "collisionActive", (event: { pairs: { bodyA: MatterBody; bodyB: MatterBody }[] }) => {
      this.handlePairs(event.pairs, "active");
    });
    Matter.Events.on(this.engine, "collisionEnd", (event: { pairs: { bodyA: MatterBody; bodyB: MatterBody }[] }) => {
      this.handlePairs(event.pairs, "end");
    });
    this.listenersBound = true;
  }

  private handlePairs(pairs: { bodyA: MatterBody; bodyB: MatterBody }[], phase: "start" | "active" | "end"): void {
    for (const pair of pairs) {
      const labels = [pair.bodyA.label, pair.bodyB.label];
      const wheel = labels.includes("rear-wheel") ? "rear" : labels.includes("front-wheel") ? "front" : null;
      if (wheel && labels.includes("terrain")) {
        const terrain = otherBody(pair, wheel === "rear" ? "rear-wheel" : "front-wheel");
        if (phase === "end") this.contacts.remove(wheel, terrain.id);
        else this.contacts.add(wheel, terrain.id);
      }
      if ((phase === "start" || phase === "active") && pairBodies(pair, "rider-head", "terrain")) {
        this.crashIfPlaying();
      }
    }
  }

  private detectHeadCrash(): void {
    if (!this.bike) return;
    const hits = Matter.Query.collides(this.bike.head, this.terrainBodies);
    if (hits.length > 0) this.crashIfPlaying();
  }

  private crashIfPlaying(): void {
    if (this.state !== "PLAYING" && this.state !== "OUT_OF_FUEL_COASTING") return;
    if (!this.machine.transition("CRASHED", { strict: this.strictTransitions, onInvalid: () => this.invalidTransition() })) {
      return;
    }
    this.machine.resultReason = "head_crash";
    this.engine.timing.timeScale = CRASH.TIME_SCALE;
    this.machine.presentationTicks = 0;
    this.stunt.abort();
    this.releaseAllInput();
  }

  private collectOverlappingPickups(): void {
    if (!this.bike) return;
    const collectors = [this.bike.chassis, this.bike.rearWheel, this.bike.frontWheel];
    const ids: string[] = [];
    for (const [id, body] of this.pickupBodies) {
      if (!this.pickups.activeIds.has(id)) continue;
      const hits = Matter.Query.collides(body, collectors);
      if (hits.length > 0) ids.push(id);
    }
    this.applyCollections(this.pickups.collect(ids));
  }

  private applyCollections(entries: PickupManifestEntry[]): void {
    for (const entry of entries) {
      const body = this.pickupBodies.get(entry.id);
      if (body) {
        Matter.World.remove(this.engine.world, body);
        this.pickupBodies.delete(entry.id);
      }
      if (entry.kind === "fuel") {
        this.fuel.collect();
        this.score.addFuelPickup(FUEL.PICKUP_SCORE);
      } else {
        this.score.addCoin(entry.value);
      }
      this.telemetry.emit(this.tick, "pickup_collected", {
        id: entry.id,
        type: entry.kind === "fuel" ? "fuel" : entry.coinType,
        value: entry.kind === "fuel" ? FUEL.PICKUP_SCORE : entry.value,
        tick: this.tick,
        x: this.bike?.chassis.position.x,
        y: this.bike?.chassis.position.y,
      });
      this.notifications.push({
        text: entry.kind === "fuel" ? `FUEL +${FUEL.PICKUP_AMOUNT}` : `+${entry.value}`,
        x: this.bike?.chassis.position.x ?? 0,
        y: this.bike?.chassis.position.y ?? 0,
        bornTick: this.tick,
        lifeTicks: 90,
      });
      if (entry.kind === "fuel") {
        this.notifications.push({
          text: "+200",
          x: this.bike?.chassis.position.x ?? 0,
          y: (this.bike?.chassis.position.y ?? 0) + 24,
          bornTick: this.tick,
          lifeTicks: 90,
        });
      }
    }
  }

  private updateStunts(contact: { airborneJustStarted: boolean; landed: boolean; airborne: boolean }): void {
    if (!this.bike) return;
    if (contact.airborneJustStarted) {
      this.telemetry.emit(this.tick, "airtime_started");
      this.applyAwards(this.stunt.beginAirborne(this.bike.chassis.angle));
      return;
    }
    if (this.stunt.airborne && contact.airborne) {
      this.applyAwards(this.stunt.tickAirborne(this.bike.chassis.angle));
    }
    if (contact.landed) {
      this.stunt.land();
      this.telemetry.emit(this.tick, "landed");
    }
  }

  private applyAwards(awards: { kind: "airtime" | "front_flip" | "back_flip"; label: string; points: number }[]): void {
    for (const award of awards) {
      if (award.kind === "airtime") this.score.addAirtime(award.points);
      else this.score.addRotation(award.points);
      this.telemetry.emit(this.tick, "stunt_awarded", { kind: award.kind, label: award.label, points: award.points });
      this.notifications.push({
        text: `${award.label} +${award.points}`,
        x: this.bike?.chassis.position.x ?? 0,
        y: this.bike?.chassis.position.y ?? 0,
        bornTick: this.tick,
        lifeTicks: 90,
      });
    }
  }

  private enterOutOfFuel(): void {
    if (!this.machine.transition("OUT_OF_FUEL_COASTING", { strict: this.strictTransitions, onInvalid: () => this.invalidTransition() })) {
      return;
    }
    this.fuel.emptyAnnounced = true;
    this.fuel.coastTicks = 0;
    this.fuel.lowSpeedTicks = 0;
    this.telemetry.emit(this.tick, "fuel_empty");
  }

  private checkOutOfFuelEnd(): void {
    if (this.state !== "OUT_OF_FUEL_COASTING" || !this.bike) return;
    this.fuel.coastTicks += 1;
    const speed = Math.hypot(
      pixelsPerTickToMps(this.bike.chassis.velocity.x),
      pixelsPerTickToMps(this.bike.chassis.velocity.y),
    );
    if (speed < OUT_OF_FUEL.STOP_SPEED_MPS) this.fuel.lowSpeedTicks += 1;
    else this.fuel.lowSpeedTicks = 0;
    if (this.fuel.lowSpeedTicks >= OUT_OF_FUEL.STOP_TICKS || this.fuel.coastTicks >= OUT_OF_FUEL.HARD_TIMEOUT_TICKS) {
      this.endRun("out_of_fuel");
    }
  }

  private checkFinish(): void {
    if (!this.bike) return;
    if (this.state !== "PLAYING" && this.state !== "OUT_OF_FUEL_COASTING") return;
    const x = this.bike.chassis.position.x;
    if (this.previousChassisX < FINISH_X_PX && x >= FINISH_X_PX) {
      if (this.machine.transition("COMPLETED", { strict: this.strictTransitions, onInvalid: () => this.invalidTransition() })) {
        this.machine.resultReason = "finish";
        this.machine.presentationTicks = 0;
        this.stunt.abort();
      }
    }
  }

  private checkBounds(): void {
    if (!this.bike) return;
    const distance = clamp(distanceFromChassisX(this.bike.chassis.position.x), 0, 1520);
    const expectedY = terrainYpx(terrainHeightM(this.levelId, distance));
    if (this.bike.chassis.position.y > expectedY + metersToPixels(BOUNDS.FALL_DEPTH_M)) {
      this.fallTicks += 1;
    } else {
      this.fallTicks = 0;
    }
    if (this.fallTicks >= BOUNDS.FALL_TICKS) this.endRun("out_of_bounds");
  }

  private endRun(reason: ResultReason): void {
    this.machine.resultReason = reason;
    if (reason === "out_of_fuel" || reason === "out_of_bounds" || reason === "simulation_fault" || reason === "abandoned") {
      this.machine.transition("RESULTS", {
        strict: reason !== "abandoned" && this.strictTransitions,
        onInvalid: () => this.invalidTransition(),
      });
      if (reason === "abandoned") {
        this.machine.state = "ABANDONED";
      }
    }
    void this.emitRunEnded();
  }

  private emitRunStarted(): void {
    this.telemetry.emit(this.tick, "run_started", {
      specVersion: SPEC_VERSION,
      levelId: this.levelId,
      seed: this.level.seed,
      viewport: this.viewport,
      userAgent: this.userAgent,
      dependencyFingerprint: this.dependencyFingerprint,
    });
  }

  private async emitHash(): Promise<void> {
    const hash = await this.getStateHash();
    this.telemetry.emit(this.tick, "state_hash", { hash });
  }

  private async emitRunEnded(): Promise<void> {
    const hash = await this.getStateHash();
    this.telemetry.emit(this.tick, "run_ended", {
      reason: this.machine.resultReason,
      ticks: this.tick,
      simulatedDuration: this.tick / SIM_HZ,
      ...this.score.snapshot(),
      distance: this.score.maxDistanceM,
      fuel: this.fuel.value,
      pickupCounts: {
        coins: this.pickups.collectedIds().filter((id) => id.startsWith("coin-")).length,
        fuel: this.pickups.collectedIds().filter((id) => id.startsWith("fuel-")).length,
      },
      finalStateHash: hash,
    });
  }

  private invalidTransition(): void {
    this.telemetry.emit(this.tick, "invalid_state_transition", { state: this.state });
  }

  private requireBike(): BikeBodies {
    if (!this.bike) throw new Error("bike not created");
    return this.bike;
  }

  private teardownPhysics(): void {
    if (this.listenersBound) {
      Matter.Events.off(this.engine, "collisionStart");
      Matter.Events.off(this.engine, "collisionActive");
      Matter.Events.off(this.engine, "collisionEnd");
      this.listenersBound = false;
    }
    clearWorld(this.engine);
    this.bike = null;
    this.terrainBodies = [];
    this.pickupBodies.clear();
    this.finishBody = null;
  }
}

function createRunId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `run-${Date.now()}-${Math.floor(performance.now())}`;
}
