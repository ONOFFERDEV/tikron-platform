export type HitLocomotionState =
  | "idle" | "walk" | "run" | "sprint"
  | "crouch_idle" | "crouch_walk"
  | "strafe_left" | "strafe_right" | "backpedal"
  | "crouch_left" | "crouch_right";

export const HIT_ANIMATION_CLIPS = [
  "rifle_idle", "rifle_walk", "rifle_sprint", "rifle_crouch_idle", "rifle_crouch_walk",
  "rifle_strafe_left", "rifle_strafe_right", "rifle_backpedal", "rifle_crouch_left", "rifle_crouch_right",
  "smg_idle", "smg_walk", "smg_sprint", "smg_crouch_idle", "smg_crouch_walk",
  "shotgun_idle", "shotgun_walk", "shotgun_sprint", "shotgun_crouch_idle", "shotgun_crouch_walk",
  "sniper_idle", "sniper_walk", "sniper_sprint", "sniper_crouch_idle", "sniper_crouch_walk",
  "pistol_idle", "pistol_walk", "pistol_sprint", "pistol_crouch_idle", "pistol_crouch_walk",
] as const;

export type HitAnimationClip = typeof HIT_ANIMATION_CLIPS[number];
export const HIT_ANIMATION_NONE = 255;
const hitAnimationIndex = new Map<string, number>(HIT_ANIMATION_CLIPS.map((clip, index) => [clip, index]));
const hitAnimationLocomotions = [
  "idle", "walk", "sprint", "crouch_idle", "crouch_walk",
  "strafe_left", "strafe_right", "backpedal", "crouch_left", "crouch_right",
  "idle", "walk", "sprint", "crouch_idle", "crouch_walk",
  "idle", "walk", "sprint", "crouch_idle", "crouch_walk",
  "idle", "walk", "sprint", "crouch_idle", "crouch_walk",
  "idle", "walk", "sprint", "crouch_idle", "crouch_walk",
] as const satisfies readonly HitLocomotionState[];
const hitAnimationWeaponIndices = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  1, 1, 1, 1, 1,
  2, 2, 2, 2, 2,
  3, 3, 3, 3, 3,
  4, 4, 4, 4, 4,
] as const;

export function encodeHitAnimationClip(clip: string): number {
  return hitAnimationIndex.get(clip) ?? HIT_ANIMATION_NONE;
}

export function decodeHitAnimationClip(index: number): HitAnimationClip | undefined {
  return Number.isInteger(index) && index >= 0 && index < HIT_ANIMATION_CLIPS.length
    ? HIT_ANIMATION_CLIPS[index]
    : undefined;
}

export function hitAnimationLocomotion(clip: HitAnimationClip): HitLocomotionState {
  return hitAnimationLocomotions[hitAnimationIndex.get(clip)!]!;
}

export function hitAnimationWeaponIndex(clip: HitAnimationClip): number {
  return hitAnimationWeaponIndices[hitAnimationIndex.get(clip)!]!;
}

export interface HitStateMotion {
  readonly alive: boolean;
  readonly crouch: boolean;
  readonly weapon: number;
  readonly yaw: number;
  readonly dx: number;
  readonly dz: number;
  readonly dtSeconds: number;
}

export interface HitStateBucketPolicy {
  readonly idleMax: number;
  readonly walkMax: number;
  readonly crouchSpeed: number;
  readonly hasCrouchClips: boolean;
  readonly hasSprintClip: boolean;
  readonly weaponFamilies: readonly string[];
}

export interface HitStateBucket {
  readonly clip: string;
  readonly locomotion: HitLocomotionState;
  readonly weaponFamily: string;
}

export function hitStateBucket(
  motion: HitStateMotion,
  policy: HitStateBucketPolicy,
): HitStateBucket | undefined {
  if (!motion.alive || !Number.isInteger(motion.weapon) || motion.weapon < 0
    || ![motion.yaw, motion.dx, motion.dz, motion.dtSeconds, policy.idleMax,
      policy.walkMax, policy.crouchSpeed].every(Number.isFinite)
    || motion.dtSeconds <= 0 || policy.idleMax < 0 || policy.walkMax <= policy.idleMax
    || policy.crouchSpeed <= 0) return undefined;
  const weaponFamily = policy.weaponFamilies[motion.weapon];
  if (weaponFamily === undefined || weaponFamily.length === 0) return undefined;

  const speed = Math.hypot(motion.dx, motion.dz) / motion.dtSeconds;
  let locomotion: HitLocomotionState;
  if (motion.crouch && policy.hasCrouchClips) {
    locomotion = speed < policy.idleMax ? "crouch_idle" : "crouch_walk";
  } else {
    locomotion = speed < policy.idleMax ? "idle"
      : speed < policy.walkMax ? "walk"
        : policy.hasSprintClip ? "sprint" : "run";
  }

  const sliding = motion.crouch && speed > policy.crouchSpeed * 1.25;
  if (sliding && policy.hasCrouchClips) locomotion = "crouch_idle";
  if (!sliding && speed >= policy.idleMax && motion.weapon === 0) {
    const lateral = motion.dx * Math.cos(motion.yaw) - motion.dz * Math.sin(motion.yaw);
    const forward = motion.dx * Math.sin(motion.yaw) + motion.dz * Math.cos(motion.yaw);
    if (Math.abs(lateral) > Math.abs(forward) * 1.2) {
      locomotion = motion.crouch
        ? lateral > 0 ? "crouch_left" : "crouch_right"
        : lateral > 0 ? "strafe_left" : "strafe_right";
    } else if (forward < -Math.abs(lateral) && !motion.crouch) {
      locomotion = "backpedal";
    }
  }
  return { clip: `${weaponFamily}_${locomotion}`, locomotion, weaponFamily };
}
