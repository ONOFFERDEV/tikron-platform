import { afterEach, describe, expect, it, vi } from "vitest";
import type { CalibratedActorSource } from "../client/calibrated-actor-source.js";
import { SOLDIER_JOINTS } from "../config/ww1-assets.js";
import { HIT_ANIMATION_CLIPS } from "../src/hit-state-bucket.js";
import type { Stage33HitIdentity } from "../src/stage33-hit-calibration.js";

const admission = vi.hoisted(() => vi.fn());
vi.mock("../client/calibrated-actor-source.js", async importOriginal => ({
  ...await importOriginal<typeof import("../client/calibrated-actor-source.js")>(),
  calibratedActorSource: admission,
}));

import { acquireCalibratedActor, calibratedActorCacheSnapshot } from "../client/calibrated-actor-loader.js";

const encoder = new TextEncoder();
const CORE_HIT_JOINTS = ["Pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "head"] as const;
const RIGHT_C195_LEAVES = ["thumb_1_r", "thumb_2_r", "thumb_3_r", "index_1_r", "index_2_r",
  "index_3_r", "middle_1_r", "middle_2_r", "middle_3_r", "ring_1_r", "ring_2_r", "ring_3_r",
  "little_1_r", "little_2_r", "little_3_r"] as const;
const RIGHT70_JOINTS = [...SOLDIER_JOINTS.slice(0, 38), ...RIGHT_C195_LEAVES,
  ...SOLDIER_JOINTS.slice(38)] as const;
const TEST_NORMALIZATION_SHA256 = "d".repeat(64);
const TEST_NORMALIZATION = { standHeightM: 1.8, sourceHeightM: 1.875,
  baseScale: .96, localMinY: -.07, feetOffsetY: .0672,
  rootScale: [.96, .96, .96],
  rootQuaternion: [0, 0, 0, 1], rootXZ: [0, 0], modelYawOffsetRadians: 0 } as const;

function packGlb(json: object, binary?: ArrayBuffer): ArrayBuffer {
  const source = JSON.stringify(json), jsonLength = Math.ceil(source.length / 4) * 4;
  const binaryLength = binary === undefined ? 0 : Math.ceil(binary.byteLength / 4) * 4;
  const bytes = new ArrayBuffer(20 + jsonLength + (binary === undefined ? 0 : 8 + binaryLength));
  const view = new DataView(bytes);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true);
  view.setUint32(8, bytes.byteLength, true); view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(bytes, 20, jsonLength).fill(0x20);
  new Uint8Array(bytes, 20, source.length).set(encoder.encode(source));
  if (binary !== undefined) {
    const offset = 20 + jsonLength;
    view.setUint32(offset, binaryLength, true); view.setUint32(offset + 4, 0x004e4942, true);
    new Uint8Array(bytes, offset + 8, binary.byteLength).set(new Uint8Array(binary));
  }
  return bytes;
}

function namesOnlyGlb(): ArrayBuffer {
  return packGlb({ asset: { version: "2.0" }, scene: 0,
    scenes: [{ nodes: SOLDIER_JOINTS.map((_, index) => index) }],
    nodes: SOLDIER_JOINTS.map(name => ({ name })) });
}

