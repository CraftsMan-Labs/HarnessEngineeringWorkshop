/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import { LEVELS } from "../../src/config/levels";
import { FIXED_DT_MS } from "../../src/config/gameConfig";
import { Matter, createMatterEngine, setGravity } from "../../src/physics/matter";
import { GameWorld } from "../../src/systems/GameWorld";
import { WHEEL } from "../../src/config/gameConfig";

function play(levelId: "green-hills" | "moon-run"): GameWorld {
  const world = new GameWorld({ testMode: true, manual: true, strictTransitions: true });
  world.startRun(levelId);
  return world;
}

describe("simulation", () => {
  it("builds the specified bike composite", () => {
    const world = play("green-hills");
    expect(world.bike).toBeTruthy();
    expect(world.bike?.constraints).toHaveLength(4);
    expect(world.bike?.rearWheel.circleRadius).toBeCloseTo(world.bike!.frontWheel.circleRadius ?? 0, 6);
    expect(world.bike?.rearWheel.circleRadius).toBeCloseTo(WHEEL.radiusM * 64, 5);
    expect(world.bike?.head.isSensor).toBe(true);
  });

  it("uses a 16.5% gravity ratio", () => {
    expect(LEVELS["green-hills"].gravityScale).toBe(0.001);
    expect(LEVELS["moon-run"].gravityScale).toBe(0.000165);
    const green = createMatterEngine();
    const moon = createMatterEngine();
    setGravity(green, 0, 1, 0.001);
    setGravity(moon, 0, 1, 0.000165);
    const greenBody = Matter.Bodies.circle(0, 0, 10, { frictionAir: 0 });
    const moonBody = Matter.Bodies.circle(0, 0, 10, { frictionAir: 0 });
    Matter.Body.setInertia(greenBody, Infinity);
    Matter.Body.setInertia(moonBody, Infinity);
    Matter.World.add(green.world, greenBody);
    Matter.World.add(moon.world, moonBody);
    for (let i = 0; i < 120; i += 1) {
      Matter.Engine.update(green, FIXED_DT_MS);
      Matter.Engine.update(moon, FIXED_DT_MS);
    }
    const dGreen = greenBody.position.y;
    const dMoon = moonBody.position.y;
    expect(dMoon / dGreen).toBeCloseTo(0.165, 2);
  });

  it("powers only the rear wheel", () => {
    const world = play("green-hills");
    world.setInput({ throttle: 1, brake: 0 });
    const rear0 = world.bike!.rearWheel.angularVelocity;
    const front0 = world.bike!.frontWheel.angularVelocity;
    world.stepTicks(20);
    expect(world.bike!.rearWheel.angularVelocity).toBeGreaterThan(rear0);
    expect(Math.abs(world.bike!.frontWheel.angularVelocity - front0)).toBeLessThan(
      Math.abs(world.bike!.rearWheel.angularVelocity - rear0),
    );
  });

  it("burns fuel on a fixed 60-tick second", () => {
    const world = play("green-hills");
    world.stepTicks(60);
    expect(world.tick).toBe(60);
    expect(world.fuel.value).toBeCloseTo(99.8, 4);
    world.setInput({ throttle: 1, brake: 0 });
    world.setFuel(100);
    world.stepTicks(60);
    expect(world.fuel.value).toBeCloseTo(99.0, 4);
  });

  it("collects fuel with a cap and ignores duplicates", () => {
    const world = play("green-hills");
    world.setFuel(80);
    const fuelId = world.pickups.manifest.find((entry) => entry.kind === "fuel")!.id;
    world.triggerPickup(fuelId);
    expect(world.fuel.value).toBe(100);
    expect(world.score.fuelPickupScore).toBe(200);
    const before = world.score.totalScore;
    world.triggerPickup(fuelId);
    expect(world.score.totalScore).toBe(before);
    const fresh = play("green-hills");
    fresh.setFuel(10);
    fresh.triggerPickup(fuelId);
    expect(fresh.fuel.value).toBe(45);
  });

  it("collects a gold coin once even if triggered twice", () => {
    const world = play("green-hills");
    const gold = world.pickups.manifest.find((entry) => entry.coinType === "gold")!;
    world.triggerPickup(gold.id);
    world.triggerPickup(gold.id);
    expect(world.score.coinScore).toBe(100);
    expect(world.telemetry.events.filter((event) => event.type === "pickup_collected")).toHaveLength(1);
  });

  it("crashes on head contact and not on chassis scrape", () => {
    const world = play("green-hills");
    world.setBikePose({ distanceM: 30, angle: Math.PI, y: world.bike!.chassis.position.y - 20 });
    let crashed = false;
    for (let i = 0; i < 180 && !crashed; i += 1) {
      world.stepTicks(1);
      crashed = world.state === "CRASHED";
    }
    expect(crashed).toBe(true);
    const fuelAtCrash = world.fuel.value;
    const scoreAtCrash = world.score.totalScore;
    world.stepTicks(10);
    expect(world.fuel.value).toBe(fuelAtCrash);
    expect(world.score.totalScore).toBe(scoreAtCrash);
    world.stepTicks(45);
    expect(world.state).toBe("RESULTS");
    expect(world.machine.resultReason).toBe("head_crash");

    const scrape = play("green-hills");
    scrape.setBikePose({ distanceM: 8, angle: 0.15 });
    scrape.stepTicks(30);
    expect(scrape.state).toBe("PLAYING");
  });

  it("ends an out-of-fuel coast and a finish crossing", () => {
    const empty = play("green-hills");
    empty.setFuel(0.0001);
    empty.setInput({ throttle: 1, brake: 0 });
    empty.stepTicks(1);
    expect(empty.state).toBe("OUT_OF_FUEL_COASTING");
    for (let i = 0; i < 120; i += 1) {
      empty.setBikePose({ distanceM: 6, angle: 0, vx: 0, vy: 0 });
      empty.stepTicks(1);
    }
    expect(empty.machine.resultReason).toBe("out_of_fuel");

    const finish = play("green-hills");
    finish.setBikePose({ distanceM: 1499.2, vx: 8, vy: 0 });
    finish.stepTicks(20);
    expect(["COMPLETED", "RESULTS"]).toContain(finish.state);
    expect(finish.machine.resultReason).toBe("finish");
  });

  it("restarts cleanly and repeats replay hashes", async () => {
    const world = play("green-hills");
    const gold = world.pickups.manifest.find((entry) => entry.coinType === "gold")!;
    world.triggerPickup(gold.id);
    world.beginSyntheticAirborneSequence();
    world.setSyntheticChassisAngle(0.2);
    world.setFuel(80);
    const firstRunId = world.telemetry.runId;
    world.restartRun();
    expect(world.tick).toBe(0);
    expect(world.fuel.value).toBe(100);
    expect(world.score.totalScore).toBe(0);
    expect(world.score.maxDistanceM).toBe(0);
    expect(world.pickups.collectedIds()).toEqual([]);
    expect(world.telemetry.runId).not.toBe(firstRunId);

    const tapeWorld = play("green-hills");
    tapeWorld.setInput({ throttle: 0.35, brake: 0 });
    tapeWorld.stepTicks(600);
    const tape = tapeWorld.replay.exportTape();

    const hashes = async () => {
      const replay = play("green-hills");
      replay.playReplay(tape);
      const collected: string[] = [];
      for (let tick = 60; tick <= 600; tick += 60) {
        replay.stepTicks(60);
        collected.push(await replay.getStateHash());
      }
      return collected;
    };
    const first = await hashes();
    const second = await hashes();
    expect(first).toEqual(second);
  });
});
