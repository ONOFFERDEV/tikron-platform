import type { SoldierHitVolume } from "./hit-calibration.js";
import { HIT_ANIMATION_CLIPS, type HitAnimationClip } from "./hit-state-bucket.js";
import type { Vec3 } from "./physics.js";
import dataset from "./data/stage33-hit-calibration.json";

export type Stage33Faction = "khaki" | "fieldgrey";

export interface Stage33HitIdentity {
  readonly faction: Stage33Faction;
  readonly glbSha256: string;
  readonly hitComponentSha256: string;
  readonly normalizationTransformSha256: string;
}

export interface Stage33MeasuredHit {
  readonly hitVolume: SoldierHitVolume;
  readonly headRadius: number;
  readonly interpolationErrorM: number;
}

export interface Stage33HitProvider {
  readonly activation: false;
  readonly knotCount: 830;
  readonly certificate: typeof STAGE33_HIT_SOURCE_CERTIFICATE;
  duration(identity: Stage33HitIdentity, clip: string): number | undefined;
  at(identity: Stage33HitIdentity, clip: string, timeSeconds: number): Stage33MeasuredHit | undefined;
}

const NORMALIZATION_SHA256 = "c78b21e423da0d57a737ed66b782c38c84d3b7f04036cc765308ea62e6a65387";
const SOURCE_DATASET_SHA256 = "4e32de0849cc8b7012788583e1a414fe6c7911337ba336dff76974165d420e7a";
const REVIEW_SHA256 = "b3257efa71fdbbce0d30bbcfb523077836f7830279c67af452c0177cc65a1f1b";
const CLIP_TABLE_SHA256 = "13dfcd2a23e44af6e491c7e8f11934db3f9ad25901019a7523199a3b7b56fc12";
const SCENE_SHA256 = "dade2f2e28ed8f021261b718638143477f34114a50f6ab1bc08ed3a93977739b";
const RIG_LOADER_SHA256 = "c6d43461ea77b0921a4d7eef928d5a4f4250c5cd12c13f9e3bc20fe864c5e1bd";
const SAMPLER_SHA256 = "c442b198fdf91e40745530605fac55bb765511b9099df9b6e8d3fe069bd503e3";
const INTERPOLATION_BUDGET_M = 0.005;
const COMPACT_DATASET_SHA256 = "1899a3cb6a4960bdffeacf7f583a4f2f271e79fb43c424c84fd62a0e87281d92";

export const STAGE33_HIT_IDENTITIES = {
  khaki: {
    faction: "khaki",
    glbSha256: "0f582be0ec60ba9c40f810cbaeecde647616f0802c4516fc199c2bf2c5dec0e6",
    hitComponentSha256: "94493e3e0d27d4e7d2da0697f315312c6aec73540bc24e8bc6a3967881b71887",
    normalizationTransformSha256: NORMALIZATION_SHA256,
  },
  fieldgrey: {
    faction: "fieldgrey",
    glbSha256: "0572984eb4bc485fcab703c2d59ad7f34b2faca5e97bfd84c65886ebe3652edf",
    hitComponentSha256: "d51dcc3dbfc18fa34dbd641db38fb54b40d4df1f354954ea2938032fba619d47",
    normalizationTransformSha256: NORMALIZATION_SHA256,
  },
} as const satisfies Record<Stage33Faction, Stage33HitIdentity>;

export const STAGE33_HIT_SOURCE_CERTIFICATE = {
  activation: false,
  acceptsExternalData: false,
  bundledGeneratedData: true,
  sourceDatasetSha256: SOURCE_DATASET_SHA256,
  independentReviewSha256: REVIEW_SHA256,
  clipTableSha256: CLIP_TABLE_SHA256,
  sceneRuntimeSha256: SCENE_SHA256,
  rigLoaderRuntimeSha256: RIG_LOADER_SHA256,
  samplerSha256: SAMPLER_SHA256,
  interpolationQualified: true,
  interpolationBudgetM: INTERPOLATION_BUDGET_M,
  heldoutHeadCenterMaxM: 0.0039870625547406358,
  heldoutHeadRadiusMaxM: 2.1105363318119075e-8,
  heldoutTorsoTopMaxM: 0.003606148345275173,
  steadyStateOnly: true,
  transitionQualified: false,
  reactionQualified: false,
  activationBlocked: true,
  compactDatasetSha256: COMPACT_DATASET_SHA256,
} as const;

interface Knot {
  readonly fraction: number;
  readonly headCenter: Vec3;
  readonly headRadius: number;
  readonly bodyTopY: number;
}

