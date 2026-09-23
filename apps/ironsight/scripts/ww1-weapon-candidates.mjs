import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { canonicalTextSha256, WW1_TEXT_HASH_POLICY } from './ww1-text-provenance.mjs';

const DEFAULT_ADMISSION = new URL('../config/ww1-weapon-candidate-admission.json', import.meta.url);
const REVIEW = {
  status: 'confirmed',
  scope: 'source-model-and-morphology-only',
  evidence: 'D:/webgame-baas/.omo/evidence/ww1/task-08/production-candidates-v3/independent-review.json',
  sha256: 'dbc37a67d7ce723e2e8cef79a185e173066ab320c76396f8b1d8ecba8a6ba2e7',
};
const RECIPE = {
  evidence: 'D:/webgame-baas/.omo/evidence/ww1/task-08/production-candidates-v3/weapon-recipes-v3.json',
  sha256: '94f124f3f69fb102af7755930966632698ee1b2f58de9d6aa1e88041c9fb95ce',
};
const CONTACT_REVIEW = {
  status: 'confirmed', scope: 'source-and-offline-only',
  evidence: 'D:/webgame-baas/.omo/evidence/ww1/task-19/post-deploy/independent-full48-review.json',
  sha256: '247176f8fb1b23f493327bdb24359f911d6c3f25d9e58245076f78d85b94f50f',
  contactFramesSha256: '1f264cab06aded30c57a7310a130e336bb45dc9feec1e5c3a1574cf240b74627',
};
const EXPECTED_ASSETS = [
  ['automatic_rifle', 'automatic-rifle', '37259feb884e69708483e65d86a42e1cbeeadefabb01dc92c25bf37537331eb9', '57794f81ab04a1860d3ad0cc2636795cfa6d9a111ffefd3a50ebab8cca724a40', '9e8d5e891b46bdd915184aae77aed0edbbb0b913408f2ca4c24ac0c06792f958'],
  ['trench_smg', 'trench-smg', '780868bc7453150b2aa1156ecf11230536b54bc0390ae2e905df6330ae300197', '3a44abfa12e904e1049b221c4727fbf076fd98f7f5faa7b0d3fc009cba84b05d', 'b6e49442151f67ffa589fc7f5d36914fc0e167ef64adddcd8c5a36f4729dc138'],
  ['pump_shotgun', 'pump-shotgun', 'a85d9b42a39ed1e961f6db9f16165f9680c5b4829abd800123b350840a68833a', '0002b5e9269a624f885e4ba256e00385cf7c6a251dc8a29cd9d76740ffd7b7c9', '6a6ffb2470cd928f5dfbc1ffd58e3bec0b578edf295e8ee0f58fb7656c554727'],
  ['bolt_service_rifle', 'bolt-rifle', '06fba41ab8e6e457ccf2496b936d587a0cdabaf53fe79e5295be05f0a05139e7', '88400625186691b84e735bb834ef68bf9f5f9f721de10cf86d75c8e3f7f10088', '88f964921c6aab237d0583b47fd78852703fab2c00c6a6630268750c2143842a'],
  ['service_pistol', 'service-pistol', '0a62fdfb5a429985c20950813359d170b8f3ba885dcad5186a35fb45427511f3', '4356d5795577799a19ddc12166de23c0a517c5fa534d9f6322a3a88057881230', 'c934437eafa21ef731150fb737391ed29db8f925837c4021b620a4edb97d09b5'],
  ['grenade', 'grenade', '2dc55c935ea9bc545043dbfc56562264c29ec8fb932455ca26e4d166144c37c5', '60082291f1630d5cda21db91de5dd6ae3d1068754ccba278eaa5e54d5ca61928'],
  ['clip-shell-casing', 'clip-shell-casing', 'fcfcc277b25b36f19a989c954b762a016723ebd73d34e3bf6aa401d62bfe87ae', '67b8f7a20536c35e02ebff3e1991b1495bf68ee87233b891528291de07aaad6c'],
].map(([key, file, glbSha256, metaSha256, metaCanonicalLfSha256 = metaSha256]) => ({ key, glb: `assets/ww1/weapons/${file}.glb`, glbSha256, meta: `assets/ww1/weapons/${file}.meta.json`, metaSha256, metaCanonicalLfSha256 }));
const EXPECTED_BUILDER = { path: 'tools/build-ww1-production-weapons.py', sha256: 'febab609d90699ab78c4e038bea9009b804eacfeafd24105833e1290fc097cde', canonicalLfSha256: 'e39e4d3a29b170ad97f395d06ee4ed285d1804bd68f2c63a5ccbc6231b567268' };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export const WW1_WEAPON_CANDIDATE_PATHS = EXPECTED_ASSETS.flatMap(asset => [asset.glb, asset.meta]);

