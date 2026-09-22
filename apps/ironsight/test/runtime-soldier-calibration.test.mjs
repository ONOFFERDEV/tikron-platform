import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
import { join } from "node:path";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { describe, expect, it } from "vitest";
import { fitOperatorKit } from "../client/operator-kit.js";

const COMMON = ["crouch_idle", "crouch_walk", "death", "hit_chest", "hit_head", "idle", "run", "sprint", "walk"];
const PREFIXES = ["rifle", "smg", "shotgun", "sniper", "pistol"];
const STATES = ["idle", "walk", "run", "sprint", "crouch_idle", "crouch_walk", "strafe_left",
  "strafe_right", "backpedal", "crouch_left", "crouch_right"];
const EXPECTED = [...COMMON, ...PREFIXES.flatMap(prefix => STATES.map(state => `${prefix}_${state}`))].sort();
const HEAD_BONES = new Set(["head", "neck_01"]), TORSO_BONES = new Set(["Pelvis", "spine_01", "spine_02", "spine_03"]);
const KITS = ["anchor", "flanker", "sniper"];

function sha(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

function normalizationTransformSignature(value) {
  return sha({ standHeight: value.standHeight, height: value.height, baseScale: value.baseScale,
    localMinY: value.localMinY, feetOffsetY: value.feetOffsetY });
}

async function load(path) {
  const bytes = await readFile(path), sha256 = createHash("sha256").update(bytes).digest("hex");
  const jsonLength = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  for (const material of document.materials ?? []) {
    if (material.pbrMetallicRoughness) {
      delete material.pbrMetallicRoughness.baseColorTexture;
      delete material.pbrMetallicRoughness.metallicRoughnessTexture;
    }
    delete material.normalTexture; delete material.occlusionTexture; delete material.emissiveTexture;
  }
  document.images = []; document.textures = []; document.samplers = [];
  const raw = Buffer.from(JSON.stringify(document)), json = Buffer.alloc(Math.ceil(raw.length / 4) * 4, 32); raw.copy(json);
  const tail = bytes.subarray(20 + jsonLength), stripped = Buffer.alloc(20 + json.length + tail.length);
  stripped.writeUInt32LE(0x46546c67, 0); stripped.writeUInt32LE(2, 4); stripped.writeUInt32LE(stripped.length, 8);
  stripped.writeUInt32LE(json.length, 12); stripped.writeUInt32LE(0x4e4f534a, 16); json.copy(stripped, 20); tail.copy(stripped, 20 + json.length);
  const data = stripped.buffer.slice(stripped.byteOffset, stripped.byteOffset + stripped.byteLength);
  return { gltf: await new GLTFLoader().parseAsync(data, ""), sha256,
    meshNodes: document.nodes?.filter(node => node.mesh !== undefined).map(node => node.name) ?? [] };
}

function ancestry(node) {
  const names = [];
  for (let current = node; current; current = current.parent) names.unshift(current.name || current.type);
  return names;
}

function lodOf(node) { return ancestry(node).find(name => /^LOD[0-2]$/.test(name)); }

function visibleInHierarchy(node) {
  for (let current = node; current; current = current.parent) if (!current.visible) return false;
  return true;
}

function materialName(node) {
  expect(Array.isArray(node.material)).toBe(false);
  return node.material.name;
}

function selectedWeight(mesh, vertex, bones) {
  const indices = mesh.geometry.getAttribute("skinIndex"), weights = mesh.geometry.getAttribute("skinWeight");
  let selected = 0;
  for (let lane = 0; lane < 4; lane += 1) {
    if (bones.has(mesh.skeleton.bones[indices.getComponent(vertex, lane)]?.name)) selected += weights.getComponent(vertex, lane);
  }
  return selected;
}

function renderableInventory(root) {
  const inventory = [];
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    inventory.push({ path: ancestry(node).join("/"), node: node.name, lod: lodOf(node), material: materialName(node),
      visibleAfterAppearance: visibleInHierarchy(node), skinned: node instanceof THREE.SkinnedMesh,
      vertices: node.geometry.getAttribute("position")?.count ?? 0,
      triangles: (node.geometry.index?.count ?? 0) / 3, operatorKit: node.userData.operatorKit ?? null,
      originalVertices: node.geometry.userData.originalVertices ?? null,
      equipmentStartTriangle: node.geometry.userData.equipmentStartTriangle ?? null,
      equipmentHitTarget: node.geometry.userData.hitTarget ?? null });
  });
  return inventory;
}

function contaminationCounts(root, bones) {
  const counts = {};
  root.traverse(node => {
    if (!(node instanceof THREE.SkinnedMesh)) return;
    const key = `${lodOf(node)}/${materialName(node)}`, positions = node.geometry.getAttribute("position");
    let count = 0;
    for (let vertex = 0; vertex < positions.count; vertex += 1) if (selectedWeight(node, vertex, bones) >= .45) count += 1;
    counts[key] = (counts[key] ?? 0) + count;
  });
  return counts;
}

