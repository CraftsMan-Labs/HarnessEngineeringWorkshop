import { FUEL, SIM_HZ, clamp } from "../config/gameConfig";
import type { ControlState } from "../types/game";

export function fuelBurnPerSecond(input: ControlState): number {
  return (
    FUEL.BASE_BURN_PER_SECOND +
    FUEL.THROTTLE_BURN_PER_SECOND * input.throttle +
    FUEL.BRAKE_BURN_PER_SECOND * input.brake
  );
}

export function applyFuelBurn(fuel: number, input: ControlState): number {
  return clamp(fuel - fuelBurnPerSecond(input) / SIM_HZ, 0, FUEL.CAPACITY);
}

export function applyFuelPickup(fuel: number): number {
  return Math.min(FUEL.CAPACITY, fuel + FUEL.PICKUP_AMOUNT);
}

export function hudFuelPercent(fuel: number): number {
  return Math.ceil(fuel);
}

export class FuelSystem {
  value: number = FUEL.STARTING;
  emptyAnnounced = false;
  coastTicks = 0;
  lowSpeedTicks = 0;

  reset(): void {
    this.value = FUEL.STARTING;
    this.emptyAnnounced = false;
    this.coastTicks = 0;
    this.lowSpeedTicks = 0;
  }

  set(value: number): void {
    this.value = clamp(value, 0, FUEL.CAPACITY);
    if (this.value > 0) {
      this.emptyAnnounced = false;
      this.coastTicks = 0;
      this.lowSpeedTicks = 0;
    }
  }

  burn(input: ControlState): { emptiedThisTick: boolean } {
    const previous = this.value;
    this.value = applyFuelBurn(this.value, input);
    const emptiedThisTick = previous > 0 && this.value === 0;
    return { emptiedThisTick };
  }

  collect(): { fuel: number; score: number } {
    this.value = applyFuelPickup(this.value);
    return { fuel: this.value, score: FUEL.PICKUP_SCORE };
  }
}
