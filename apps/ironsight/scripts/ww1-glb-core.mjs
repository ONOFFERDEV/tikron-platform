import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { accessorData, isSingularMatrix } from "./ww1-glb-accessors.mjs";
import { activeSceneGraph, transformPoint } from "./ww1-glb-scene.mjs";
import { auditWeaponMotion } from "./ww1-weapon-motion.mjs";

const SOCKETS = Object.freeze(["grip_r", "grip_l", "muzzle", "eject", "sight_rear", "sight_front"]);
const PARTS = Object.freeze({
  automatic_rifle: ["magazine", "bolt"], trench_smg: ["magazine", "bolt"],
  pump_shotgun: ["pump", "shell"], bolt_service_rifle: ["bolt", "clip"],
  service_pistol: ["slide", "magazine"],
});
const MECHANISM_SOCKETS = Object.freeze({
  automatic_rifle: ["magwell", "chamber"], trench_smg: ["magwell", "chamber"],
  pump_shotgun: ["chamber"], bolt_service_rifle: ["chamber", "clip_mount"],
  service_pistol: ["magwell", "chamber"],
});

function issue(code, path, detail) {
  return detail === undefined ? { code, path } : { code, path, detail };
}

function parseGlb(bytes) {
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67) throw new Error("invalid_glb_magic");
  if (bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error("invalid_glb_header");
  let offset = 12;
  let json;
  let binary;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const end = offset + 8 + length;
    if (end > bytes.length) throw new Error("invalid_glb_chunk");
    if (type === 0x4e4f534a) json = JSON.parse(bytes.subarray(offset + 8, end).toString("utf8").trim());
    if (type === 0x004e4942) binary = bytes.subarray(offset + 8, end);
    offset = end;
  }
  if (json === undefined || binary === undefined) throw new Error("missing_glb_chunk");
  return { json, binary };
}

function auditPrimitives(document, binary, sceneGraph, issues) {
  let triangles = 0;
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  const countedMeshes = new Set();
  for (const { meshIndex, matrix } of sceneGraph.meshInstances) {
    const mesh = document.meshes[meshIndex];
    if (!Array.isArray(mesh.primitives) || mesh.primitives.length === 0) issues.push(issue("empty_mesh", `meshes[${meshIndex}].primitives`));
    for (const [primitiveIndex, primitive] of (mesh.primitives ?? []).entries()) {
      const path = `meshes[${meshIndex}].primitives[${primitiveIndex}]`;
      if ((primitive.mode ?? 4) !== 4 || primitive.indices === undefined) issues.push(issue("non_indexed_triangles", path));
      for (const attribute of ["POSITION", "NORMAL", "TEXCOORD_0"]) {
        if (primitive.attributes?.[attribute] === undefined) issues.push(issue("missing_vertex_attribute", `${path}.${attribute}`));
      }
      const positionData = primitive.attributes?.POSITION === undefined ? { values: [], count: 0 } : accessorData(document, binary, primitive.attributes.POSITION, issues);
      if (positionData.type !== "VEC3" || positionData.componentType !== 5126) issues.push(issue("invalid_attribute_accessor", `${path}.POSITION`));
      const positions = positionData.values;
      for (let offset = 0; offset + 2 < positions.length; offset += 3) {
        const transformed = transformPoint(matrix, positions.slice(offset, offset + 3));
        for (let axis = 0; axis < 3; axis += 1) {
          bounds.min[axis] = Math.min(bounds.min[axis], transformed[axis]);
          bounds.max[axis] = Math.max(bounds.max[axis], transformed[axis]);
        }
      }
      for (const attribute of ["NORMAL", "TEXCOORD_0"]) if (primitive.attributes?.[attribute] !== undefined) {
        const data = accessorData(document, binary, primitive.attributes[attribute], issues);
        if (data.count !== positionData.count) issues.push(issue("attribute_count_mismatch", `${path}.${attribute}`));
        if (data.type !== (attribute === "NORMAL" ? "VEC3" : "VEC2")) issues.push(issue("invalid_attribute_accessor", `${path}.${attribute}`));
      }
      if (primitive.indices !== undefined) {
        const indexData = accessorData(document, binary, primitive.indices, issues);
        const indices = indexData.values;
        if (indexData.type !== "SCALAR" || indexData.normalized || ![5121, 5123, 5125].includes(indexData.componentType)) {
          issues.push(issue("invalid_index_accessor", `${path}.indices`));
        }
        if (indices.some((value) => value >= positionData.count)) issues.push(issue("vertex_index_out_of_range", `${path}.indices`, { vertexCount: positionData.count }));
        if (indices.length % 3 !== 0) issues.push(issue("non_indexed_triangles", path));
        if (!countedMeshes.has(meshIndex)) triangles += Math.floor(indices.length / 3);
      }
    }
    countedMeshes.add(meshIndex);
  }
  if (triangles === 0) issues.push(issue("missing_scene_geometry", "scenes.active"));
  return { triangles, bounds };
}

