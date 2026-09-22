import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
import { join } from "node:path";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { describe, expect, it, vi } from "vitest";
import { RemoteWeapon, remoteWeaponTemplate } from "../client/remote-weapon.js";
import { ActorAppearance } from "../client/actor-appearance.js";
import { clonePlayerRig } from "../client/rig-loader.js";
import { WEAPON_CONTACT_FRAMES } from "../client/weapon-contact-frames.js";
import { acquireWeaponModel, weaponSource } from "../client/weapon-loader.js";
import { WEAPON_KEYS } from "../src/weapon-contract.js";
import { captureContactSample } from "./helpers/runtime-contact-geometry.mjs";

vi.mock("../client/weapon-loader.js", async importOriginal => ({
  ...await importOriginal(),
  acquireWeaponModel: vi.fn(),
  weaponSource: vi.fn(),
}));

const HOLDS = ["idle", "walk", "run", "sprint", "crouch_idle",
  "crouch_walk", "strafe_left", "strafe_right", "backpedal", "crouch_left", "crouch_right"];
const HASHES = {
  automatic_rifle: "37259feb884e69708483e65d86a42e1cbeeadefabb01dc92c25bf37537331eb9",
  trench_smg: "780868bc7453150b2aa1156ecf11230536b54bc0390ae2e905df6330ae300197",
  pump_shotgun: "a85d9b42a39ed1e961f6db9f16165f9680c5b4829abd800123b350840a68833a",
  bolt_service_rifle: "06fba41ab8e6e457ccf2496b936d587a0cdabaf53fe79e5295be05f0a05139e7",
  service_pistol: "0a62fdfb5a429985c20950813359d170b8f3ba885dcad5186a35fb45427511f3",
};
const ROOT = join(process.cwd(), ".inspect", "ww1-art", "production-candidates-v3");
const CONTRACT = join("D:", "webgame-baas", ".omo", "evidence", "ww1", "task-08",
  "production-candidates-v3", "contact-frames-v1", "contact-frames-v1.json");

async function load(path) {
  const bytes = await readFile(path);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const jsonLength = bytes.readUInt32LE(12);
  const document = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  for (const material of document.materials ?? []) {
    if (material.pbrMetallicRoughness) {
      delete material.pbrMetallicRoughness.baseColorTexture;
      delete material.pbrMetallicRoughness.metallicRoughnessTexture;
    }
    delete material.normalTexture; delete material.occlusionTexture; delete material.emissiveTexture;
  }
  document.images = []; document.textures = []; document.samplers = [];
  const raw = Buffer.from(JSON.stringify(document));
  const json = Buffer.alloc(Math.ceil(raw.length / 4) * 4, 32); raw.copy(json);
  const tail = bytes.subarray(20 + jsonLength);
  const stripped = Buffer.alloc(20 + json.length + tail.length);
  stripped.writeUInt32LE(0x46546c67, 0); stripped.writeUInt32LE(2, 4); stripped.writeUInt32LE(stripped.length, 8);
  stripped.writeUInt32LE(json.length, 12); stripped.writeUInt32LE(0x4e4f534a, 16);
  json.copy(stripped, 20); tail.copy(stripped, 20 + json.length);
  const data = stripped.buffer.slice(stripped.byteOffset, stripped.byteOffset + stripped.byteLength);
  const meshNodes = document.nodes?.filter(node => node.mesh !== undefined).map(node => node.name) ?? [];
  return { gltf: await new GLTFLoader().parseAsync(data, ""), sha256, meshNodes };
}

const position = new THREE.Vector3();
const targetPosition = new THREE.Vector3();
const targetRotation = new THREE.Quaternion();
const vertex = new THREE.Vector3();
const closest = new THREE.Vector3();
const triangle = new THREE.Triangle();

