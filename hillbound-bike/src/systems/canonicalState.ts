import { normalizeZero, roundTo } from "../config/gameConfig";
import type { BodySnapshot, CanonicalState } from "../types/game";

function round4(value: number): number {
  return normalizeZero(roundTo(value, 4));
}

export function snapshotBody(body: {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  angle: number;
  angularVelocity: number;
}): BodySnapshot {
  return {
    x: body.position.x,
    y: body.position.y,
    vx: body.velocity.x,
    vy: body.velocity.y,
    angle: body.angle,
    angularVelocity: body.angularVelocity,
  };
}

export function serializeCanonicalState(state: CanonicalState): string {
  const payload = {
    tick: state.tick,
    levelId: state.levelId,
    seed: state.seed,
    runState: state.runState,
    chassis: {
      x: round4(state.chassis.x),
      y: round4(state.chassis.y),
      vx: round4(state.chassis.vx),
      vy: round4(state.chassis.vy),
      angle: round4(state.chassis.angle),
      angularVelocity: round4(state.chassis.angularVelocity),
    },
    rearWheel: {
      x: round4(state.rearWheel.x),
      y: round4(state.rearWheel.y),
      vx: round4(state.rearWheel.vx),
      vy: round4(state.rearWheel.vy),
      angle: round4(state.rearWheel.angle),
      angularVelocity: round4(state.rearWheel.angularVelocity),
    },
    frontWheel: {
      x: round4(state.frontWheel.x),
      y: round4(state.frontWheel.y),
      vx: round4(state.frontWheel.vx),
      vy: round4(state.frontWheel.vy),
      angle: round4(state.frontWheel.angle),
      angularVelocity: round4(state.frontWheel.angularVelocity),
    },
    fuel: round4(state.fuel),
    score: state.score,
    maxDistanceM: round4(state.maxDistanceM),
    collectedPickupIds: [...state.collectedPickupIds].sort(),
    stunt: {
      airborne: state.stunt.airborne,
      airtimeTicks: state.stunt.airtimeTicks,
      rotationAccumulator: round4(state.stunt.rotationAccumulator),
      awardedAirtimeThresholds: [...state.stunt.awardedAirtimeThresholds],
    },
  };
  return JSON.stringify(payload);
}

export async function hashCanonicalState(state: CanonicalState): Promise<string> {
  const encoded = new TextEncoder().encode(serializeCanonicalState(state));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
