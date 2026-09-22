import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1]);
const output = args.get('--report');
const inputs = [args.get('--khaki'), args.get('--fieldgrey')];
if (!output || inputs.some(value => !value)) throw Error('usage: --khaki path --fieldgrey path --report path');
const common = ['crouch_idle', 'crouch_walk', 'death', 'hit_chest', 'hit_head', 'idle', 'run', 'sprint', 'walk'];
const holds = ['rifle', 'smg', 'shotgun', 'sniper', 'pistol'].flatMap(prefix =>
  ['idle', 'walk', 'run', 'sprint', 'crouch_idle', 'crouch_walk', 'strafe_left', 'strafe_right',
    'backpedal', 'crouch_left', 'crouch_right'].map(state => `${prefix}_${state}`));
const expected = [...common, ...holds].sort();
const files = inputs.map(path => {
  const bytes = readFileSync(path);
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8').trim());
  const names = gltf.animations.map(clip => clip.name).sort();
  const joints = new Set(gltf.skins[0].joints);
  const metadata = JSON.parse(readFileSync(path.replace('.glb', '.meta.json'), 'utf8'));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const issues = [];
  if (JSON.stringify(names) !== JSON.stringify(expected)) issues.push('animation_names');
  if (joints.size !== 55) issues.push('joint_count');
  if (!gltf.animations.every(clip => clip.channels.every(channel => joints.has(channel.target.node)))) issues.push('animation_target');
  if (metadata.outputSha256 !== sha256) issues.push('metadata_hash');
  if (metadata.animationClipCount !== 64 || metadata.animationRetargetMethod !== 'armature-space-rest-delta') issues.push('metadata_animation');
  return { path, bytes: bytes.length, sha256, animationCount: names.length, jointCount: joints.size, issues };
});
const report = { schemaVersion: 1, valid: files.every(file => file.issues.length === 0), files };
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
if (!report.valid) process.exitCode = 1;
