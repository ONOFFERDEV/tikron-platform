import { readdir, stat, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, relative, resolve } from 'node:path';
import { verifyReviewEvidence } from '../tools/meshy-review.mjs';
import { AUTHORED_WW1_PATHS, auditAuthoredWw1Assets } from './ww1-authored-assets.mjs';
import { PREVIEW_AUTHORED_WW1_PATHS, auditPreviewAuthoredWw1Assets } from './ww1-preview-authored-assets.mjs';
import { WW1_WEAPON_CANDIDATE_PATHS, auditWw1WeaponCandidates } from './ww1-weapon-candidates.mjs';
import { WW1_SOLDIER_CANDIDATE_PATHS, auditWw1SoldierCandidates } from './ww1-soldier-candidates.mjs';
const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const receiptArg = option('--receipt');
if (receiptArg) {
  const artifactArg = option('--artifact');
  const configArg = option('--config') ?? 'config/ww1-meshy.json';
  if (!artifactArg) throw Error('Receipt audit requires --artifact');
  const receipt = JSON.parse(await readFile(resolve(receiptArg), 'utf8'));
  const canonicalConfigPath = resolve('config/ww1-meshy.json');
  if (resolve(configArg) !== canonicalConfigPath) throw Error('Receipt audit requires the canonical WW1 Meshy config');
  const config = JSON.parse(await readFile(canonicalConfigPath, 'utf8'));
  const asset = config.assets?.find(candidate => candidate.assetKey === receipt.assetKey);
  if (!asset || receipt.schemaVersion !== 1 || receipt.role !== asset.role || receipt.sourceKind !== 'meshy-generated') throw Error('Receipt registry membership mismatch');
  if (receipt.state !== 'audit_accepted' || receipt.review?.status !== 'accepted' || !receipt.review.reasons?.length || !receipt.review.evidence?.length) throw Error('Receipt is not review/audit accepted');
  const attemptId = receipt.attemptId ?? 'attempt-1';
  const recipe = attemptId === 'attempt-1' ? { attemptId, prompt: asset.prompt } : config.retryRecipes?.[receipt.assetKey]?.find(candidate => candidate.attemptId === attemptId);
  if (!recipe) throw Error('Receipt attempt has no canonical recipe');
  const expectedInputHash = createHash('sha256').update(JSON.stringify({ prompt: recipe.prompt, model: config.model, targetPolycount: asset.targetPolycount })).digest('hex');
  if (receipt.prompt !== recipe.prompt || JSON.stringify(receipt.model?.requested) !== JSON.stringify(config.model) || receipt.model?.targetPolycount !== asset.targetPolycount || receipt.inputHash !== expectedInputHash || !/^[a-f0-9]{64}$/i.test(receipt.outputSha256)) throw Error('Receipt input/output hash lineage is incomplete or incorrect');
  if (receipt.model?.requested?.aiModel !== 'meshy-7' || receipt.model.requested.ultra !== false || receipt.model.requested.sourceTextureResolution !== '2k') throw Error('Receipt model options are not approved');
  if (receipt.model?.actual?.aiModel !== 'meshy-7' || receipt.model.actual.topology !== 'triangle' || receipt.model.actual.shouldRemesh !== true || receipt.model.actual.pbr !== true || receipt.model.actual.sourceTextureResolution !== '2k' || !receipt.model.actual.formats?.includes('glb')) throw Error('Provider response options are incomplete or unapproved');
  if (!Array.isArray(receipt.operations) || receipt.operations.some(operation => !['charged', 'refunded'].includes(operation.accounting))) throw Error('Receipt has unresolved credit accounting');
  if (/MESHY_API_KEY|Bearer\s|https?:\/\//i.test(JSON.stringify(receipt))) throw Error('Receipt contains a credential or transient URL');
  const artifact = await readFile(resolve(artifactArg));
  const receiptRoot = resolve(resolve(receiptArg), '..', '..');
  const fixtureMode = process.env.MESHY_FIXTURE_MODE === '1' && process.env.MESHY_CREDENTIAL_SOURCE === 'ironsight-meshy-fixture';
  await verifyReviewEvidence({ out: receiptRoot, assetKey: receipt.assetKey }, receipt.review, fixtureMode);
  if (attemptId === 'attempt-1') { if (receipt.retry !== null && receipt.retry !== undefined) throw Error('Initial attempt has retry lineage'); }
  else {
    if (receipt.retry?.priorAttemptId !== recipe.priorAttemptId || receipt.retry?.authorizationArtifact !== recipe.authorizationArtifact || receipt.retry?.authorizationSha256 !== recipe.authorizationSha256) throw Error('Retry authorization lineage mismatch');
    const authorizationBytes = await readFile(resolve(recipe.authorizationArtifact));
    if (createHash('sha256').update(authorizationBytes).digest('hex') !== recipe.authorizationSha256) throw Error('Retry authorization artifact hash mismatch');
    const authorization = JSON.parse(authorizationBytes);
    if (authorization.assetKey !== receipt.assetKey || authorization.correctedPrompt !== recipe.prompt || !(authorization.retryAuthorized === true || authorization.retryAuthorizedByArt === true) || authorization.refineAuthorized !== false) throw Error('Retry authorization content is invalid');
    const expectedPriorPath = `attempts/${receipt.assetKey}/${recipe.priorAttemptId}.json`;
    if (receipt.retry.priorReceiptPath !== expectedPriorPath) throw Error('Retry prior receipt path is not canonical');
    const priorBytes = await readFile(join(receiptRoot, expectedPriorPath));
    if (createHash('sha256').update(priorBytes).digest('hex') !== receipt.retry.priorReceiptSha256) throw Error('Retry prior receipt hash mismatch');
    const prior = JSON.parse(priorBytes);
    if ((prior.attemptId ?? 'attempt-1') !== recipe.priorAttemptId || prior.assetKey !== receipt.assetKey || prior.state !== 'review_rejected' || prior.review?.status !== 'rejected' || !prior.operations?.some(operation => operation.accounting === 'charged')) throw Error('Retry prior receipt is not a charged reviewed rejection');
    await verifyReviewEvidence({ out: receiptRoot, assetKey: receipt.assetKey }, prior.review, fixtureMode);
  }
  const expectedSourcePath = `sources/${receipt.assetKey}.glb`;
  if (receipt.sourceArtifact?.relativePath !== expectedSourcePath) throw Error('Receipt source path is not canonical');
  const source = await readFile(join(receiptRoot, expectedSourcePath)); const sourceDigest = createHash('sha256').update(source).digest('hex');
  if (sourceDigest !== receipt.sourceSha256 || source.length !== receipt.sourceArtifact.bytes) throw Error('Receipt source hash does not match retained source bytes');
  const digest = createHash('sha256').update(artifact).digest('hex');
  if (digest !== receipt.outputSha256 || artifact.length !== receipt.output?.bytes) throw Error('Receipt output does not match shipped bytes');
  if (artifact.length < 20 || artifact.readUInt32LE(0) !== 0x46546c67 || artifact.readUInt32LE(4) !== 2 || artifact.readUInt32LE(8) !== artifact.length || artifact.readUInt32LE(16) !== 0x4e4f534a) throw Error('Receipt artifact is not a GLB 2.0 JSON-first container');
  console.log(JSON.stringify({ assetKey: receipt.assetKey, role: receipt.role, state: receipt.state, outputSha256: digest, bytes: artifact.length }));
  process.exit(0);
}
const root = fileURLToPath(new URL('../public/', import.meta.url));
const authoredWw1Audit = await auditAuthoredWw1Assets(root, fileURLToPath(new URL('../tools/build-ww1-environment.mjs', import.meta.url)));
if (!authoredWw1Audit.valid) throw Error(`WW1 authored asset audit failed: ${JSON.stringify(authoredWw1Audit.issues)}`);
const previewAuthoredWw1Audit = await auditPreviewAuthoredWw1Assets(root, fileURLToPath(new URL('../tools/build-ww1-fp-arms.mjs', import.meta.url)));
if (!previewAuthoredWw1Audit.valid) throw Error(`WW1 preview authored asset audit failed: ${JSON.stringify(previewAuthoredWw1Audit.issues)}`);
const weaponCandidateAudit = await auditWw1WeaponCandidates(root, fileURLToPath(new URL('../tools/build-ww1-production-weapons.py', import.meta.url)));
if (!weaponCandidateAudit.valid) throw Error(`WW1 weapon candidate audit failed: ${JSON.stringify(weaponCandidateAudit.issues)}`);
const soldierCandidateAudit = await auditWw1SoldierCandidates(root, fileURLToPath(new URL('../tools/fit-ww1-soldiers.py', import.meta.url)));
if (!soldierCandidateAudit.valid) throw Error(`WW1 soldier candidate audit failed: ${JSON.stringify(soldierCandidateAudit.issues)}`);
const approvedDerived = [
  'assets/models/player.glb', 'assets/models/weapons-vm.glb',
  'assets/maps/arena1-dressing.glb', 'assets/maps/arena2-dressing.glb', 'assets/maps/relay-skyline.glb',
];
const libraryAdditions = ['ammo-crate-stack', 'field-chest-panel', 'fuel-drum-cluster'];
const approvedOriginal = [...libraryAdditions.map(name => `assets/props/${name}.glb`),
  'assets/maps/relay-architecture.glb', 'assets/maps/undertow-architecture.glb',
  'assets/maps/switchyard-architecture.glb', 'assets/props/switchyard-transformer.glb', 'assets/props/relay-uplink.glb',
  'assets/props/field-radio-pack.glb',
  'assets/props/relay-field-sandbags.glb',
  'assets/weapons/field-carbine.glb',
  'assets/ui/damage-vignette.png', 'assets/undertow-dusk.hdr', 'assets/undertow-dusk-sky.png',
  'assets/switchyard-overcast.hdr', 'assets/switchyard-overcast-sky.png'];
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else files.push({ path: relative(root, path).replaceAll('\\', '/'), bytes: (await stat(path)).size });
  }
}
await walk(root);
for (const file of files) {
  if (file.bytes >= 25 * 1024 * 1024) throw Error(`Cloudflare per-file cap exceeded: ${file.path}`);
  if (/\.(fbx|blend|zip|unitypackage)$/i.test(file.path)) throw Error(`Raw source asset in public: ${file.path}`);
  if (file.path.endsWith('.glb') && !approvedDerived.includes(file.path) && !approvedOriginal.includes(file.path) && !AUTHORED_WW1_PATHS.includes(file.path) && !PREVIEW_AUTHORED_WW1_PATHS.includes(file.path) && !WW1_WEAPON_CANDIDATE_PATHS.includes(file.path) && !WW1_SOLDIER_CANDIDATE_PATHS.includes(file.path)) throw Error(`Document provenance before shipping: ${file.path}`);
}
for (const path of [...approvedDerived, ...approvedOriginal]) if (!files.some(f => f.path === path)) throw Error(`Restore private derived asset: ${path}`);
// New library entries carry a review receipt tied to the shipped bytes. This catches
// accidentally publishing the raw 2k source or a rejected candidate under an approved name.
for (const name of libraryAdditions) {
  const buffer = await readFile(join(root, `assets/props/${name}.glb`));
  const meta = JSON.parse(await readFile(join(root, `assets/props/${name}.meta.json`), 'utf8'));
  const shipped = meta.adoption;
  if (!shipped || shipped.sha256 !== createHash('sha256').update(buffer).digest('hex') || shipped.bytes !== buffer.length)
    throw Error(`Library provenance does not match shipped bytes: ${name}`);
  if (buffer.readUInt32LE(0) !== 0x46546c67 || buffer.readUInt32LE(4) !== 2 || buffer.readUInt32LE(8) !== buffer.length
      || buffer.readUInt32LE(16) !== 0x4e4f534a) throw Error(`Invalid library GLB: ${name}`);
  const gltf = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString());
  let triangles = 0;
  for (const mesh of gltf.meshes ?? []) for (const primitive of mesh.primitives) {
    if ((primitive.mode ?? 4) !== 4) throw Error(`Non-triangle library primitive: ${name}`);
    triangles += gltf.accessors[primitive.indices ?? primitive.attributes.POSITION].count / 3;
  }
  if (triangles > 4000 || triangles !== shipped.triangles) throw Error(`Library triangle budget/receipt mismatch: ${name}`);
  if ((gltf.images ?? []).some(image => image.mimeType !== 'image/webp' || image.uri))
    throw Error(`Library requires embedded WebP textures: ${name}`);
  if (shipped.textureMaxSize !== 512 || shipped.origin !== 'base-centre') throw Error(`Missing library scale/texture review: ${name}`);
}
const assetBytes = files.filter(f => f.path.startsWith('assets/')).reduce((n, f) => n + f.bytes, 0);
const publicBytes = files.reduce((n, f) => n + f.bytes, 0);
// Raised 40 -> 60 MiB by owner decision 2026-09-10 for the visual-fidelity phase.
// Per-map lazy loading is what keeps first load reasonable; the cap is the ceiling, not a target.
if (publicBytes > 60 * 1024 * 1024) throw Error('Deployed public asset set exceeds 60 MiB budget');
console.log(JSON.stringify({ assetBytes, publicBytes, maxFileBytes: Math.max(...files.map(f => f.bytes)),
  derivedFiles: files.filter(f => approvedDerived.includes(f.path)), originalFiles: files.filter(f => approvedOriginal.includes(f.path)), authoredWw1: authoredWw1Audit, previewAuthoredWw1: previewAuthoredWw1Audit, weaponCandidates: weaponCandidateAudit, soldierCandidates: soldierCandidateAudit, note: 'All purchased derivatives must remain unversioned; see .gitignore and assets/README.md.' }, null, 2));
