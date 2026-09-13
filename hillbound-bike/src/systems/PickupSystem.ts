import { COIN, FUEL } from "../config/gameConfig";
import { terrainHeightM } from "../terrain/terrainHeight";
import type { CoinType, LevelId, PickupManifestEntry } from "../types/game";

export function fuelDistances(): number[] {
  const distances: number[] = [];
  for (let k = 0; ; k += 1) {
    const distance = FUEL.FIRST_DISTANCE_M + FUEL.SPACING_M * k;
    if (distance >= FUEL.MAX_DISTANCE_M) break;
    distances.push(distance);
  }
  return distances;
}

export function coinTypeForIndex(j: number): CoinType {
  if (j === 4) return "gold";
  if (j === 2 || j === 6) return "silver";
  return "bronze";
}

export function coinValue(type: CoinType): number {
  if (type === "gold") return COIN.GOLD;
  if (type === "silver") return COIN.SILVER;
  return COIN.BRONZE;
}

export function fuelPickupId(levelId: LevelId, distanceM: number): string {
  return `fuel-${levelId}-${distanceM}`;
}

export function coinPickupId(levelId: LevelId, groupCenter: number, j: number): string {
  return `coin-${levelId}-${groupCenter}-${j}`;
}

export function generatePickupManifest(levelId: LevelId): PickupManifestEntry[] {
  const fuels = fuelDistances();
  const entries: PickupManifestEntry[] = fuels.map((distanceM) => ({
    id: fuelPickupId(levelId, distanceM),
    kind: "fuel",
    value: FUEL.PICKUP_SCORE,
    distanceM,
    heightM: terrainHeightM(levelId, distanceM) + FUEL.ELEVATION_M,
    radiusM: FUEL.SENSOR_RADIUS_M,
  }));

  for (let k = 0; ; k += 1) {
    const center = COIN.FIRST_CENTER_M + COIN.SPACING_M * k;
    if (center >= COIN.MAX_CENTER_M) break;
    if (fuels.some((fuel) => Math.abs(center - fuel) <= COIN.FUEL_SKIP_RADIUS_M)) continue;
    for (let j = 0; j < COIN.COUNT_PER_GROUP; j += 1) {
      const coinType = coinTypeForIndex(j);
      const distanceM = center + (j - 4) * COIN.STEP_M;
      const normalized = (j - 4) / 4;
      const elevation = COIN.BASE_ELEVATION_M + COIN.ARC_ELEVATION_M * (1 - normalized * normalized);
      entries.push({
        id: coinPickupId(levelId, center, j),
        kind: "coin",
        coinType,
        value: coinValue(coinType),
        distanceM,
        heightM: terrainHeightM(levelId, distanceM) + elevation,
        radiusM: COIN.SENSOR_RADIUS_M,
      });
    }
  }

  return entries;
}

export class PickupSystem {
  manifest: PickupManifestEntry[] = [];
  collected = new Set<string>();
  activeIds = new Set<string>();

  load(levelId: LevelId): void {
    this.manifest = generatePickupManifest(levelId);
    this.collected.clear();
    this.activeIds = new Set(this.manifest.map((entry) => entry.id));
  }

  reset(levelId: LevelId): void {
    this.load(levelId);
  }

  get(id: string): PickupManifestEntry | undefined {
    return this.manifest.find((entry) => entry.id === id);
  }

  collect(ids: string[]): PickupManifestEntry[] {
    const unique = [...new Set(ids)].sort();
    const collected: PickupManifestEntry[] = [];
    for (const id of unique) {
      if (this.collected.has(id) || !this.activeIds.has(id)) continue;
      const entry = this.get(id);
      if (!entry) continue;
      this.collected.add(id);
      this.activeIds.delete(id);
      collected.push(entry);
    }
    return collected;
  }

  collectedIds(): string[] {
    return [...this.collected].sort();
  }
}