function auditWeights(document, binary, sceneGraph, issues) {
  for (const [meshIndex, mesh] of (document.meshes ?? []).entries()) for (const primitive of mesh.primitives ?? []) {
    const accessorIndex = primitive.attributes?.WEIGHTS_0;
    const jointsIndex = primitive.attributes?.JOINTS_0;
    if ((accessorIndex === undefined) !== (jointsIndex === undefined)) issues.push(issue("missing_skin_attribute", `meshes[${meshIndex}]`));
    if (accessorIndex !== undefined) {
      const weightsData = accessorData(document, binary, accessorIndex, issues);
      const positionData = accessorData(document, binary, primitive.attributes?.POSITION, issues);
      const values = weightsData.values;
      const validWeightsEncoding = weightsData.componentType === 5126
        ? !weightsData.normalized
        : [5121, 5123].includes(weightsData.componentType) && weightsData.normalized;
      if (weightsData.type !== "VEC4" || !validWeightsEncoding) {
        issues.push(issue("invalid_weights_accessor", `accessors[${accessorIndex}]`));
      }
      if (weightsData.count !== positionData.count) issues.push(issue("skin_attribute_count_mismatch", `accessors[${accessorIndex}]`, { vertices: positionData.count, weights: weightsData.count }));
      for (let offset = 0; offset < values.length; offset += 4) {
        const total = values.slice(offset, offset + 4).reduce((sum, value) => sum + value, 0);
        const weights = values.slice(offset, offset + 4);
        if (!Number.isFinite(total) || Math.abs(total - 1) > 0.01 || weights.some((value) => value < 0 || value > 1)) {
          issues.push(issue("invalid_skin_weights", `meshes[${meshIndex}]`));
        }
      }
    }
    if (jointsIndex !== undefined) {
      const joints = accessorData(document, binary, jointsIndex, issues);
      const positionData = accessorData(document, binary, primitive.attributes?.POSITION, issues);
      const jointLimit = Math.max(0, ...(document.skins ?? []).map((skin) => Array.isArray(skin.joints) ? skin.joints.length : 0));
      if (joints.type !== "VEC4" || joints.normalized || ![5121, 5123].includes(joints.componentType)) {
        issues.push(issue("invalid_joints_accessor", `accessors[${jointsIndex}]`));
      }
      if (joints.count !== positionData.count) issues.push(issue("skin_attribute_count_mismatch", `accessors[${jointsIndex}]`, { vertices: positionData.count, joints: joints.count }));
      if (joints.values.some((value) => value >= jointLimit)) issues.push(issue("joint_index_out_of_range", `accessors[${jointsIndex}]`, { jointCount: jointLimit }));
    }
  }
  for (const [skinIndex, skin] of (document.skins ?? []).entries()) {
    const joints = Array.isArray(skin.joints) ? skin.joints : [];
    if (joints.length === 0) issues.push(issue("missing_skin_joints", `skins[${skinIndex}].joints`));
    for (const [jointOffset, joint] of joints.entries()) {
      if (!Number.isSafeInteger(joint) || !document.nodes?.[joint]) issues.push(issue("invalid_node_reference", `skins[${skinIndex}].joints[${jointOffset}]`, joint));
    }
    if (skin.inverseBindMatrices === undefined) issues.push(issue("missing_inverse_bind", `skins[${skinIndex}]`));
    else {
      const inverseBind = accessorData(document, binary, skin.inverseBindMatrices, issues);
      if (inverseBind.count !== joints.length || inverseBind.width !== 16 || inverseBind.componentType !== 5126) {
        issues.push(issue("inverse_bind_count_mismatch", `skins[${skinIndex}].inverseBindMatrices`, { joints: joints.length, matrices: inverseBind.count }));
      }
      for (let offset = 0; offset + 15 < inverseBind.values.length; offset += 16) {
        if (isSingularMatrix(inverseBind.values.slice(offset, offset + 16))) issues.push(issue("singular_inverse_bind", `skins[${skinIndex}].inverseBindMatrices`));
      }
    }
  }
  for (const nodeIndex of sceneGraph.active) {
    const node = document.nodes[nodeIndex];
    if (!Number.isSafeInteger(node.skin) || !document.skins?.[node.skin] || !Number.isSafeInteger(node.mesh) || !document.meshes?.[node.mesh]) continue;
    const jointCount = document.skins[node.skin].joints?.length ?? 0;
    for (const [primitiveIndex, primitive] of (document.meshes[node.mesh].primitives ?? []).entries()) {
      const jointsIndex = primitive.attributes?.JOINTS_0;
      const weightsIndex = primitive.attributes?.WEIGHTS_0;
      if (jointsIndex === undefined || weightsIndex === undefined) {
        issues.push(issue("missing_skin_attribute", `meshes[${node.mesh}].primitives[${primitiveIndex}]`));
        continue;
      }
      const joints = accessorData(document, binary, jointsIndex, issues);
      if (joints.type !== "VEC4" || joints.normalized || ![5121, 5123].includes(joints.componentType)) {
        issues.push(issue("invalid_joints_accessor", `accessors[${jointsIndex}]`));
      }
      if (joints.values.some((value) => value >= jointCount)) issues.push(issue("joint_index_out_of_range", `accessors[${jointsIndex}]`, { jointCount }));
    }
  }
}

