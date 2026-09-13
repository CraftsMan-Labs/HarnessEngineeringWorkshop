export type LevelId = "green-hills" | "moon-run";

export type RunState =
  | "BOOT"
  | "MENU"
  | "PLAYING"
  | "PAUSED"
  | "OUT_OF_FUEL_COASTING"
  | "CRASHED"
  | "COMPLETED"
  | "RESULTS"
  | "ABANDONED";

export type ResultReason =
  | "head_crash"
  | "out_of_fuel"
  | "finish"
  | "out_of_bounds"
  | "simulation_fault"
  | "abandoned";

export type CoinType = "bronze" | "silver" | "gold";

export type PickupKind = "fuel" | "coin";

export interface ControlState {
  throttle: number;
  brake: number;
}

export interface BodySnapshot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVelocity: number;
}

export interface StuntSnapshot {
  airborne: boolean;
  airtimeTicks: number;
  rotationAccumulator: number;
  awardedAirtimeThresholds: number[];
}

export interface CanonicalState {
  tick: number;
  levelId: LevelId;
  seed: number;
  runState: string;
  chassis: BodySnapshot;
  rearWheel: BodySnapshot;
  frontWheel: BodySnapshot;
  fuel: number;
  score: number;
  maxDistanceM: number;
  collectedPickupIds: string[];
  stunt: StuntSnapshot;
}

export interface ScoreComponents {
  distanceScore: number;
  coinScore: number;
  fuelPickupScore: number;
  airtimeScore: number;
  rotationScore: number;
  totalScore: number;
}

export interface RunSummary {
  resultReason: ResultReason | null;
  scoreComponents: ScoreComponents;
  displayDistanceM: number;
  rawGrounded: boolean;
  gameplayGrounded: boolean;
  airborneTicks: number;
  rotationAccumulator: number;
}

export interface PickupManifestEntry {
  id: string;
  kind: PickupKind;
  coinType?: CoinType;
  value: number;
  distanceM: number;
  heightM: number;
  radiusM: number;
}

export interface TestBikePose {
  distanceM?: number;
  x?: number;
  y?: number;
  angle?: number;
  vx?: number;
  vy?: number;
  angularVelocity?: number;
  frontWheelVx?: number;
  rearWheelVx?: number;
  rearWheelOmega?: number;
  frontWheelOmega?: number;
}

export interface InputChange {
  tick: number;
  throttle: number;
  brake: number;
}

export interface ReplayTape {
  specVersion: "1.0.0";
  levelId: LevelId;
  seed: number;
  dependencyFingerprint: string;
  changes: InputChange[];
}

export interface TelemetryEvent {
  sequence: number;
  runId: string;
  tick: number;
  type: string;
  data: Record<string, unknown>;
}

export interface SaveDataV1 {
  version: 1;
  muted: boolean;
  levels: Record<
    LevelId,
    {
      bestDistanceM: number;
      bestScore: number;
    }
  >;
}

export interface LevelDefinition {
  id: LevelId;
  displayName: string;
  seed: number;
  gravityX: number;
  gravityY: number;
  gravityScale: number;
  terrainFriction: number;
  terrainStaticFriction: number;
  terrainRestitution: number;
  chassisAirFriction: number;
  wheelAirFriction: number;
  airtimeScoreMultiplier: number;
  theme: "green-hills" | "moon-run";
}

export interface FloatingLabel {
  text: string;
  x: number;
  y: number;
  bornTick: number;
  lifeTicks: number;
}

export interface AwardEvent {
  kind: "airtime" | "front_flip" | "back_flip";
  label: string;
  points: number;
  tick: number;
}
