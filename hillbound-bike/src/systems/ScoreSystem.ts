import { START_X_PX, PX_PER_METER } from "../config/gameConfig";
import type { ScoreComponents } from "../types/game";

export function updateMaxDistance(previousMaxDistanceM: number, chassisX: number): number {
  return Math.max(previousMaxDistanceM, Math.max(0, (chassisX - START_X_PX) / PX_PER_METER));
}

export class ScoreSystem {
  maxDistanceM = 0;
  coinScore = 0;
  fuelPickupScore = 0;
  airtimeScore = 0;
  rotationScore = 0;

  reset(): void {
    this.maxDistanceM = 0;
    this.coinScore = 0;
    this.fuelPickupScore = 0;
    this.airtimeScore = 0;
    this.rotationScore = 0;
  }

  observeChassisX(chassisX: number): void {
    this.maxDistanceM = updateMaxDistance(this.maxDistanceM, chassisX);
  }

  addCoin(value: number): void {
    this.coinScore += value;
  }

  addFuelPickup(value: number): void {
    this.fuelPickupScore += value;
  }

  addAirtime(value: number): void {
    this.airtimeScore += value;
  }

  addRotation(value: number): void {
    this.rotationScore += value;
  }

  get displayDistanceM(): number {
    return Math.floor(this.maxDistanceM);
  }

  get distanceScore(): number {
    return Math.floor(this.maxDistanceM);
  }

  get totalScore(): number {
    return (
      this.distanceScore +
      this.coinScore +
      this.fuelPickupScore +
      this.airtimeScore +
      this.rotationScore
    );
  }

  snapshot(): ScoreComponents {
    return {
      distanceScore: this.distanceScore,
      coinScore: this.coinScore,
      fuelPickupScore: this.fuelPickupScore,
      airtimeScore: this.airtimeScore,
      rotationScore: this.rotationScore,
      totalScore: this.totalScore,
    };
  }
}
