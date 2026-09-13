import { SAVE_DISTANCE_DECIMALS, STORAGE_KEY, roundTo } from "../config/gameConfig";
import { LEVEL_ORDER } from "../config/levels";
import type { LevelId, SaveDataV1 } from "../types/game";

export function defaultSave(): SaveDataV1 {
  return {
    version: 1,
    muted: false,
    levels: {
      "green-hills": { bestDistanceM: 0, bestScore: 0 },
      "moon-run": { bestDistanceM: 0, bestScore: 0 },
    },
  };
}

export function parseSave(raw: string | null): SaveDataV1 {
  if (!raw) return defaultSave();
  try {
    const parsed = JSON.parse(raw) as Partial<SaveDataV1>;
    if (parsed.version !== 1 || typeof parsed.muted !== "boolean" || !parsed.levels) {
      return defaultSave();
    }
    const save = defaultSave();
    save.muted = parsed.muted;
    for (const id of LEVEL_ORDER) {
      const entry = parsed.levels[id];
      if (!entry) continue;
      if (typeof entry.bestDistanceM === "number" && Number.isFinite(entry.bestDistanceM)) {
        save.levels[id].bestDistanceM = roundTo(entry.bestDistanceM, SAVE_DISTANCE_DECIMALS);
      }
      if (typeof entry.bestScore === "number" && Number.isFinite(entry.bestScore)) {
        save.levels[id].bestScore = Math.floor(entry.bestScore);
      }
    }
    return save;
  } catch {
    return defaultSave();
  }
}

export function recordResult(save: SaveDataV1, levelId: LevelId, distanceM: number, score: number): SaveDataV1 {
  const next = structuredClone(save);
  const entry = next.levels[levelId];
  entry.bestDistanceM = Math.max(entry.bestDistanceM, roundTo(distanceM, SAVE_DISTANCE_DECIMALS));
  entry.bestScore = Math.max(entry.bestScore, Math.floor(score));
  return next;
}

export function loadSave(storage?: Storage | null): SaveDataV1 {
  try {
    return parseSave(storage?.getItem(STORAGE_KEY) ?? null);
  } catch {
    return defaultSave();
  }
}

export function writeSave(save: SaveDataV1, storage?: Storage | null): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    // Local storage failure must not prevent play.
  }
}