async function optionalBytes(path) {
  try { return await readFile(path); }
  catch (error) { if (error?.code === 'ENOENT') return undefined; throw error; }
}

export async function auditWw1WeaponCandidates(publicRoot, builderPath, admissionPath = DEFAULT_ADMISSION) {
  const candidate = JSON.parse(await readFile(admissionPath, 'utf8'));
  const issues = [], files = [];
  if (candidate.textHashPolicy !== WW1_TEXT_HASH_POLICY || !same(candidate.builder, EXPECTED_BUILDER)) issues.push({ code: 'candidate_admission_contract', path: String(admissionPath) });
  if (candidate.schemaVersion !== 1 || candidate.kind !== 'ww1-source-model-candidate-admission' || candidate.heroAccepted !== false || candidate.runtimeAccepted !== false || candidate.publicationStatus !== 'development-preview-opt-in' || candidate.publishedWeaponModels !== 5 || candidate.publishedSupportAssets !== 2 || candidate.supportPublication !== 'development-preview-opt-in' || candidate.firstPersonFit !== 'source-offline-approved-runtime-pending' || !same(candidate.review, REVIEW) || !same(candidate.contactReview, CONTACT_REVIEW) || !same(candidate.recipe, RECIPE) || !same(candidate.assets, EXPECTED_ASSETS)) issues.push({ code: 'candidate_admission_contract', path: String(admissionPath) });
  const builder = await readFile(builderPath);
  if (canonicalTextSha256(builder) !== candidate.builder?.canonicalLfSha256) issues.push({ code: 'candidate_builder_hash', path: String(builderPath) });
  for (const [index, asset] of (candidate.assets ?? []).entries()) {
    const glb = await optionalBytes(join(publicRoot, asset.glb));
    const meta = await optionalBytes(join(publicRoot, asset.meta));
    if (!glb && !meta) {
      if (index < candidate.publishedWeaponModels + candidate.publishedSupportAssets) issues.push({ code: 'candidate_missing_published_pair', path: asset.glb });
      continue;
    }
    if (!glb || !meta) { issues.push({ code: 'candidate_missing_pair', path: asset.glb }); continue; }
    if (sha256(glb) !== asset.glbSha256) { issues.push({ code: 'candidate_glb_hash', path: asset.glb }); continue; }
    if (canonicalTextSha256(meta) !== asset.metaCanonicalLfSha256) { issues.push({ code: 'candidate_meta_hash', path: asset.meta }); continue; }
    if (glb.length < 20 || glb.readUInt32LE(0) !== 0x46546c67 || glb.readUInt32LE(4) !== 2 || glb.readUInt32LE(8) !== glb.length || glb.readUInt32LE(16) !== 0x4e4f534a) { issues.push({ code: 'candidate_glb_structure', path: asset.glb }); continue; }
    files.push({ key: asset.key, glb: asset.glb, meta: asset.meta, sha256: asset.glbSha256, bytes: glb.length });
  }
  return { valid: issues.length === 0, registered: files, pending: EXPECTED_ASSETS.map(asset => asset.key).filter(key => !files.some(file => file.key === key)), issues };
}