function hitMeshes(root, faction) {
  const meshes = [];
  root.traverse(node => {
    if (node instanceof THREE.SkinnedMesh && lodOf(node) === "LOD0" && materialName(node) === `${faction}-wool`) meshes.push(node);
  });
  expect(meshes).toHaveLength(1);
  return meshes;
}

function regionBounds(meshes, bones) {
  const points = [], point = new THREE.Vector3();
  for (const mesh of meshes) {
    mesh.skeleton.update();
    const positions = mesh.geometry.getAttribute("position"), originalVertices = mesh.geometry.userData.originalVertices ?? positions.count;
    for (let vertex = 0; vertex < originalVertices; vertex += 1) {
      if (selectedWeight(mesh, vertex, bones) < .45) continue;
      point.fromBufferAttribute(positions, vertex); mesh.applyBoneTransform(vertex, point); mesh.localToWorld(point); points.push(point.clone());
    }
  }
  expect(points.length).toBeGreaterThan(100);
  const box = new THREE.Box3().setFromPoints(points), center = box.getCenter(new THREE.Vector3());
  return { min: box.min.toArray(), max: box.max.toArray(), center: center.toArray(),
    radius: Math.max(...points.map(candidate => candidate.distanceTo(center))), vertices: points.length };
}

function componentSignature(meshes, regions) {
  const records = [];
  for (const mesh of meshes) {
    const positions = mesh.geometry.getAttribute("position"), indices = mesh.geometry.getAttribute("skinIndex");
    const weights = mesh.geometry.getAttribute("skinWeight"), originalVertices = mesh.geometry.userData.originalVertices ?? positions.count;
    for (let vertex = 0; vertex < originalVertices; vertex += 1) {
      const memberships = regions.filter(region => selectedWeight(mesh, vertex, region.bones) >= .45).map(region => region.name);
      if (!memberships.length) continue;
      records.push({ vertex, memberships, position: [positions.getX(vertex), positions.getY(vertex), positions.getZ(vertex)],
        joints: [0, 1, 2, 3].map(lane => indices.getComponent(vertex, lane)),
        weights: [0, 1, 2, 3].map(lane => weights.getComponent(vertex, lane)) });
    }
    records.push({ bones: mesh.skeleton.bones.map((bone, index) => ({ name: bone.name, inverse: mesh.skeleton.boneInverses[index].elements })) });
  }
  return { sha256: sha(records), records: records.length - meshes.length };
}

function normalizedClone(scene, kit) {
  const object = clone(scene); fitOperatorKit(object, kit); object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object), height = box.max.y - box.min.y || 1;
  const baseScale = 1.8 / height, localMinY = box.min.y;
  const diagnosticPreAnimationFullBox = { min: box.min.toArray(), max: box.max.toArray() };
  object.scale.setScalar(baseScale); object.position.y = -localMinY * baseScale;
  object.getObjectByName("LOD1").visible = false; object.getObjectByName("LOD2").visible = false; object.updateMatrixWorld(true);
  return { object, diagnosticPreAnimationFullBox, height, baseScale, localMinY };
}

