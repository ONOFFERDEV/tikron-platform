import { createHash, randomUUID } from 'node:crypto'; import { mkdir, readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import { dirname, join, resolve } from 'node:path'; import { pathToFileURL } from 'node:url';
import { aggregate, taskClaims } from './meshy-accounting.mjs';
import { ConfigError, inputHash, parseConfig, recipeFor } from './meshy-config.mjs'; import { JournalError, atomicJson, readJson, withJournalLock } from './meshy-journal.mjs';
import { ReviewEvidenceError, bindReviewEvidence, verifyReviewEvidence } from './meshy-review.mjs';

const API_ROOT = 'https://api.meshy.ai'; const TERMINAL_PROVIDER_FAILURES = new Set(['FAILED', 'CANCELED']);

class PipelineError extends Error {
  constructor(code, detail) { super(`${code}${detail ? `: ${detail}` : ''}`); this.name = 'PipelineError'; this.code = code; }
}

class HttpStatusError extends PipelineError {
  constructor(status, operation) { super('provider_http_error', `${operation} returned ${status}`); this.status = status; }
}

const args = process.argv.slice(2); const option = (name, fallback) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : fallback; };
const required = (name) => { const value = option(name); if (!value) throw new PipelineError('missing_argument', name); return value; };
const isRecord = value => typeof value === 'object' && value !== null && !Array.isArray(value); const sha256 = value => createHash('sha256').update(value).digest('hex');
const fixtureMode = () => process.env.MESHY_FIXTURE_MODE === '1' && process.env.MESHY_CREDENTIAL_SOURCE === 'ironsight-meshy-fixture';
async function loadContext() {
  const configPath = resolve(option('--config', 'config/ww1-meshy.json')); const config = parseConfig(await readJson(configPath)); const assetKey = required('--asset');
  const asset = config.assets.find(candidate => isRecord(candidate) && candidate.assetKey === assetKey);
  if (!asset) throw new PipelineError('unknown_asset', assetKey);
  const canonicalOut = resolve('artifacts/ww1'); const out = resolve(option('--out', canonicalOut));
  if (out !== canonicalOut && !fixtureMode()) throw new PipelineError('noncanonical_journal_path');
  return { config, asset, assetKey, out, journalPath: join(out, 'journal.json'), receiptPath: join(out, 'receipts', `${assetKey.replaceAll('_', '-')}.json`) };
}

function apiRoot() {
  const root = option('--api-base', API_ROOT); if (root === API_ROOT) return root;
  const url = new URL(root);
  if (!fixtureMode() || !['127.0.0.1', 'localhost'].includes(url.hostname)) throw new PipelineError('fixture_endpoint_forbidden');
  return root.replace(/\/$/, '');
}

function requireCredential(config) {
  if (!process.env.MESHY_API_KEY) throw new PipelineError('missing_explicit_credential'); if (process.env.MESHY_CREDENTIAL_SOURCE !== (fixtureMode() ? 'ironsight-meshy-fixture' : config.credentialSource)) throw new PipelineError('wrong_credential_source');
}

function requestUrl(method, url, body, binary, headers) {
  const transport = url.protocol === 'https:' ? https : http;
  const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
  return new Promise((resolveRequest, rejectRequest) => {
    const requestValue = transport.request(url, { method, headers: { ...headers, ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}) } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const status = response.statusCode ?? 0;
        if (status < 200 || status >= 300) { rejectRequest(new HttpStatusError(status, `${method} ${url.pathname}`)); return; }
        if (binary) { resolveRequest(buffer); return; }
        try { resolveRequest(buffer.length ? JSON.parse(buffer.toString('utf8')) : {}); }
        catch { rejectRequest(new PipelineError('malformed_provider_response', `${method} ${url.pathname}`)); }
      });
    });
    requestValue.setTimeout(Number(option('--timeout-ms', 15000)), () => requestValue.destroy(new PipelineError('provider_timeout', `${method} ${url.pathname}`)));
    requestValue.on('error', rejectRequest);
    if (payload) requestValue.write(payload);
    requestValue.end();
  });
}
const apiRequest = (method, path, body) => requestUrl(method, new URL(path, `${apiRoot()}/`), body, false, { Authorization: `Bearer ${process.env.MESHY_API_KEY}` });
const downloadRequest = value => {
  const url = new URL(value); if (url.username || url.password || (!fixtureMode() && url.protocol !== 'https:') || (fixtureMode() && !['http:', 'https:'].includes(url.protocol))) throw new PipelineError('unsafe_download_url');
  return requestUrl('GET', url, undefined, true, {});
};