function palmFrame(root, side, weaponIndex) {
  const hand = root.getObjectByName(`Hand_${side.toUpperCase()}`);
  const thumb = root.getObjectByName(`thumb_01_${side}`);
  const index = root.getObjectByName(`indexFinger_01_${side}`);
  const fingers = root.getObjectByName(`finger_01_${side}`);
  const origin = thumb.position.clone().add(index.position).add(fingers.position).multiplyScalar(1 / 3);
  const towardWrist = origin.clone().normalize().multiplyScalar(-1);
  const tangent = fingers.position.clone().sub(index.position);
  tangent.addScaledVector(towardWrist, -tangent.dot(towardWrist)).normalize();
  const normal = towardWrist.clone().cross(tangent).normalize();
  tangent.crossVectors(normal, towardWrist).normalize();
  const local = new THREE.Matrix4().makeBasis(normal, towardWrist, tangent).setPosition(origin);
  const localRotation = new THREE.Quaternion().setFromRotationMatrix(local);
  if (side === "l" && weaponIndex === 4) origin.addScaledVector(tangent, -.02);
  return { position: hand.localToWorld(origin.addScaledVector(normal, -.014)),
    quaternion: hand.getWorldQuaternion(new THREE.Quaternion()).multiply(localRotation) };
}

function fingerPose(root, side) {
  const pose = new Map();
  for (const family of ["thumb", "indexFinger", "finger"]) {
    for (let number = 1; number < (family === "thumb" ? 3 : 4); number++) {
      const name = `${family}_${String(number).padStart(2, "0")}_${side}`;
      const bone = root.getObjectByName(name);
      if (bone) pose.set(name, bone.quaternion.clone());
    }
  }
  return pose;
}

function fingerRotationDeltas(root, before) {
  const deltas = { thumb: 0, indexFinger: 0, finger: 0 };
  for (const [name, quaternion] of before) {
    const family = name.split("_")[0];
    deltas[family] = Math.max(deltas[family], quaternion.angleTo(root.getObjectByName(name).quaternion));
  }
  return deltas;
}

function donorFingerPose(root, side) {
  const pose = new Map();
  for (const family of ["thumb", "index", "middle", "ring", "little"]) {
    for (let segment = 1; segment <= 3; segment++) {
      const name = `${family}_${segment}_${side}`;
      const bone = root.getObjectByName(name);
      if (bone) pose.set(name, bone.quaternion.clone());
    }
  }
  return pose;
}

function donorFingerRotationDeltas(root, before) {
  const deltas = { thumb: 0, index: 0, middle: 0, ring: 0, little: 0 };
  for (const [name, quaternion] of before) {
    const family = name.split("_")[0];
    deltas[family] = Math.max(deltas[family], quaternion.angleTo(root.getObjectByName(name).quaternion));
  }
  return deltas;
}

function donorFingerWorldMatrices(root, side) {
  const matrices = {};
  for (const family of ["thumb", "index", "middle", "ring", "little"]) {
    for (let segment = 1; segment <= 3; segment++) {
      const name = `${family}_${segment}_${side}`;
      const bone = root.getObjectByName(name);
      if (bone) matrices[name] = bone.matrixWorld.toArray();
    }
  }
  return matrices;
}

function action(index, kind) {
  return { weaponIndex: index, kind, phase: kind === "cycle" ? "cycle" : "reload",
    startedAt: 100, phaseStartedAt: 100, endsAt: 1100, serial: 1,
    committed: 0, fireBuffered: false };
}

function runtimeVisible(node) {
  for (let current = node; current; current = current.parent) if (!current.visible) return false;
  return true;
}

