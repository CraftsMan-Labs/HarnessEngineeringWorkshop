import { describe, expect, it } from "vitest";
import { START_X_PX, PX_PER_METER } from "../../src/config/gameConfig";
import { ScoreSystem, updateMaxDistance } from "../../src/systems/ScoreSystem";
import { StuntSystem } from "../../src/systems/StuntSystem";

describe("distance and stunts", () => {
  it("keeps distance monotonic", () => {
    const score = new ScoreSystem();
    score.observeChassisX(START_X_PX + 10.9 * PX_PER_METER);
    expect(score.displayDistanceM).toBe(10);
    score.observeChassisX(START_X_PX + 14.2 * PX_PER_METER);
    expect(score.displayDistanceM).toBe(14);
    score.observeChassisX(START_X_PX + 12.0 * PX_PER_METER);
    expect(score.displayDistanceM).toBe(14);
    expect(score.distanceScore).toBe(14);
    expect(updateMaxDistance(14.2, START_X_PX + 12 * PX_PER_METER)).toBe(14.2);
  });

  it("awards green airtime milestones", () => {
    const stunt = new StuntSystem();
    stunt.reset(1);
    const score = new ScoreSystem();
    const at: number[] = [];
    for (let i = 0; i < 270; i += 1) {
      for (const award of stunt.applySyntheticTick(0)) {
        if (award.kind === "airtime") score.addAirtime(award.points);
      }
      if ([44, 45, 89, 90, 149, 150, 210, 270].includes(stunt.airtimeTicks)) {
        at.push(score.airtimeScore);
      }
    }
    expect(at).toEqual([0, 25, 25, 75, 75, 175, 275, 375]);
  });

  it("awards moon airtime milestones", () => {
    const stunt = new StuntSystem();
    stunt.reset(1.5);
    const score = new ScoreSystem();
    const check = new Map<number, number>();
    for (let i = 0; i < 270; i += 1) {
      for (const award of stunt.applySyntheticTick(0)) {
        if (award.kind === "airtime") score.addAirtime(award.points);
      }
      if ([45, 90, 150, 210, 270].includes(stunt.airtimeTicks)) {
        check.set(stunt.airtimeTicks, score.airtimeScore);
      }
    }
    expect(check.get(45)).toBe(38);
    expect(check.get(90)).toBe(113);
    expect(check.get(150)).toBe(263);
    expect(check.get(210)).toBe(413);
    expect(check.get(270)).toBe(563);
  });

  it("counts two front flips and one back flip", () => {
    const front = new StuntSystem();
    front.reset(1);
    const score = new ScoreSystem();
    const steps = 80;
    const total = 4 * Math.PI + 0.01;
    front.applySyntheticTick(0);
    for (let i = 1; i <= steps; i += 1) {
      for (const award of front.applySyntheticTick((total * i) / steps)) {
        if (award.kind !== "airtime") score.addRotation(award.points);
      }
    }
    expect(score.rotationScore).toBe(500);
    expect(front.snapshot().airtimeTicks).toBeGreaterThan(0);

    const back = new StuntSystem();
    const backScore = new ScoreSystem();
    const backTotal = -2 * Math.PI - 0.01;
    back.applySyntheticTick(0);
    for (let i = 1; i <= 40; i += 1) {
      for (const award of back.applySyntheticTick((backTotal * i) / 40)) {
        if (award.kind !== "airtime") backScore.addRotation(award.points);
      }
    }
    expect(backScore.rotationScore).toBe(300);
  });

  it("does not score a reversed partial rotation", () => {
    const stunt = new StuntSystem();
    const score = new ScoreSystem();
    for (let i = 1; i <= 20; i += 1) {
      for (const award of stunt.applySyntheticTick((1.5 * Math.PI * i) / 20)) {
        if (award.kind !== "airtime") score.addRotation(award.points);
      }
    }
    for (let i = 1; i <= 20; i += 1) {
      for (const award of stunt.applySyntheticTick((1.5 * Math.PI * (20 - i)) / 20)) {
        if (award.kind !== "airtime") score.addRotation(award.points);
      }
    }
    stunt.land();
    expect(score.rotationScore).toBe(0);
  });

  it("unwraps a Matter angle wrap as one front flip", () => {
    const stunt = new StuntSystem();
    const score = new ScoreSystem();
    const steps = 40;
    stunt.applySyntheticTick(0);
    for (let i = 1; i <= steps; i += 1) {
      const raw = (2 * Math.PI * i) / steps;
      const wrapped = Math.atan2(Math.sin(raw), Math.cos(raw));
      for (const award of stunt.applySyntheticTick(wrapped)) {
        if (award.kind === "front_flip") score.addRotation(award.points);
      }
    }
    expect(score.rotationScore).toBe(250);
  });
});
