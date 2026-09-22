import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { auditWw1SoldierCandidates } from '../scripts/ww1-soldier-candidates.mjs';

const app = resolve(import.meta.dirname, '..'), sourcePublic = join(app, 'public');
const builder = join(app, 'tools/fit-ww1-soldiers.py'), admissionPath = join(app, 'config/ww1-soldier-candidate-admission.json');
const admission = JSON.parse(await readFile(admissionPath, 'utf8'));
const root = await mkdtemp(join(tmpdir(), 'ww1-soldier-candidates-'));
const reportIndex = process.argv.indexOf('--report'), reportPath = reportIndex >= 0 ? resolve(process.argv[reportIndex + 1]) : undefined;

async function stage(name) {
  const publicRoot = join(root, name, 'public');
  for (const path of [admission.source.path, ...admission.assets.flatMap(asset => [asset.glb, asset.meta])]) {
    const target = join(publicRoot, path); await mkdir(dirname(target), { recursive: true }); await copyFile(join(sourcePublic, path), target);
  }
  return publicRoot;
}

try {
  const baselineRoot = await stage('baseline'), baseline = await auditWw1SoldierCandidates(baselineRoot, builder);
  assert.equal(baseline.valid, false); assert.equal(baseline.issues.some(issue => issue.code === 'soldier_candidate_quarantined'), true); assert.equal(baseline.files.length, 2); assert.deepEqual(baseline.files.map(file => file.clips), [64, 64]);
  const changedRoot = await stage('changed'), changedPath = join(changedRoot, admission.assets[0].glb), changed = await readFile(changedPath); changed[changed.length - 1] ^= 1; await writeFile(changedPath, changed);
  const changedResult = await auditWw1SoldierCandidates(changedRoot, builder); assert.equal(changedResult.issues.some(issue => issue.code === 'soldier_glb_hash'), true);
  const metaRoot = await stage('meta'), metaPath = join(metaRoot, admission.assets[1].meta), meta = await readFile(metaPath); meta[meta.length - 2] ^= 1; await writeFile(metaPath, meta);
  const metaResult = await auditWw1SoldierCandidates(metaRoot, builder); assert.equal(metaResult.issues.some(issue => issue.code === 'soldier_meta_hash'), true);
  const forged = structuredClone(admission); forged.runtimeAccepted = true; const forgedPath = join(root, 'forged.json'); await writeFile(forgedPath, JSON.stringify(forged));
  const forgedResult = await auditWw1SoldierCandidates(baselineRoot, builder, forgedPath); assert.equal(forgedResult.issues.some(issue => issue.code === 'soldier_admission_contract'), true);
  const report = { verdict: 'PASS_QUARANTINED_STAGING16', files: baseline.files, scenarios: ['exact-quarantined-two-64-clips', 'changed-glb', 'changed-meta', 'forged-runtime-acceptance'] };
  if (reportPath) { await mkdir(dirname(reportPath), { recursive: true }); await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`); }
  console.log(JSON.stringify(report));
} finally { await rm(root, { recursive: true, force: true }); }
