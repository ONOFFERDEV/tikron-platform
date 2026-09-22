import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";

const ACTIONS = ["equip", "ready", "ads_in", "ads_out", "fire", "sprint_in", "sprint_out", "reload"];
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const padded = (bytes, fill = 0) => { const out = Buffer.alloc(bytes.length + (4 - bytes.length % 4) % 4, fill); out.set(bytes); return out; };
const geometry = () => ({ position: [], normal: [], uv: [], joints: [], weights: [], indices: [] });
const vertex = (g, p, n, uv, joint) => {
  g.position.push(...p); g.normal.push(...n); g.uv.push(...uv);
  g.joints.push(joint, 0, 0, 0); g.weights.push(1, 0, 0, 0);
  return g.position.length / 3 - 1;
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = value => { const length = Math.hypot(...value); return value.map(item => item / length); };
function beam(g, start, end, startRadius, endRadius, joint, sides = 8) {
  const axis = unit(end.map((item, index) => item - start[index]));
  const side = unit(cross(axis, Math.abs(axis[1]) < .9 ? [0, 1, 0] : [1, 0, 0]));
  const up = cross(axis, side), base = g.position.length / 3;
  for (let ring = 0; ring < 2; ring += 1) for (let segment = 0; segment < sides; segment += 1) {
    const angle = segment / sides * Math.PI * 2;
    const normal = side.map((item, index) => item * Math.cos(angle) + up[index] * Math.sin(angle));
    const radius = ring === 0 ? startRadius : endRadius, center = ring === 0 ? start : end;
    vertex(g, center.map((item, index) => item + normal[index] * radius), normal, [segment / sides, ring], joint);
  }
  for (let segment = 0; segment < sides; segment += 1) {
    const next = (segment + 1) % sides, a = base + segment, b = base + next, c = a + sides, d = b + sides;
    g.indices.push(a, c, b, b, c, d);
  }
}
function ellipsoid(g, center, radius, joint, rings = 6, sectors = 10) {
  const base = g.position.length / 3;
  for (let ring = 0; ring <= rings; ring += 1) for (let sector = 0; sector <= sectors; sector += 1) {
    const v = ring / rings, u = sector / sectors, polar = Math.PI * v, azimuth = Math.PI * 2 * u;
    const normal = [Math.sin(polar) * Math.cos(azimuth), Math.cos(polar), Math.sin(polar) * Math.sin(azimuth)];
    vertex(g, normal.map((item, index) => center[index] + item * radius[index]), normal, [u, v], joint);
  }
  for (let ring = 0; ring < rings; ring += 1) for (let sector = 0; sector < sectors; sector += 1) {
    const a = base + ring * (sectors + 1) + sector, b = a + sectors + 1;
    g.indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
}

const FINGERS = [["thumb", .035, .82], ["index", .027, 1],
  ["middle", .009, 1.06], ["ring", -.009, .96], ["little", -.027, .82]];
function fingerSegments(name, sign, zOffset, lengthScale) {
  let start = [sign * .13, name === "thumb" ? -.088 : -.115, .57 + sign * zOffset];
  const directions = name === "thumb"
    ? [[0, -.018, -sign * .014], [0, -.015, -sign * .011], [0, -.012, -sign * .008]]
    : [[0, -.029, 0], [0, -.025, 0], [0, -.021, 0]];
  return directions.map(raw => {
    const direction = raw.map(item => item * lengthScale);
    const segment = { start, end: start.map((item, index) => item + direction[index]) };
    start = segment.end;
    return segment;
  });
}

function skeleton() {
  const bones = [{ name: "root", parent: null, at: [0, 0, 0] }];
  for (const [suffix, sign] of [["L", -1], ["R", 1]]) {
    const upper = `upperarm_${suffix.toLowerCase()}`, lower = `lowerarm_${suffix.toLowerCase()}`, hand = `Hand_${suffix}`;
    bones.push({ name: upper, parent: "root", at: [sign * .27, -.18, .08] });
    bones.push({ name: lower, parent: upper, at: [sign * .24, -.15, .34] });
    bones.push({ name: hand, parent: lower, at: [sign * .13, -.06, .57] });
    for (const [finger, zOffset, lengthScale] of FINGERS) {
      let parent = hand;
      for (const [index, pivot] of fingerSegments(finger, sign, zOffset, lengthScale).entries()) {
        const name = `${finger}_${index + 1}_${suffix.toLowerCase()}`;
        bones.push({ name, parent, at: pivot.start });
        parent = name;
      }
    }
  }
  bones.push({ name: "ik_hand_root", parent: "root", at: [0, 0, 0] });
  bones.push({ name: "ik_hand_gun", parent: "ik_hand_root", at: [0, -.04, .48] });
  bones.push({ name: "ik_hand_l", parent: "ik_hand_root", at: [-.13, -.06, .57] });
  bones.push({ name: "ik_hand_r", parent: "ik_hand_root", at: [.13, -.06, .57] });
  return bones;
}

function armGeometry(bones) {
  const joint = name => bones.findIndex(bone => bone.name === name), sleeves = geometry(), gloves = geometry();
  for (const [suffix, sign] of [["l", -1], ["r", 1]]) {
    beam(sleeves, [sign * .31, -.2, .02], [sign * .24, -.15, .34], .065, .045, joint(`upperarm_${suffix}`), 10);
    beam(sleeves, [sign * .24, -.15, .34], [sign * .14, -.07, .535], .045, .024, joint(`lowerarm_${suffix}`), 10);
    beam(sleeves, [sign * .14, -.07, .515], [sign * .14, -.07, .548], .025, .020, joint(`lowerarm_${suffix}`), 10);
    ellipsoid(gloves, [sign * .13, -.085, .57], [.019, .040, .038], joint(`Hand_${suffix.toUpperCase()}`), 7, 12);
    for (const [name, zOffset, lengthScale] of FINGERS) {
      const segments = fingerSegments(name, sign, zOffset, lengthScale);
      segments.forEach((segment, index) => {
        const radius = name === "thumb" ? .011 : .0085;
        beam(gloves, segment.start, segment.end, name === "thumb" ? .011 : .009,
          name === "thumb" ? .009 : .0075, joint(`${name}_${index + 1}_${suffix}`), 7);
        ellipsoid(gloves, segment.start, [radius, radius, radius],
          joint(`${name}_${index + 1}_${suffix}`), 3, 6);
        if (index === segments.length - 1) ellipsoid(gloves, segment.end,
          [radius * .82, radius * .82, radius * .82],
          joint(`${name}_${index + 1}_${suffix}`), 3, 6);
      });
    }
  }
  return { sleeves, gloves };
}

function buildGlb() {
  const bones = skeleton(), geometryByMaterial = armGeometry(bones), chunks = [], views = [], accessors = [];
  const push = (typed, target) => {
    const bytes = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength), byteOffset = chunks.reduce((sum, item) => sum + item.length, 0);
    chunks.push(padded(bytes)); views.push({ buffer: 0, byteOffset, byteLength: bytes.length, ...(target ? { target } : {}) }); return views.length - 1;
  };
  const accessor = (typed, componentType, type, target, bounds) => {
    const result = { bufferView: push(typed, target), componentType, count: typed.length / ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 })[type], type, ...(bounds ?? {}) };
    accessors.push(result); return accessors.length - 1;
  };
  const primitive = (g, material, variants) => {
    const positions = new Float32Array(g.position), minimum = [Infinity, Infinity, Infinity], maximum = [-Infinity, -Infinity, -Infinity];
    for (let index = 0; index < positions.length; index += 3) for (let axis = 0; axis < 3; axis += 1) {
      minimum[axis] = Math.min(minimum[axis], positions[index + axis]); maximum[axis] = Math.max(maximum[axis], positions[index + axis]);
    }
    return {
      attributes: {
        POSITION: accessor(positions, 5126, "VEC3", 34962, { min: minimum, max: maximum }),
        NORMAL: accessor(new Float32Array(g.normal), 5126, "VEC3", 34962),
        TEXCOORD_0: accessor(new Float32Array(g.uv), 5126, "VEC2", 34962),
        JOINTS_0: accessor(new Uint16Array(g.joints), 5123, "VEC4", 34962),
        WEIGHTS_0: accessor(new Float32Array(g.weights), 5126, "VEC4", 34962),
      },
      indices: accessor(new Uint16Array(g.indices), 5123, "SCALAR", 34963), material, mode: 4,
      ...(variants ? { extensions: { KHR_materials_variants: { mappings: [{ material: 1, variants: [0] }, { material: 2, variants: [1] }] } } } : {}),
    };
  };
  const inverse = new Float32Array(bones.length * 16);
  bones.forEach((bone, index) => { inverse.set([1,0,0,0, 0,1,0,0, 0,0,1,0, -bone.at[0],-bone.at[1],-bone.at[2],1], index * 16); });
  const inverseAccessor = accessor(inverse, 5126, "MAT4");
  const nodes = [{ name: "ironsight-fp-arms", children: [1, 2] }, { name: "fp-arms-skinned", mesh: 0, skin: 0 }];
  for (const bone of bones) {
    const parent = bone.parent === null ? null : bones.find(item => item.name === bone.parent);
    const translation = parent === null ? bone.at : bone.at.map((item, axis) => item - parent.at[axis]);
    nodes.push({ name: bone.name, translation, children: [] });
  }
  bones.forEach((bone, index) => { if (bone.parent !== null) nodes[2 + bones.findIndex(item => item.name === bone.parent)].children.push(2 + index); });
  const timeAccessor = accessor(new Float32Array([0, .16, .32]), 5126, "SCALAR", undefined, { min: [0], max: [.32] });
  const animations = ACTIONS.map((name, actionIndex) => {
    const samplers = [], channels = [];
    for (const [boneName, direction] of [["Hand_L", -1], ["Hand_R", 1]]) {
      const angle = [.35, .08, .05, -.05, -.11, .28, -.28, .42][actionIndex] * direction;
      const half = angle / 2, reloadBolt = name === "reload" && boneName === "Hand_R";
      const rotations = new Float32Array([0,0,0,1, reloadBolt ? 0 : Math.sin(half),0,reloadBolt ? Math.sin(half) : 0,Math.cos(half), 0,0,0,1]);
      samplers.push({ input: timeAccessor, output: accessor(rotations, 5126, "VEC4"), interpolation: "LINEAR" });
      channels.push({ sampler: samplers.length - 1, target: { node: 2 + bones.findIndex(bone => bone.name === boneName), path: "rotation" } });
    }
    return { name, samplers, channels };
  });
  const document = {
    asset: { version: "2.0", generator: "Ironsight original FP arms builder v5" }, scene: 0, scenes: [{ nodes: [0] }], nodes,
    meshes: [{ name: "fp-arms-mesh", primitives: [primitive(geometryByMaterial.sleeves, 1, true), primitive(geometryByMaterial.gloves, 0, false)] }],
    skins: [{ name: "ironsight-fp-arms", skeleton: 2, joints: bones.map((_, index) => index + 2), inverseBindMatrices: inverseAccessor }],
    animations, accessors, bufferViews: views, buffers: [{ byteLength: chunks.reduce((sum, item) => sum + item.length, 0) }],
    materials: [
      { name: "Glove_Leather", pbrMetallicRoughness: { baseColorFactor: [.13,.09,.055,1], roughnessFactor: .88 } },
      { name: "Sleeve_Khaki", pbrMetallicRoughness: { baseColorFactor: [.34,.30,.19,1], roughnessFactor: .92 } },
      { name: "Sleeve_Fieldgrey", pbrMetallicRoughness: { baseColorFactor: [.23,.29,.27,1], roughnessFactor: .92 } },
    ],
    extensionsUsed: ["KHR_materials_variants"], extensions: { KHR_materials_variants: { variants: [{ name: "khaki" }, { name: "fieldgrey" }] } },
    extras: { coordinateSystem: { units: "metres", up: "+Y", forward: "+Z" }, skeleton: "ironsight-fp-arms", sleeveVariants: ["khaki", "fieldgrey"], actionClips: ACTIONS, boneBudget: 48, contactFit: "v3-surfaces", triggerDiscipline: true },
  };
  const json = padded(Buffer.from(JSON.stringify(document)), 0x20), binary = Buffer.concat(chunks), output = Buffer.alloc(12 + 8 + json.length + 8 + binary.length);
  output.writeUInt32LE(0x46546c67); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8); output.writeUInt32LE(json.length, 12); output.writeUInt32LE(0x4e4f534a, 16); json.copy(output, 20);
  const binaryOffset = 20 + json.length; output.writeUInt32LE(binary.length, binaryOffset); output.writeUInt32LE(0x004e4942, binaryOffset + 4); binary.copy(output, binaryOffset + 8);
  return { output, document, triangles: (geometryByMaterial.sleeves.indices.length + geometryByMaterial.gloves.indices.length) / 3, bones: bones.length };
}