async function writeLedger(context, journal, receipt) {
  journal.receipts[context.assetKey] = receipt;
  await atomicJson(context.journalPath, journal);
  await atomicJson(context.receiptPath, receipt);
}

async function repairInterrupted(context) {
  const journal = await readJson(context.journalPath, blankJournal(context)); const changed = [];
  for (const [assetKey, receipt] of Object.entries(journal.receipts)) {
    if (!receipt.state?.endsWith('_submitting')) continue;
    const stage = receipt.state.slice(0, -'_submitting'.length); const operation = receipt.operations?.findLast(candidate => candidate.stage === stage);
    if (!operation || operation.accounting !== 'submitting') throw new PipelineError('malformed_interrupted_receipt', assetKey);
    operation.accounting = 'unknown'; operation.recoveredAt = new Date().toISOString(); receipt.state = `${stage}_submit_unknown`; changed.push([assetKey, receipt]);
  }
  if (!changed.length) return;
  await atomicJson(context.journalPath, journal);
  for (const [assetKey, receipt] of changed) await atomicJson(join(context.out, 'receipts', `${assetKey.replaceAll('_', '-')}.json`), receipt);
}

const withContextLock = (context, action) => withJournalLock(context.journalPath, () => repairInterrupted(context), action);

const blankJournal = context => ({ schemaVersion: 1, limits: context.config.limits, accountOpeningBalance: null, receipts: {}, archivedReceipts: {} });
async function loadReceipt(context) {
  const journal = await readJson(context.journalPath, blankJournal(context)); return journal.receipts[context.assetKey];
}
const observedOptions = (task, prior = {}) => ({ ...prior,
  ...(typeof task.ai_model === 'string' ? { aiModel: task.ai_model } : {}), ...(typeof task.topology === 'string' ? { topology: task.topology } : {}), ...(typeof task.should_remesh === 'boolean' ? { shouldRemesh: task.should_remesh } : {}),
  ...(typeof task.enable_pbr === 'boolean' ? { pbr: task.enable_pbr } : {}), ...(typeof task.texture_resolution === 'string' ? { sourceTextureResolution: task.texture_resolution } : {}), ...(Array.isArray(task.target_formats) ? { formats: task.target_formats.filter(value => typeof value === 'string') } : {}) });

function initialReceipt(context, recipe = recipeFor(context)) {
  const inputHashValue = inputHash(context, { attemptId: recipe.attemptId });
  return {
    schemaVersion: 1, assetKey: context.assetKey, attemptId: recipe.attemptId, role: context.asset.role, sourceKind: 'meshy-generated', state: 'planned',
    source: { provider: 'meshy', previewTaskId: null, refineTaskId: null, parentTaskId: null },
    model: { requested: context.config.model, actual: null, targetPolycount: context.asset.targetPolycount },
    utc: { plannedAt: new Date().toISOString() }, expectedCredits: { preview: context.config.pricing.previewCredits, refine: context.config.pricing.refine2kCredits },
    prompt: recipe.prompt, inputHash: inputHashValue, sourceSha256: null, outputSha256: null, review: { status: 'pending', reasons: [], evidence: [] },
    attribution: { licenseBasis: 'Meshy-generated original asset for this project; account terms apply.' }, cleanup: null, retry: null,
    exporterVersion: null, runtimeBudget: { textureMax: context.asset.runtimeTextureMax }, operations: [], output: null,
  };
}

