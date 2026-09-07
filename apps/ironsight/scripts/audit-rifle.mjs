import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const args = process.argv.slice(2), source = args[args.indexOf('--source') + 1];
if (!args.includes('--source')) throw Error('--source <original player.glb> required');
const parse = bytes => {
  const size = bytes.readUInt32LE(12);
  return { json: JSON.parse(bytes.subarray(20, 20 + size).toString()), bin: bytes.subarray(28 + size), bytes };
};
const original = parse(await readFile(source));
const baked = parse(await readFile(new URL('../public/assets/models/player.glb', import.meta.url)));
for (const field of ['nodes', 'skins', 'meshes', 'images', 'textures', 'materials']) assert.deepEqual(baked.json[field], original.json[field], field);
assert.deepEqual(baked.bin.subarray(0, original.bin.length), original.bin, 'original geometry/skin/clip payload stays byte-identical');
assert.deepEqual(baked.json.animations.slice(0, original.json.animations.length), original.json.animations, 'original clip fallback');
const clips = baked.json.animations.filter(a => a.name.startsWith('rifle_'));
assert.equal(clips.length, 6);
let sampledRotations = 0;
for (const clip of clips) {
  const base = original.json.animations.find(a => a.name === clip.name.slice(6)); assert.ok(base);
  for (const channel of clip.channels) {
    const sampler = clip.samplers[channel.sampler];
    if (sampler.output < original.json.accessors.length) continue;
    assert.equal(channel.target.path, 'rotation');
    assert.match(baked.json.nodes[channel.target.node].name, /^(UpperArm_|lowerarm_|Hand_|thumb_|indexFinger_|finger_)/);
    const a = baked.json.accessors[sampler.output], view = baked.json.bufferViews[a.bufferView];
    for (let i = 0; i < a.count; i++) {
      const q = Array.from({ length: 4 }, (_, k) => baked.bin.readFloatLE((view.byteOffset ?? 0) + (a.byteOffset ?? 0) + (i * 4 + k) * 4));
      assert.ok(q.every(Number.isFinite)); assert.ok(Math.abs(Math.hypot(...q) - 1) < 0.0001); sampledRotations++;
    }
  }
  for (const channel of base.channels) {
    const name = original.json.nodes[channel.target.node].name;
    if (/^(UpperArm_|lowerarm_|Hand_|thumb_|indexFinger_|finger_)/.test(name) && channel.target.path === 'rotation') continue;
    assert.ok(clip.channels.some(c => JSON.stringify(c) === JSON.stringify(channel)), `preserved ${name} ${channel.target.path}`);
  }
}
const report = { sourceSha256: createHash('sha256').update(original.bytes).digest('hex'),
  originalClips: original.json.animations.length, rifleClips: clips.length, sampledRotations,
  sourceGeometryAndLowerBodyPreserved: true, outputBytes: baked.bytes.length };
await writeFile(new URL('../.inspect/rifle-audit.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
