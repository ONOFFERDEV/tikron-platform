import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
const SOURCE =
    process.env.WW1_HIT_RIG_SOURCE ??
    "D:/webgame-baas/.omo/evidence/ww1/task-09-20-post-deploy/staging33/characters",
  OUT =
    process.env.WW1_HIT_RIG_OUT ??
    fileURLToPath(new URL("../src/generated/hit-rig-pose-data.json", import.meta.url));
const CLIPS = [
  "rifle_idle",
  "rifle_walk",
  "rifle_sprint",
  "rifle_crouch_idle",
  "rifle_crouch_walk",
  "rifle_strafe_left",
  "rifle_strafe_right",
  "rifle_backpedal",
  "rifle_crouch_left",
  "rifle_crouch_right",
  ...["smg", "shotgun", "sniper", "pistol"].flatMap((f) =>
    ["idle", "walk", "sprint", "crouch_idle", "crouch_walk"].map((s) => `${f}_${s}`),
  ),
  "hit_chest",
  "hit_head",
];
async function load(path) {
  const bytes = await readFile(path),
    sha256 = createHash("sha256").update(bytes).digest("hex"),
    jl = bytes.readUInt32LE(12),
    doc = JSON.parse(bytes.subarray(20, 20 + jl).toString());
  for (const m of doc.materials ?? []) {
    if (m.pbrMetallicRoughness) {
      delete m.pbrMetallicRoughness.baseColorTexture;
      delete m.pbrMetallicRoughness.metallicRoughnessTexture;
    }
    delete m.normalTexture;
    delete m.occlusionTexture;
    delete m.emissiveTexture;
  }
  doc.images = [];
  doc.textures = [];
  doc.samplers = [];
  const raw = Buffer.from(JSON.stringify(doc)),
    json = Buffer.alloc(Math.ceil(raw.length / 4) * 4, 32);
  raw.copy(json);
  const tail = bytes.subarray(20 + jl),
    b = Buffer.alloc(20 + json.length + tail.length);
  b.writeUInt32LE(0x46546c67, 0);
  b.writeUInt32LE(2, 4);
  b.writeUInt32LE(b.length, 8);
  b.writeUInt32LE(json.length, 12);
  b.writeUInt32LE(0x4e4f534a, 16);
  json.copy(b, 20);
  tail.copy(b, 20 + json.length);
  return {
    gltf: await new GLTFLoader().parseAsync(
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
      "",
    ),
    sha256,
  };
}
function wool(root, faction) {
  let out;
  root.traverse((n) => {
    if (n instanceof THREE.SkinnedMesh && n.material.name === `${faction}-wool`) {
      let p = n,
        lod;
      while (p) {
        if (/^LOD[0-2]$/.test(p.name)) {
          lod = p.name;
          break;
        }
        p = p.parent;
      }
      if (lod === "LOD0") out = n;
    }
  });
  if (!out) throw Error("wool");
  return out;
}
const arr = (a) => Array.from(a),
  nodeRecord = (n, bones) => ({
    name: n.name,
    parent: bones.has(n.parent?.name) ? n.parent.name : null,
    position: n.position.toArray(),
    quaternion: n.quaternion.toArray(),
    scale: n.scale.toArray(),
  });
