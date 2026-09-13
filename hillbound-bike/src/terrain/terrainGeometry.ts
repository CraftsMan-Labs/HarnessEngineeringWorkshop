import {
  PX_PER_METER,
  TERRAIN,
  TERRAIN_END_M,
  metersToPixels,
  roundTo,
  terrainXpx,
  terrainYpx,
} from "../config/gameConfig";
import type { LevelId } from "../types/game";
import { terrainHeightM } from "./terrainHeight";

export interface TerrainSample {
  distanceM: number;
  heightM: number;
  x: number;
  y: number;
}

export interface TerrainSegmentSpec {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
}

export function sampleTerrain(levelId: LevelId): TerrainSample[] {
  const samples: TerrainSample[] = [];
  const start = TERRAIN.START_SAMPLE_M;
  const steps = Math.round((TERRAIN_END_M - start) / TERRAIN.SAMPLE_STEP_M);
  for (let i = 0; i <= steps; i += 1) {
    const distanceM = roundTo(start + i * TERRAIN.SAMPLE_STEP_M, 6);
    const heightM = roundTo(terrainHeightM(levelId, distanceM), 6);
    samples.push({
      distanceM,
      heightM,
      x: terrainXpx(distanceM),
      y: terrainYpx(heightM),
    });
  }
  return samples;
}

export function segmentSpecsFromSamples(samples: TerrainSample[]): TerrainSegmentSpec[] {
  const height = metersToPixels(TERRAIN.THICKNESS_M);
  const specs: TerrainSegmentSpec[] = [];
  for (let i = 0; i < samples.length - 1; i += 1) {
    const p0 = samples[i];
    const p1 = samples[i + 1];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const length = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const normalX = -Math.sin(angle);
    const normalY = Math.cos(angle);
    const half = height / 2;
    specs.push({
      index: i,
      x: (p0.x + p1.x) / 2 + normalX * half,
      y: (p0.y + p1.y) / 2 + normalY * half,
      width: length + TERRAIN.OVERLAP_PX,
      height,
      angle,
    });
  }
  return specs;
}

export function buildTerrainGeometry(levelId: LevelId): {
  samples: TerrainSample[];
  segments: TerrainSegmentSpec[];
} {
  const samples = sampleTerrain(levelId);
  return { samples, segments: segmentSpecsFromSamples(samples) };
}

export function chunkCount(segmentCount: number): number {
  return Math.ceil(segmentCount / TERRAIN.CHUNK_SIZE);
}

export const SCENE_PIXEL_SCALE = PX_PER_METER;