function skinDistance(root, side, target, frame, fingers) {
  let minimum = Infinity;
  const nearest = new THREE.Vector3();
  const inverse = frame.clone().invert();
  const near = [];
  root.traverse(node => {
    if (!(node instanceof THREE.SkinnedMesh) || !runtimeVisible(node)) return;
    const indices = node.geometry.getAttribute("skinIndex");
    const weights = node.geometry.getAttribute("skinWeight");
    const positions = node.geometry.getAttribute("position");
    for (let index = 0; index < positions.count; index++) {
      let selected = 0;
      for (let lane = 0; lane < 4; lane++) {
        const bone = node.skeleton.bones[indices.getComponent(index, lane)];
        const name = bone?.name ?? "";
        const isFinger = /^(thumb|indexFinger|finger|index|middle|ring|little)_/.test(name);
        if (fingers ? isFinger && name.endsWith(`_${side}`) : name === `Hand_${side.toUpperCase()}`) {
          selected += weights.getComponent(index, lane);
        }
      }
      if (selected < .25) continue;
      vertex.fromBufferAttribute(positions, index);
      node.applyBoneTransform(index, vertex);
      node.localToWorld(vertex);
      const distance = vertex.distanceTo(target);
      if (distance < minimum) { minimum = distance; nearest.copy(vertex); }
      if (distance < .06) near.push(vertex.clone().sub(target).applyQuaternion(inverse));
    }
  });
  const axis = index => near.length ? {
    min: Math.min(...near.map(point => point.getComponent(index))),
    max: Math.max(...near.map(point => point.getComponent(index))),
  } : { min: Infinity, max: -Infinity };
  return { distance: minimum, point: nearest.toArray(), nearCount: near.length,
    normal: axis(0), wrist: axis(1), tangent: axis(2) };
}

function surfaceDistance(root, target) {
  let minimum = Infinity;
  const nearest = new THREE.Vector3();
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    const positions = node.geometry.getAttribute("position");
    const indices = node.geometry.index;
    const count = indices?.count ?? positions.count;
    for (let offset = 0; offset < count; offset += 3) {
      const at = lane => indices ? indices.getX(offset + lane) : offset + lane;
      triangle.a.fromBufferAttribute(positions, at(0)).applyMatrix4(node.matrixWorld);
      triangle.b.fromBufferAttribute(positions, at(1)).applyMatrix4(node.matrixWorld);
      triangle.c.fromBufferAttribute(positions, at(2)).applyMatrix4(node.matrixWorld);
      triangle.closestPointToPoint(target, closest);
      const distance = closest.distanceTo(target);
      if (distance < minimum) { minimum = distance; nearest.copy(closest); }
    }
  });
  return { distance: minimum, point: nearest.toArray() };
}

function nearbyTriangles(root, target) {
  const result = [];
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    const positions = node.geometry.getAttribute("position");
    const indices = node.geometry.index;
    const count = indices?.count ?? positions.count;
    for (let offset = 0; offset < count; offset += 3) {
      const at = lane => indices ? indices.getX(offset + lane) : offset + lane;
      const item = new THREE.Triangle(
        new THREE.Vector3().fromBufferAttribute(positions, at(0)).applyMatrix4(node.matrixWorld),
        new THREE.Vector3().fromBufferAttribute(positions, at(1)).applyMatrix4(node.matrixWorld),
        new THREE.Vector3().fromBufferAttribute(positions, at(2)).applyMatrix4(node.matrixWorld));
      item.closestPointToPoint(target, closest);
      if (closest.distanceTo(target) < .16) result.push(item);
    }
  });
  return result;
}