for (const faction of ["khaki", "fieldgrey"]) {
}
const factions = {};
for (const faction of ["khaki", "fieldgrey"]) {
  const { gltf, sha256 } = await load(`${SOURCE}/soldier-${faction}.glb`),
    mesh = wool(gltf.scene, faction),
    bones = mesh.skeleton.bones,
    boneNames = new Set(bones.map((b) => b.name)),
    pos = mesh.geometry.getAttribute("position"),
    si = mesh.geometry.getAttribute("skinIndex"),
    sw = mesh.geometry.getAttribute("skinWeight"),
    limit = mesh.geometry.userData.originalVertices ?? pos.count,
    torsoBones = new Set(["Pelvis", "spine_01", "spine_02", "spine_03"]),
    positions = [],
    joints = [],
    weights = [];
  for (let v = 0; v < limit; v++) {
    let selected = 0;
    for (let l = 0; l < 4; l++)
      if (torsoBones.has(bones[si.getComponent(v, l)]?.name)) selected += sw.getComponent(v, l);
    if (selected < 0.45) continue;
    positions.push(pos.getX(v), pos.getY(v), pos.getZ(v));
    for (let l = 0; l < 4; l++) {
      joints.push(si.getComponent(v, l));
      weights.push(sw.getComponent(v, l));
    }
  }
  const clips = {};
  for (const name of CLIPS) {
    const clip = THREE.AnimationClip.findByName(gltf.animations, name);
    if (!clip) throw Error(`missing ${name}`);
    clips[name] = {
      duration: clip.duration,
      tracks: clip.tracks
        .filter((t) => boneNames.has(t.name.split(".")[0]))
        .map((t) => THREE.KeyframeTrack.toJSON(t)),
    };
  }
  const head = [-4.157808064508828e-8, 0.09088907692851822, 0.004840148884921847],
    radius = 0.12999890244330098;
  factions[faction] = {
    glbSha256: sha256,
    baseScale: 0.9638507396403432,
    localMinY: -0.0775088784061,
    headLocalCenter: head,
    headLocalRadius: radius,
    bones: bones.map((b) => nodeRecord(b, boneNames)),
    boneInverses: bones.map((_, i) => mesh.skeleton.boneInverses[i].toArray()),
    bindMatrix: mesh.bindMatrix.toArray(),
    bindMatrixInverse: mesh.bindMatrixInverse.toArray(),
    meshMatrix: mesh.matrix.toArray(),
    torso: { positions, joints, weights },
    clips,
  };
}
const required = new Set([
  "Pelvis",
  "spine_01",
  "spine_02",
  "spine_03",
  "neck_01",
  "head",
  "Thigh_L",
  "calf_l",
  "Foot_L",
  "ball_l",
  "toes_l",
  "Thigh_R",
  "calf_r",
  "Foot_R",
  "ball_r",
  "toes_r",
]);
const sourceRig = factions.khaki,
  boneMap = new Map(sourceRig.bones.map((b, i) => [b.name, i])),
  compactBones = sourceRig.bones.filter((b) => required.has(b.name)),
  compactIndex = new Map(compactBones.map((b, i) => [b.name, i]));
const clips = Object.fromEntries(
  Object.entries(sourceRig.clips).map(([name, clip]) => [
    name,
    {
      duration: clip.duration,
      tracks: clip.tracks.filter((track) => required.has(track.name.split(".")[0])),
    },
  ]),
);
const compactFactions = Object.fromEntries(
  Object.entries(factions).map(([name, value]) => {
    const joints = value.torso.joints.map((joint, i) =>
      value.torso.weights[i] > 1e-6 ? compactIndex.get(value.bones[joint].name) : 0,
    );
    if (joints.some((x) => x === undefined)) throw Error("unmapped joint");
    return [
      name,
      {
        glbSha256: value.glbSha256,
        baseScale: value.baseScale,
        localMinY: value.localMinY,
        headLocalCenter: value.headLocalCenter,
        headLocalRadius: value.headLocalRadius,
        torso: { positions: value.torso.positions, joints, weights: value.torso.weights },
      },
    ];
  }),
);
const data = {
  schemaVersion: 2,
  source: "Stage33 frozen HIT component",
  rig: {
    bones: compactBones,
    boneInverses: compactBones.map((b) => sourceRig.boneInverses[boneMap.get(b.name)]),
    bindMatrix: sourceRig.bindMatrix,
    bindMatrixInverse: sourceRig.bindMatrixInverse,
    meshMatrix: sourceRig.meshMatrix,
    clips,
  },
  factions: compactFactions,
};
await mkdir(fileURLToPath(new URL("../src/generated/", import.meta.url)), { recursive: true });
await writeFile(
  OUT,
  JSON.stringify(data, (_key, value) =>
    typeof value === "number" ? Math.round(value * 1e8) / 1e8 : value,
  ),
);
console.log(
  JSON.stringify({
    out: OUT,
    bytes: Buffer.byteLength(JSON.stringify(data)),
    bones: data.rig.bones.length,
    clips: Object.keys(data.rig.clips).length,
    factions: Object.fromEntries(
      Object.entries(data.factions).map(([k, v]) => [
        k,
        { torsoVertices: v.torso.positions.length / 3 },
      ]),
    ),
  }),
);
