import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOCKETS = ["grip_r", "grip_l", "muzzle", "eject", "sight_rear", "sight_front"];
const SOCKET_POSITIONS = {
  grip_r: [0, 0, 0], grip_l: [0, 0, 0.8], muzzle: [0, 0, 2.1], eject: [0.1, 0, 1.1], sight_rear: [0, 0.1, 1], sight_front: [0, 0.1, 1.9],
};
const motion = (pivotSocket, translation, visibility = "persistent") => ({
  ww1MotionPivotSocket: pivotSocket, ww1MotionTranslation: translation,
  ww1MotionRotationAxis: [0, 0, 1], ww1MotionRotationRadians: 0, ww1MotionVisibility: visibility,
});

function bytes(view) {
  return new Uint8Array(view);
}

function concat(parts) {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.byteLength; }
  return output;
}

function pad4(input, fill = 0) {
  const padding = (4 - (input.byteLength % 4)) % 4;
  if (padding === 0) return input;
  const output = new Uint8Array(input.byteLength + padding);
  output.set(input);
  output.fill(fill, input.byteLength);
  return output;
}

export function fixtureGlb(options = {}) {
  const positions = options.axis === "bad" ? [0, 0, 0, 2, 0, 0, 0, 0.1, 0.1] : [0, 0, 0, 0.1, 0, 2, 0, 0.1, 2];
  if (options.nanVertex) positions[0] = Number.NaN;
  const matrices = Array.from({ length: 16 }, (_, index) => index % 5 === 0 ? 1 : 0);
  if (options.nanSkin) matrices[0] = Number.NaN;
  if (options.singularInverse) matrices.fill(0);
  const hasSkin = options.nanSkin || options.invalidSkinJoint || options.mismatchedInverseBind || options.singularInverse
    || options.negativeWeights || options.badJointsAttribute || options.zeroWeightCount || options.shortWeightCount
    || options.wrongWeightWidth || options.validFloatSkin || options.normalizedU8Skin || options.shortJointsCount
    || options.matrixWeights || options.matrixJoints || options.normalizedU16Skin || options.rawU8Weights
    || options.rawU16Weights || options.normalizedI8Weights || options.normalizedFloatWeights || options.u16Joints || options.normalizedJoints;
  const weights = options.negativeWeights ? [-0.25, 1.25, 0, 0, -0.25, 1.25, 0, 0, -0.25, 1.25, 0, 0] : [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
  const joints = options.badJointsAttribute ? [99, 0, 0, 0, 99, 0, 0, 0, 99, 0, 0, 0] : Array(12).fill(0);
  const weightBytes = (options.normalizedU8Skin || options.rawU8Weights) ? bytes(new Uint8Array(weights.map((value) => options.normalizedU8Skin ? value * 255 : value)).buffer)
    : (options.normalizedU16Skin || options.rawU16Weights) ? bytes(new Uint16Array(weights.map((value) => options.normalizedU16Skin ? value * 65535 : value)).buffer)
      : options.normalizedI8Weights ? bytes(new Int8Array(weights.map((value) => value * 127)).buffer) : bytes(new Float32Array(weights).buffer);
  const jointBytes = options.u16Joints ? bytes(new Uint16Array(joints).buffer) : bytes(new Uint8Array(joints).buffer);
  const lod0Indices = options.signedIndex ? bytes(new Int16Array([0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2]).buffer)
    : bytes(new Uint16Array([0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2]).buffer);
  const chunks = [
    bytes(new Float32Array(positions).buffer), bytes(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]).buffer),
    bytes(new Float32Array([0, 0, 1, 0, 0, 1]).buffer),
    lod0Indices,
    bytes(new Uint16Array([0, 1, 2, 0, 1, 2]).buffer), bytes(new Uint16Array([0, 1, 2]).buffer),
    bytes(new Float32Array(matrices).buffer),
    weightBytes, jointBytes,
  ];
  if (options.outOfRangeIndex) new Uint16Array(chunks[3].buffer)[0] = 65535;
  const offsets = [];
  let byteOffset = 0;
  for (const chunk of chunks) { offsets.push(byteOffset); byteOffset += chunk.byteLength; }
  const binary = pad4(concat(chunks));
  const skinAttributes = hasSkin ? { WEIGHTS_0: 7, JOINTS_0: 8 } : {};
  const attributes = options.omitUvNormal ? { POSITION: 0, ...skinAttributes } : { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2, ...skinAttributes };
  const nodes = [
    { name: options.boltAsset ? "bolt_service_rifle" : "pump_shotgun" }, { name: "LOD0", mesh: 0 }, { name: "LOD1", mesh: 1 }, { name: "LOD2", mesh: 2 },
    ...SOCKETS.map((name) => ({ name, translation: SOCKET_POSITIONS[name] })),
    { name: "chamber", translation: [0, 0, 1.2] }, { name: "magwell", translation: [0, 0, 0.4] }, { name: "clip_mount", translation: [0, 0.1, 1.2] },
    { name: "shell", mesh: 0, translation: [0, 0, 1.2], extras: options.missingSecondaryMotion ? undefined : motion("chamber", [0, -0.08, 0], "transient") },
    ...(options.omitPump ? [] : [{ name: "pump", mesh: options.invalidPartMesh ? 999 : (options.emptyPumpPrimitive || options.zeroIndexPump) ? 3 : 0, translation: [0, 0, 0.8], extras: motion("grip_l", [0, 0, -0.12]) }]),
    ...(options.joinedBolt ? [{ name: "bolt" }] : [{ name: "bolt", mesh: 0, translation: options.badBoltPivot ? [0, 0, 0.4] : [0, 0, 1.2], extras: motion("chamber", [0, 0, -0.085]) }]),
    { name: "clip", mesh: 0, translation: [0, 0.1, 1.2], extras: motion("clip_mount", [0, 0.08, 0], "transient") },
  ];
  if (options.boltAsset && !options.joinedBolt) nodes.find((node) => node.name === "bolt").extras.ww1MotionRotationRadians = 1;
  if (options.offsetGripOrigin) nodes[4].translation = [0.01, 0, 0];
  if (options.parentRotated) {
    nodes.push({ name: "rotated_parent", rotation: [0, Math.SQRT1_2, 0, Math.SQRT1_2], children: nodes.map((_, index) => index) });
  }
  if (options.validTranslation) nodes.push({ name: "translated_parent", translation: [2, 3, 4], children: nodes.map((_, index) => index) });
  if (options.zeroQuaternion) nodes[0].rotation = [0, 0, 0, 0];
  if (options.nodeCycle) nodes[0].children = [0];
  if (options.invalidNodeSkin) nodes[1].skin = 999;
  if (options.zeroMesh) for (const node of nodes) delete node.mesh;
  const skinJoints = options.invalidSkinJoint ? [999] : options.mismatchedInverseBind ? [0, 1] : [0];
  if (hasSkin) for (const node of nodes) if (Number.isSafeInteger(node.mesh)) node.skin = 0;
  const sceneNodes = options.emptyScene ? [] : (options.parentRotated || options.validTranslation) ? [nodes.length - 1] : nodes.map((_, index) => index);
  const meshes = [3, 4, 5].map((indices) => ({ primitives: [{ attributes, indices, mode: 4 }] }));
  if (options.emptyPumpPrimitive) meshes.push({ primitives: [] });
  if (options.zeroIndexPump) meshes.push({ primitives: [{ attributes, indices: 9, mode: 4 }] });
  if (options.onlyEmptyMeshes) for (const mesh of meshes) mesh.primitives = [];
  const json = {
    asset: { version: "2.0", generator: "ww1-audit-test" }, scene: 0, scenes: [{ nodes: sceneNodes }], nodes,
    meshes, buffers: [{ byteLength: binary.byteLength }],
    bufferViews: chunks.map((chunk, index) => ({ buffer: 0, byteOffset: offsets[index], byteLength: options.shortBufferView && index === 0 ? 4 : chunk.byteLength })),
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: "VEC3" }, { bufferView: 1, componentType: 5126, count: 3, type: "VEC3" },
      { bufferView: 2, componentType: 5126, count: 3, type: "VEC2" }, { bufferView: 3, componentType: options.signedIndex ? 5122 : 5123, normalized: options.normalizedIndex || undefined, count: 12, type: "SCALAR" },
      { bufferView: 4, componentType: 5123, count: 6, type: "SCALAR" }, { bufferView: 5, componentType: 5123, count: 3, type: "SCALAR" },
      { bufferView: 6, componentType: 5126, count: 1, type: "MAT4" },
      { bufferView: 7, componentType: (options.normalizedU8Skin || options.rawU8Weights) ? 5121 : (options.normalizedU16Skin || options.rawU16Weights) ? 5123 : options.normalizedI8Weights ? 5120 : 5126, normalized: options.normalizedU8Skin || options.normalizedU16Skin || options.normalizedI8Weights || options.normalizedFloatWeights || undefined, count: options.zeroWeightCount ? 0 : options.shortWeightCount ? 1 : 3, type: options.wrongWeightWidth ? "SCALAR" : options.matrixWeights ? "MAT2" : "VEC4" },
      { bufferView: 8, componentType: options.u16Joints ? 5123 : 5121, normalized: options.normalizedJoints || undefined, count: options.shortJointsCount ? 1 : 3, type: options.matrixJoints ? "MAT2" : "VEC4" },
      { bufferView: 5, componentType: 5123, count: 0, type: "SCALAR" },
    ],
    ...(hasSkin ? { skins: [{ joints: skinJoints, inverseBindMatrices: 6 }] } : {}),
  };
  if (options.normalVec2) json.accessors[1].type = "VEC2";
  if (options.uvScalar) json.accessors[2].type = "SCALAR";
  const jsonChunk = pad4(new TextEncoder().encode(JSON.stringify(json)), 0x20);
  const output = new Uint8Array(12 + 8 + jsonChunk.byteLength + 8 + binary.byteLength);
  const data = new DataView(output.buffer);
  data.setUint32(0, 0x46546c67, true); data.setUint32(4, 2, true); data.setUint32(8, output.byteLength, true);
  data.setUint32(12, jsonChunk.byteLength, true); data.setUint32(16, 0x4e4f534a, true); output.set(jsonChunk, 20);
  const binaryHeader = 20 + jsonChunk.byteLength;
  data.setUint32(binaryHeader, binary.byteLength, true); data.setUint32(binaryHeader + 4, 0x004e4942, true); output.set(binary, binaryHeader + 8);
  return output;
}

