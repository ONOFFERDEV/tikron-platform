import { SkinnedMesh } from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { HIT_ANIMATION_CLIPS } from "../src/hit-state-bucket.js";
import type { Stage33HitIdentity } from "../src/stage33-hit-calibration.js";
import { prepareSoldierAtlas } from "./field-equipment.js";
import {
  SharedAssetCache,
  disposeGltfTemplate,
  type AssetCacheSnapshot,
  type AssetLease,
} from "./shared-gltf-cache.js";
import {
  calibratedActorSource,
  type CalibratedActorNormalization,
  type CalibratedActorRig,
  type CalibratedActorSource,
} from "./calibrated-actor-source.js";

export interface CalibratedActorTemplate {
  readonly gltf: GLTF;
  readonly source: CalibratedActorSource;
  readonly normalization: CalibratedActorNormalization;
  readonly rig: CalibratedActorRig;
  readonly equipmentHitTarget: false;
}

function record(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : undefined;
}

async function digest(bytes: ArrayBuffer): Promise<string> {
  const runtime = globalThis as typeof globalThis & {
    readonly crypto: { readonly subtle: { digest(name: string, data: ArrayBuffer): Promise<ArrayBuffer> } };
  };
  const result = await runtime.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(result), value => value.toString(16).padStart(2, "0")).join("");
}

function sameValues(value: unknown, expected: readonly unknown[]): boolean {
  return Array.isArray(value) && value.length === expected.length &&
    value.every((item, index) => item === expected[index]);
}

function metadataNormalization(
  bytes: ArrayBuffer,
  source: CalibratedActorSource,
): CalibratedActorNormalization | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
  const metadata = record(parsed);
  const normalization = record(metadata?.["runtimeNormalization"]);
  const skeleton = record(metadata?.["skeleton"]);
  if (!(metadata?.["schemaVersion"] === 2 &&
    metadata["assetKey"] === `soldier-${source.faction}` &&
    metadata["role"] === "hero-character" &&
    metadata["sourceKind"] === "licensed-derived" &&
    metadata["outputSha256"] === source.expectedGlbSha256 &&
    metadata["hitComponentSha256"] === source.hitComponentSha256 &&
    metadata["equipmentHitTarget"] === false &&
    skeleton?.["label"] === source.rig.label && skeleton["boneCount"] === source.rig.boneCount &&
    skeleton["coreBoneCount"] === source.rig.coreBoneNames.length &&
    sameValues(skeleton["boneNames"], source.rig.boneNames) &&
    sameValues(skeleton["coreBoneNames"], source.rig.coreBoneNames) &&
    sameValues(skeleton["coreHitJoints"], source.rig.coreHitJoints) &&
    normalization?.["normalizationTransformSha256"] === source.normalizationTransformSha256 &&
    normalization["standHeightM"] === source.normalization.standHeightM &&
    normalization["sourceHeightM"] === source.normalization.sourceHeightM &&
    normalization?.["baseScale"] === source.normalization.baseScale &&
    normalization["localMinY"] === source.normalization.localMinY &&
    normalization["feetOffsetY"] === source.normalization.feetOffsetY &&
    sameValues(normalization["rootScale"], source.normalization.rootScale) &&
    sameValues(normalization["rootQuaternion"], source.normalization.rootQuaternion) &&
    sameValues(normalization["rootXZ"], source.normalization.rootXZ) &&
    normalization["modelYawOffsetRadians"] === 0)) return undefined;
  return source.normalization;
}

function sourceKey(source: CalibratedActorSource): string {
  return JSON.stringify(source);
}

function rigMatches(gltf: GLTF, source: CalibratedActorSource): boolean {
  const clipNames = new Set(gltf.animations.map(clip => clip.name));
  if (HIT_ANIMATION_CLIPS.some(name => !clipNames.has(name))) return false;
  const skeletons: string[][] = [];
  gltf.scene.traverse(object => {
    if (!(object instanceof SkinnedMesh)) return;
    skeletons.push(object.skeleton.bones.filter(bone => bone.isBone).map(bone => bone.name));
  });
  return skeletons.length > 0 && skeletons.every(names => sameValues(names, source.rig.boneNames));
}

async function loadVerifiedSource(key: string): Promise<CalibratedActorTemplate> {
  const source = JSON.parse(key) as CalibratedActorSource;
  const [glbResponse, metaResponse] = await Promise.all([fetch(source.url), fetch(source.metaUrl)]);
  if (!glbResponse.ok || !metaResponse.ok) throw new Error("calibrated_actor_fetch");
  const [glbBytes, metaBytes] = await Promise.all([glbResponse.arrayBuffer(), metaResponse.arrayBuffer()]);
  const [glbSha256, metaSha256] = await Promise.all([digest(glbBytes), digest(metaBytes)]);
  if (glbSha256 !== source.expectedGlbSha256 || metaSha256 !== source.expectedMetaSha256)
    throw new Error("calibrated_actor_hash");
  const normalization = metadataNormalization(metaBytes, source);
  if (normalization === undefined) throw new Error("calibrated_actor_metadata");
  const base = source.url.slice(0, source.url.lastIndexOf("/") + 1);
  const gltf = await new GLTFLoader().parseAsync(glbBytes, base);
  if (!rigMatches(gltf, source)) {
    disposeGltfTemplate(gltf);
    throw new Error("calibrated_actor_rig");
  }
  prepareSoldierAtlas(gltf.scene);
  return { gltf, source, normalization, rig: source.rig, equipmentHitTarget: false };
}

const cache = new SharedAssetCache<CalibratedActorTemplate>(
  loadVerifiedSource,
  value => disposeGltfTemplate(value.gltf),
);
const warned = new Set<string>();

export function acquireCalibratedActor(
  team: number,
  identity: Stage33HitIdentity,
): AssetLease<CalibratedActorTemplate> {
  const source = calibratedActorSource(team, identity);
  if (source === undefined) return { value: Promise.resolve(undefined), release: () => undefined };
  const key = sourceKey(source);
  const lease = cache.acquire(key);
  return {
    value: lease.value.catch((error: unknown) => {
      if (!warned.has(key)) {
        warned.add(key);
        console.warn(`[calibrated-actor-loader] rejected ${source.url}; using calibrated fallback`, error);
      }
      return undefined;
    }),
    release: lease.release,
  };
}

export function calibratedActorCacheSnapshot(): AssetCacheSnapshot {
  return cache.snapshot();
}
