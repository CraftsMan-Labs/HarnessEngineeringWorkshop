import { describe, expect, it } from "vitest";
import { FUEL } from "../../src/config/gameConfig";
import { applyFuelBurn, applyFuelPickup } from "../../src/systems/FuelSystem";

describe("fuel", () => {
  it("burns idle, throttle, brake, and mixed amounts", () => {
    let idle = 100;
    let throttle = 100;
    let brake = 100;
    let mixed = 100;
    for (let i = 0; i < 60; i += 1) {
      idle = applyFuelBurn(idle, { throttle: 0, brake: 0 });
      throttle = applyFuelBurn(throttle, { throttle: 1, brake: 0 });
      brake = applyFuelBurn(brake, { throttle: 0, brake: 1 });
      mixed = applyFuelBurn(mixed, { throttle: 0.5, brake: 0.5 });
    }
    expect(idle).toBeCloseTo(99.8, 4);
    expect(throttle).toBeCloseTo(99.0, 4);
    expect(brake).toBeCloseTo(99.45, 4);
    expect(mixed).toBeCloseTo(100 - (0.2 + 0.4 + 0.175), 4);
  });

  it("caps pickup fuel and keeps the canonical refill amount", () => {
    expect(applyFuelPickup(80)).toBe(FUEL.CAPACITY);
    expect(applyFuelPickup(10)).toBe(45);
  });
});
