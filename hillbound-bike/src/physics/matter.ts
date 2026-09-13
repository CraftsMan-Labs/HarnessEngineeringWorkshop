import matterLib from "phaser/src/physics/matter-js/CustomMain.js";
import { MATTER_SETTINGS } from "../config/gameConfig";

export interface MatterVector {
  x: number;
  y: number;
}

export interface MatterCollisionFilter {
  category?: number;
  mask?: number;
  group?: number;
}

export interface MatterBody {
  id: number;
  label: string;
  position: MatterVector;
  velocity: MatterVector;
  angle: number;
  angularVelocity: number;
  torque: number;
  isSensor: boolean;
  isStatic: boolean;
  circleRadius?: number;
  collisionFilter: MatterCollisionFilter;
}

export interface MatterConstraint {
  bodyA: MatterBody;
  bodyB: MatterBody;
}

export interface MatterEngine {
  world: { gravity: { x: number; y: number; scale: number } };
  gravity?: { x: number; y: number; scale: number };
  enableSleeping: boolean;
  positionIterations: number;
  velocityIterations: number;
  constraintIterations: number;
  timing: { timeScale: number };
}

export interface MatterLib {
  Engine: {
    create: (options?: Record<string, unknown>) => MatterEngine;
    update: (engine: MatterEngine, delta: number) => void;
    clear: (engine: MatterEngine) => void;
  };
  World: {
    add: (world: MatterEngine["world"], body: unknown) => void;
    remove: (world: MatterEngine["world"], body: unknown) => void;
    clear: (world: MatterEngine["world"], keepStatic: boolean) => void;
  };
  Bodies: {
    rectangle: (x: number, y: number, w: number, h: number, options?: Record<string, unknown>) => MatterBody;
    circle: (x: number, y: number, r: number, options?: Record<string, unknown>) => MatterBody;
  };
  Body: {
    setPosition: (body: MatterBody, position: MatterVector) => void;
    setVelocity: (body: MatterBody, velocity: MatterVector) => void;
    setAngle: (body: MatterBody, angle: number) => void;
    setAngularVelocity: (body: MatterBody, velocity: number) => void;
    setInertia: (body: MatterBody, inertia: number) => void;
  };
  Constraint: {
    create: (options: Record<string, unknown>) => MatterConstraint;
  };
  Query: {
    collides: (body: MatterBody, bodies: MatterBody[]) => unknown[];
  };
  Events: {
    on: (engine: MatterEngine, name: string, callback: (event: { pairs: { bodyA: MatterBody; bodyB: MatterBody }[] }) => void) => void;
    off: (engine: MatterEngine, name: string, callback?: unknown) => void;
  };
}

export const Matter = matterLib as unknown as MatterLib;

export function createMatterEngine(): MatterEngine {
  const engine = Matter.Engine.create({
    enableSleeping: MATTER_SETTINGS.enableSleeping,
  });
  engine.positionIterations = MATTER_SETTINGS.positionIterations;
  engine.velocityIterations = MATTER_SETTINGS.velocityIterations;
  engine.constraintIterations = MATTER_SETTINGS.constraintIterations;
  engine.timing.timeScale = MATTER_SETTINGS.timeScale;
  setGravity(engine, 0, 1, 0.001);
  return engine;
}

export function setGravity(engine: MatterEngine, x: number, y: number, scale: number): void {
  const gravity = engine.gravity ?? engine.world.gravity;
  gravity.x = x;
  gravity.y = y;
  gravity.scale = scale;
}

export function applyEngineSettings(engine: MatterEngine): void {
  engine.enableSleeping = MATTER_SETTINGS.enableSleeping;
  engine.positionIterations = MATTER_SETTINGS.positionIterations;
  engine.velocityIterations = MATTER_SETTINGS.velocityIterations;
  engine.constraintIterations = MATTER_SETTINGS.constraintIterations;
  engine.timing.timeScale = MATTER_SETTINGS.timeScale;
}

export function clearWorld(engine: MatterEngine): void {
  Matter.World.clear(engine.world, false);
  Matter.Engine.clear(engine);
}