function rigGlb(
  joints: readonly string[] = SOLDIER_JOINTS,
  clips: readonly string[] = HIT_ANIMATION_CLIPS,
): ArrayBuffer {
  const boneCount = joints.length, inverseBindOffset = 96;
  const timeOffset = inverseBindOffset + boneCount * 64;
  const binary = new ArrayBuffer(timeOffset + 40);
  new Float32Array(binary, 0, 9).set([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  new Float32Array(binary, 48, 12).set([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
  const inverseBind = new Float32Array(binary, inverseBindOffset, boneCount * 16);
  for (let index = 0; index < boneCount; index++) {
    inverseBind[index * 16] = 1; inverseBind[index * 16 + 5] = 1;
    inverseBind[index * 16 + 10] = 1; inverseBind[index * 16 + 15] = 1;
  }
  new Float32Array(binary, timeOffset, 2).set([0, 1]);
  new Float32Array(binary, timeOffset + 8, 8).set([0, 0, 0, 1, 0, 0, 0, 1]);
  const boneNodes = joints.map((name, index) => ({ name,
    ...(index + 1 < boneCount ? { children: [index + 2] } : {}) }));
  return packGlb({
    asset: { version: "2.0" }, scene: 0, buffers: [{ byteLength: binary.byteLength }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 12 },
      { buffer: 0, byteOffset: 48, byteLength: 48 },
      { buffer: 0, byteOffset: inverseBindOffset, byteLength: boneCount * 64 },
      { buffer: 0, byteOffset: timeOffset, byteLength: 8 },
      { buffer: 0, byteOffset: timeOffset + 8, byteLength: 32 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [1, 1, 0] },
      { bufferView: 1, componentType: 5121, count: 3, type: "VEC4" },
      { bufferView: 2, componentType: 5126, count: 3, type: "VEC4" },
      { bufferView: 3, componentType: 5126, count: boneCount, type: "MAT4" },
      { bufferView: 4, componentType: 5126, count: 2, type: "SCALAR", min: [0], max: [1] },
      { bufferView: 5, componentType: 5126, count: 2, type: "VEC4" },
    ],
    materials: [{ name: "field-kit" }],
    meshes: [{ primitives: [{ material: 0, attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 } }] }],
    skins: [{ inverseBindMatrices: 3, joints: joints.map((_, index) => index + 1), skeleton: 1 }],
    nodes: [{ name: "LOD0", mesh: 0, skin: 0 }, ...boneNodes],
    animations: clips.map(name => ({ name,
      samplers: [{ input: 4, output: 5, interpolation: "LINEAR" }],
      channels: [{ sampler: 0, target: { node: 1, path: "rotation" } }] })),
    scenes: [{ nodes: [0, 1] }],
  }, binary);
}

async function hash(bytes: ArrayBuffer): Promise<string> {
  const runtime = globalThis as typeof globalThis & {
    readonly crypto: { readonly subtle: { digest(name: string, data: ArrayBuffer): Promise<ArrayBuffer> } };
  };
  const result = await runtime.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(result), value => value.toString(16).padStart(2, "0")).join("");
}

function metadata(source: Omit<CalibratedActorSource, "expectedMetaSha256">, patch: object = {}): ArrayBuffer {
  const bytes = encoder.encode(JSON.stringify({ schemaVersion: 2,
    assetKey: `soldier-${source.faction}`, role: "hero-character", sourceKind: "licensed-derived",
    outputSha256: source.expectedGlbSha256, hitComponentSha256: source.hitComponentSha256,
    skeleton: { label: source.rig.label, boneCount: source.rig.boneCount,
      boneNames: source.rig.boneNames, coreBoneCount: source.rig.coreBoneNames.length,
      coreBoneNames: source.rig.coreBoneNames, coreHitJoints: source.rig.coreHitJoints },
    runtimeNormalization: { ...source.normalization,
      normalizationTransformSha256: source.normalizationTransformSha256 },
    equipmentHitTarget: false, ...patch }));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function fixture(
  glbBytes = rigGlb(),
  metaPatch: object = {},
  boneNames: readonly string[] = SOLDIER_JOINTS,
  label = `ironsight-humanoid-${boneNames.length}-test-v1`,
) {
  const base = { faction: "khaki" as const, url: "/soldier.glb", metaUrl: "/soldier.meta.json",
    expectedGlbSha256: await hash(glbBytes), hitComponentSha256: "c".repeat(64),
    normalizationTransformSha256: TEST_NORMALIZATION_SHA256, normalization: TEST_NORMALIZATION,
    rig: { label, boneCount: boneNames.length, boneNames, coreBoneNames: SOLDIER_JOINTS,
      coreHitJoints: CORE_HIT_JOINTS } };
  const metaBytes = metadata(base, metaPatch);
  const source: CalibratedActorSource = { ...base, expectedMetaSha256: await hash(metaBytes) };
  const identity: Stage33HitIdentity = { faction: base.faction, glbSha256: base.expectedGlbSha256,
    hitComponentSha256: base.hitComponentSha256,
    normalizationTransformSha256: base.normalizationTransformSha256 };
  return { source, identity, glbBytes, metaBytes };
}

function serve(glbBytes: ArrayBuffer, metaBytes: ArrayBuffer): ReturnType<typeof vi.fn> {
  const mock = vi.fn(async (input: string | URL | Request) =>
    new Response(String(input).endsWith(".meta.json") ? metaBytes : glbBytes));
  vi.stubGlobal("fetch", mock); return mock;
}

async function expectRejected(data: Awaited<ReturnType<typeof fixture>>): Promise<void> {
  admission.mockReturnValue(data.source);
  const lease = acquireCalibratedActor(0, data.identity);
  expect(await lease.value).toBeUndefined(); lease.release();
  expect(calibratedActorCacheSnapshot()).toEqual({ entries: 0, pending: 0, ready: 0, references: 0 });
}

afterEach(() => {
  vi.unstubAllGlobals(); vi.restoreAllMocks(); admission.mockReset();
  expect(calibratedActorCacheSnapshot()).toEqual({ entries: 0, pending: 0, ready: 0, references: 0 });
});

describe("verified calibrated actor loader", () => {
  it("keeps unresolved and quarantined identities outside the cache", async () => {
    const data = await fixture(), fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const lease = acquireCalibratedActor(0, data.identity);
    expect(await lease.value).toBeUndefined(); lease.release();
    expect(fetchMock).not.toHaveBeenCalled(); expect(calibratedActorCacheSnapshot().entries).toBe(0);
  });

  it("admits a genuine skinned hierarchy with every authority clip through one shared lease", async () => {
    const data = await fixture(rigGlb(RIGHT70_JOINTS), {}, RIGHT70_JOINTS,
      "ironsight-humanoid-70-c195-right-v1"); admission.mockReturnValue(data.source);
    const fetchMock = serve(data.glbBytes, data.metaBytes);
    const first = acquireCalibratedActor(0, data.identity), second = acquireCalibratedActor(0, data.identity);
    const [a, b] = await Promise.all([first.value, second.value]);
    expect(a?.gltf.scene.getObjectByName("head")?.type).toBe("Bone");
    expect(a?.gltf.scene.getObjectByName("LOD0")?.userData.fieldEquipmentRaycast).toBe(true);
    expect(a?.rig.boneCount).toBe(70); expect(a?.normalization).toEqual(TEST_NORMALIZATION);
    expect(a?.gltf.animations.map(clip => clip.name)).toEqual(expect.arrayContaining([...HIT_ANIMATION_CLIPS]));
    expect(b).toBe(a); expect(fetchMock).toHaveBeenCalledTimes(2);
    first.release(); expect(calibratedActorCacheSnapshot().references).toBe(1); second.release();
  });

  it("rejects wrong hashes and corrupt GLB bytes without retaining cache state", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const wrong = await fixture(); wrong.source = { ...wrong.source, expectedGlbSha256: "0".repeat(64) };
    serve(wrong.glbBytes, wrong.metaBytes); await expectRejected(wrong);
    const corrupt = encoder.encode("not a glb").buffer as ArrayBuffer;
    const corruptData = await fixture(corrupt); serve(corruptData.glbBytes, corruptData.metaBytes);
    await expectRejected(corruptData);
  });

  it("rejects the same GLB with wrong component or normalization metadata", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    for (const patch of [{ hitComponentSha256: "e".repeat(64) },
      { runtimeNormalization: { ...TEST_NORMALIZATION, normalizationTransformSha256: "f".repeat(64) } },
      { runtimeNormalization: { ...TEST_NORMALIZATION, feetOffsetY: .25,
        normalizationTransformSha256: TEST_NORMALIZATION_SHA256 } }]) {
      const data = await fixture(rigGlb(), patch); serve(data.glbBytes, data.metaBytes);
      await expectRejected(data);
    }
  });

  it("does not alias the same URL across different identity certificates", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const accepted = await fixture();
    const rejectedSource = { ...accepted.source, expectedGlbSha256: "0".repeat(64),
      hitComponentSha256: "e".repeat(64) };
    const rejectedIdentity = { ...accepted.identity, glbSha256: rejectedSource.expectedGlbSha256,
      hitComponentSha256: rejectedSource.hitComponentSha256 };
    admission.mockImplementation((_team: number, identity: Stage33HitIdentity) =>
      identity.hitComponentSha256 === accepted.identity.hitComponentSha256
        ? accepted.source : rejectedSource);
    const fetchMock = serve(accepted.glbBytes, accepted.metaBytes);
    const first = acquireCalibratedActor(0, accepted.identity);
    const second = acquireCalibratedActor(0, rejectedIdentity);
    expect(calibratedActorCacheSnapshot()).toMatchObject({ entries: 2, pending: 2, references: 2 });
    expect(await first.value).toBeDefined(); expect(await second.value).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    first.release(); second.release();
  });

  it("rejects named objects without a skin, mis-cased skeleton bones, and missing clips", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    for (const glbBytes of [namesOnlyGlb(),
      rigGlb(SOLDIER_JOINTS.map(name => name === "head" ? "Head" : name)),
      rigGlb(SOLDIER_JOINTS, HIT_ANIMATION_CLIPS.slice(1))]) {
      const data = await fixture(glbBytes); serve(data.glbBytes, data.metaBytes); await expectRejected(data);
    }
  });

  it("drops a released pending load after it settles", async () => {
    const data = await fixture(); admission.mockReturnValue(data.source);
    let unblock: () => void = () => {};
    const blocked = new Promise<void>(resolve => { unblock = resolve; });
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      await blocked; return new Response(String(input).endsWith(".meta.json") ? data.metaBytes : data.glbBytes);
    }));
    const lease = acquireCalibratedActor(0, data.identity); lease.release();
    expect(calibratedActorCacheSnapshot()).toMatchObject({ pending: 1, references: 0 });
    unblock(); expect(await lease.value).toBeUndefined();
    expect(calibratedActorCacheSnapshot()).toEqual({ entries: 0, pending: 0, ready: 0, references: 0 });
  });
});