interface Table {
  readonly duration: number;
  readonly knots: readonly Knot[];
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function finite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function vec3(value: unknown): Vec3 | undefined {
  if (!Array.isArray(value) || value.length !== 3) return undefined;
  const x = finite(value[0]), y = finite(value[1]), z = finite(value[2]);
  return x === undefined || y === undefined || z === undefined ? undefined : { x, y, z };
}

function identityMatches(identity: Stage33HitIdentity): boolean {
  const expected = STAGE33_HIT_IDENTITIES[identity.faction];
  return expected !== undefined && identity.glbSha256 === expected.glbSha256
    && identity.hitComponentSha256 === expected.hitComponentSha256
    && identity.normalizationTransformSha256 === expected.normalizationTransformSha256;
}

function matchesBinding(bindings: Record<string, unknown>, faction: Stage33Faction): boolean {
  return bindings[faction] === STAGE33_HIT_IDENTITIES[faction].glbSha256;
}

function parseKnot(value: unknown): Knot | undefined {
  if (!Array.isArray(value) || value.length !== 4) return undefined;
  const fraction = finite(value[0]), headCenter = vec3(value[1]);
  const headRadius = finite(value[2]), bodyTopY = finite(value[3]);
  if (fraction === undefined || fraction < 0 || fraction >= 1 || headCenter === undefined
    || headRadius === undefined || headRadius <= 0 || bodyTopY === undefined) return undefined;
  return { fraction, headCenter, headRadius, bodyTopY };
}

function measured(a: Knot, b: Knot, fraction: number): Stage33MeasuredHit {
  const selected = fraction === a.fraction ? a : fraction === b.fraction ? b : undefined;
  const t = selected === undefined ? (fraction - a.fraction) / (b.fraction - a.fraction) : 0;
  const lerp = (left: number, right: number): number => selected === undefined
    ? left + (right - left) * t
    : selected === a ? left : right;
  const interpolationErrorM = selected === undefined ? INTERPOLATION_BUDGET_M : 0;
  return {
    hitVolume: {
      headCenter: {
        x: lerp(a.headCenter.x, b.headCenter.x),
        y: lerp(a.headCenter.y, b.headCenter.y),
        z: lerp(a.headCenter.z, b.headCenter.z),
      },
      bodyTopY: lerp(a.bodyTopY, b.bodyTopY) + interpolationErrorM,
    },
    headRadius: lerp(a.headRadius, b.headRadius) + interpolationErrorM,
    interpolationErrorM,
  };
}

export function createStage33HitProvider(): Stage33HitProvider | undefined {
  const root = record(dataset), bindings = record(root?.["bindings"]);
  const components = record(root?.["hitComponentBindings"]);
  if (root === undefined || bindings === undefined || components === undefined || root["schemaVersion"] !== 2
    || root["activation"] !== false || root["sourceDatasetSha256"] !== SOURCE_DATASET_SHA256
    || root["independentReviewSha256"] !== REVIEW_SHA256 || root["clipTableSha256"] !== CLIP_TABLE_SHA256
    || root["sceneRuntimeSha256"] !== SCENE_SHA256 || root["rigLoaderRuntimeSha256"] !== RIG_LOADER_SHA256
    || root["samplerSha256"] !== SAMPLER_SHA256 || root["normalizationTransformSha256"] !== NORMALIZATION_SHA256
    || root["interpolationBudgetM"] !== INTERPOLATION_BUDGET_M || root["sourceToleranceM"] !== 0.004
    || root["knotCount"] !== 830 || !matchesBinding(bindings, "khaki")
    || !matchesBinding(bindings, "fieldgrey")
    || components["khaki"] !== STAGE33_HIT_IDENTITIES.khaki.hitComponentSha256
    || components["fieldgrey"] !== STAGE33_HIT_IDENTITIES.fieldgrey.hitComponentSha256
    || !Array.isArray(root["tables"])
    || root["tables"].length !== 60) return undefined;

  const tables = new Map<string, Table>();
  let knotCount = 0;
  for (const value of root["tables"]) {
    const raw = record(value), duration = finite(raw?.["duration"]);
    const faction = raw?.["faction"], clip = raw?.["clip"];
    if (raw === undefined || (faction !== "khaki" && faction !== "fieldgrey")
      || typeof clip !== "string" || !HIT_ANIMATION_CLIPS.includes(clip as HitAnimationClip)
      || duration === undefined || duration <= 0 || !Array.isArray(raw["knots"])) return undefined;
    const knots = raw["knots"].map(parseKnot);
    if (knots.some(knot => knot === undefined) || knots.length < 4 || knots.length > 24) return undefined;
    const parsed = knots as Knot[];
    if (parsed[0]!.fraction !== 0 || parsed.at(-1)!.fraction !== 0.9999
      || parsed.some((knot, index) => index > 0 && knot.fraction <= parsed[index - 1]!.fraction)) return undefined;
    const key = `${faction}:${clip}`;
    if (tables.has(key)) return undefined;
    tables.set(key, { duration, knots: parsed });
    knotCount += parsed.length;
  }
  if (knotCount !== 830 || tables.size !== 60
    || HIT_ANIMATION_CLIPS.some(clip => tables.get(`khaki:${clip}`)?.duration
      !== tables.get(`fieldgrey:${clip}`)?.duration)) return undefined;

  return {
    activation: false,
    knotCount: 830,
    certificate: STAGE33_HIT_SOURCE_CERTIFICATE,
    duration(identity, clip) {
      return identityMatches(identity) ? tables.get(`${identity.faction}:${clip}`)?.duration : undefined;
    },
    at(identity, clip, timeSeconds) {
      if (!identityMatches(identity) || !Number.isFinite(timeSeconds) || timeSeconds < 0) return undefined;
      const table = tables.get(`${identity.faction}:${clip}`);
      if (table === undefined) return undefined;
      const fraction = (timeSeconds % table.duration) / table.duration;
      const upper = table.knots.findIndex(knot => knot.fraction >= fraction);
      if (upper === 0) return measured(table.knots[0]!, table.knots[1]!, fraction);
      if (upper > 0) return measured(table.knots[upper - 1]!, table.knots[upper]!, fraction);
      return measured(table.knots.at(-1)!, { ...table.knots[0]!, fraction: 1 }, fraction);
    },
  };
}
