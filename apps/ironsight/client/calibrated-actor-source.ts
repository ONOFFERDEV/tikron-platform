import rawAdmission from "../config/ww1-soldier-candidate-admission.json";
import {
  SOLDIER_JOINTS,
  WW1_ASSET_MANIFEST,
  type SoldierAsset,
} from "../config/ww1-assets.js";
import type {
  Stage33Faction,
  Stage33HitIdentity,
} from "../src/stage33-hit-calibration.js";
import { STAGE33_HIT_IDENTITIES } from "../src/stage33-hit-calibration.js";

export interface CalibratedActorSource {
  readonly faction: Stage33Faction;
  readonly url: string;
  readonly metaUrl: string;
  readonly expectedGlbSha256: string;
  readonly expectedMetaSha256: string;
  readonly hitComponentSha256: string;
  readonly normalizationTransformSha256: string;
  readonly normalization: CalibratedActorNormalization;
  readonly rig: CalibratedActorRig;
}

export interface CalibratedActorNormalization {
  readonly standHeightM: number;
  readonly sourceHeightM: number;
  readonly baseScale: number;
  readonly localMinY: number;
  readonly feetOffsetY: number;
  readonly rootScale: readonly [number, number, number];
  readonly rootQuaternion: readonly [number, number, number, number];
  readonly rootXZ: readonly [number, number];
  readonly modelYawOffsetRadians: 0;
}

export interface CalibratedActorRig {
  readonly label: string;
  readonly boneCount: number;
  readonly boneNames: readonly string[];
  readonly coreBoneNames: readonly string[];
  readonly coreHitJoints: readonly string[];
}

