import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { auditWw1WeaponCandidates } from '../scripts/ww1-weapon-candidates.mjs';

const app = resolve(import.meta.dirname, '..');
const builder = join(app, 'tools/build-ww1-production-weapons.py');
const admissionPath = join(app, 'config/ww1-weapon-candidate-admission.json');
const admission = JSON.parse(await readFile(admissionPath, 'utf8'));
const sourceRoot = join(app, '.inspect/ww1-art/production-candidates-v3');
const sourceDirectories = {
  automatic_rifle: 'automatic_rifle', trench_smg: 'trench_smg', pump_shotgun: 'pump_shotgun',
  bolt_service_rifle: 'bolt_service_rifle', service_pistol: 'service_pistol',
  grenade: 'support/grenade', 'clip-shell-casing': 'support/clip-shell-casing',
};
const root = await mkdtemp(join(tmpdir(), 'ww1-weapon-candidates-'));
const reportIndex = process.argv.indexOf('--report');
const reportPath = reportIndex >= 0 ? resolve(process.argv[reportIndex + 1]) : undefined;

async function stage(name) {
  const publicRoot = join(root, name, 'public');
  for (const asset of admission.assets.slice(0, admission.publishedWeaponModels + admission.publishedSupportAssets)) {
    const source = join(sourceRoot, sourceDirectories[asset.key]);
    for (const [from, to] of [['candidate.glb', asset.glb], ['metadata.json', asset.meta]]) {
      const target = join(publicRoot, to); await mkdir(dirname(target), { recursive: true }); await copyFile(join(source, from), target);
    }
  }
  return publicRoot;
}

try {
  const baselineRoot = await stage('baseline');
  const baseline = await auditWw1WeaponCandidates(baselineRoot, builder);
  assert.equal(baseline.valid, true); assert.equal(baseline.registered.length, 7); assert.deepEqual(baseline.pending, []);
  const changedRoot = await stage('changed');
  const changedPath = join(changedRoot, admission.assets[0].glb), changed = await readFile(changedPath); changed[changed.length - 1] ^= 1; await writeFile(changedPath, changed);
  const changedResult = await auditWw1WeaponCandidates(changedRoot, builder); assert.equal(changedResult.issues.some(issue => issue.code === 'candidate_glb_hash'), true);
  const changedSupportRoot = await stage('changed-support');
  const changedSupportPath = join(changedSupportRoot, admission.assets[6].meta), changedSupport = await readFile(changedSupportPath);
  changedSupport[changedSupport.length - 1] ^= 1; await writeFile(changedSupportPath, changedSupport);
  const changedSupportResult = await auditWw1WeaponCandidates(changedSupportRoot, builder);
  assert.equal(changedSupportResult.issues.some(issue => issue.code === 'candidate_meta_hash'), true);
  const missingRoot = await stage('missing'); await unlink(join(missingRoot, admission.assets[1].meta));
  const missing = await auditWw1WeaponCandidates(missingRoot, builder); assert.equal(missing.issues.some(issue => issue.code === 'candidate_missing_pair'), true);
  const forged = structuredClone(admission); forged.runtimeAccepted = true; const forgedPath = join(root, 'forged.json'); await writeFile(forgedPath, JSON.stringify(forged));
  const forgedResult = await auditWw1WeaponCandidates(baselineRoot, builder, forgedPath); assert.equal(forgedResult.issues.some(issue => issue.code === 'candidate_admission_contract'), true);
  const stale = structuredClone(admission); stale.assets[0].glb = 'assets/ww1/weapons/stale-rifle.glb'; const stalePath = join(root, 'stale.json'); await writeFile(stalePath, JSON.stringify(stale));
  const staleResult = await auditWw1WeaponCandidates(baselineRoot, builder, stalePath); assert.equal(staleResult.issues.some(issue => issue.code === 'candidate_admission_contract'), true);
  const report = { verdict: 'PASS', registered: baseline.registered, pending: baseline.pending, scenarios: ['exact-seven-published', 'changed-weapon-byte', 'changed-support-meta-byte', 'missing-pair', 'forged-runtime-acceptance', 'stale-public-path'] };
  if (reportPath) { await mkdir(dirname(reportPath), { recursive: true }); await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`); }
  console.log(JSON.stringify(report));
} finally { await rm(root, { recursive: true, force: true }); }
