import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export class DerivativeAuditError extends Error {
  constructor(code) { super(code); this.name = 'DerivativeAuditError'; this.code = code; }
}
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const isRecord = value => typeof value === 'object' && value !== null && !Array.isArray(value);
const isHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const inside = (root, path) => { const value = relative(root, path); return value !== '' && !value.startsWith('..') && !isAbsolute(value); };
const exactKeys = (value, keys) => isRecord(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const FORBIDDEN_KEYS = new Set(['apikey', 'meshyapikey', 'authorization', 'authorizationheader', 'auth', 'credential', 'credentials', 'secret', 'token', 'accesstoken', 'signedurl', 'modelurl', 'modelurls', 'thumbnailurl', 'downloadurl']);
const sameStrings = (left, right) => Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => value === right[index]);

async function ownedBytes(path, roots, code = 'unowned_path') {
  let ownedPath;
  try { ownedPath = await realpath(resolve(path)); } catch { throw new DerivativeAuditError('missing_file'); }
  if (!roots.some(root => inside(root, ownedPath))) throw new DerivativeAuditError(code);
  return { path: ownedPath, bytes: await readFile(ownedPath) };
}
async function checkedFile(value, roots, code) {
  const keys = Object.hasOwn(value ?? {}, 'bytes') ? ['path', 'bytes', 'sha256'] : ['path', 'sha256'];
  if (!exactKeys(value, keys) || typeof value.path !== 'string' || !isHash(value.sha256)) throw new DerivativeAuditError('invalid_receipt_shape');
  const loaded = await ownedBytes(value.path, roots); if (sha256(loaded.bytes) !== value.sha256) throw new DerivativeAuditError(code);
  if ('bytes' in value && (!Number.isSafeInteger(value.bytes) || value.bytes !== loaded.bytes.length)) throw new DerivativeAuditError(code);
  return loaded;
}
function assertSafeProvenance(value) {
  if (typeof value === 'string' && (/Bearer\s/i.test(value) || /^https?:\/\//i.test(value))) throw new DerivativeAuditError('forbidden_provenance_content');
  if (Array.isArray(value)) { for (const item of value) assertSafeProvenance(item); return; }
  if (!isRecord(value)) return;
  for (const [key, item] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.replace(/[^a-z0-9]/gi, '').toLowerCase())) throw new DerivativeAuditError('forbidden_provenance_content');
    assertSafeProvenance(item);
  }
}
function parseJson(bytes, code) { try { return JSON.parse(bytes); } catch { throw new DerivativeAuditError(code); } }
function parseSafeJson(bytes, code) { const value = parseJson(bytes, code); assertSafeProvenance(value); return value; }
function validGlb(bytes) { return bytes.length >= 20 && bytes.readUInt32LE(0) === 0x46546c67 && bytes.readUInt32LE(4) === 2 && bytes.readUInt32LE(8) === bytes.length; }

function validateRecipe(value, receipt) {
  if (!exactKeys(value, ['schemaVersion', 'kind', 'assetKey', 'sourceAssetKey', 'version', 'operations']) || value.schemaVersion !== 1 || value.kind !== 'ww1-derivative-correction-recipe' || value.assetKey !== receipt.assetKey || value.sourceAssetKey !== receipt.source.assetKey || typeof value.version !== 'string' || !/^[1-9][0-9]*\.[0-9]+\.[0-9]+$/.test(value.version) || !sameStrings(value.operations, receipt.correction.operations)) throw new DerivativeAuditError('correction_recipe_mismatch');
}
function validateDecision(value, receipt) {
  if (!exactKeys(value, ['schemaVersion', 'kind', 'assetKey', 'sourceAssetKey', 'finalSha256', 'reviewer', 'status', 'finalAccepted', 'evidenceSha256s']) || value.schemaVersion !== 1 || value.kind !== 'ww1-derivative-quality-decision') throw new DerivativeAuditError('invalid_quality_decision_shape');
  if (value.assetKey !== receipt.assetKey || value.sourceAssetKey !== receipt.source.assetKey || value.finalSha256 !== receipt.final.sha256 || value.reviewer !== receipt.quality.reviewer || value.status !== 'accepted' || value.finalAccepted !== true || !sameStrings(value.evidenceSha256s, receipt.quality.evidence.map(item => item.sha256))) throw new DerivativeAuditError('independent_quality_required');
}
async function validateA6({ value, receipt, artifact, roots }) {
  if (!exactKeys(value, ['schemaVersion', 'role', 'scope', 'runtimeAccepted', 'manifestSha256', 'valid', 'files']) || value.schemaVersion !== 1 || value.scope !== 'asset-bytes-audit' || value.runtimeAccepted !== false || (value.manifestSha256 !== null && !isHash(value.manifestSha256)) || !Array.isArray(value.files) || value.files.length === 0 || value.files.some(file => !exactKeys(file, ['assetKey', 'path', 'valid', 'sha256', 'metrics', 'issues']))) throw new DerivativeAuditError('invalid_quality_audit_shape');
  const role = { 'hero-weapon': 'weapon', 'hero-character': 'character', 'environment-prop': 'environment' }[receipt.receiptRole], matching = value.files.filter(file => file.assetKey === receipt.assetKey);
  if (value.role !== role || value.valid !== true || matching.length !== 1) throw new DerivativeAuditError('accepted_a6_audit_required');
  const file = matching[0], metrics = file.metrics;
  if (file.valid !== true || file.sha256 !== receipt.final.sha256 || !Array.isArray(file.issues) || file.issues.length !== 0 || !isRecord(metrics) || metrics.bytes !== artifact.bytes.length || !Number.isSafeInteger(metrics.triangles) || metrics.triangles < 1 || !Number.isSafeInteger(metrics.nodes) || metrics.nodes < 1) throw new DerivativeAuditError('accepted_a6_audit_required');
  const auditedArtifact = await ownedBytes(file.path, roots); if (auditedArtifact.path !== artifact.path) throw new DerivativeAuditError('accepted_a6_audit_required');
}