function skinWeaponCoverage(root, side, fingers, triangles) {
  let minimum = Infinity, contacts = 0;
  const labels = new Set();
  root.traverse(node => {
    if (!(node instanceof THREE.SkinnedMesh) || !runtimeVisible(node)) return;
    const indices = node.geometry.getAttribute("skinIndex"), weights = node.geometry.getAttribute("skinWeight");
    const positions = node.geometry.getAttribute("position");
    for (let index = 0; index < positions.count; index++) {
      let selected = 0;
      const vertexLabels = new Set();
      for (let lane = 0; lane < 4; lane++) {
        const name = node.skeleton.bones[indices.getComponent(index, lane)]?.name ?? "";
        const isFinger = /^(thumb|indexFinger|finger|index|middle|ring|little)_/.test(name);
        if (fingers ? isFinger && name.endsWith(`_${side}`) : name === `Hand_${side.toUpperCase()}`) {
          selected += weights.getComponent(index, lane);
          if (isFinger) vertexLabels.add(name.split("_")[0]);
        }
      }
      if (selected < .25) continue;
      vertex.fromBufferAttribute(positions, index); node.applyBoneTransform(index, vertex); node.localToWorld(vertex);
      let distance = Infinity;
      for (const item of triangles) { item.closestPointToPoint(vertex, closest); distance = Math.min(distance, closest.distanceTo(vertex)); }
      minimum = Math.min(minimum, distance);
      if (distance < .006) { contacts++; for (const label of vertexLabels) labels.add(label); }
    }
  });
  return { minimum, contacts, labels: [...labels].sort(), triangles: triangles.length };
}