async function liveBalance() {
  const value = await apiRequest('GET', '/openapi/v1/balance');
  if (!isRecord(value) || typeof value.balance !== 'number' || !Number.isFinite(value.balance)) throw new PipelineError('invalid_balance_response');
  return value.balance;
}

async function submit(context, stage) {
  requireCredential(context.config);
  await withContextLock(context, async () => {
    const journal = await readJson(context.journalPath, blankJournal(context));
    const existing = journal.receipts[context.assetKey];
    if (stage === 'preview' && existing && (existing.state !== 'planned' || existing.operations.length)) throw new PipelineError('duplicate_asset_attempt', context.assetKey);
    const receipt = existing ?? initialReceipt(context);
    if (stage === 'refine' && receipt.state !== 'review_accepted') throw new PipelineError('refine_requires_accepted_review', receipt.state);
    const expectedCredits = stage === 'preview' ? receipt.expectedCredits.preview : receipt.expectedCredits.refine;
    const current = aggregate(journal); const balance = await liveBalance();
    if (current.charged + current.unresolved + expectedCredits > context.config.limits.totalCredits) throw new PipelineError('total_budget_exceeded');
    if (journal.accountOpeningBalance === null || journal.accountOpeningBalance === undefined) { if (current.charged + current.unresolved > 0) throw new PipelineError('missing_opening_balance_anchor'); journal.accountOpeningBalance = balance; }
    const spendableBalance = Math.min(balance, journal.accountOpeningBalance - current.charged - current.unresolved); if (spendableBalance - expectedCredits < context.config.limits.minimumBalance) throw new PipelineError('minimum_balance_breached');
    const operation = { stage, attemptId: randomUUID(), expectedCredits, actualCredits: null, accounting: 'submitting', taskId: null, balanceObservedBefore: balance, spendableBalanceBefore: spendableBalance, projectedBalanceAfterReservations: spendableBalance - expectedCredits, submittedAt: new Date().toISOString() };
    receipt.operations.push(operation); receipt.state = `${stage}_submitting`; await writeLedger(context, journal, receipt);
    if (stage === 'refine') receipt.source.parentTaskId = receipt.source.previewTaskId;
    const body = stage === 'preview'
      ? { mode: 'preview', prompt: receipt.prompt, ai_model: 'meshy-7', should_remesh: true, topology: 'triangle', target_polycount: receipt.model.targetPolycount, target_formats: ['glb'], auto_size: true, origin_at: 'bottom' }
      : { mode: 'refine', preview_task_id: receipt.source.previewTaskId, enable_pbr: true, texture_resolution: '2k', target_formats: ['glb'], auto_size: true, origin_at: 'bottom' };
    try {
      const response = await apiRequest('POST', '/openapi/v2/text-to-3d', body);
      if (!isRecord(response) || typeof response.result !== 'string') throw new PipelineError('missing_provider_task_id');
      if (taskClaims(journal, response.result).length) throw new PipelineError('provider_task_id_collision');
      operation.taskId = response.result; operation.accounting = 'submitted'; receipt.source[`${stage}TaskId`] = response.result; receipt.state = `${stage}_submitted`;
    } catch (error) {
      if (error instanceof HttpStatusError && [400, 401, 403, 404, 422, 429].includes(error.status)) { operation.accounting = 'refunded'; operation.actualCredits = 0; receipt.state = `${stage}_api_refunded`; }
      else { operation.accounting = 'unknown'; receipt.state = `${stage}_submit_unknown`; }
      await writeLedger(context, journal, receipt); throw error;
    }
    await writeLedger(context, journal, receipt);
  });
}

async function attach(context) {
  const stage = required('--operation'); const taskId = required('--task-id');
  if (!['preview', 'refine'].includes(stage)) throw new PipelineError('invalid_operation', stage);
  await withContextLock(context, async () => {
    const journal = await readJson(context.journalPath, blankJournal(context)); const receipt = journal.receipts[context.assetKey];
    const existingTaskId = receipt?.source?.[`${stage}TaskId`];
    if (existingTaskId === taskId) return;
    if (taskClaims(journal, taskId).length) throw new PipelineError('foreign_task_id');
    if (!receipt || receipt.state !== `${stage}_submit_unknown`) throw new PipelineError('attach_requires_unknown_submission');
    const operation = receipt.operations.findLast(candidate => candidate.stage === stage);
    if (!operation || operation.taskId) throw new PipelineError('invalid_unknown_operation');
    operation.taskId = taskId; operation.accounting = 'submitted'; receipt.source[`${stage}TaskId`] = taskId; receipt.state = `${stage}_submitted`; await writeLedger(context, journal, receipt);
  });
}

