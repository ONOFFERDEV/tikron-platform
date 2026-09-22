import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { PREVIEW_AUTHORED_WW1_PATHS, auditPreviewAuthoredWw1Assets } from '../scripts/ww1-preview-authored-assets.mjs';

const app = resolve(import.meta.dirname, '..');
const builder = join(app, 'tools/build-ww1-fp-arms.mjs');
const root = await mkdtemp(join(tmpdir(), 'ww1-preview-authored-'));
const reportIndex = process.argv.indexOf('--report');
const reportPath = reportIndex >= 0 ? resolve(process.argv[reportIndex + 1]) : null;

async function fixture(name) {
  const publicRoot = join(root, name, 'public');
  for (const relativePath of PREVIEW_AUTHORED_WW1_PATHS) {
    const target = join(publicRoot, relativePath);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(join(app, 'public', relativePath), target);
  }
  return publicRoot;
}

async function expectIssue(name, mutate, code, builderPath = builder) {
  const publicRoot = await fixture(name);
  await mutate(publicRoot);
  const result = await auditPreviewAuthoredWw1Assets(publicRoot, builderPath);
  assert.equal(result.valid, false);
  assert.equal(result.issues.some(issue => issue.code === code), true, JSON.stringify(result.issues));
  return { name, code, observed: result.issues.map(issue => issue.code) };
}

const scenarios = [];
try {
  const baselineRoot = await fixture('baseline');
  const baseline = await auditPreviewAuthoredWw1Assets(baselineRoot, builder);
  assert.equal(baseline.valid, true, JSON.stringify(baseline.issues));
  assert.equal(baseline.file.releaseStatus, 'development-preview');
  assert.equal(baseline.file.qualityStatus, 'unfinished');
  assert.equal(baseline.file.sourceOfflineStatus, 'accepted');
  assert.equal(baseline.file.runtimeStatus, 'unqualified-pending-browser');
  assert.equal(baseline.file.heroAccepted, false);
  assert.equal(baseline.file.reviewStatus, 'runtime_contact_validation_pending');
  scenarios.push({ name: 'verified unfinished development-preview asset', code: 'PASS', observed: baseline.file });
  scenarios.push(await expectIssue('changed-glb', async publicRoot => {
    const path = join(publicRoot, PREVIEW_AUTHORED_WW1_PATHS[0]);
    const bytes = await readFile(path); bytes[bytes.length - 1] ^= 1; await writeFile(path, bytes);
  }, 'trusted_glb_hash'));
  scenarios.push(await expectIssue('changed-meta', async publicRoot => {
    const path = join(publicRoot, PREVIEW_AUTHORED_WW1_PATHS[1]);
    const metadata = JSON.parse(await readFile(path, 'utf8')); metadata.reviewStatus = 'accepted'; await writeFile(path, JSON.stringify(metadata));
  }, 'trusted_meta_hash'));
  const forgedAdmission = JSON.parse(await readFile(join(app, 'config/ww1-preview-authored-admission.json'), 'utf8'));
  forgedAdmission.runtimeStatus = 'accepted';
  const forgedAdmissionPath = join(root, 'forged-admission.json'); await writeFile(forgedAdmissionPath, JSON.stringify(forgedAdmission));
  const forgedResult = await auditPreviewAuthoredWw1Assets(baselineRoot, builder, forgedAdmissionPath);
  assert.equal(forgedResult.valid, false); assert.equal(forgedResult.issues.some(issue => issue.code === 'admission_contract'), true);
  scenarios.push({ name: 'forged-runtime-acceptance', code: 'admission_contract', observed: forgedResult.issues.map(issue => issue.code) });
  const driftBuilder = join(root, 'drift-builder.mjs');
  await writeFile(driftBuilder, `${await readFile(builder, 'utf8')}\n`);
  scenarios.push(await expectIssue('changed-builder', async () => {}, 'builder_hash', driftBuilder));
  const report = { verdict: 'PASS', baseline: baseline.file, scenarios };
  if (reportPath) { await mkdir(dirname(reportPath), { recursive: true }); await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`); }
  process.stdout.write(`${JSON.stringify(report)}\n`);
} finally {
  await rm(root, { recursive: true, force: true });
}
