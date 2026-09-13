import { describe, expect, it } from "vitest";
import { TERRAIN_END_M } from "../../src/config/gameConfig";
import { sampleTerrain } from "../../src/terrain/terrainGeometry";
import { greenHeight, moonHeight, smoothstep } from "../../src/terrain/terrainHeight";

describe("terrain", () => {
  it("smoothstep is 0/1 at endpoints and clamped outside", () => {
    expect(smoothstep(14, 26, 14)).toBe(0);
    expect(smoothstep(14, 26, 26)).toBe(1);
    expect(smoothstep(14, 26, 0)).toBe(0);
    expect(smoothstep(14, 26, 40)).toBe(1);
  });

  it("is flat for the first 14 m", () => {
    expect(greenHeight(0)).toBe(0);
    expect(greenHeight(14)).toBe(0);
    expect(moonHeight(0)).toBe(0);
    expect(moonHeight(14)).toBe(0);
  });

  it("has a rising profile in the middle and a flat finish", () => {
    expect(Math.abs(greenHeight(200))).toBeGreaterThan(0);
    expect(greenHeight(1500)).toBe(greenHeight(1520));
    expect(moonHeight(1500)).toBe(moonHeight(1510));
  });

  it("samples are finite and deterministic", () => {
    const a = sampleTerrain("green-hills");
    const b = sampleTerrain("green-hills");
    expect(JSON.stringify(a.map((s) => s.heightM))).toBe(JSON.stringify(b.map((s) => s.heightM)));
    expect(a[0].heightM).toBe(0);
    expect(a.every((sample) => Number.isFinite(sample.heightM))).toBe(true);
    expect(a.at(-1)?.distanceM).toBe(TERRAIN_END_M);
    const moonA = sampleTerrain("moon-run");
    const moonB = sampleTerrain("moon-run");
    expect(JSON.stringify(moonA)).toBe(JSON.stringify(moonB));
  });
});
