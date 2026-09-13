import {
  AIR_CONTROL,
  DRIVE,
  MAX_LINEAR_SPEED_MPS,
  PX_PER_METER,
  SIM_HZ,
  moveToward,
} from "../config/gameConfig";
import type { ControlState } from "../types/game";
import { Matter, type MatterBody } from "../physics/matter";

export function pixelsPerTickToMps(pxPerTick: number): number {
  return (pxPerTick * SIM_HZ) / PX_PER_METER;
}

export function maxSpeedPxPerTick(): number {
  return (MAX_LINEAR_SPEED_MPS * PX_PER_METER) / SIM_HZ;
}

export function applyGroundDrive(
  rearWheel: MatterBody,
  frontWheel: MatterBody,
  chassis: MatterBody,
  input: ControlState,
  motorEnabled: boolean,
): void {
  if (!motorEnabled) return;
  const speedMps = Math.abs(pixelsPerTickToMps(chassis.velocity.x));
  if (input.brake > 0 && speedMps > DRIVE.REVERSE_ENTRY_SPEED_MPS) {
    Matter.Body.setAngularVelocity(
      rearWheel,
      moveToward(rearWheel.angularVelocity, 0, DRIVE.BRAKE_DECEL_PER_TICK * input.brake),
    );
    Matter.Body.setAngularVelocity(
      frontWheel,
      moveToward(frontWheel.angularVelocity, 0, DRIVE.BRAKE_DECEL_PER_TICK * input.brake),
    );
    return;
  }
  if (input.brake > 0 && speedMps <= DRIVE.REVERSE_ENTRY_SPEED_MPS) {
    Matter.Body.setAngularVelocity(
      rearWheel,
      moveToward(
        rearWheel.angularVelocity,
        DRIVE.REVERSE_TARGET_OMEGA,
        DRIVE.REVERSE_ACCEL_PER_TICK * input.brake,
      ),
    );
    return;
  }
  if (input.throttle > 0) {
    Matter.Body.setAngularVelocity(
      rearWheel,
      moveToward(
        rearWheel.angularVelocity,
        DRIVE.FORWARD_TARGET_OMEGA,
        DRIVE.FORWARD_ACCEL_PER_TICK * input.throttle,
      ),
    );
  }
}

export function applyAirControl(
  chassis: MatterBody,
  input: ControlState,
  airborne: boolean,
  motorEnabled: boolean,
): void {
  if (!airborne || !motorEnabled) return;
  chassis.torque += AIR_CONTROL.AIR_CONTROL_TORQUE * (input.brake - input.throttle);
}

export function clampChassisSpin(chassis: MatterBody): void {
  const limit = AIR_CONTROL.MAX_CHASSIS_ANGULAR_VELOCITY;
  if (chassis.angularVelocity > limit) Matter.Body.setAngularVelocity(chassis, limit);
  else if (chassis.angularVelocity < -limit) Matter.Body.setAngularVelocity(chassis, -limit);
}

export function clampBodySpeed(body: MatterBody): boolean {
  const speed = Math.hypot(body.velocity.x, body.velocity.y);
  const cap = maxSpeedPxPerTick();
  if (speed <= cap || speed === 0) return false;
  const scale = cap / speed;
  Matter.Body.setVelocity(body, { x: body.velocity.x * scale, y: body.velocity.y * scale });
  return true;
}
