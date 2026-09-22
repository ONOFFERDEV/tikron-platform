import { targetHeadRadius, targetHitVolume, type FireClaim, type HitTarget } from "./hitscan.js";
import type { RampDef } from "./map/types.js";
import { raySphere, type Box, type Vec3 } from "./physics.js";
import { nearestOccluder } from "./ray-occlusion.js";

export type ParsedHitClaim =
  | { readonly kind: "absent"; readonly source: "missing" | "malformed" }
  | { readonly kind: "miss" }
  | { readonly kind: "hit"; readonly claim: FireClaim };

export type HitClaimRejectReason = "no-target" | "friendly" | "range" | "cone" | "part" | "occluded";

export interface HitClaimValidation {
  readonly claim: FireClaim;
  readonly shooterTeam: number;
  readonly targets: readonly HitTarget[];
  readonly origin: Vec3;
  readonly aimDir: Vec3;
  readonly range: number;
  readonly accuracySpread: number;
  readonly boxes: readonly Box[];
  readonly ramps: readonly RampDef[];
  readonly hitRadius: number;
  readonly headRadius: number;
  readonly coneMarginM: number;
  readonly teamless?: boolean;
}

export type HitClaimDecision =
  | { readonly accepted: true; readonly t: number; readonly angleErrDeg: number; readonly part: FireClaim["part"] }
  | { readonly accepted: false; readonly reason: HitClaimRejectReason; readonly angleErrDeg?: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value;
}

export function readHitClaim(value: unknown, key = "claim"): ParsedHitClaim {
  if (!isRecord(value) || !(key in value)) return { kind: "absent", source: "missing" };
  const raw = value[key];
  if (raw === null) return { kind: "miss" };
  if (!isRecord(raw) || typeof raw["id"] !== "string" || (raw["part"] !== "head" && raw["part"] !== "body")) {
    return { kind: "absent", source: "malformed" };
  }
  return { kind: "hit", claim: { id: raw["id"], part: raw["part"] } };
}

export function validateHitClaim(input: HitClaimValidation): HitClaimDecision {
  const target = input.targets.find(candidate => candidate.id === input.claim.id);
  if (target === undefined) return { accepted: false, reason: "no-target" };
  if (!(input.teamless ?? false) && target.team === input.shooterTeam) return { accepted: false, reason: "friendly" };
  const headRadius = targetHeadRadius(target, input.headRadius);
  const volume = targetHitVolume(target, headRadius);
  const reference = input.claim.part === "head"
    ? volume.headCenter
    : { x: target.x, y: (target.feetY + volume.bodyTopY) / 2, z: target.z };
  const delta = { x: reference.x - input.origin.x, y: reference.y - input.origin.y, z: reference.z - input.origin.z };
  const distance = Math.hypot(delta.x, delta.y, delta.z);
  if (distance < 1e-6 || distance > input.range) return { accepted: false, reason: "range" };
  // Server-only random spread cannot widen the part gate for a client base-ray claim.
  if (input.claim.part === "head" &&
      raySphere(input.origin, input.aimDir, volume.headCenter, headRadius, input.range) === null) {
    return { accepted: false, reason: "part" };
  }
  const direction = { x: delta.x / distance, y: delta.y / distance, z: delta.z / distance };
  const cosine = clamp(input.aimDir.x * direction.x + input.aimDir.y * direction.y + input.aimDir.z * direction.z, -1, 1);
  const angleError = Math.acos(cosine);
  const angleErrDeg = angleError * 180 / Math.PI;
  const tolerance = Math.atan2(input.hitRadius + input.coneMarginM, distance) + input.accuracySpread * Math.SQRT2;
  if (angleError > tolerance) return { accepted: false, reason: "cone", angleErrDeg };
  if (nearestOccluder(input.origin, direction, input.boxes, input.ramps, distance) < distance) {
    return { accepted: false, reason: "occluded", angleErrDeg };
  }
  return { accepted: true, t: distance, angleErrDeg, part: input.claim.part };
}
