import { MOVE } from "./config.js";

export type MovementIntent = {
  readonly mx: number;
  readonly mz: number;
  readonly crouch: boolean;
  readonly sprint: boolean;
  readonly ads: boolean;
};

export type HorizontalMovement = {
  readonly x: number;
  readonly z: number;
  readonly speed: number;
};

export function movementSpeed(intent: MovementIntent, grounded: boolean): number {
  if (intent.crouch) return MOVE.crouch;
  if (grounded && intent.sprint && !intent.ads && intent.mz > 0) return MOVE.sprint;
  if (grounded && intent.ads) return MOVE.walk * MOVE.adsGroundMultiplier;
  return MOVE.walk;
}

export function horizontalMovement(intent: MovementIntent, grounded: boolean, yaw: number): HorizontalMovement {
  const sine = Math.sin(yaw);
  const cosine = Math.cos(yaw);
  const x = sine * intent.mz + cosine * intent.mx;
  const z = cosine * intent.mz - sine * intent.mx;
  const length = Math.hypot(x, z);
  const scale = length > 1 ? 1 / length : 1;
  return { x: x * scale, z: z * scale, speed: movementSpeed(intent, grounded) };
}