async function poll(context) {
  requireCredential(context.config);
  const receipt = await loadReceipt(context); if (!receipt) throw new PipelineError('missing_receipt');
  const stage = receipt.state.startsWith('preview_') ? 'preview' : receipt.state.startsWith('refine_') ? 'refine' : null;
  if (!stage || !['preview_submitted', 'refine_submitted'].includes(receipt.state)) throw new PipelineError('poll_requires_submitted_task', receipt.state);
  const taskId = receipt.source[`${stage}TaskId`]; const task = await apiRequest('GET', `/openapi/v2/text-to-3d/${encodeURIComponent(taskId)}`);
  if (!isRecord(task) || typeof task.status !== 'string') throw new PipelineError('invalid_task_response');
  await withContextLock(context, async () => {
    const journal = await readJson(context.journalPath, blankJournal(context)); const current = journal.receipts[context.assetKey]; const operation = current.operations.findLast(candidate => candidate.stage === stage);
    if (task.status === 'SUCCEEDED') {
      operation.accounting = 'charged'; operation.actualCredits = operation.expectedCredits; operation.completedAt = new Date().toISOString();
      current.state = stage === 'preview' ? 'preview_complete_pending_review' : 'refine_complete'; current.model.actual = observedOptions(task, current.model.actual ?? {});
    } else if (TERMINAL_PROVIDER_FAILURES.has(task.status)) {
      operation.accounting = 'refunded'; operation.actualCredits = 0; operation.completedAt = new Date().toISOString(); current.state = `${stage}_api_refunded`;
    }
    await writeLedger(context, journal, current);
  });
}

async function review(context) {
  const decision = required('--decision'); const reason = required('--reason'); const evidence = required('--evidence');
  if (!['accepted', 'rejected'].includes(decision)) throw new PipelineError('invalid_review_decision');
  const evidencePaths = [...new Set(evidence.split(',').filter(Boolean))];
  if (evidencePaths.length < (decision === 'accepted' ? 4 : 2)) throw new PipelineError('insufficient_review_evidence');
  const boundEvidence = await bindReviewEvidence(context, evidencePaths, fixtureMode());
  await withContextLock(context, async () => {
    const journal = await readJson(context.journalPath, blankJournal(context)); const receipt = journal.receipts[context.assetKey];
    if (!receipt || !['preview_complete_pending_review', 'review_rejected'].includes(receipt.state) || (receipt.state === 'review_rejected' && decision !== 'rejected')) throw new PipelineError('review_requires_completed_preview');
    receipt.review = { status: decision, reasons: [reason], evidence: boundEvidence, reviewedAt: new Date().toISOString() };
    receipt.state = decision === 'accepted' ? 'review_accepted' : 'review_rejected'; await writeLedger(context, journal, receipt);
  });
}

