import type { LevelDefinition, LevelId } from "../types/game";

export const LEVELS: Record<LevelId, LevelDefinition> = {
  "green-hills": {
    id: "green-hills",
    displayName: "Green Hills",
    seed: 0x47524831,
    gravityX: 0,
    gravityY: 1,
    gravityScale: 0.001,
    terrainFriction: 0.92,
    terrainStaticFriction: 1,
    terrainRestitution: 0,
    chassisAirFriction: 0.012,
    wheelAirFriction: 0.008,
    airtimeScoreMultiplier: 1,
    theme: "green-hills",
  },
  "moon-run": {
    id: "moon-run",
    displayName: "Moon Run",
    seed: 0x4d4f4f4e,
    gravityX: 0,
    gravityY: 1,
    gravityScale: 0.000165,
    terrainFriction: 0.7,
    terrainStaticFriction: 0.85,
    terrainRestitution: 0.02,
    chassisAirFriction: 0.004,
    wheelAirFriction: 0.003,
    airtimeScoreMultiplier: 1.5,
    theme: "moon-run",
  },
};

export const LEVEL_ORDER: LevelId[] = ["green-hills", "moon-run"];

export function getLevel(id: LevelId): LevelDefinition {
  return LEVELS[id];
}