function validateShape(receipt) {
  if (!exactKeys(receipt, ['schemaVersion', 'kind', 'assetKey', 'receiptRole', 'sourceKind', 'source', 'correction', 'final', 'quality']) || receipt.schemaVersion !== 1 || receipt.kind !== 'ww1-meshy-derived-authored' || typeof receipt.assetKey !== 'string' || !/^[a-z0-9_-]+$/.test(receipt.assetKey) || !['hero-weapon', 'hero-character', 'environment-prop'].includes(receipt.receiptRole) || receipt.sourceKind !== 'meshy-derived-authored') throw new DerivativeAuditError('invalid_receipt_shape');
  const { source, correction, final, quality } = receipt;
  if (!exactKeys(source, ['assetKey', 'providerReceiptPath', 'providerReceiptSha256', 'providerState', 'attemptId', 'taskId', 'glb']) || typeof source.assetKey !== 'string' || !/^[a-z0-9_-]+$/.test(source.assetKey) || source.providerState !== 'review_rejected' || !isHash(source.providerReceiptSha256) || !/^attempt-[1-9][0-9]*$/.test(source.attemptId) || typeof source.taskId !== 'string' || !source.taskId || !exactKeys(correction, ['recipe', 'author', 'tool', 'toolVersion', 'exporterVersion', 'operations', 'completedAt']) || !exactKeys(final, ['publicPath', 'bytes', 'sha256']) || !exactKeys(quality, ['status', 'reviewer', 'decision', 'audit', 'evidence'])) throw new DerivativeAuditError('invalid_receipt_shape');
  if (typeof correction.author !== 'string' || !correction.author.trim() || typeof correction.tool !== 'string' || !correction.tool.trim() || typeof correction.toolVersion !== 'string' || !correction.toolVersion.trim() || typeof correction.exporterVersion !== 'string' || !correction.exporterVersion.trim() || !Array.isArray(correction.operations) || !correction.operations.length || correction.operations.some(operation => typeof operation !== 'string' || !operation.trim()) || new Set(correction.operations).size !== correction.operations.length || !Number.isFinite(Date.parse(correction.completedAt))) throw new DerivativeAuditError('invalid_correction');
  if (typeof final.publicPath !== 'string' || !/^\/assets\/ww1\/.+\.glb$/.test(final.publicPath) || !Number.isSafeInteger(final.bytes) || final.bytes < 20 || !isHash(final.sha256)) throw new DerivativeAuditError('invalid_final');
  if (quality.status !== 'accepted' || typeof quality.reviewer !== 'string' || !quality.reviewer.trim() || quality.reviewer.trim().toLowerCase() === correction.author.trim().toLowerCase() || !Array.isArray(quality.evidence) || quality.evidence.length < 4) throw new DerivativeAuditError('independent_quality_required');
}