const variants = {
  "wrong-axis": { axis: "bad" }, "nan-vertex": { nanVertex: true }, "nan-skin": { nanSkin: true },
  "missing-pump": { omitPump: true }, "nonseparate-bolt": { joinedBolt: true }, "missing-uv-normal": { omitUvNormal: true },
  "invalid-part-mesh": { invalidPartMesh: true }, "out-of-range-index": { outOfRangeIndex: true },
  "short-buffer-view": { shortBufferView: true }, "invalid-skin-joint": { invalidSkinJoint: true },
  "mismatched-inverse-bind": { mismatchedInverseBind: true }, "empty-active-scene": { emptyScene: true },
  "zero-mesh-support": { zeroMesh: true }, "parent-rotated": { parentRotated: true },
  "singular-inverse": { singularInverse: true }, "negative-weights": { negativeWeights: true },
  "bad-joints-attribute": { badJointsAttribute: true },
  "normal-vec2": { normalVec2: true }, "uv-scalar": { uvScalar: true }, "empty-pump-primitive": { emptyPumpPrimitive: true },
  "only-empty-meshes": { onlyEmptyMeshes: true }, "zero-weight-count": { zeroWeightCount: true }, "short-weight-count": { shortWeightCount: true },
  "wrong-weight-width": { wrongWeightWidth: true }, "valid-float-skin": { validFloatSkin: true }, "valid-normalized-u8-skin": { normalizedU8Skin: true },
  "zero-quaternion": { zeroQuaternion: true }, "node-cycle": { nodeCycle: true }, "invalid-node-skin": { invalidNodeSkin: true },
  "short-joints-count": { shortJointsCount: true }, "valid-translation": { validTranslation: true },
  "normalized-index": { normalizedIndex: true }, "signed-index": { signedIndex: true },
  "matrix-weights": { matrixWeights: true }, "matrix-joints": { matrixJoints: true }, "zero-index-pump": { zeroIndexPump: true },
  "valid-normalized-u16-skin": { normalizedU16Skin: true }, "raw-u8-weights": { rawU8Weights: true }, "raw-u16-weights": { rawU16Weights: true },
  "normalized-i8-weights": { normalizedI8Weights: true }, "normalized-float-weights": { normalizedFloatWeights: true },
  "u16-joints": { u16Joints: true }, "normalized-joints": { normalizedJoints: true },
  "offset-grip-origin": { offsetGripOrigin: true },
};

async function writeFixtures(directory) {
  await mkdir(directory, { recursive: true });
  for (const [name, options] of Object.entries(variants)) await writeFile(resolve(directory, `${name}.glb`), fixtureGlb(options));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = process.argv[process.argv.indexOf("--output") + 1];
  if (!output) throw new Error("--output is required");
  await writeFixtures(resolve(output));
}