const outputIndex = process.argv.indexOf("--out"), audit = process.argv.includes("--audit");
if (outputIndex < 0 || !process.argv[outputIndex + 1] || !isAbsolute(process.argv[outputIndex + 1])) throw new Error("--out requires an absolute path");
const outputPath = process.argv[outputIndex + 1], built = buildGlb();
await mkdir(dirname(outputPath), { recursive: true }); await writeFile(outputPath, built.output);
const metadata = { schemaVersion: 1, key: "fp-arms", sha256: sha256(built.output), source: { kind: "original-authored", generator: "tools/build-ww1-fp-arms.mjs", recipeVersion: 5 }, coordinateSystem: built.document.extras.coordinateSystem, skeleton: "ironsight-fp-arms", bones: built.bones, triangleCount: built.triangles, sleeveVariants: built.document.extras.sleeveVariants, actionClips: ACTIONS, uv: true, normals: true, skinWeights: true, inverseBindMatrices: true, contactFit: built.document.extras.contactFit, triggerDiscipline: true, reviewStatus: "runtime_contact_validation_pending" };
await writeFile(outputPath.replace(/\.glb$/u, ".meta.json"), `${JSON.stringify(metadata, null, 2)}\n`);
if (audit) {
  const bytes = await readFile(outputPath), jsonLength = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8").trim());
  const names = new Set(document.nodes.map(node => node.name)), required = ["root", "upperarm_l", "lowerarm_l", "Hand_L", "upperarm_r", "lowerarm_r", "Hand_R", "ik_hand_root", "ik_hand_gun", "ik_hand_l", "ik_hand_r"];
  const issues = [...required.filter(name => !names.has(name)).map(name => `missing:${name}`), ...(document.animations.map(item => item.name).join("|") === ACTIONS.join("|") ? [] : ["animation_contract"]), ...(built.bones <= 48 ? [] : ["bone_budget"]), ...(document.meshes[0].primitives.every(item => item.attributes.JOINTS_0 !== undefined && item.attributes.WEIGHTS_0 !== undefined && item.attributes.NORMAL !== undefined && item.attributes.TEXCOORD_0 !== undefined) ? [] : ["skinned_attributes"])];
  process.stdout.write(`${JSON.stringify({ valid: issues.length === 0, output: outputPath, sha256: sha256(bytes), bytes: bytes.length, triangles: built.triangles, bones: built.bones, actions: ACTIONS.length, issues })}\n`);
  if (issues.length > 0) process.exitCode = 1;
}