async function retry(context) {
  const attemptId = required('--attempt-id'); const reason = required('--reason'); const recipe = recipeFor(context, attemptId);
  if (!recipe || typeof recipe.authorizationArtifact !== 'string') throw new PipelineError('unauthorized_retry_recipe');
  const authorizationBytes = await readFile(resolve(recipe.authorizationArtifact)); if (sha256(authorizationBytes) !== recipe.authorizationSha256) throw new PipelineError('retry_authorization_hash_mismatch');
  let authorization; try { authorization = JSON.parse(authorizationBytes); } catch { throw new PipelineError('invalid_retry_authorization'); }
  const retryAuthorized = authorization?.retryAuthorized === true || authorization?.retryAuthorizedByArt === true;
  if (!isRecord(authorization) || authorization.assetKey !== context.assetKey || authorization.correctedPrompt !== recipe.prompt || !retryAuthorized || authorization.refineAuthorized !== false) throw new PipelineError('retry_not_authorized');
  await withContextLock(context, async () => {
    const journal = await readJson(context.journalPath, blankJournal(context)); const receipt = journal.receipts[context.assetKey];
    if (receipt?.attemptId === attemptId && receipt.state === 'planned') return;
    const priorAttemptId = receipt?.attemptId ?? 'attempt-1'; if (!receipt || receipt.state !== 'review_rejected' || recipe.priorAttemptId !== priorAttemptId) throw new PipelineError('retry_requires_matching_rejected_attempt');
    await verifyReviewEvidence(context, receipt.review, fixtureMode());
    if ((journal.archivedReceipts?.[context.assetKey] ?? []).some(candidate => (candidate.attemptId ?? 'attempt-1') === attemptId)) throw new PipelineError('duplicate_retry_attempt');
    const archiveRelativePath = `attempts/${context.assetKey}/${priorAttemptId}.json`; const archivePath = join(context.out, archiveRelativePath); await atomicJson(archivePath, receipt); const priorReceiptSha256 = sha256(await readFile(archivePath));
    journal.archivedReceipts ??= {}; journal.archivedReceipts[context.assetKey] ??= []; journal.archivedReceipts[context.assetKey].push(receipt);
    const next = initialReceipt(context, recipe); next.retry = { reason, priorAttemptId, priorReceiptPath: archiveRelativePath, priorReceiptSha256, authorizationArtifact: recipe.authorizationArtifact, authorizationSha256: recipe.authorizationSha256, preparedAt: new Date().toISOString() }; await writeLedger(context, journal, next);
  });
}

async function download(context, previewOnly = false) {
  requireCredential(context.config); const receipt = await loadReceipt(context); const requiredState = previewOnly ? 'preview_complete_pending_review' : 'refine_complete';
  if (!receipt || receipt.state !== requiredState) throw new PipelineError(previewOnly ? 'preview_download_requires_completed_preview' : 'download_requires_completed_refine');
  const taskId = previewOnly ? receipt.source.previewTaskId : receipt.source.refineTaskId; const task = await apiRequest('GET', `/openapi/v2/text-to-3d/${encodeURIComponent(taskId)}`);
  if (!isRecord(task) || !isRecord(task.model_urls) || typeof task.model_urls.glb !== 'string') throw new PipelineError('missing_glb_url'); const buffer = await downloadRequest(task.model_urls.glb);
  const relativePath = previewOnly ? `reviews/${context.assetKey}/preview.glb` : `sources/${context.assetKey}.glb`; await mkdir(dirname(join(context.out, relativePath)), { recursive: true }); await writeFile(join(context.out, relativePath), buffer);
  let thumbnail; if (previewOnly) { if (typeof task.thumbnail_url !== 'string') throw new PipelineError('missing_thumbnail_url'); thumbnail = await downloadRequest(task.thumbnail_url); await writeFile(join(context.out, 'reviews', context.assetKey, 'thumbnail.png'), thumbnail); }
  await withContextLock(context, async () => { const journal = await readJson(context.journalPath, blankJournal(context)); const current = journal.receipts[context.assetKey];
    if (previewOnly) current.reviewArtifacts = { model: { relativePath, sha256: sha256(buffer), bytes: buffer.length }, thumbnail: { relativePath: `reviews/${context.assetKey}/thumbnail.png`, sha256: sha256(thumbnail), bytes: thumbnail.length } };
    else { current.sourceSha256 = sha256(buffer); current.sourceArtifact = { relativePath, bytes: buffer.length }; current.output = null; current.state = 'downloaded'; }
    await writeLedger(context, journal, current);
  });
}

