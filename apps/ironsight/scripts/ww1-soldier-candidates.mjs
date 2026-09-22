import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_ADMISSION = new URL('../config/ww1-soldier-candidate-admission.json', import.meta.url);
const REVIEW = { status: 'suspended-pending-true-three-box3', scope: 'source-and-offline-morphology-pose-only', evidence: 'D:/webgame-baas/.omo/evidence/ww1/task-09-20-post-deploy/independent-final-model-review-v3.json', sha256: 'b2e33e82c7d705c0e51ccd7a2b80271a9c948bd9bad4c211203a8ea71b08b94a' };
const EXPECTED = [
  { key: 'soldier-khaki', glb: 'assets/ww1/characters/soldier-khaki.glb', glbSha256: '61255ca272403f54a4d81153c1ac5a4d0675c6df9f2e76aebfbd3dd58c71acd8', meta: 'assets/ww1/characters/soldier-khaki.meta.json', metaSha256: '3e1908ee5bd7f3c2dfbf46ba4a2b4f0a3961ff070de3f594a8106c3a290237b4' },
  { key: 'soldier-fieldgrey', glb: 'assets/ww1/characters/soldier-fieldgrey.glb', glbSha256: '96c123b8d81da64dc2c43e41c28b86105d0f49494ba84146485d1ee8aaf11182', meta: 'assets/ww1/characters/soldier-fieldgrey.meta.json', metaSha256: 'da1128695875b140b43538a33c96dc817fc3c8b3a8d0ef1060fc1f68a749138d' },
];
const COMMON = ['idle', 'walk', 'run', 'sprint', 'crouch_idle', 'crouch_walk', 'death', 'hit_chest', 'hit_head'];
const HOLDS = ['idle', 'walk', 'run', 'sprint', 'crouch_idle', 'crouch_walk', 'strafe_left', 'strafe_right', 'backpedal', 'crouch_left', 'crouch_right'];
const CLIPS = [...COMMON, ...['rifle', 'smg', 'shotgun', 'sniper', 'pistol'].flatMap(prefix => HOLDS.map(clip => `${prefix}_${clip}`))].sort();
const REQUIRED_NODES = ['Pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'head', 'UpperArm_L', 'lowerarm_l', 'Hand_L', 'UpperArm_R', 'lowerarm_r', 'Hand_R', 'Thigh_L', 'calf_l', 'Foot_L', 'Thigh_R', 'calf_r', 'Foot_R'];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
export const WW1_SOLDIER_CANDIDATE_PATHS = EXPECTED.flatMap(asset => [asset.glb, asset.meta]);

function documentFromGlb(bytes) {
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length || bytes.readUInt32LE(16) !== 0x4e4f534a) throw Error('soldier_glb_structure');
  const length = bytes.readUInt32LE(12); if (20 + length > bytes.length) throw Error('soldier_glb_structure');
  return JSON.parse(bytes.subarray(20, 20 + length).toString('utf8').trim());
}

export async function auditWw1SoldierCandidates(publicRoot, builderPath, admissionPath = DEFAULT_ADMISSION) {
  const admission = JSON.parse(await readFile(admissionPath, 'utf8')), issues = [], files = [];
  if (admission.schemaVersion !== 1 || admission.kind !== 'ww1-licensed-derived-soldier-quarantine-record' || admission.candidateStatus !== 'quarantined-inconsistent-runtime-normalization-evidence' || admission.sourceOfflineAccepted !== false || admission.runtimeAccepted !== false || admission.thirdPersonWeaponContact !== 'pending-v3-five-weapon-review' || !same(admission.review, REVIEW) || !same(admission.builder, { path: 'tools/fit-ww1-soldiers.py', sha256: '7dcc94ded7c62488bb6d09f5ed9fa6a0f80fbd1f17ee9dbcb7bc92517e50c815' }) || !same(admission.source, { path: 'assets/models/player.glb', sha256: '5dced0ed9b3ee898c9609bca372a60f869ca998ffec53f3ecae20b50699bec66' }) || !same(admission.assets, EXPECTED)) issues.push({ code: 'soldier_admission_contract', path: String(admissionPath) });
  issues.push({ code: 'soldier_candidate_quarantined', path: 'assets/ww1/characters' });
  if (sha256(await readFile(builderPath)) !== admission.builder?.sha256) issues.push({ code: 'soldier_builder_hash', path: String(builderPath) });
  if (sha256(await readFile(join(publicRoot, admission.source.path))) !== admission.source.sha256) issues.push({ code: 'soldier_source_hash', path: admission.source.path });
  for (const asset of EXPECTED) {
    try {
      const glb = await readFile(join(publicRoot, asset.glb)), metaBytes = await readFile(join(publicRoot, asset.meta));
      if (sha256(glb) !== asset.glbSha256) throw Error('soldier_glb_hash');
      if (sha256(metaBytes) !== asset.metaSha256) throw Error('soldier_meta_hash');
      const meta = JSON.parse(metaBytes), document = documentFromGlb(glb), clips = (document.animations ?? []).map(animation => animation.name).sort(), nodes = new Set((document.nodes ?? []).map(node => node.name));
      if (meta.assetKey !== asset.key || meta.role !== 'hero-character' || meta.sourceKind !== 'licensed-derived' || meta.sourceSha256 !== admission.source.sha256 || meta.outputSha256 !== asset.glbSha256 || meta.scriptSha256 !== admission.builder.sha256 || meta.equipmentHitTarget !== false) throw Error('soldier_metadata_contract');
      if (!same(clips, CLIPS)) throw Error('soldier_clip_contract');
      if (REQUIRED_NODES.some(name => !nodes.has(name))) throw Error('soldier_rig_contract');
      files.push({ key: asset.key, glb: asset.glb, meta: asset.meta, sha256: asset.glbSha256, clips: clips.length, bytes: glb.length });
    } catch (error) { issues.push({ code: error?.code === 'ENOENT' ? 'soldier_missing_pair' : error instanceof Error ? error.message : 'soldier_candidate_error', path: asset.glb }); }
  }
  return { valid: issues.length === 0, files, issues };
}
