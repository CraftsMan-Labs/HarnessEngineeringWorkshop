import type { LevelId } from "../types/game";

export const SPEC_VERSION = "1.0.0";

export const PX_PER_METER = 64;
export const metersToPixels = (m: number): number => m * PX_PER_METER;
export const pixelsToMeters = (px: number): number => px / PX_PER_METER;

export const START_X_PX = 8 * PX_PER_METER;
export const COURSE_LENGTH_M = 1500;
export const FINISH_DISTANCE_M = 1500;
export const FINISH_X_PX = START_X_PX + COURSE_LENGTH_M * PX_PER_METER;
export const TERRAIN_END_M = 1520;
export const VIEWPORT_WIDTH = 1280;
export const VIEWPORT_HEIGHT = 720;
export const TERRAIN_DATUM_Y_PX = 520;

export const SIM_HZ = 60;
export const FIXED_DT_S = 1 / 60;
export const FIXED_DT_MS = 1000 / 60;
export const MAX_CATCH_UP_TICKS = 5;

export const MATTER_SETTINGS = {
  enableSleeping: false,
  positionIterations: 8,
  velocityIterations: 6,
  constraintIterations: 4,
  timeScale: 1,
} as const;

export const COLLISION = {
  BIKE: 0x0001,
  TERRAIN: 0x0002,
  PICKUP: 0x0004,
  HEAD_SENSOR: 0x0008,
  FINISH: 0x0010,
} as const;

export const CHASSIS = {
  widthM: 1.7,
  heightM: 0.42,
  chamferPx: 8,
  density: 0.0022,
  friction: 0.65,
  staticFriction: 0.8,
  restitution: 0.02,
  slop: 0.03,
} as const;

export const WHEEL = {
  radiusM: 0.36,
  density: 0.0014,
  friction: 0.95,
  staticFriction: 1,
  restitution: 0.06,
  slop: 0.02,
  rearOffsetM: { x: -0.62, y: 0.34 },
  frontOffsetM: { x: 0.62, y: 0.34 },
} as const;

export const RIDER_HEAD = {
  offsetM: { x: -0.08, y: -0.72 },
  radiusM: 0.19,
  density: 0.0001,
  friction: 0,
  staticFriction: 0,
  restitution: 0,
  slop: 0,
} as const;

export const SUSPENSION = {
  attachXOffsetM: 0.16,
  lengthM: 0.34,
  stiffness: 0.62,
  damping: 0.16,
  angularStiffness: 0,
} as const;

export const SPAWN = {
  distanceM: 4,
  chassisHeightM: WHEEL.rearOffsetM.y + WHEEL.radiusM + 0.02,
  angle: 0,
} as const;

export const DRIVE = {
  FORWARD_TARGET_OMEGA: 0.42,
  REVERSE_TARGET_OMEGA: -0.18,
  FORWARD_ACCEL_PER_TICK: 0.018,
  REVERSE_ACCEL_PER_TICK: 0.012,
  BRAKE_DECEL_PER_TICK: 0.03,
  REVERSE_ENTRY_SPEED_MPS: 1.2,
} as const;

export const AIR_CONTROL = {
  AIR_CONTROL_TORQUE: 0.003,
  MAX_CHASSIS_ANGULAR_VELOCITY: 0.135,
} as const;

export const MAX_LINEAR_SPEED_MPS = 32;

export const CONTACT = {
  groundGraceTicks: 5,
  airborneAfterTicks: 6,
} as const;

export const FUEL = {
  CAPACITY: 100,
  STARTING: 100,
  BASE_BURN_PER_SECOND: 0.2,
  THROTTLE_BURN_PER_SECOND: 0.8,
  BRAKE_BURN_PER_SECOND: 0.35,
  PICKUP_AMOUNT: 35,
  PICKUP_SCORE: 200,
  SENSOR_RADIUS_M: 0.6,
  ELEVATION_M: 1.65,
  FIRST_DISTANCE_M: 180,
  SPACING_M: 210,
  MAX_DISTANCE_M: 1470,
} as const;

export const COIN = {
  BRONZE: 10,
  SILVER: 25,
  GOLD: 100,
  GROUP_TOTAL: 210,
  SENSOR_RADIUS_M: 0.32,
  FIRST_CENTER_M: 55,
  SPACING_M: 45,
  MAX_CENTER_M: 1470,
  FUEL_SKIP_RADIUS_M: 12,
  COUNT_PER_GROUP: 9,
  STEP_M: 1.25,
  BASE_ELEVATION_M: 1.4,
  ARC_ELEVATION_M: 3.2,
} as const;