async function calibrate(faction, path) {
  const source = await load(path);
  expect(source.meshNodes).toEqual(["LOD0", "LOD1", "LOD2"]);
  expect(source.gltf.animations.map(clip => clip.name).sort()).toEqual(EXPECTED);
  const coldCacheDiagnostics = KITS.map(kit => {
    const normalized = normalizedClone(source.gltf.scene, kit);
    return { kit, cachePhase: "cold-first-fit-build", phase: "pre-animation-after-fitOperatorKit",
      diagnosticPreAnimationFullBox: normalized.diagnosticPreAnimationFullBox, height: normalized.height,
      baseScale: normalized.baseScale, localMinY: normalized.localMinY, feetOffsetY: -normalized.localMinY * normalized.baseScale };
  });
  const { object, diagnosticPreAnimationFullBox, height, baseScale, localMinY } = normalizedClone(source.gltf.scene, "anchor"), inventory = renderableInventory(object);
  const normalization = { method: "Scene.makeModelRig consumed vertical transform", standHeight: 1.8,
    height, baseScale, localMinY, feetOffsetY: -localMinY * baseScale };
  for (const candidate of coldCacheDiagnostics) {
    expect(candidate.height).toBeCloseTo(normalization.height, 12);
    expect(candidate.baseScale).toBeCloseTo(normalization.baseScale, 12);
    expect(candidate.localMinY).toBeCloseTo(normalization.localMinY, 12);
  }
  expect(inventory).toHaveLength(9);
  expect(new Set(inventory.map(item => item.lod))).toEqual(new Set(["LOD0", "LOD1", "LOD2"]));
  expect(inventory.every(item => item.skinned && item.lod)).toBe(true);
  expect(inventory.filter(item => item.visibleAfterAppearance).every(item => item.lod === "LOD0")).toBe(true);
  expect(inventory.filter(item => item.visibleAfterAppearance)).toHaveLength(3);
  const legacyContamination = { head: contaminationCounts(object, HEAD_BONES), torso: contaminationCounts(object, TORSO_BONES) };
  expect(Object.entries(legacyContamination.head).some(([key, count]) => !key.endsWith(`${faction}-wool`) && count > 0)).toBe(true);
  expect(Object.entries(legacyContamination.torso).some(([key, count]) => !key.endsWith(`${faction}-wool`) && count > 0)).toBe(true);
  const meshes = hitMeshes(object, faction), mixer = new THREE.AnimationMixer(object), samples = [];
  const hitComponent = componentSignature(meshes, [{ name: "head", bones: HEAD_BONES }, { name: "torso", bones: TORSO_BONES }]);
  for (const clip of source.gltf.animations) {
    for (const [phase, time] of [["start", 0], ["mid", clip.duration / 2], ["end", clip.duration]]) {
      mixer.stopAllAction(); mixer.time = 0; mixer.clipAction(clip).reset().play(); mixer.update(time); object.updateMatrixWorld(true);
      samples.push({ faction, clip: clip.name, phase, time, head: regionBounds(meshes, HEAD_BONES), torso: regionBounds(meshes, TORSO_BONES) });
    }
  }
  mixer.stopAllAction(); mixer.uncacheRoot(object);
  const diagnosticFullBoxes = [...coldCacheDiagnostics, { kit: "anchor", cachePhase: "warm-cached-fit-reuse",
    phase: "pre-animation-after-fitOperatorKit", diagnosticPreAnimationFullBox, height, baseScale, localMinY,
    feetOffsetY: -localMinY * baseScale }];
  return { faction, path, sha256: source.sha256, clipCount: source.gltf.animations.length,
    clipIdentities: source.gltf.animations.map(clip => clip.name).sort(), meshNodes: source.meshNodes,
    normalization, diagnosticFullBoxes,
    normalizationTransformSha256: normalizationTransformSignature(normalization),
    hitComponentSha256: hitComponent.sha256, hitComponentRecords: hitComponent.records,
    ownership: { included: { lod: "LOD0", material: `${faction}-wool`, dynamicEquipment: false },
      excluded: { lods: ["LOD1", "LOD2"], materials: [`${faction}-field-kit`, `${faction}-helmet`], dynamicEquipment: true },
      inventory, legacyContamination }, samples };
}

describe("runtime soldier HIT body/head checkpoint", () => {
  it("hashes every consumed normalization value and ignores unused horizontal bounds", () => {
    const baseline = { standHeight: 1.8, height: 1.875, baseScale: .96, localMinY: -.07, feetOffsetY: .0672,
      diagnosticPreAnimationFullBox: { min: [-1, -.07, -.24], max: [1, 1.8, .22] } };
    expect(normalizationTransformSignature({ ...baseline,
      diagnosticPreAnimationFullBox: { min: [-2, -.07, -.9], max: [3, 1.8, .8] } })).toBe(normalizationTransformSignature(baseline));
    for (const changed of [{ ...baseline, standHeight: 1.81 }, { ...baseline, height: 1.87 }, { ...baseline, baseScale: .97 },
      { ...baseline, localMinY: -.08 }, { ...baseline, feetOffsetY: .0768 }]) {
      expect(normalizationTransformSignature(changed)).not.toBe(normalizationTransformSignature(baseline));
    }
  });

  it("samples exact LOD0 wool skin after Scene normalization without kit contamination", async () => {
    const root = process.env.WW1_SOLDIER_DIR ?? join(process.cwd(), "public", "assets", "ww1", "characters");
    const reports = await Promise.all(["khaki", "fieldgrey"].map(faction => calibrate(faction, join(root, `soldier-${faction}.glb`))));
    const samples = reports.flatMap(report => report.samples);
    expect(samples).toHaveLength(384);
    for (const sample of samples) {
      for (const region of [sample.head, sample.torso]) {
        expect(region.min.every(Number.isFinite)).toBe(true); expect(region.max.every(Number.isFinite)).toBe(true);
        expect(region.min[1]).toBeGreaterThan(-.1); expect(region.max[1]).toBeLessThan(2.1);
      }
    }
    const reportPath = process.env.WW1_CALIBRATION_REPORT;
    if (reportPath) await writeFile(reportPath, `${JSON.stringify({ schemaVersion: 3,
      status: "PROPOSED_DATA_CHECKPOINT_ONLY", activation: false,
      space: "Three game model-local feet-relative after scene.makeModelRig normalization",
      limitation: "Stage33 hands and pistol pose remain rejected; this packet samples unchanged HIT-relevant wool head/torso only.",
      reuseGate: "Any hand-only graft must match hitComponentSha256, normalizationTransformSha256, baseScale/localMinY/feetOffset/standHeight, clip identities, and all bound source hashes; horizontal Box3 values are diagnostic because production does not consume them.",
      sampleCount: samples.length, soldiers: reports.map(({ samples: _samples, ...report }) => report), samples }, null, 2)}\n`);
  }, 30_000);
});
