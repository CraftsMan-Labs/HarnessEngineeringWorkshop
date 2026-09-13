import {
  AIRTIME_REPEAT,
  AIRTIME_THRESHOLDS,
  ROTATION,
  normalizeToMinusPiThroughPi,
} from "../config/gameConfig";
import type { AwardEvent, StuntSnapshot } from "../types/game";

export function airtimeAward(baseIncrement: number, multiplier: number): number {
  return Math.floor(baseIncrement * multiplier + 0.5);
}

export class StuntSystem {
  airborne = false;
  airtimeTicks = 0;
  rotationAccumulator = 0;
  previousAngle = 0;
  awardedAirtimeThresholds: number[] = [];
  private multiplier = 1;

  reset(multiplier = 1): void {
    this.airborne = false;
    this.airtimeTicks = 0;
    this.rotationAccumulator = 0;
    this.previousAngle = 0;
    this.awardedAirtimeThresholds = [];
    this.multiplier = multiplier;
  }

  setMultiplier(multiplier: number): void {
    this.multiplier = multiplier;
  }

  beginAirborne(angle: number): AwardEvent[] {
    this.airborne = true;
    this.airtimeTicks = 1;
    this.rotationAccumulator = 0;
    this.previousAngle = angle;
    this.awardedAirtimeThresholds = [];
    return this.collectAwards(0);
  }

  tickAirborne(angle: number): AwardEvent[] {
    if (!this.airborne) {
      return this.beginAirborne(angle);
    }
    const delta = normalizeToMinusPiThroughPi(angle - this.previousAngle);
    this.rotationAccumulator += delta;
    this.previousAngle = angle;
    this.airtimeTicks += 1;
    return this.collectAwards(0);
  }

  applySyntheticTick(angle: number): AwardEvent[] {
    if (!this.airborne) {
      this.airborne = true;
      this.airtimeTicks = 0;
      this.rotationAccumulator = 0;
      this.previousAngle = angle;
      this.awardedAirtimeThresholds = [];
    }
    const delta = normalizeToMinusPiThroughPi(angle - this.previousAngle);
    this.rotationAccumulator += delta;
    this.previousAngle = angle;
    this.airtimeTicks += 1;
    return this.collectAwards(0);
  }

  land(): void {
    this.airborne = false;
    this.airtimeTicks = 0;
    this.rotationAccumulator = 0;
    this.awardedAirtimeThresholds = [];
  }

  abort(): void {
    this.land();
  }

  snapshot(): StuntSnapshot {
    return {
      airborne: this.airborne,
      airtimeTicks: this.airtimeTicks,
      rotationAccumulator: this.rotationAccumulator,
      awardedAirtimeThresholds: [...this.awardedAirtimeThresholds],
    };
  }

  private collectAwards(tick: number): AwardEvent[] {
    const awards: AwardEvent[] = [];
    for (const threshold of AIRTIME_THRESHOLDS) {
      if (this.airtimeTicks >= threshold.tick && !this.awardedAirtimeThresholds.includes(threshold.tick)) {
        this.awardedAirtimeThresholds.push(threshold.tick);
        awards.push({
          kind: "airtime",
          label: threshold.label,
          points: airtimeAward(threshold.increment, this.multiplier),
          tick,
        });
      }
    }
    if (this.airtimeTicks > AIRTIME_REPEAT.startTick) {
      const extra = this.airtimeTicks - AIRTIME_REPEAT.startTick;
      const extrasAwarded = Math.floor(extra / AIRTIME_REPEAT.interval);
      for (let i = 1; i <= extrasAwarded; i += 1) {
        const key = AIRTIME_REPEAT.startTick + i * AIRTIME_REPEAT.interval;
        if (!this.awardedAirtimeThresholds.includes(key)) {
          this.awardedAirtimeThresholds.push(key);
          awards.push({
            kind: "airtime",
            label: AIRTIME_REPEAT.label,
            points: airtimeAward(AIRTIME_REPEAT.increment, this.multiplier),
            tick,
          });
        }
      }
    }

    const twoPi = Math.PI * 2;
    while (this.rotationAccumulator >= twoPi) {
      this.rotationAccumulator -= twoPi;
      awards.push({
        kind: "front_flip",
        label: "FRONT FLIP",
        points: ROTATION.FRONT_FLIP_SCORE,
        tick,
      });
    }
    while (this.rotationAccumulator <= -twoPi) {
      this.rotationAccumulator += twoPi;
      awards.push({
        kind: "back_flip",
        label: "BACK FLIP",
        points: ROTATION.BACK_FLIP_SCORE,
        tick,
      });
    }
    return awards;
  }
}