export const OUT_OF_FUEL = {
  STOP_SPEED_MPS: 0.5,
  STOP_TICKS: 120,
  HARD_TIMEOUT_TICKS: 480,
} as const;

export const CRASH = {
  PRESENTATION_TICKS: 45,
  TIME_SCALE: 0.35,
} as const;

export const FINISH = {
  PRESENTATION_TICKS: 60,
  SENSOR_HALF_HEIGHT_M: 4,
} as const;

export const BOUNDS = {
  LEFT_WALL_DISTANCE_M: -6,
  CAMERA_MIN_DISTANCE_M: -8,
  FALL_DEPTH_M: 20,
  FALL_TICKS: 30,
} as const;

export const TERRAIN = {
  SAMPLE_STEP_M: 0.5,
  THICKNESS_M: 2.25,
  OVERLAP_PX: 2,
  START_SAMPLE_M: -10,
  START_FLAT_END_M: 14,
  START_BLEND_END_M: 26,
  FINISH_BLEND_START_M: 1476,
  FINISH_BLEND_END_M: 1500,
  CHUNK_SIZE: 200,
} as const;

export const AIRTIME_THRESHOLDS = [
  { tick: 45, increment: 25, label: "AIR TIME" },
  { tick: 90, increment: 50, label: "BIG AIR" },
  { tick: 150, increment: 100, label: "HUGE AIR" },
  { tick: 210, increment: 100, label: "INSANE AIR" },
] as const;

export const AIRTIME_REPEAT = {
  startTick: 210,
  interval: 60,
  increment: 100,
  label: "INSANE AIR",
} as const;

export const ROTATION = {
  FRONT_FLIP_SCORE: 250,
  BACK_FLIP_SCORE: 300,
} as const;

export const CAMERA = {
  followX: 0.62,
  followY: 0.58,
  lerp: 0.18,
  zoom: 1,
} as const;

export const STORAGE_KEY = "hillbound-bike:v1";

export const TELEMETRY_CAP = 50_000;

export const SAVE_DISTANCE_DECIMALS = 2;

export const HASH_INTERVAL_TICKS = 60;

export const DEPENDENCY_FINGERPRINT_SOURCE = "phaser@3.90.0|spec@1.0.0";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function moveToward(current: number, target: number, maxDelta: number): number {
  const delta = target - current;
  if (Math.abs(delta) <= maxDelta) return target;
  return current + Math.sign(delta) * maxDelta;
}

export function normalizeToMinusPiThroughPi(angle: number): number {
  const twoPi = Math.PI * 2;
  let a = angle;
  while (a <= -Math.PI) a += twoPi;
  while (a > Math.PI) a -= twoPi;
  return a;
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

export function terrainXpx(distanceM: number): number {
  return START_X_PX + distanceM * PX_PER_METER;
}

export function terrainYpx(heightM: number): number {
  return TERRAIN_DATUM_Y_PX - heightM * PX_PER_METER;
}

export function distanceFromChassisX(x: number): number {
  return (x - START_X_PX) / PX_PER_METER;
}

export function isLevelId(value: string): value is LevelId {
  return value === "green-hills" || value === "moon-run";
}

export const GAME_CONFIG = {
  SPEC_VERSION,
  PX_PER_METER,
  START_X_PX,
  COURSE_LENGTH_M,
  FINISH_DISTANCE_M,
  FINISH_X_PX,
  TERRAIN_END_M,
  VIEWPORT_WIDTH,
  VIEWPORT_HEIGHT,
  TERRAIN_DATUM_Y_PX,
  SIM_HZ,
  FIXED_DT_S,
  FIXED_DT_MS,
  MAX_CATCH_UP_TICKS,
  MATTER_SETTINGS,
  COLLISION,
  CHASSIS,
  WHEEL,
  RIDER_HEAD,
  SUSPENSION,
  SPAWN,
  DRIVE,
  AIR_CONTROL,
  MAX_LINEAR_SPEED_MPS,
  CONTACT,
  FUEL,
  COIN,
  OUT_OF_FUEL,
  CRASH,
  FINISH,
  BOUNDS,
  TERRAIN,
  AIRTIME_THRESHOLDS,
  AIRTIME_REPEAT,
  ROTATION,
  CAMERA,
  STORAGE_KEY,
  TELEMETRY_CAP,
  HASH_INTERVAL_TICKS,
} as const;

export type GameConfig = typeof GAME_CONFIG;