async function cleanup(context) {
  const artifact = resolve(required('--artifact')); const buffer = await readFile(artifact); const exporterVersion = required('--exporter-version');
  await withContextLock(context, async () => {
    const journal = await readJson(context.journalPath, blankJournal(context)); const receipt = journal.receipts[context.assetKey];
    if (!receipt || receipt.state !== 'downloaded') throw new PipelineError('cleanup_requires_downloaded');
    receipt.outputSha256 = sha256(buffer); receipt.cleanup = { exporterVersion, completedAt: new Date().toISOString() }; receipt.exporterVersion = exporterVersion; receipt.output = { bytes: buffer.length }; receipt.state = 'cleaned'; await writeLedger(context, journal, receipt);
  });
}

async function audit(context) {
  const artifact = resolve(required('--artifact')); const buffer = await readFile(artifact);
  await withContextLock(context, async () => {
    const journal = await readJson(context.journalPath, blankJournal(context)); const receipt = journal.receipts[context.assetKey];
    if (!receipt || receipt.state !== 'cleaned' || receipt.review.status !== 'accepted') throw new PipelineError('audit_requires_cleaned_accepted_asset'); await verifyReviewEvidence(context, receipt.review, fixtureMode());
    const recipe = recipeFor(context, receipt.attemptId); if (!recipe || receipt.prompt !== recipe.prompt || JSON.stringify(receipt.model.requested) !== JSON.stringify(context.config.model) || receipt.model.targetPolycount !== context.asset.targetPolycount || receipt.inputHash !== inputHash(context, receipt)) throw new PipelineError('input_hash_mismatch');
    const expectedSourcePath = `sources/${context.assetKey}.glb`; if (receipt.sourceArtifact?.relativePath !== expectedSourcePath) throw new PipelineError('noncanonical_source_path'); const source = await readFile(join(context.out, expectedSourcePath)); if (sha256(source) !== receipt.sourceSha256 || source.length !== receipt.sourceArtifact.bytes) throw new PipelineError('source_hash_mismatch');
    if (receipt.model.actual?.aiModel !== 'meshy-7' || receipt.model.actual?.topology !== 'triangle' || receipt.model.actual?.shouldRemesh !== true || receipt.model.actual?.pbr !== true || receipt.model.actual?.sourceTextureResolution !== '2k' || !receipt.model.actual?.formats?.includes('glb')) throw new PipelineError('provider_options_unverified');
    if (buffer.length < 20 || buffer.readUInt32LE(0) !== 0x46546c67 || buffer.readUInt32LE(4) !== 2 || buffer.readUInt32LE(8) !== buffer.length) throw new PipelineError('invalid_glb');
    if (sha256(buffer) !== receipt.outputSha256 || receipt.output.bytes !== buffer.length) throw new PipelineError('output_hash_mismatch');
    const serialized = JSON.stringify(receipt);
    if (/MESHY_API_KEY|Bearer\s|https?:\/\//i.test(serialized)) throw new PipelineError('forbidden_receipt_field');
    receipt.state = 'audit_accepted'; receipt.audit = { acceptedAt: new Date().toISOString(), artifactSha256: receipt.outputSha256 }; await writeLedger(context, journal, receipt);
  });
}

async function main() {
  const context = await loadContext(); const stage = required('--stage'); if (stage === 'balance') { requireCredential(context.config); console.log(JSON.stringify({ balance: await liveBalance() })); return; }
  if (stage === 'preview' || stage === 'refine') await submit(context, stage);
  else if (stage === 'attach') await attach(context);
  else if (stage === 'poll') await poll(context);
  else if (stage === 'review') await review(context);
  else if (stage === 'retry') await retry(context);
  else if (stage === 'download-preview') await download(context, true); else if (stage === 'download') await download(context);
  else if (stage === 'cleanup') await cleanup(context); else if (stage === 'audit') await audit(context);
  else throw new PipelineError('unknown_stage', stage);
  const receipt = await readJson(context.receiptPath); console.log(JSON.stringify({ assetKey: context.assetKey, state: receipt.state, receipt: context.receiptPath }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error instanceof PipelineError || error instanceof JournalError || error instanceof ConfigError || error instanceof ReviewEvidenceError ? error.message : 'unexpected_pipeline_error'); process.exitCode = 1; });
}