function auditNodes(document, assetKey, sceneGraph, issues) {
  const nodes = document.nodes ?? [];
  const byName = new Map();
  for (const [index, node] of nodes.entries()) {
    if (!sceneGraph.active.has(index)) continue;
    if (typeof node.name !== "string" || node.name.length === 0) continue;
    if (byName.has(node.name)) issues.push(issue("duplicate_node", `nodes[${index}].name`, node.name));
    byName.set(node.name, { node, index });
  }
  for (const name of [...SOCKETS, "LOD0", "LOD1", "LOD2", ...(MECHANISM_SOCKETS[assetKey] ?? [])]) {
    if (!byName.has(name)) issues.push(issue(name.startsWith("LOD") ? "missing_lod" : "missing_socket", `nodes.${name}`));
  }
  const socketPosition = (name) => {
    const entry = byName.get(name);
    return entry ? transformPoint(sceneGraph.world.get(entry.index), [0, 0, 0]) : [0, 0, 0];
  };
  const positions = SOCKETS.map(socketPosition);
  const gripOrigin = positions[0];
  if (!gripOrigin.every((value) => Number.isFinite(value) && Math.abs(value) <= 1e-6)) {
    issues.push(issue("weapon_origin", "nodes.grip_r", { position: gripOrigin, expected: [0, 0, 0] }));
  }
  if (positions.some((value) => !Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) || new Set(positions.map((value) => JSON.stringify(value))).size < 4) {
    issues.push(issue("invalid_socket_transform", "nodes.sockets"));
  }
  const rear = socketPosition("sight_rear"), front = socketPosition("sight_front"), muzzle = socketPosition("muzzle");
  if (!(front[2] > rear[2] && muzzle[2] > front[2])) issues.push(issue("invalid_sight_axis", "nodes.sights"));
  const boreVector = muzzle.map((value, axis) => value - rear[axis]);
  if (!(boreVector[2] > 0 && Math.abs(boreVector[2]) > Math.max(Math.abs(boreVector[0]), Math.abs(boreVector[1])))) {
    issues.push(issue("bore_axis", "nodes.muzzle", { vector: boreVector }));
  }
  if (!byName.has(assetKey)) issues.push(issue("missing_asset_root", `nodes.${assetKey}`));
  const lodMeshes = ["LOD0", "LOD1", "LOD2"].map((name) => byName.get(name)?.node.mesh);
  const lodTriangles = lodMeshes.map((meshIndex) => {
    const mesh = Number.isSafeInteger(meshIndex) ? document.meshes?.[meshIndex] : undefined;
    return (mesh?.primitives ?? []).reduce((total, primitive) => total + Math.floor((document.accessors?.[primitive.indices]?.count ?? 0) / 3), 0);
  });
  if (new Set(lodMeshes).size !== 3 || !(lodTriangles[0] > lodTriangles[1] && lodTriangles[1] > lodTriangles[2] && lodTriangles[2] > 0)) {
    issues.push(issue("invalid_lod", "nodes.LOD0..LOD2", { meshIndices: lodMeshes, triangles: lodTriangles }));
  }
  for (const name of PARTS[assetKey] ?? []) {
    const entry = byName.get(name);
    if (!entry) issues.push(issue("missing_mechanical_part", `nodes.${name}`));
    else if (!Number.isSafeInteger(entry.node.mesh)) issues.push(issue("non_mesh_mechanical_part", `nodes[${entry.index}]`));
    else if (!document.meshes?.[entry.node.mesh]) issues.push(issue("invalid_mesh_reference", `nodes[${entry.index}].mesh`, entry.node.mesh));
    else {
      const primitives = document.meshes[entry.node.mesh].primitives;
      const triangles = Array.isArray(primitives) ? primitives.reduce((total, primitive) => {
        if ((primitive.mode ?? 4) !== 4 || !Number.isSafeInteger(primitive.indices)) return total;
        const count = document.accessors?.[primitive.indices]?.count;
        return total + (Number.isSafeInteger(count) && count >= 3 ? Math.floor(count / 3) : 0);
      }, 0) : 0;
      if (triangles === 0) issues.push(issue("empty_mechanical_part", `nodes[${entry.index}].mesh`));
    }
  }
  issues.push(...auditWeaponMotion(byName, assetKey, socketPosition));
  return { nodes: byName.size, lodTriangles, boreVector };
}