const CORE_HIT_JOINTS = ["Pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "head"] as const;

function record(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : undefined;
}

function sha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function numbers(value: unknown, length: number): readonly number[] | undefined {
  return Array.isArray(value) && value.length === length &&
    value.every(item => typeof item === "number" && Number.isFinite(item))
    ? value as readonly number[] : undefined;
}

function strings(value: unknown): readonly string[] | undefined {
  return Array.isArray(value) && value.length > 0 &&
    value.every(item => typeof item === "string" && item.length > 0) &&
    new Set(value).size === value.length ? value as readonly string[] : undefined;
}

function sameStrings(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function sameNumbers(actual: readonly number[], expected: readonly number[]): boolean {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function admittedNormalization(
  asset: Readonly<Record<string, unknown>>,
  expectedSha256: string,
): CalibratedActorNormalization | undefined {
  const value = record(asset["runtimeNormalization"]);
  const standHeightM = value?.["standHeightM"];
  const sourceHeightM = value?.["sourceHeightM"];
  const baseScale = value?.["baseScale"];
  const localMinY = value?.["localMinY"];
  const feetOffsetY = value?.["feetOffsetY"];
  const rootScale = numbers(value?.["rootScale"], 3);
  const rootQuaternion = numbers(value?.["rootQuaternion"], 4);
  const rootXZ = numbers(value?.["rootXZ"], 2);
  if (
    value?.["normalizationTransformSha256"] !== expectedSha256 ||
    typeof standHeightM !== "number" || !Number.isFinite(standHeightM) || standHeightM <= 0 ||
    typeof sourceHeightM !== "number" || !Number.isFinite(sourceHeightM) || sourceHeightM <= 0 ||
    typeof baseScale !== "number" || !Number.isFinite(baseScale) || baseScale <= 0 ||
    typeof localMinY !== "number" || !Number.isFinite(localMinY) ||
    typeof feetOffsetY !== "number" || !Number.isFinite(feetOffsetY) ||
    rootScale === undefined || rootScale.some(component => component !== baseScale) ||
    rootQuaternion === undefined || !sameNumbers(rootQuaternion, [0, 0, 0, 1]) ||
    rootXZ === undefined || rootXZ.some(component => component !== 0) ||
    value?.["modelYawOffsetRadians"] !== 0 ||
    Math.abs(baseScale - standHeightM / sourceHeightM) > 1e-9 ||
    Math.abs(feetOffsetY + localMinY * baseScale) > 1e-9
  ) return undefined;
  return { standHeightM, sourceHeightM, baseScale, localMinY, feetOffsetY,
    rootScale: rootScale as CalibratedActorNormalization["rootScale"],
    rootQuaternion: rootQuaternion as CalibratedActorNormalization["rootQuaternion"],
    rootXZ: rootXZ as CalibratedActorNormalization["rootXZ"], modelYawOffsetRadians: 0 };
}

function admittedRig(
  asset: Readonly<Record<string, unknown>>,
  coreBoneNames: readonly string[],
): CalibratedActorRig | undefined {
  const value = record(asset["skeleton"]);
  const label = value?.["label"], boneCount = value?.["boneCount"];
  const coreBoneCount = value?.["coreBoneCount"];
  const boneNames = strings(value?.["boneNames"]);
  const admittedCore = strings(value?.["coreBoneNames"]);
  const coreHitJoints = strings(value?.["coreHitJoints"]);
  if (typeof label !== "string" || typeof boneCount !== "number" || !Number.isInteger(boneCount) ||
    typeof coreBoneCount !== "number" || !Number.isInteger(coreBoneCount) || boneNames === undefined ||
    admittedCore === undefined || coreHitJoints === undefined || boneCount !== boneNames.length ||
    coreBoneCount !== coreBoneNames.length || !label.includes(`-${boneCount}-`) ||
    !sameStrings(admittedCore, coreBoneNames) || !sameStrings(coreHitJoints, CORE_HIT_JOINTS) ||
    admittedCore.some(name => !boneNames.includes(name))) return undefined;
  return { label, boneCount, boneNames, coreBoneNames: admittedCore, coreHitJoints };
}

function factionForTeam(team: number): Stage33Faction | undefined {
  return team === 0 ? "khaki" : team === 1 ? "fieldgrey" : undefined;
}

function admittedAsset(faction: Stage33Faction): Readonly<Record<string, unknown>> | undefined {
  const admission = record(rawAdmission);
  const review = record(admission?.["review"]);
  if (
    admission?.["sourceOfflineAccepted"] !== true ||
    admission["runtimeAccepted"] !== true ||
    typeof admission["kind"] !== "string" ||
    admission["kind"].includes("quarantine") ||
    review?.["status"] !== "accepted" ||
    !sha256(review["sha256"]) ||
    typeof review["evidence"] !== "string" ||
    !Array.isArray(admission["assets"])
  ) return undefined;
  return admission["assets"]
    .map(record)
    .find(candidate => candidate?.["key"] === `soldier-${faction}`);
}

export function calibratedActorSource(
  team: number,
  suppliedIdentity: Stage33HitIdentity,
): CalibratedActorSource | undefined {
  const faction = factionForTeam(team);
  if (faction === undefined || suppliedIdentity.faction !== faction) return undefined;
  const calibratedIdentity = STAGE33_HIT_IDENTITIES[faction];
  if (
    suppliedIdentity.glbSha256 !== calibratedIdentity.glbSha256 ||
    suppliedIdentity.hitComponentSha256 !== calibratedIdentity.hitComponentSha256 ||
    suppliedIdentity.normalizationTransformSha256 !== calibratedIdentity.normalizationTransformSha256
  ) return undefined;

  const manifestAsset: SoldierAsset | undefined = WW1_ASSET_MANIFEST.soldiers
    .find(candidate => candidate.faction === faction);
  const admissionAsset = admittedAsset(faction);
  const normalization = admissionAsset === undefined
    ? undefined
    : admittedNormalization(admissionAsset, suppliedIdentity.normalizationTransformSha256);
  const rig = admissionAsset === undefined ? undefined
    : admittedRig(admissionAsset, manifestAsset?.requiredJoints ?? []);
  if (
    manifestAsset === undefined ||
    manifestAsset.provenance.status !== "accepted" ||
    manifestAsset.provenance.sourceKind !== "licensed-derived" ||
    manifestAsset.provenance.receiptRole !== "hero-character" ||
    manifestAsset.provenance.outputSha256 !== suppliedIdentity.glbSha256 ||
    admissionAsset?.["glbSha256"] !== suppliedIdentity.glbSha256 ||
    normalization === undefined || rig === undefined ||
    !sha256(admissionAsset["metaSha256"]) ||
    admissionAsset["glb"] !== manifestAsset.publicUrl.slice(1) ||
    admissionAsset["meta"] !== manifestAsset.publicUrl.slice(1).replace(/\.glb$/, ".meta.json") ||
    manifestAsset.requiredJoints.length !== SOLDIER_JOINTS.length ||
    manifestAsset.requiredJoints.some((name, index) => name !== SOLDIER_JOINTS[index])
  ) return undefined;

  return {
    faction,
    url: manifestAsset.publicUrl,
    metaUrl: `/${admissionAsset["meta"]}`,
    expectedGlbSha256: suppliedIdentity.glbSha256,
    expectedMetaSha256: admissionAsset["metaSha256"],
    hitComponentSha256: suppliedIdentity.hitComponentSha256,
    normalizationTransformSha256: suppliedIdentity.normalizationTransformSha256,
    normalization,
    rig,
  };
}
