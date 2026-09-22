import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { AUTHORED_WW1_PATHS, auditAuthoredWw1Assets } from '../scripts/ww1-authored-assets.mjs';

const app = resolve(import.meta.dirname, '..');
const sourcePublic = join(app, 'public');
const builder = join(app, 'tools/build-ww1-environment.mjs');
const root = await mkdtemp(join(tmpdir(), 'ww1-authored-audit-'));
const reportIndex = process.argv.indexOf('--report');
const reportPath = reportIndex >= 0 ? resolve(process.argv[reportIndex + 1]) : null;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function fixture(name) {
  const publicRoot = join(root, name, 'public');
  for (const relativePath of AUTHORED_WW1_PATHS) {
    const target = join(publicRoot, relativePath); await mkdir(dirname(target), { recursive: true }); await copyFile(join(sourcePublic, relativePath), target);
  }
  return publicRoot;
}
async function changeMeta(publicRoot, key, directory, mutate) {
  const path = join(publicRoot, `assets/ww1/${directory}/${key}.meta.json`), value = JSON.parse(await readFile(path, 'utf8')); mutate(value); await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}
async function expectIssue(name, mutate, code, builderPath = builder) {
  const publicRoot = await fixture(name); await mutate(publicRoot); const result = await auditAuthoredWw1Assets(publicRoot, builderPath); assert.equal(result.valid, false); assert.equal(result.issues.some(issue => issue.code === code), true, JSON.stringify(result.issues)); return { name, code, observed: result.issues.map(issue => issue.code) };
}

const scenarios = [];
try {
  const baselineRoot = await fixture('baseline'); const baseline = await auditAuthoredWw1Assets(baselineRoot, builder); assert.equal(baseline.valid, true); assert.equal(baseline.files.length, 13); scenarios.push({ name: 'exact twenty-six-file authored inventory', code: 'PASS', observed: baseline.files.map(file => ({ key: file.key, sha256: file.sha256, triangles: file.triangles, bounds: file.bounds, texture: file.texture })) });
  scenarios.push(await expectIssue('changed-byte', async publicRoot => { const path = join(publicRoot, 'assets/ww1/environment/duckboard.glb'), bytes = await readFile(path); bytes[bytes.length - 1] ^= 1; await writeFile(path, bytes); }, 'trusted_glb_hash'));
  scenarios.push(await expectIssue('changed-byte-updated-meta', async publicRoot => { const path = join(publicRoot, 'assets/ww1/environment/duckboard.glb'), bytes = await readFile(path); bytes[bytes.length - 1] ^= 1; await writeFile(path, bytes); await changeMeta(publicRoot, 'duckboard', 'environment', meta => { meta.sha256 = sha256(bytes); }); }, 'trusted_glb_hash'));
  scenarios.push(await expectIssue('forged-provenance', publicRoot => changeMeta(publicRoot, 'duckboard', 'environment', meta => { meta.provenance.status = 'accepted'; }), 'provenance_contract'));
  scenarios.push(await expectIssue('extra-generated', async publicRoot => { await writeFile(join(publicRoot, 'assets/ww1/environment/unreviewed-prop.glb'), 'not accepted'); }, 'unexpected_authored_asset'));
  const reviewRoot = await fixture('forged-review-scope'), reviewAdmission = JSON.parse(await readFile(join(app, 'config/ww1-authored-admission.json'), 'utf8')); reviewAdmission.runtimeVisual = 'qualified'; const reviewAdmissionPath = join(root, 'forged-review-admission.json'); await writeFile(reviewAdmissionPath, JSON.stringify(reviewAdmission)); const reviewResult = await auditAuthoredWw1Assets(reviewRoot, builder, reviewAdmissionPath); assert.equal(reviewResult.valid, false); assert.equal(reviewResult.issues.some(issue => issue.code === 'admission_contract'), true, JSON.stringify(reviewResult.issues)); scenarios.push({ name: 'forged-review-scope', code: 'admission_contract', observed: reviewResult.issues.map(issue => issue.code) });
  scenarios.push(await expectIssue('missing-meta', publicRoot => unlink(join(publicRoot, 'assets/ww1/environment/sandbag.meta.json')), 'missing_pair'));
  scenarios.push(await expectIssue('wrong-lod-order', publicRoot => changeMeta(publicRoot, 'duckboard', 'environment', meta => { meta.lodTriangles = [96, 132, 168]; }), 'metadata_contract'));
  const nanRoot = await fixture('nan-position'), nanPath = join(nanRoot, 'assets/ww1/environment/duckboard.glb'), nanBytes = await readFile(nanPath), jsonLength = nanBytes.readUInt32LE(12), document = JSON.parse(nanBytes.subarray(20, 20 + jsonLength).toString('utf8').trim()), accessor = document.accessors[0], view = document.bufferViews[accessor.bufferView], binaryStart = 20 + jsonLength + 8;
  nanBytes.writeFloatLE(Number.NaN, binaryStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)); await writeFile(nanPath, nanBytes); await changeMeta(nanRoot, 'duckboard', 'environment', meta => { meta.sha256 = sha256(nanBytes); });
  const nanMetaPath = join(nanRoot, 'assets/ww1/environment/duckboard.meta.json'), nanAdmission = JSON.parse(await readFile(join(app, 'config/ww1-authored-admission.json'), 'utf8')), nanAnchor = nanAdmission.assets.find(asset => asset.key === 'duckboard'); nanAnchor.glbSha256 = sha256(nanBytes); nanAnchor.metaSha256 = sha256(await readFile(nanMetaPath)); const nanAdmissionPath = join(root, 'nan-admission.json'); await writeFile(nanAdmissionPath, JSON.stringify(nanAdmission));
  const nanResult = await auditAuthoredWw1Assets(nanRoot, builder, nanAdmissionPath); assert.equal(nanResult.valid, false); assert.equal(nanResult.issues.some(issue => issue.code === 'non_finite_accessor'), true, JSON.stringify(nanResult.issues)); scenarios.push({ name: 'nan-position', code: 'non_finite_accessor', observed: nanResult.issues.map(issue => issue.code) });
  scenarios.push(await expectIssue('oversized-cladding', publicRoot => changeMeta(publicRoot, 'rail-platform', 'environment', meta => { meta.maxCladdingOffsetM = .021; }), 'runtime_material_contract'));
  scenarios.push(await expectIssue('blocking-wire', publicRoot => changeMeta(publicRoot, 'wire', 'environment', meta => { meta.collision = { kind: 'box', dimensionsM: [3, 1.1, .18] }; }), 'wire_collision'));
  scenarios.push(await expectIssue('pilotable-biplane', publicRoot => changeMeta(publicRoot, 'biplane', 'support', meta => { meta.pilotable = true; }), 'support_behavior'));
  const driftBuilder = join(root, 'drift-builder.mjs'); await writeFile(driftBuilder, `${await readFile(builder, 'utf8')}\n`); scenarios.push(await expectIssue('builder-drift', async () => {}, 'builder_hash', driftBuilder));
  const report = { verdict: 'PASS', fixtureOnly: true, baselineFiles: baseline.files.length, scenarios };
  if (reportPath) { await mkdir(dirname(reportPath), { recursive: true }); await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`); }
  console.log(JSON.stringify(report));
} finally { await rm(root, { recursive: true, force: true }); }