function auditSoldierNodes(document, requiredJoints, sceneGraph, issues) {
  const nodes = document.nodes ?? [];
  const names = new Set(nodes.map((node, index) => sceneGraph.active.has(index) ? node.name : undefined).filter((name) => typeof name === "string"));
  for (const joint of requiredJoints ?? []) if (!names.has(joint)) issues.push(issue("missing_rig_joint", `nodes.${joint}`));
  for (const lod of ["LOD0", "LOD1", "LOD2"]) if (!names.has(lod)) issues.push(issue("missing_lod", `nodes.${lod}`));
  if (!Array.isArray(document.skins) || document.skins.length === 0) issues.push(issue("missing_skin", "skins"));
  return { nodes: names.size };
}

export function auditGlb(input, options) {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  const issues = [];
  let parsed;
  try { parsed = parseGlb(bytes); } catch (error) {
    return { valid: false, sha256: createHash("sha256").update(bytes).digest("hex"), issues: [issue("invalid_glb", "$", error.message)] };
  }
  const { json, binary } = parsed;
  const sceneGraph = activeSceneGraph(json, issues);
  const metrics = auditPrimitives(json, binary, sceneGraph, issues);
  auditWeights(json, binary, sceneGraph, issues);
  const nodeMetrics = options.role === "weapon" ? auditNodes(json, options.assetKey, sceneGraph, issues)
    : options.role === "soldier" ? auditSoldierNodes(json, options.requiredJoints, sceneGraph, issues)
      : { nodes: sceneGraph.active.size };
  const size = metrics.bounds.max.map((value, index) => value - metrics.bounds.min[index]);
  if (options.role === "weapon" && size.every(Number.isFinite) && size[2] <= size[0] * 1.5) {
    issues.push(issue("bore_axis", "meshes.POSITION", { size }));
  }
  if (options.expectedSha256 && createHash("sha256").update(bytes).digest("hex") !== options.expectedSha256) issues.push(issue("hash_mismatch", "$"));
  return { valid: issues.length === 0, sha256: createHash("sha256").update(bytes).digest("hex"), metrics: { bytes: bytes.length, triangles: metrics.triangles, ...nodeMetrics, bounds: metrics.bounds }, issues };
}

export const WW1_WEAPON_PARTS = PARTS;