function contactSvg(row) {
  const panels = [["right", row.rightGeometry], ["left", row.leftGeometry]];
  const circles = [];
  for (const [panel, geometry] of panels) {
    for (const [plane, axes] of [["XY", [0, 1]], ["XZ", [0, 2]]]) {
      const column = panel === "right" ? 0 : 1;
      const rowIndex = plane === "XY" ? 0 : 1;
      const cx = 210 + column * 400, cy = 155 + rowIndex * 280;
      circles.push(`<text x="${cx - 175}" y="${cy - 125}" fill="#d8d2bd">${panel} ${plane}</text>`);
      for (const [kind, color] of [["weapon", "#b5a27a"], ["palm", "#e76f51"], ["finger", "#4cc9f0"]]) {
        const point = geometry[kind];
        const x = cx + (point[axes[0]] - geometry.contact[axes[0]]) * 1600;
        const y = cy - (point[axes[1]] - geometry.contact[axes[1]]) * 1600;
        circles.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="6" fill="${color}"/>`);
      }
      circles.push(`<circle cx="${cx}" cy="${cy}" r="3" fill="#ffffff"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="820" height="590" viewBox="0 0 820 590"><rect width="820" height="590" fill="#141713"/><text x="24" y="28" fill="#fff" font-family="monospace">${row.weapon} / ${row.hold} / runtime skinned contact</text><g font-family="monospace" font-size="15">${circles.join("")}</g><text x="24" y="570" fill="#aaa" font-family="monospace" font-size="13">white=contract contact, tan=weapon triangle, red=palm vertex, cyan=finger vertex; scale 1m=1600px</text></svg>`;
}

describe("exact-v3 remote weapon contact", () => {
  it("excludes non-remote representations from physical length and muzzle", () => {
    const scene = new THREE.Group();
    const slot = new THREE.Group(); slot.name = "service_pistol"; scene.add(slot);
    for (const [name, length] of [["fp", 100], ["LOD1", 80], ["LOD2", 60], ["LOD0", .2]]) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(.02, .03, length), new THREE.MeshBasicMaterial());
      mesh.name = name; slot.add(mesh);
    }
    for (const name of ["grip_l", "grip_r"]) {
      const node = new THREE.Object3D(); node.name = name; slot.add(node);
    }
    const template = remoteWeaponTemplate({ scene }, "service_pistol", 4);
    expect(template).toBeDefined();
    expect(template.object.getObjectByName("fp")).toBeUndefined();
    expect(template.object.getObjectByName("LOD1")).toBeUndefined();
    expect(template.object.getObjectByName("LOD2")).toBeUndefined();
    expect(template.length).toBeCloseTo(.2, 6);
    expect(template.tip.z).toBeCloseTo(.1, 6);
  });

  it("keeps both hands on oriented surface frames in all 55 weapon holds", async () => {
    const soldierPath = process.env.WW1_SOLDIER_PATH
      ?? join(process.cwd(), "public", "assets", "ww1", "characters", "soldier-khaki.glb");
    const soldier = await load(soldierPath);
    expect(soldier.meshNodes).toEqual(["LOD0", "LOD1", "LOD2"]);
    const normalizationRig = clonePlayerRig(soldier.gltf);
    const normalizationBox = new THREE.Box3().setFromObject(normalizationRig.object);
    const normalization = { min: normalizationBox.min.toArray(), max: normalizationBox.max.toArray(),
      baseScale: 1.8 / (normalizationBox.max.y - normalizationBox.min.y), localMinY: normalizationBox.min.y };
    normalizationRig.dispose();
    const contractPath = CONTRACT;
    const contractBytes = await readFile(contractPath);
    expect(createHash("sha256").update(contractBytes).digest("hex"))
      .toBe("1f264cab06aded30c57a7310a130e336bb45dc9feec1e5c3a1574cf240b74627");
    const contract = JSON.parse(contractBytes.toString());
    const rows = [];
    const geometrySamples = [];
    const surfaceFailures = [];

    for (const [index, key] of WEAPON_KEYS.entries()) {
      const candidatePath = join(ROOT, key, "candidate.glb");
      const candidate = await load(candidatePath);
      expect(candidate.sha256).toBe(HASHES[key]);
      vi.mocked(acquireWeaponModel).mockReturnValue({ value: Promise.resolve(candidate.gltf), release: vi.fn() });
      vi.mocked(weaponSource).mockReturnValue({ url: candidatePath, nodeName: key });
      for (const hand of ["grip_r", "grip_l"]) {
        const source = WEAPON_CONTACT_FRAMES[key][hand];
        const frozen = contract.weapons[key].frames.find(frame =>
          frame.frameName === hand || frame.anchorName === hand);
        expect(frozen).toBeDefined();
        expect(source.position).toEqual(source.source === "root"
          ? frozen.contractRootLocalPosition : frozen.partLocalPosition);
        expect(source.quaternion).toEqual(frozen.quaternionXyzw);
        expect(frozen.space).toBe("namedPartLocal");
      }
      const rig = clonePlayerRig(soldier.gltf);
      const group = new THREE.Group();
      group.add(rig.object);
      new ActorAppearance(rig.object, 0x80755a);
      const box = new THREE.Box3().setFromObject(rig.object);
      const baseScale = 1.8 / (box.max.y - box.min.y);
      rig.object.scale.setScalar(baseScale);
      rig.object.position.y = -box.min.y * baseScale;
      rig.setWeaponHold(index);
      const weapon = new RemoteWeapon(group, rig.object);
      weapon.setWeapon(index);
      await Promise.resolve(); await Promise.resolve();
      expect(weapon.loaded).toBe(true);
      expect(weapon.mount.getObjectByName("rifle-magazine"), `${key}:legacy-synthetic-magazine`)
        .toBeUndefined();
      const movingName = index === 2 ? "pump" : index === 3 ? "bolt" : "magazine";
      const moving = weapon.mount.getObjectByName(`rifle-${movingName}`)
        ?? weapon.mount.getObjectByName(movingName);
      expect(moving, `${key}:${movingName}:node`).toBeTruthy();
      const movingPosition = moving.position.clone();
      const movingRotation = moving.quaternion.clone();
      weapon.update(1.8, 0, true, undefined, true, null, null, 0);
      expect(moving.position.distanceTo(movingPosition), `${key}:${movingName}:neutral-position`).toBeLessThan(1e-9);
      expect(moving.quaternion.angleTo(movingRotation), `${key}:${movingName}:neutral-rotation`).toBeLessThan(1e-9);
      const kind = index === 2 || index === 3 ? "cycle" : "magazine_reload";
      weapon.update(1.8, 0, true, undefined, true, null, action(index, kind), 600);
      expect(moving.position.distanceTo(movingPosition), `${key}:${movingName}:incremental-motion`).toBeGreaterThan(.005);
      weapon.update(1.8, 0, true, undefined, true, null, null, 0);
      expect(moving.position.distanceTo(movingPosition), `${key}:${movingName}:reset-position`).toBeLessThan(1e-9);
      expect(moving.quaternion.angleTo(movingRotation), `${key}:${movingName}:reset-rotation`).toBeLessThan(1e-9);
      weapon.beforeAnimation();
      let switchRestorePose = new Map();
      for (const hold of HOLDS) {
        weapon.beforeAnimation();
        rig.setState(hold);
        rig.update(.23);
        const rightFingerPose = fingerPose(rig.object, "r");
        const leftFingerPose = fingerPose(rig.object, "l");
        const rightDonorFingerPose = donorFingerPose(rig.object, "r");
        const leftDonorFingerPose = donorFingerPose(rig.object, "l");
        switchRestorePose = new Map([...rightFingerPose, ...leftFingerPose,
          ...rightDonorFingerPose, ...leftDonorFingerPose]);
        group.updateMatrixWorld(true);
        weapon.update(1.8, .18, true);
        group.updateMatrixWorld(true);
        const right = rig.object.getObjectByName("Hand_R");
        const left = rig.object.getObjectByName("Hand_L");
        const gripR = weapon.mount.getObjectByName("remote-grip-r");
        const gripL = weapon.mount.getObjectByName("remote-grip-l");
        expect(right && left && gripR && gripL).toBeTruthy();
        const rightPalmFrame = palmFrame(rig.object, "r", index);
        const leftPalmFrame = palmFrame(rig.object, "l", index);
        const rightDistanceM = rightPalmFrame.position.distanceTo(gripR.getWorldPosition(targetPosition));
        const rightAngleRad = rightPalmFrame.quaternion.angleTo(gripR.getWorldQuaternion(targetRotation));
        const leftDistanceM = leftPalmFrame.position.distanceTo(gripL.getWorldPosition(targetPosition));
        const leftAngleRad = leftPalmFrame.quaternion.angleTo(gripL.getWorldQuaternion(targetRotation));
        const rightDonorDistanceM = right.getWorldPosition(new THREE.Vector3())
          .distanceTo(gripR.getWorldPosition(new THREE.Vector3()));
        const rightDonorAngleRad = right.getWorldQuaternion(new THREE.Quaternion())
          .angleTo(gripR.getWorldQuaternion(new THREE.Quaternion()));
        const rightFingerRotationRad = fingerRotationDeltas(rig.object, rightFingerPose);
        const leftFingerRotationRad = fingerRotationDeltas(rig.object, leftFingerPose);
        const rightDonorFingerRotationRad = donorFingerRotationDeltas(rig.object, rightDonorFingerPose);
        const leftDonorFingerRotationRad = donorFingerRotationDeltas(rig.object, leftDonorFingerPose);
        const rightContact = gripR.getWorldPosition(new THREE.Vector3());
        const leftContact = gripL.getWorldPosition(new THREE.Vector3());
        const rightFrame = gripR.getWorldQuaternion(new THREE.Quaternion());
        const rightGripScale = gripR.getWorldScale(new THREE.Vector3());
        const leftFrame = gripL.getWorldQuaternion(new THREE.Quaternion());
        const rightPalm = skinDistance(rig.object, "r", rightContact, rightFrame, false);
        const rightFinger = skinDistance(rig.object, "r", rightContact, rightFrame, true);
        const leftPalm = skinDistance(rig.object, "l", leftContact, leftFrame, false);
        const leftFinger = skinDistance(rig.object, "l", leftContact, leftFrame, true);
        const rightWeapon = surfaceDistance(weapon.mount, rightContact);
        const leftWeapon = surfaceDistance(weapon.mount, leftContact);
        const rightTriangles = nearbyTriangles(weapon.mount, rightContact);
        const leftTriangles = nearbyTriangles(weapon.mount, leftContact);
        const rightPalmWeapon = skinWeaponCoverage(rig.object, "r", false, rightTriangles);
        const rightFingerWeapon = skinWeaponCoverage(rig.object, "r", true, rightTriangles);
        const leftPalmWeapon = skinWeaponCoverage(rig.object, "l", false, leftTriangles);
        const leftFingerWeapon = skinWeaponCoverage(rig.object, "l", true, leftTriangles);
        if (hold === "idle" || (key === "service_pistol" && hold === "walk")) {
          const geometrySample = captureContactSample(key, hold, rig.object, weapon.mount);
          geometrySamples.push(geometrySample);
        }
        const rightPalmSurfaceM = rightPalm.distance, rightFingerSurfaceM = rightFinger.distance;
        const leftPalmSurfaceM = leftPalm.distance, leftFingerSurfaceM = leftFinger.distance;
        const rightWeaponSurfaceM = rightWeapon.distance, leftWeaponSurfaceM = leftWeapon.distance;
        rows.push({ weapon: key, hold, rightDistanceM, leftDistanceM, rightAngleRad, leftAngleRad,
          rightFrame: rightFrame.toArray(), leftFrame: leftFrame.toArray(),
          rightGripScale: rightGripScale.toArray(),
          rightPalmSurfaceM, rightFingerSurfaceM, leftPalmSurfaceM, leftFingerSurfaceM,
          rightWeaponSurfaceM, leftWeaponSurfaceM,
          rightFingerRotationRad, leftFingerRotationRad,
          rightDonorFingerRotationRad, leftDonorFingerRotationRad,
          rightDonorWorldMatrices: donorFingerWorldMatrices(rig.object, "r"),
          leftDonorWorldMatrices: donorFingerWorldMatrices(rig.object, "l"),
          rightHandWorldMatrix: right.matrixWorld.toArray(), gripRWorldMatrix: gripR.matrixWorld.toArray(),
          mountWorldMatrix: weapon.mount.matrixWorld.toArray(),
          rightGeometry: { contact: rightContact.toArray(), palm: rightPalm.point,
            finger: rightFinger.point, weapon: rightWeapon.point, palmCoverage: rightPalm,
            fingerCoverage: rightFinger, palmWeaponCoverage: rightPalmWeapon,
            fingerWeaponCoverage: rightFingerWeapon },
          leftGeometry: { contact: leftContact.toArray(), palm: leftPalm.point,
            finger: leftFinger.point, weapon: leftWeapon.point, palmCoverage: leftPalm,
            fingerCoverage: leftFinger, palmWeaponCoverage: leftPalmWeapon,
            fingerWeaponCoverage: leftFingerWeapon } });
        if (rightDonorFingerPose.size === 0) {
          expect(rightDistanceM, `${key}:${hold}:right-position`).toBeLessThan(.002);
          expect(rightAngleRad, `${key}:${hold}:right-orientation`).toBeLessThan(.01);
        }
        if (!(key === "service_pistol" && rightDonorFingerPose.size > 0 && leftDonorFingerPose.size === 0)) {
          expect(leftDistanceM, `${key}:${hold}:left-position`).toBeLessThan(.002);
          expect(leftAngleRad, `${key}:${hold}:left-orientation`).toBeLessThan(.01);
        }
        for (const [side, deltas] of [["right", rightFingerRotationRad], ["left", leftFingerRotationRad]]) {
          for (const [family, delta] of Object.entries(deltas)) {
            expect(delta, `${key}:${hold}:${side}:${family}-articulation`).toBeGreaterThan(.5);
          }
        }
        for (const [side, pose, deltas] of [["right", rightDonorFingerPose, rightDonorFingerRotationRad],
          ["left", leftDonorFingerPose, leftDonorFingerRotationRad]]) {
          if (pose.size === 0) continue;
          expect(pose.size, `${key}:${hold}:${side}:donor-chain-count`).toBe(15);
          for (const [family, delta] of Object.entries(deltas))
            expect(delta, `${key}:${hold}:${side}:${family}-donor-articulation`).toBeGreaterThan(.02);
        }
        if (key === "service_pistol" && ["idle", "walk"].includes(hold) && rightDonorFingerPose.size > 0) {
          for (const component of rightGripScale.toArray())
            expect(Math.abs(component - .85), `${key}:${hold}:right-grip-physical-scale-error`)
              .toBeLessThan(.00002);
          if (rightPalmWeapon.minimum >= .008 || rightPalmWeapon.contacts === 0
            || rightFingerWeapon.contacts === 0 || rightFingerWeapon.labels.length < 3)
            surfaceFailures.push({ key, hold, palm: rightPalmWeapon, fingers: rightFingerWeapon });
        }
        expect(rightWeaponSurfaceM, `${key}:${hold}:right-weapon-surface`).toBeLessThan(.00002);
        expect(leftWeaponSurfaceM, `${key}:${hold}:left-weapon-surface`).toBeLessThan(.00002);
        if (!(key === "service_pistol" && rightDonorFingerPose.size > 0)) {
          expect(rightPalmSurfaceM, `${key}:${hold}:right-palm-surface`).toBeLessThan(.08);
          expect(rightFingerSurfaceM, `${key}:${hold}:right-finger-surface`).toBeLessThan(.12);
        }
        if (!(key === "service_pistol" && rightDonorFingerPose.size > 0 && leftDonorFingerPose.size === 0)) {
          expect(leftPalmSurfaceM, `${key}:${hold}:left-palm-surface`).toBeLessThan(.08);
          expect(leftFingerSurfaceM, `${key}:${hold}:left-finger-surface`).toBeLessThan(.12);
        }
        if (hold !== HOLDS.at(-1)) {
          weapon.beforeAnimation();
          for (const [name, quaternion] of [...rightFingerPose, ...leftFingerPose,
            ...rightDonorFingerPose, ...leftDonorFingerPose]) {
            expect(rig.object.getObjectByName(name).quaternion.angleTo(quaternion), `${key}:${hold}:${name}:reset`)
              .toBeLessThan(1e-3);
          }
        }
      }
      weapon.setWeapon((index + 1) % WEAPON_KEYS.length);
      for (const [name, quaternion] of switchRestorePose) {
        expect(rig.object.getObjectByName(name).quaternion.angleTo(quaternion), `${key}:${name}:switch-reset`)
          .toBeLessThan(1e-3);
      }
      weapon.dispose();
      rig.dispose();
    }
    expect(rows).toHaveLength(55);
    const viewDir = process.env.WW1_CONTACT_VIEW_DIR;
    if (viewDir) {
      await mkdir(viewDir, { recursive: true });
      await Promise.all(rows.map(row => writeFile(join(viewDir, `${row.weapon}-${row.hold}.svg`), contactSvg(row))));
    }
    const reportPath = process.env.WW1_CONTACT_REPORT;
    if (reportPath) await writeFile(reportPath, `${JSON.stringify({ schemaVersion: 1,
      soldier: { path: soldierPath, sha256: soldier.sha256, meshNodes: soldier.meshNodes,
        threeSceneNormalization: normalization }, contract: { path: contractPath,
        sha256: "1f264cab06aded30c57a7310a130e336bb45dc9feec1e5c3a1574cf240b74627" },
      candidates: HASHES, sampleCount: rows.length, rows }, null, 2)}\n`);
    const geometryPath = process.env.WW1_CONTACT_GEOMETRY;
    if (geometryPath) await writeFile(geometryPath, `${JSON.stringify({ schemaVersion: 1,
      soldier: { path: soldierPath, sha256: soldier.sha256 }, candidates: HASHES,
      samples: geometrySamples }, null, 2)}\n`);
    expect(surfaceFailures, "donor glove must make opposed pistol surface contact").toEqual([]);
  }, 30_000);
});
