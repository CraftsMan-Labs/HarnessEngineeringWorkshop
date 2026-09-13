import { TERRAIN, clamp, lerp } from "../config/gameConfig";
import type { LevelId } from "../types/game";

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function greenRaw(x: number): number {
  const progression = 1 + 0.35 * clamp(x / 1500, 0, 1);
  return (
    progression *
      (2.15 * Math.sin(x / 13.0) +
        1.05 * Math.sin(x / 5.3 + 0.7) +
        0.42 * Math.sin(x / 2.15 + 1.9)) +
    0.0015 * x
  );
}

export function moonBase(x: number): number {
  return (
    2.8 * Math.sin(x / 19.0 + 0.35) +
    1.2 * Math.sin(x / 7.25 + 1.4) +
    0.35 * Math.sin(x / 2.8)
  );
}

export function craterCenter(k: number): number {
  return 42 + 58 * k;
}

export function craterRadius(k: number): number {
  return 5.5 + 1.5 * ((k * 7) % 4);
}

export function craterDepth(k: number): number {
  return 1.4 + 0.35 * ((k * 3) % 5);
}

export function craterContribution(x: number, c: number, r: number, d: number): number {
  const u = Math.abs(x - c) / r;
  if (u >= 1) return 0;
  const bowl = (1 - u * u) ** 2;
  return -d * bowl;
}

export function moonRaw(x: number): number {
  let height = moonBase(x);
  for (let k = 0; craterCenter(k) < 1460; k += 1) {
    height += craterContribution(x, craterCenter(k), craterRadius(k), craterDepth(k));
  }
  return height;
}

function blendProfile(x: number, rawAt: (value: number) => number): number {
  if (x >= TERRAIN.FINISH_BLEND_END_M) {
    return rawAt(TERRAIN.FINISH_BLEND_START_M);
  }
  const startBlend = smoothstep(TERRAIN.START_FLAT_END_M, TERRAIN.START_BLEND_END_M, x);
  const profile = startBlend * rawAt(x);
  if (x >= TERRAIN.FINISH_BLEND_START_M) {
    const finishHeight = rawAt(TERRAIN.FINISH_BLEND_START_M);
    return lerp(profile, finishHeight, smoothstep(TERRAIN.FINISH_BLEND_START_M, TERRAIN.FINISH_BLEND_END_M, x));
  }
  return profile;
}

export function greenHeight(x: number): number {
  return blendProfile(x, greenRaw);
}

export function moonHeight(x: number): number {
  return blendProfile(x, moonRaw);
}

export function terrainHeightM(levelId: LevelId, distanceM: number): number {
  return levelId === "moon-run" ? moonHeight(distanceM) : greenHeight(distanceM);
}
