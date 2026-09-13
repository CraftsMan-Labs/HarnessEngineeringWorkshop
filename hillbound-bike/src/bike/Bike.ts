import {
  CHASSIS,
  COLLISION,
  RIDER_HEAD,
  SPAWN,
  SUSPENSION,
  WHEEL,
  metersToPixels,
  terrainXpx,
  terrainYpx,
} from "../config/gameConfig";
import type { LevelDefinition } from "../types/game";
import { Matter, type MatterBody, type MatterConstraint, type MatterEngine } from "../physics/matter";
import { terrainHeightM } from "../terrain/terrainHeight";

export interface BikeBodies {
  chassis: MatterBody;
  rearWheel: MatterBody;
  frontWheel: MatterBody;
  head: MatterBody;
  constraints: MatterConstraint[];
}

function bikeFilter() {
  return {
    category: COLLISION.BIKE,
    mask: COLLISION.TERRAIN | COLLISION.FINISH,
    group: -1,
  };
}

export function spawnPose(levelId: LevelDefinition["id"]): { x: number; y: number; angle: number } {
  const groundY = terrainYpx(terrainHeightM(levelId, SPAWN.distanceM));
  return {
    x: terrainXpx(SPAWN.distanceM),
    y: groundY - metersToPixels(SPAWN.chassisHeightM),
    angle: SPAWN.angle,
  };
}

export function syncHeadFromChassis(chassis: MatterBody, head: MatterBody): void {
  const lx = metersToPixels(RIDER_HEAD.offsetM.x);
  const ly = metersToPixels(RIDER_HEAD.offsetM.y);
  const cos = Math.cos(chassis.angle);
  const sin = Math.sin(chassis.angle);
  Matter.Body.setPosition(head, {
    x: chassis.position.x + lx * cos - ly * sin,
    y: chassis.position.y + lx * sin + ly * cos,
  });
  Matter.Body.setAngle(head, chassis.angle);
  Matter.Body.setVelocity(head, { x: 0, y: 0 });
  Matter.Body.setAngularVelocity(head, 0);
}

export function createBike(engine: MatterEngine, level: LevelDefinition): BikeBodies {
  const pose = spawnPose(level.id);
  const chassis = Matter.Bodies.rectangle(
    pose.x,
    pose.y,
    metersToPixels(CHASSIS.widthM),
    metersToPixels(CHASSIS.heightM),
    {
      label: "bike-chassis",
      chamfer: { radius: CHASSIS.chamferPx },
      density: CHASSIS.density,
      friction: CHASSIS.friction,
      frictionStatic: CHASSIS.staticFriction,
      restitution: CHASSIS.restitution,
      slop: CHASSIS.slop,
      frictionAir: level.chassisAirFriction,
      collisionFilter: bikeFilter(),
      sleepThreshold: Infinity,
    },
  );

  const rearOffset = {
    x: metersToPixels(WHEEL.rearOffsetM.x),
    y: metersToPixels(WHEEL.rearOffsetM.y),
  };
  const frontOffset = {
    x: metersToPixels(WHEEL.frontOffsetM.x),
    y: metersToPixels(WHEEL.frontOffsetM.y),
  };

  const rearWheel = Matter.Bodies.circle(
    pose.x + rearOffset.x,
    pose.y + rearOffset.y,
    metersToPixels(WHEEL.radiusM),
    {
      label: "rear-wheel",
      density: WHEEL.density,
      friction: WHEEL.friction,
      frictionStatic: WHEEL.staticFriction,
      restitution: WHEEL.restitution,
      slop: WHEEL.slop,
      frictionAir: level.wheelAirFriction,
      collisionFilter: bikeFilter(),
      sleepThreshold: Infinity,
    },
  );
  const frontWheel = Matter.Bodies.circle(
    pose.x + frontOffset.x,
    pose.y + frontOffset.y,
    metersToPixels(WHEEL.radiusM),
    {
      label: "front-wheel",
      density: WHEEL.density,
      friction: WHEEL.friction,
      frictionStatic: WHEEL.staticFriction,
      restitution: WHEEL.restitution,
      slop: WHEEL.slop,
      frictionAir: level.wheelAirFriction,
      collisionFilter: bikeFilter(),
      sleepThreshold: Infinity,
    },
  );

  const head = Matter.Bodies.circle(pose.x, pose.y, metersToPixels(RIDER_HEAD.radiusM), {
    label: "rider-head",
    isSensor: true,
    density: RIDER_HEAD.density,
    friction: RIDER_HEAD.friction,
    frictionStatic: RIDER_HEAD.staticFriction,
    restitution: RIDER_HEAD.restitution,
    slop: RIDER_HEAD.slop,
    frictionAir: 0,
    collisionFilter: {
      category: COLLISION.HEAD_SENSOR,
      mask: COLLISION.TERRAIN,
      group: 0,
    },
    sleepThreshold: Infinity,
  });

  const constraints: MatterConstraint[] = [];
  const mounts = [
    { wheel: rearWheel, wheelX: WHEEL.rearOffsetM.x },
    { wheel: frontWheel, wheelX: WHEEL.frontOffsetM.x },
  ];
  for (const mount of mounts) {
    for (const sign of [-1, 1]) {
      constraints.push(
        Matter.Constraint.create({
          bodyA: chassis,
          bodyB: mount.wheel,
          pointA: {
            x: metersToPixels(mount.wheelX + sign * SUSPENSION.attachXOffsetM),
            y: 0,
          },
          pointB: { x: 0, y: 0 },
          length: metersToPixels(SUSPENSION.lengthM),
          stiffness: SUSPENSION.stiffness,
          damping: SUSPENSION.damping,
          angularStiffness: SUSPENSION.angularStiffness,
        }),
      );
    }
  }

  Matter.World.add(engine.world, [chassis, rearWheel, frontWheel, head, ...constraints]);
  syncHeadFromChassis(chassis, head);
  return { chassis, rearWheel, frontWheel, head, constraints };
}

export function isFiniteBody(body: MatterBody): boolean {
  return (
    Number.isFinite(body.position.x) &&
    Number.isFinite(body.position.y) &&
    Number.isFinite(body.velocity.x) &&
    Number.isFinite(body.velocity.y) &&
    Number.isFinite(body.angle) &&
    Number.isFinite(body.angularVelocity)
  );
}
