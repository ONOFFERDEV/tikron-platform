/** Original authored rifle upper body layered over the private operator's UAL
 * locomotion. No retarget guess/online IK: explicit elbow directions, wrist roll
 * and finger curls are sampled to ordinary glTF quaternion tracks. The original
 * clips, bind matrices, mesh, images and lower body samplers remain byte-identical.
 * Run: node tools/bake-rifle-hold.mjs --source <original player.glb>
 * Output is a purchased-source derivative and MUST remain ignored.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as T from 'three';
const args = process.argv.slice(2);
const source = args[args.indexOf('--source') + 1];
if (!args.includes('--source') || !source) throw Error('--source is required (original nine-clip operator)');
const bytes = await readFile(source);
const jsonSize = bytes.readUInt32LE(12);
const doc = JSON.parse(bytes.subarray(20, 20 + jsonSize).toString());
const bin = bytes.subarray(28 + jsonSize, 28 + jsonSize + bytes.readUInt32LE(20 + jsonSize));
if (doc.animations.some(a => a.name.startsWith('rifle_'))) throw Error('Use the original source, not a previous bake');
const objects = doc.nodes.map(n => {
  const o = new T.Object3D(); o.name = n.name;
  if (n.translation) o.position.fromArray(n.translation);
  if (n.rotation) o.quaternion.fromArray(n.rotation);
  if (n.scale) o.scale.fromArray(n.scale);
  if (n.matrix) new T.Matrix4().fromArray(n.matrix).decompose(o.position, o.quaternion, o.scale);
  return o;
});
doc.nodes.forEach((n, i) => n.children?.forEach(c => objects[i].add(objects[c])));
const root = new T.Group(); objects.filter(o => !o.parent).forEach(o => root.add(o));
const named = name => objects.find(o => o.name === name);
const rest = objects.map(o => ({ p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() }));
const widths = { SCALAR: 1, VEC3: 3, VEC4: 4 };
function data(index) {
  const a = doc.accessors[index], v = doc.bufferViews[a.bufferView], width = widths[a.type];
  if (a.componentType !== 5126 || !width) throw Error('Expected float animation accessor');
  const out = new Float32Array(a.count * width);
  for (let i = 0; i < a.count; i++) for (let j = 0; j < width; j++)
    out[i * width + j] = bin.readFloatLE((v.byteOffset ?? 0) + (a.byteOffset ?? 0) + i * (v.byteStride ?? width * 4) + j * 4);
  return out;
}
const chunks = [bin]; let offset = bin.length;
function accessor(values, type) {
  const pad = (4 - offset % 4) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; }
  const arr = Float32Array.from(values), b = Buffer.from(arr.buffer);
  const view = doc.bufferViews.length; doc.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: b.length });
  chunks.push(b); offset += b.length;
  const index = doc.accessors.length;
  doc.accessors.push({ bufferView: view, componentType: 5126, count: values.length / widths[type], type,
    ...(type === 'SCALAR' ? { min: [values[0]], max: [values.at(-1)] } : {}) });
  return index;
}
const v = new T.Vector3(), a = new T.Vector3(), b = new T.Vector3(), q = new T.Quaternion(), parent = new T.Quaternion();
function worldRotation(bone, rotation) {
  bone.parent.getWorldQuaternion(parent).invert(); bone.quaternion.copy(parent).multiply(rotation);
  root.updateMatrixWorld(true);
}
function direction(boneName, childName, dir) {
  const bone = named(boneName), child = named(childName);
  bone.getWorldPosition(a); child.getWorldPosition(b).sub(a).normalize();
  q.setFromUnitVectors(b, v.fromArray(dir).normalize());
  bone.getWorldQuaternion(parent); q.multiply(parent); worldRotation(bone, q);
}
// Rifle at the shoulder; elbows below wrists. Left forearm crosses toward the
// fore-end, right forearm rises into the pistol grip. +Z is actor forward.
const authored = {
  UpperArm_R: [-0.28, -0.95, 0.10], lowerarm_r: [0.26, 0.48, 0.84],
  UpperArm_L: [-0.45, -0.40, 0.80], lowerarm_l: [-0.90, 0.15, 0.42],
};
const modified = objects.flatMap((o, i) => /^(UpperArm_|lowerarm_|Hand_|thumb_|indexFinger_|finger_)/.test(o.name) ? [i] : []);
const summaries = [];
for (const clip of [...doc.animations]) {
  if (!['idle', 'walk', 'run', 'sprint', 'crouch_idle', 'crouch_walk'].includes(clip.name)) continue;
  const tracks = clip.channels.map(c => {
    const s = clip.samplers[c.sampler], times = data(s.input), values = data(s.output);
    const Track = c.target.path === 'rotation' ? T.QuaternionKeyframeTrack : T.VectorKeyframeTrack;
    const track = new Track('sample', times, values);
    return { target: c.target, sample: track.createInterpolant() };
  });
  const duration = Math.max(...clip.samplers.map(s => data(s.input).at(-1)));
  const frames = Math.ceil(duration * 30), times = Array.from({ length: frames + 1 }, (_, i) => duration * i / frames);
  const outputs = new Map(modified.map(i => [i, []]));
  for (const time of times) {
    objects.forEach((o, i) => { o.position.copy(rest[i].p); o.quaternion.copy(rest[i].q); o.scale.copy(rest[i].s); });
    for (const { target, sample } of tracks) {
      const o = objects[target.node], value = sample.evaluate(time);
      (target.path === 'rotation' ? o.quaternion : target.path === 'scale' ? o.scale : o.position).fromArray(value);
    }
    root.updateMatrixWorld(true);
    for (const [suffix, side] of [['R', -1], ['L', 1]]) {
      direction(`UpperArm_${suffix}`, `lowerarm_${suffix.toLowerCase()}`, authored[`UpperArm_${suffix}`]);
      direction(`lowerarm_${suffix.toLowerCase()}`, `Hand_${suffix}`, authored[`lowerarm_${suffix.toLowerCase()}`]);
      // Palm's long axis follows the forearm into the grip. Explicit roll keeps
      // knuckles outside the receiver; no hand-orientation cancellation in bake.
      // Right fingers follow -X, left fingers +X: both point forward.
      const x = suffix === 'R' ? new T.Vector3(0, -0.8, -0.6) : new T.Vector3(0, 0, 1);
      const y = suffix === 'R' ? new T.Vector3(1, 0, 0) : new T.Vector3(0, 1, 0);
      const z = new T.Vector3().crossVectors(x, y).normalize(); y.crossVectors(z, x);
      worldRotation(named(`Hand_${suffix}`), q.setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z)));
      for (const stem of ['finger', 'indexFinger', 'thumb']) for (let joint = 1; joint <= 4; joint++) {
        const bone = named(`${stem}_${String(joint).padStart(2, '0')}_${suffix.toLowerCase()}`);
        if (!bone) continue;
        const curl = stem === 'thumb' ? (joint === 1 ? 0.55 : 0.75)
          : joint === 1 ? 0.12 : stem === 'indexFinger' && suffix === 'R' ? 0.85 : 0.9;
        bone.quaternion.copy(rest[objects.indexOf(bone)].q).multiply(q.setFromAxisAngle(new T.Vector3(0, 0, 1), suffix === 'R' ? -curl : curl));
      }
    }
    for (const i of modified) outputs.get(i).push(...objects[i].quaternion.toArray());
  }
  const next = structuredClone(clip); next.name = `rifle_${clip.name}`;
  next.channels = next.channels.filter(c => !(c.target.path === 'rotation' && outputs.has(c.target.node)));
  const input = accessor(times, 'SCALAR');
  for (const [node, values] of outputs) {
    const output = accessor(values, 'VEC4'), sampler = next.samplers.length;
    next.samplers.push({ input, output, interpolation: 'LINEAR' });
    next.channels.push({ sampler, target: { node, path: 'rotation' } });
  }
  doc.animations.push(next); summaries.push({ clip: next.name, duration, frames: times.length, authoredBones: modified.length });
}
doc.buffers[0].byteLength = offset;
let json = Buffer.from(JSON.stringify(doc)); json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
let binary = Buffer.concat(chunks); binary = Buffer.concat([binary, Buffer.alloc((4 - binary.length % 4) % 4)]);
const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + json.length + binary.length, 8); header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
const bh = Buffer.alloc(8); bh.writeUInt32LE(binary.length); bh.writeUInt32LE(0x004e4942, 4);
const output = new URL('../public/assets/models/player.glb', import.meta.url);
await writeFile(output, Buffer.concat([header, json, bh, binary]));
await mkdir(new URL('../.inspect/', import.meta.url), { recursive: true });
const report = { source, sha256: createHash('sha256').update(bytes).digest('hex'), outputBytes: header.readUInt32LE(8), authored, clips: summaries };
await writeFile(new URL('../.inspect/rifle-bake.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