export async function auditDerivativeReceipt(options) {
  if (!isRecord(options) || !Array.isArray(options.allowedRoots) || options.allowedRoots.length === 0 || typeof options.expectedAssetKey !== 'string' || !/^[a-z0-9_-]+$/.test(options.expectedAssetKey) || !['hero-weapon', 'hero-character', 'environment-prop'].includes(options.expectedReceiptRole) || typeof options.expectedPublicPath !== 'string' || !/^\/assets\/ww1\/.+\.glb$/.test(options.expectedPublicPath)) throw new DerivativeAuditError('missing_manifest_anchor');
  const roots = await Promise.all(options.allowedRoots.map(root => realpath(resolve(root))));
  if (!isHash(options.expectedReceiptSha256) || !isHash(options.expectedOutputSha256)) throw new DerivativeAuditError('missing_manifest_anchor');
  const receiptFile = await ownedBytes(options.receiptPath, roots), artifact = await ownedBytes(options.artifactPath, roots);
  if (receiptFile.path === artifact.path) throw new DerivativeAuditError('receipt_artifact_alias');
  if (sha256(receiptFile.bytes) !== options.expectedReceiptSha256) throw new DerivativeAuditError('receipt_manifest_hash');
  const receipt = parseSafeJson(receiptFile.bytes, 'invalid_receipt_json'); validateShape(receipt);
  if (receipt.assetKey !== options.expectedAssetKey || receipt.receiptRole !== options.expectedReceiptRole || receipt.final.publicPath !== options.expectedPublicPath) throw new DerivativeAuditError('receipt_manifest_identity');
  if (receipt.final.sha256 !== options.expectedOutputSha256 || sha256(artifact.bytes) !== options.expectedOutputSha256 || artifact.bytes.length !== receipt.final.bytes || !validGlb(artifact.bytes)) throw new DerivativeAuditError('final_manifest_hash');
  const providerReceiptFile = await checkedFile({ path: receipt.source.providerReceiptPath, sha256: receipt.source.providerReceiptSha256 }, roots, 'provider_receipt_hash'), providerReceipt = parseSafeJson(providerReceiptFile.bytes, 'invalid_provider_receipt');
  if (providerReceipt.assetKey !== receipt.source.assetKey || providerReceipt.role !== receipt.receiptRole || providerReceipt.state !== 'review_rejected' || providerReceipt.review?.status !== 'rejected' || (providerReceipt.attemptId ?? 'attempt-1') !== receipt.source.attemptId || providerReceipt.source?.previewTaskId !== receipt.source.taskId) throw new DerivativeAuditError('provider_rejection_lineage');
  const providerGlb = await checkedFile(receipt.source.glb, roots, 'provider_source_hash'); if (!validGlb(providerGlb.bytes) || providerReceipt.reviewArtifacts?.model?.sha256 !== receipt.source.glb.sha256 || providerReceipt.reviewArtifacts.model.bytes !== receipt.source.glb.bytes) throw new DerivativeAuditError('provider_source_lineage');
  if (providerGlb.path === artifact.path) throw new DerivativeAuditError('source_final_alias');
  const recipeFile = await checkedFile(receipt.correction.recipe, roots, 'correction_recipe_hash'); validateRecipe(parseSafeJson(recipeFile.bytes, 'invalid_correction_recipe'), receipt);
  const decisionFile = await checkedFile(receipt.quality.decision, roots, 'quality_decision_hash'), decision = parseSafeJson(decisionFile.bytes, 'invalid_quality_decision');
  const auditFile = await checkedFile(receipt.quality.audit, roots, 'quality_audit_hash'), audit = parseSafeJson(auditFile.bytes, 'invalid_quality_audit');
  validateDecision(decision, receipt); await validateA6({ value: audit, receipt, artifact, roots });
  if (decisionFile.path === auditFile.path) throw new DerivativeAuditError('forbidden_receipt_content');
  const reservedPaths = new Set([receiptFile.path, artifact.path, providerReceiptFile.path, providerGlb.path, recipeFile.path, decisionFile.path, auditFile.path]);
  const evidencePaths = new Set();
  for (const evidence of receipt.quality.evidence) { const file = await checkedFile(evidence, roots, 'quality_evidence_hash'); if (reservedPaths.has(file.path)) throw new DerivativeAuditError('quality_evidence_alias'); if (evidencePaths.has(file.path)) throw new DerivativeAuditError('duplicate_quality_evidence'); if (extname(file.path).toLowerCase() === '.json') parseSafeJson(file.bytes, 'invalid_quality_evidence_json'); evidencePaths.add(file.path); }
  return { valid: true, assetKey: receipt.assetKey, sourceAssetKey: receipt.source.assetKey, receiptRole: receipt.receiptRole, sourceKind: receipt.sourceKind, providerState: receipt.source.providerState, sourceSha256: receipt.source.glb.sha256, outputSha256: receipt.final.sha256, receiptSha256: options.expectedReceiptSha256, evidenceFiles: evidencePaths.size };
}

async function main() {
  const args = process.argv.slice(2), option = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
  const receiptPath = option('--receipt'), artifactPath = option('--artifact'), expectedAssetKey = option('--expected-asset-key'), expectedReceiptRole = option('--expected-receipt-role'), expectedPublicPath = option('--expected-public-path'), expectedReceiptSha256 = option('--expected-receipt-sha256'), expectedOutputSha256 = option('--expected-output-sha256');
  if (!receiptPath || !artifactPath || !expectedAssetKey || !expectedReceiptRole || !expectedPublicPath) throw new DerivativeAuditError('missing_argument');
  const result = await auditDerivativeReceipt({ receiptPath, artifactPath, expectedAssetKey, expectedReceiptRole, expectedPublicPath, expectedReceiptSha256, expectedOutputSha256, allowedRoots: [resolve('.'), 'D:/webgame-baas/.omo/evidence/ww1'] }); console.log(JSON.stringify(result));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error instanceof DerivativeAuditError ? error.code : 'unexpected_derivative_audit_error'); process.exitCode = 1; });
