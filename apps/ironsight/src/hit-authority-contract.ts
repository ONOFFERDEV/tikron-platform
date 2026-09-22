import rawAdmission from "../config/ww1-soldier-candidate-admission.json";
import { SOLDIER_JOINTS, WW1_ASSET_MANIFEST } from "../config/ww1-assets.js";
import { GAME } from "./game-config.js";
import type { HitAuthorityEvaluator } from "./hit-authority-history.js";
import { HIT_RIG_COMPONENT_SHA256, HIT_RIG_NORMALIZATION_SHA256, HIT_RIG_POSE_DATA } from "./hit-rig-pose-data.js";
import { sampleStage33HitRigPose } from "./hit-rig-pose.js";
import type { HitStateBucketPolicy } from "./hit-state-bucket.js";
import { STAGE33_HIT_IDENTITIES, type Stage33Faction, type Stage33HitIdentity } from "./stage33-hit-calibration.js";

export interface BundledHitAuthorityContract {
  readonly hitAnimationPolicy: HitStateBucketPolicy;
  readonly evaluator: HitAuthorityEvaluator;
  readonly identities: Readonly<Record<Stage33Faction, Stage33HitIdentity>>;
  identityForTeam(team: number): Stage33HitIdentity | undefined;
}

function record(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : undefined;
}

function sha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function strings(value: unknown): readonly string[] | undefined {
  return Array.isArray(value) && value.length > 0
    && value.every(item => typeof item === "string" && item.length > 0)
    && new Set(value).size === value.length
    ? value as readonly string[]
    : undefined;
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function admittedFaction(
  admission: Readonly<Record<string, unknown>>,
  faction: Stage33Faction,
): boolean {
  const identity = STAGE33_HIT_IDENTITIES[faction];
  const poseData = HIT_RIG_POSE_DATA.factions[faction];
  const assets = admission["assets"];
  if (!Array.isArray(assets) || assets.length !== 2 || poseData.glbSha256 !== identity.glbSha256
    || HIT_RIG_COMPONENT_SHA256[faction] !== identity.hitComponentSha256
    || HIT_RIG_NORMALIZATION_SHA256 !== identity.normalizationTransformSha256) return false;
  const asset = assets.map(record).find(candidate => candidate?.["key"] === `soldier-${faction}`);
  const normalization = record(asset?.["runtimeNormalization"]);
  const skeleton = record(asset?.["skeleton"]);
  const boneCount = skeleton?.["boneCount"];
  const boneNames = strings(skeleton?.["boneNames"]);
  const coreBoneNames = strings(skeleton?.["coreBoneNames"]);
  const evaluatorBones = HIT_RIG_POSE_DATA.rig.bones.map(bone => bone.name);
  const manifest = WW1_ASSET_MANIFEST.soldiers.find(candidate => candidate.faction === faction);
  return asset !== undefined && manifest !== undefined
    && asset["glb"] === `assets/ww1/characters/soldier-${faction}.glb`
    && asset["glbSha256"] === identity.glbSha256
    && sha256(asset["metaSha256"])
    && asset["hitComponentSha256"] === identity.hitComponentSha256
    && asset["normalizationTransformSha256"] === identity.normalizationTransformSha256
    && normalization?.["normalizationTransformSha256"] === identity.normalizationTransformSha256
    && normalization["baseScale"] === poseData.baseScale
    && normalization["localMinY"] === poseData.localMinY
    && typeof boneCount === "number" && Number.isInteger(boneCount)
    && boneNames !== undefined && boneCount === boneNames.length
    && coreBoneNames !== undefined && sameStrings(coreBoneNames, SOLDIER_JOINTS)
    && evaluatorBones.every(name => boneNames.includes(name) && coreBoneNames.includes(name))
    && manifest.publicUrl === `/${asset["glb"]}`
    && sameStrings(manifest.requiredJoints, SOLDIER_JOINTS)
    && manifest.provenance.status === "accepted"
    && manifest.provenance.sourceKind === "licensed-derived"
    && manifest.provenance.receiptRole === "hero-character"
    && manifest.provenance.outputSha256 === identity.glbSha256;
}

function admitted(): boolean {
  const admission = record(rawAdmission);
  const review = record(admission?.["review"]);
  return admission !== undefined
    && (admission["schemaVersion"] === 1 || admission["schemaVersion"] === 2)
    && admission["kind"] === "ww1-licensed-derived-soldier-admission"
    && admission["candidateStatus"] === "accepted"
    && admission["sourceOfflineAccepted"] === true
    && admission["runtimeAccepted"] === true
    && review?.["status"] === "accepted"
    && typeof review["evidence"] === "string" && review["evidence"].length > 0
    && sha256(review["sha256"])
    && admittedFaction(admission, "khaki")
    && admittedFaction(admission, "fieldgrey");
}

export function createBundledHitAuthorityContract(): BundledHitAuthorityContract | undefined {
  if (!admitted()) return undefined;
  const hitAnimationPolicy: HitStateBucketPolicy = {
    idleMax: 0.5,
    walkMax: 7,
    crouchSpeed: GAME.move.crouch,
    hasCrouchClips: true,
    hasSprintClip: true,
    weaponFamilies: ["rifle", "smg", "shotgun", "sniper", "pistol"],
  };
  return {
    hitAnimationPolicy,
    evaluator: sampleStage33HitRigPose,
    identities: STAGE33_HIT_IDENTITIES,
    identityForTeam(team) {
      return team === 0 ? STAGE33_HIT_IDENTITIES.khaki
        : team === 1 ? STAGE33_HIT_IDENTITIES.fieldgrey
          : undefined;
    },
  };
}
