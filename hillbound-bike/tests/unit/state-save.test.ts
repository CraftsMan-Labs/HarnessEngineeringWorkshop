import { describe, expect, it } from "vitest";
import { normalizeToMinusPiThroughPi } from "../../src/config/gameConfig";
import { LEVELS } from "../../src/config/levels";
import { serializeCanonicalState } from "../../src/systems/canonicalState";
import { defaultSave, parseSave, recordResult } from "../../src/systems/persistence";
import { InvalidStateTransitionError, RunStateMachine, canTransition } from "../../src/systems/RunStateMachine";
import type { CanonicalState } from "../../src/types/game";

describe("state machine and save", () => {
  it("allows the specified transitions and rejects others", () => {
    expect(canTransition("MENU", "PLAYING")).toBe(true);
    expect(canTransition("PLAYING", "PAUSED")).toBe(true);
    expect(canTransition("PAUSED", "PLAYING")).toBe(true);
    expect(canTransition("PAUSED", "MENU")).toBe(false);
    const machine = new RunStateMachine();
    machine.resetToMenu();
    expect(() => machine.transition("CRASHED", { strict: true })).toThrow(InvalidStateTransitionError);
  });

  it("recovers from corrupt save data", () => {
    expect(parseSave("not-json")).toEqual(defaultSave());
    expect(parseSave(JSON.stringify({ version: 2, muted: true }))).toEqual(defaultSave());
    const saved = recordResult(defaultSave(), "green-hills", 12.349, 88);
    expect(saved.levels["green-hills"].bestDistanceM).toBe(12.35);
    expect(saved.levels["green-hills"].bestScore).toBe(88);
  });

  it("serializes canonical state with ordered keys and rounded numbers", () => {
    const state: CanonicalState = {
      tick: 60,
      levelId: "green-hills",
      seed: LEVELS["green-hills"].seed,
      runState: "PLAYING",
      chassis: { x: 1.23456, y: -0, vx: 0, vy: 0, angle: 0.12345, angularVelocity: 0 },
      rearWheel: { x: 0, y: 0, vx: 0, vy: 0, angle: 0, angularVelocity: 0 },
      frontWheel: { x: 0, y: 0, vx: 0, vy: 0, angle: 0, angularVelocity: 0 },
      fuel: 99.80123,
      score: 10,
      maxDistanceM: 1.23999,
      collectedPickupIds: ["coin-b", "coin-a"],
      stunt: { airborne: false, airtimeTicks: 0, rotationAccumulator: 0, awardedAirtimeThresholds: [] },
    };
    const json = serializeCanonicalState(state);
    const parsed = JSON.parse(json) as CanonicalState;
    expect(Object.keys(parsed)).toEqual([
      "tick",
      "levelId",
      "seed",
      "runState",
      "chassis",
      "rearWheel",
      "frontWheel",
      "fuel",
      "score",
      "maxDistanceM",
      "collectedPickupIds",
      "stunt",
    ]);
    expect(parsed.chassis.x).toBe(1.2346);
    expect(parsed.chassis.y).toBe(0);
    expect(parsed.collectedPickupIds).toEqual(["coin-a", "coin-b"]);
    expect(normalizeToMinusPiThroughPi(Math.PI + 0.1)).toBeLessThanOrEqual(Math.PI);
  });
});
