import type { HitFadeSource } from "../src/hit-animation-timeline.js";
import type { Stage33HitIdentity } from "../src/stage33-hit-calibration.js";
import {
  encodeHitAnimationClip,
  hitAnimationLocomotion,
  hitAnimationWeaponIndex,
  HIT_ANIMATION_CLIPS,
} from "../src/hit-state-bucket.js";

export interface InspectionHitFields {
  readonly hitClipIndex: number;
  readonly hitClipStartedAt: number;
  readonly hitBlendSources: readonly HitFadeSource[];
  readonly hitReactionKind: number;
  readonly hitReactionStartedAt: number;
  readonly hitReactionSeq: number;
  readonly hitSegmentSeq: number;
  readonly hitSegmentStartedAt: number;
}

export function inspectionHitFields(
  weapon: number,
  locomotion: string,
  phaseSeconds: number,
  serverNow: number,
  reaction: { readonly kind: 0 | 1 | 2; readonly ageMs: number } = { kind: 0, ageMs: 0 },
): InspectionHitFields | undefined {
  if (!Number.isInteger(weapon) || weapon < 0 || weapon > 4
    || !Number.isFinite(phaseSeconds) || phaseSeconds < 0
    || !Number.isFinite(serverNow) || !Number.isFinite(reaction.ageMs) || reaction.ageMs < 0)
    return undefined;
  const clip = HIT_ANIMATION_CLIPS.find(candidate =>
    hitAnimationWeaponIndex(candidate) === weapon && hitAnimationLocomotion(candidate) === locomotion);
  if (clip === undefined) return undefined;
  const hitClipStartedAt = serverNow - phaseSeconds * 1000;
  return {
    hitClipIndex: encodeHitAnimationClip(clip),
    hitClipStartedAt,
    hitBlendSources: [],
    hitReactionKind: reaction.kind,
    hitReactionStartedAt: serverNow - reaction.ageMs,
    hitReactionSeq: reaction.kind === 0 ? 0 : 1,
    hitSegmentSeq: 1,
    hitSegmentStartedAt: hitClipStartedAt,
  };
}

export type InspectionRigKind = "capsule" | "model" | "calibratedFallback" | "calibratedModel";

export interface InspectionActorInfo {
  readonly supported: boolean;
  readonly issue?: string;
  readonly authority: "legacy" | "calibrated";
  readonly rigKind?: InspectionRigKind;
  readonly renderedSource: "none" | "legacy-capsule" | "legacy-model" | "calibrated-fallback" | "calibrated-model";
  readonly requestedIdentity?: Stage33HitIdentity;
  readonly resolvedSourceIdentity?: Stage33HitIdentity;
}

interface InspectionActorInput {
  readonly calibrated: boolean;
  readonly issue?: string;
  readonly rigKind?: InspectionRigKind;
  readonly requestedIdentity?: Stage33HitIdentity;
  readonly resolvedSourceIdentity?: Stage33HitIdentity;
}

function renderedSource(kind: InspectionRigKind | undefined): InspectionActorInfo["renderedSource"] {
  switch (kind) {
    case undefined: return "none";
    case "capsule": return "legacy-capsule";
    case "model": return "legacy-model";
    case "calibratedFallback": return "calibrated-fallback";
    case "calibratedModel": return "calibrated-model";
  }
}

export function describeInspectionActor(input: InspectionActorInput): InspectionActorInfo {
  return {
    supported: input.issue === undefined,
    ...(input.issue === undefined ? {} : { issue: input.issue }),
    authority: input.calibrated ? "calibrated" : "legacy",
    ...(input.rigKind === undefined ? {} : { rigKind: input.rigKind }),
    renderedSource: renderedSource(input.rigKind),
    ...(input.requestedIdentity === undefined ? {} : { requestedIdentity: input.requestedIdentity }),
    ...(input.resolvedSourceIdentity === undefined ? {} : { resolvedSourceIdentity: input.resolvedSourceIdentity }),
  };
}
