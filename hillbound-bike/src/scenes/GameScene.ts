import Phaser from "phaser";
import {
  CAMERA,
  FINISH_X_PX,
  FIXED_DT_MS,
  MAX_CATCH_UP_TICKS,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
  metersToPixels,
  terrainXpx,
  terrainYpx,
} from "../config/gameConfig";
import { getRuntime } from "../gameContext";
import { drawBackground, drawFinish, drawTerrain } from "../terrain/terrainRenderer";
import { terrainHeightM } from "../terrain/terrainHeight";
import { CHASSIS, RIDER_HEAD, WHEEL } from "../config/gameConfig";

export class GameScene extends Phaser.Scene {
  private accumulator = 0;
  private background!: Phaser.GameObjects.Graphics;
  private terrainGfx!: Phaser.GameObjects.Graphics;
  private finishGfx!: Phaser.GameObjects.Graphics;
  private bikeGfx!: Phaser.GameObjects.Graphics;
  private pickupGfx!: Phaser.GameObjects.Graphics;
  private lastState = "";

  constructor() {
    super("GameScene");
  }

  create(): void {
    this.accumulator = 0;
    this.background = this.add.graphics();
    this.terrainGfx = this.add.graphics();
    this.finishGfx = this.add.graphics();
    this.pickupGfx = this.add.graphics();
    this.bikeGfx = this.add.graphics();
    this.cameras.main.setSize(VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
    this.cameras.main.setZoom(CAMERA.zoom);
    this.redrawStatic();
    this.snapCamera();
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.SHUTDOWN);
    });
  }

  update(_time: number, delta: number): void {
    const runtime = getRuntime();
    if (runtime.world.state === "RESULTS" && this.lastState !== "RESULTS") {
      runtime.persistResults();
      runtime.refreshUi();
      this.scene.start("ResultsScene");
      this.lastState = runtime.world.state;
      return;
    }
    this.lastState = runtime.world.state;

    if (!runtime.flags.manual && runtime.world.state !== "PAUSED") {
      this.accumulator += delta;
      let steps = 0;
      while (this.accumulator >= FIXED_DT_MS && steps < MAX_CATCH_UP_TICKS) {
        runtime.world.stepTick();
        this.accumulator -= FIXED_DT_MS;
        steps += 1;
      }
      if (this.accumulator >= FIXED_DT_MS) {
        this.accumulator = 0;
        runtime.world.telemetry.emit(runtime.world.tick, "simulation_time_dropped");
      }
    }

    if (runtime.world.state === "RESULTS") {
      runtime.persistResults();
      runtime.refreshUi();
      this.scene.start("ResultsScene");
      return;
    }

    this.drawFrame();
    runtime.refreshUi();
    if (runtime.world.bike && runtime.world.state !== "PAUSED") {
      runtime.audio.engine(runtime.world.input.throttle, runtime.world.bike.rearWheel.angularVelocity);
    } else {
      runtime.audio.engine(0, 0);
    }
  }

  private redrawStatic(): void {
    const runtime = getRuntime();
    this.terrainGfx.clear();
    drawTerrain(this.terrainGfx, runtime.world.samples, runtime.world.levelId);
    const finishY = terrainYpx(terrainHeightM(runtime.world.levelId, 1500));
    this.finishGfx.clear();
    drawFinish(this.finishGfx, FINISH_X_PX, finishY);
  }

  private drawFrame(): void {
    const runtime = getRuntime();
    const bike = runtime.world.bike;
    const cameraX = bike?.chassis.position.x ?? 0;
    this.background.clear();
    drawBackground(this.background, runtime.world.levelId, cameraX);
    this.drawPickups();
    this.drawBike();
    this.updateCamera();
  }

  private drawPickups(): void {
    const runtime = getRuntime();
    this.pickupGfx.clear();
    const t = this.time.now / 1000;
    for (const entry of runtime.world.pickups.manifest) {
      if (!runtime.world.pickups.activeIds.has(entry.id)) continue;
      const x = terrainXpx(entry.distanceM);
      const bob = runtime.flags.testMode ? 0 : Math.sin((t * Math.PI * 2) / 1.2) * metersToPixels(0.1);
      const y = terrainYpx(entry.heightM) + bob;
      if (entry.kind === "fuel") {
        this.pickupGfx.fillStyle(0xd7263d, 1);
        this.pickupGfx.fillRoundedRect(x - 10, y - 14, 20, 28, 4);
        this.pickupGfx.fillStyle(0xffffff, 1);
        this.pickupGfx.fillCircle(x, y - 2, 5);
      } else {
        const color = entry.coinType === "gold" ? 0xf4d35e : entry.coinType === "silver" ? 0xd9dde5 : 0xc47c2b;
        this.pickupGfx.fillStyle(color, 1);
        this.pickupGfx.fillCircle(x, y, 8);
      }
    }
  }

  private drawBike(): void {
    const runtime = getRuntime();
    const bike = runtime.world.bike;
    this.bikeGfx.clear();
    if (!bike) return;
    const { chassis, rearWheel, frontWheel, head } = bike;
    this.bikeGfx.lineStyle(4, 0x2b2d42, 1);
    this.bikeGfx.lineBetween(chassis.position.x, chassis.position.y, rearWheel.position.x, rearWheel.position.y);
    this.bikeGfx.lineBetween(chassis.position.x, chassis.position.y, frontWheel.position.x, frontWheel.position.y);
    this.bikeGfx.fillStyle(0x222831, 1);
    this.drawRotatedRect(chassis.position.x, chassis.position.y, metersToPixels(CHASSIS.widthM), metersToPixels(CHASSIS.heightM), chassis.angle);
    this.bikeGfx.fillStyle(0x1b1b1b, 1);
    this.bikeGfx.fillCircle(rearWheel.position.x, rearWheel.position.y, metersToPixels(WHEEL.radiusM));
    this.bikeGfx.fillCircle(frontWheel.position.x, frontWheel.position.y, metersToPixels(WHEEL.radiusM));
    this.bikeGfx.lineStyle(3, 0xe8f1ea, 1);
    this.bikeGfx.strokeCircle(rearWheel.position.x, rearWheel.position.y, metersToPixels(WHEEL.radiusM) * 0.55);
    this.bikeGfx.strokeCircle(frontWheel.position.x, frontWheel.position.y, metersToPixels(WHEEL.radiusM) * 0.55);
    this.bikeGfx.fillStyle(0xf7c59f, 1);
    this.bikeGfx.fillCircle(head.position.x, head.position.y, metersToPixels(RIDER_HEAD.radiusM));
    this.bikeGfx.fillStyle(0x2b2d42, 1);
    this.bikeGfx.fillCircle(head.position.x, head.position.y - 4, metersToPixels(RIDER_HEAD.radiusM) * 0.7);
  }

  private drawRotatedRect(x: number, y: number, w: number, h: number, angle: number): void {
    const hw = w / 2;
    const hh = h / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const pts = [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ].map(([px, py]) => [x + px * cos - py * sin, y + px * sin + py * cos] as const);
    this.bikeGfx.beginPath();
    this.bikeGfx.moveTo(pts[0][0], pts[0][1]);
    for (const point of pts) this.bikeGfx.lineTo(point[0], point[1]);
    this.bikeGfx.closePath();
    this.bikeGfx.fillPath();
  }

  private cameraTarget(): { x: number; y: number } | null {
    const bike = getRuntime().world.bike;
    if (!bike) return null;
    const cam = this.cameras.main;
    return {
      x: bike.chassis.position.x - VIEWPORT_WIDTH * CAMERA.followX,
      y: bike.chassis.position.y - VIEWPORT_HEIGHT * CAMERA.followY,
    };
  }

  private snapCamera(): void {
    const target = this.cameraTarget();
    if (!target) return;
    this.cameras.main.scrollX = target.x;
    this.cameras.main.scrollY = target.y;
  }

  private updateCamera(): void {
    const target = this.cameraTarget();
    if (!target) return;
    const runtime = getRuntime();
    const cam = this.cameras.main;
    const lerp = runtime.reducedMotion ? 1 : CAMERA.lerp;
    cam.scrollX += (target.x - cam.scrollX) * lerp;
    cam.scrollY += (target.y - cam.scrollY) * lerp;
  }
}
