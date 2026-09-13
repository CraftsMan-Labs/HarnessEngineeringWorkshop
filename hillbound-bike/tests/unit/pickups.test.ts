import { describe, expect, it } from "vitest";
import { COIN } from "../../src/config/gameConfig";
import { terrainHeightM } from "../../src/terrain/terrainHeight";
import {
  coinValue,
  fuelDistances,
  generatePickupManifest,
  PickupSystem,
} from "../../src/systems/PickupSystem";

describe("pickups", () => {
  it("places fuel at the canonical distances", () => {
    expect(fuelDistances()).toEqual([180, 390, 600, 810, 1020, 1230, 1440]);
  });

  it("gives a complete coin group 210 points", () => {
    const total =
      coinValue("bronze") * 6 + coinValue("silver") * 2 + coinValue("gold");
    expect(total).toBe(COIN.GROUP_TOTAL);
  });

  it("generates deterministic unique manifests above terrain", () => {
    const a = generatePickupManifest("green-hills");
    const b = generatePickupManifest("green-hills");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const ids = a.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(a.every((entry) => entry.heightM > terrainHeightM("green-hills", entry.distanceM))).toBe(true);
  });

  it("collects a pickup only once", () => {
    const system = new PickupSystem();
    system.load("green-hills");
    const gold = system.manifest.find((entry) => entry.coinType === "gold");
    expect(gold).toBeTruthy();
    const first = system.collect([gold!.id, gold!.id]);
    const second = system.collect([gold!.id]);
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
  });
});
