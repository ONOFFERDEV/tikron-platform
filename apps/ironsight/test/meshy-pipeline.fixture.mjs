import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const appRoot = resolve(import.meta.dirname, '..');
const configPath = join(appRoot, 'config', 'ww1-meshy.json');
const reportPath = process.argv[process.argv.indexOf('--report') + 1];
const fixtureRoot = await mkdtemp(join(tmpdir(), 'ironsight-meshy-fixture-'));
const tasks = new Map();
const requests = [];
const downloadRequests = [];
let mode = 'success';
let balance = 990;
let debitAccepted = true;
let acceptedSubmissions = 0;
let nextTask = 1;

const jsonChunk = Buffer.from(JSON.stringify({ asset: { version: '2.0' }, scenes: [{ nodes: [] }], scene: 0 }).padEnd(68, ' '));
const glb = Buffer.alloc(20 + jsonChunk.length);
glb.writeUInt32LE(0x46546c67, 0); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(glb.length, 8); glb.writeUInt32LE(jsonChunk.length, 12); glb.writeUInt32LE(0x4e4f534a, 16); jsonChunk.copy(glb, 20);
const thumbnail = Buffer.from('89504e470d0a1a0a', 'hex');
const downloadServer = http.createServer((request, response) => { downloadRequests.push({ path: request.url, authorization: request.headers.authorization ?? null }); response.end(request.url?.startsWith('/download/thumbnail') ? thumbnail : glb); });
await new Promise(resolveListen => downloadServer.listen(0, '127.0.0.1', resolveListen));
const downloadAddress = downloadServer.address();
if (!downloadAddress || typeof downloadAddress === 'string') throw new TypeError('Download fixture did not bind a TCP port');
const downloadBaseUrl = `http://127.0.0.1:${downloadAddress.port}`;

const server = http.createServer((request, response) => {
  const path = request.url ?? '';
  if (path === '/openapi/v1/balance') { requests.push({ method: 'GET', path }); response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ balance })); return; }
  if (request.method === 'POST' && path === '/openapi/v2/text-to-3d') {
    const chunks = [];
    request.on('data', chunk => chunks.push(chunk));
    request.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8')); requests.push({ method: 'POST', path, body });
      if (mode === 'timeout') return;
      if (mode === '401' || mode === '429' || mode === '500') { response.statusCode = Number(mode); response.end(`redacted-provider-body https://signed.invalid/${mode}`); return; }
      const id = `${body.mode}-${nextTask++}`; acceptedSubmissions += 1; if (debitAccepted) balance -= body.mode === 'preview' ? 20 : 10; tasks.set(id, { ...body, status: 'SUCCEEDED', ai_model: body.ai_model ?? 'meshy-7' });
      response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ result: id }));
    });
    return;
  }
  if (request.method === 'GET' && path.startsWith('/openapi/v2/text-to-3d/')) {
    const id = decodeURIComponent(path.split('/').at(-1)); const task = tasks.get(id) ?? { status: 'PENDING' };
    requests.push({ method: 'GET', path }); response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ ...task, thumbnail_url: `${downloadBaseUrl}/download/thumbnail.png?signature=fixture-secret`, model_urls: { glb: `${downloadBaseUrl}/download/model.glb?signature=fixture-secret` } })); return;
  }
  response.statusCode = 404; response.end();
});
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const address = server.address();
if (!address || typeof address === 'string') throw new TypeError('Fixture server did not bind a TCP port');
const baseUrl = `http://127.0.0.1:${address.port}`;
const fixtureEnv = { ...process.env, MESHY_API_KEY: 'fixture-only-key', MESHY_CREDENTIAL_SOURCE: 'ironsight-meshy-fixture', MESHY_FIXTURE_MODE: '1' };
const receiptName = asset => `${asset.replaceAll('_', '-')}.json`;

async function run(asset, stage, root, extra = [], env = fixtureEnv) {
  const command = ['tools/meshy-generate.mjs', '--config', configPath, '--asset', asset, '--stage', stage, '--out', root, '--api-base', baseUrl, '--timeout-ms', '80', ...extra];
  try { const result = await execute(process.execPath, command, { cwd: appRoot, env, windowsHide: true }); return { ok: true, stdout: result.stdout, stderr: result.stderr }; }
  catch (error) { return { ok: false, stdout: error.stdout ?? '', stderr: error.stderr ?? '' }; }
}

const observations = [];
try {
  const reviewEvidence = await Promise.all(['front.png', 'side.png', 'back.png', 'clay.png'].map(async name => { const path = join(fixtureRoot, name); await writeFile(path, name); return path; }));
  const happyRoot = join(fixtureRoot, 'happy');
  const preview = await run('automatic_rifle', 'preview', happyRoot); assert.equal(preview.ok, true);
  const previewReceipt = JSON.parse(await readFile(join(happyRoot, 'receipts', receiptName('automatic_rifle')), 'utf8'));
  assert.equal(previewReceipt.state, 'preview_submitted');
  const previewRequest = requests.find(entry => entry.method === 'POST');
  assert.deepEqual({ ai_model: previewRequest.body.ai_model, topology: previewRequest.body.topology, should_remesh: previewRequest.body.should_remesh }, { ai_model: 'meshy-7', topology: 'triangle', should_remesh: true });
  assert.equal(await run('automatic_rifle', 'poll', happyRoot).then(result => result.ok), true);
  assert.equal(await run('automatic_rifle', 'download-preview', happyRoot).then(result => result.ok), true);
  assert.deepEqual(await readFile(join(happyRoot, 'reviews', 'automatic_rifle', 'preview.glb')), glb);
  assert.deepEqual(await readFile(join(happyRoot, 'reviews', 'automatic_rifle', 'thumbnail.png')), thumbnail);
  const downloadedPreviewReceipt = JSON.parse(await readFile(join(happyRoot, 'receipts', receiptName('automatic_rifle')), 'utf8'));
  assert.equal(downloadedPreviewReceipt.reviewArtifacts.model.relativePath, 'reviews/automatic_rifle/preview.glb');
  assert.equal(downloadedPreviewReceipt.reviewArtifacts.thumbnail.relativePath, 'reviews/automatic_rifle/thumbnail.png');
  assert.equal(downloadRequests.every(entry => entry.authorization === null), true);
  const postsBeforeReview = acceptedSubmissions;
  assert.equal(await run('automatic_rifle', 'refine', happyRoot).then(result => result.ok), false); assert.equal(acceptedSubmissions, postsBeforeReview);
  assert.equal(await run('automatic_rifle', 'review', happyRoot, ['--decision', 'accepted', '--reason', 'silhouette-and-topology-pass', '--evidence', reviewEvidence.join(',')]).then(result => result.ok), true);
  assert.equal(await run('automatic_rifle', 'refine', happyRoot).then(result => result.ok), true);
  const postsAfterRefine = acceptedSubmissions;
  assert.equal(await run('automatic_rifle', 'refine', happyRoot).then(result => result.ok), false); assert.equal(acceptedSubmissions, postsAfterRefine);
  assert.equal(await run('automatic_rifle', 'poll', happyRoot).then(result => result.ok), true);
  assert.equal(await run('automatic_rifle', 'download', happyRoot).then(result => result.ok), true);
  assert.equal(downloadRequests[0]?.authorization, null);
  const artifact = join(happyRoot, 'sources', 'automatic_rifle.glb');
  assert.equal(await run('automatic_rifle', 'cleanup', happyRoot, ['--artifact', artifact, '--exporter-version', 'fixture-cleaner-1']).then(result => result.ok), true);
  const preAuditReceiptPath = join(happyRoot, 'receipts', receiptName('automatic_rifle')); const preAuditReceiptBytes = await readFile(preAuditReceiptPath); const preAuditJournalPath = join(happyRoot, 'journal.json'); const preAuditJournalBytes = await readFile(preAuditJournalPath);
  const reducedReceipt = JSON.parse(preAuditReceiptBytes); reducedReceipt.review.evidence = reducedReceipt.review.evidence.slice(0, 2); const reducedJournal = JSON.parse(preAuditJournalBytes); reducedJournal.receipts.automatic_rifle = reducedReceipt;
  await writeFile(preAuditReceiptPath, JSON.stringify(reducedReceipt)); await writeFile(preAuditJournalPath, JSON.stringify(reducedJournal));
  assert.equal(await run('automatic_rifle', 'audit', happyRoot, ['--artifact', artifact]).then(result => result.ok), false);
  reducedReceipt.state = 'audit_accepted'; await writeFile(preAuditReceiptPath, JSON.stringify(reducedReceipt));
  assert.equal(await execute(process.execPath, ['scripts/audit-assets.mjs', '--config', configPath, '--receipt', preAuditReceiptPath, '--artifact', artifact], { cwd: appRoot, env: fixtureEnv, windowsHide: true }).then(() => true, () => false), false);
  await writeFile(preAuditReceiptPath, preAuditReceiptBytes); await writeFile(preAuditJournalPath, preAuditJournalBytes); observations.push('accepted review tampering from four bound artifacts to two failed internal and external audit');
  assert.equal(await run('automatic_rifle', 'audit', happyRoot, ['--artifact', artifact]).then(result => result.ok), true);
  const acceptedReceiptPath = join(happyRoot, 'receipts', receiptName('automatic_rifle'));
  const acceptedReceipt = JSON.parse(await readFile(acceptedReceiptPath, 'utf8'));
  assert.equal(acceptedReceipt.state, 'audit_accepted'); assert.equal(acceptedReceipt.operations.length, 2); assert.equal(acceptedReceipt.model.actual.aiModel, 'meshy-7'); assert.equal(acceptedReceipt.model.actual.sourceTextureResolution, '2k'); assert.equal(JSON.stringify(acceptedReceipt).includes('signature=fixture-secret'), false);
  const externalAudit = await execute(process.execPath, ['scripts/audit-assets.mjs', '--config', configPath, '--receipt', acceptedReceiptPath, '--artifact', artifact], { cwd: appRoot, env: fixtureEnv, windowsHide: true });
  assert.equal(JSON.parse(externalAudit.stdout).state, 'audit_accepted'); observations.push('accepted preview paused, reviewed, refined once, resumed, downloaded, cleaned and audited');

  const rejectRoot = join(fixtureRoot, 'rejected');
  assert.equal(await run('trench_smg', 'preview', rejectRoot).then(result => result.ok), true); assert.equal(await run('trench_smg', 'poll', rejectRoot).then(result => result.ok), true);
  assert.equal(await run('trench_smg', 'review', rejectRoot, ['--decision', 'rejected', '--reason', 'incorrect-period-silhouette', '--evidence', reviewEvidence.slice(0, 2).join(',')]).then(result => result.ok), true);
  const boundReview = JSON.parse(await readFile(join(rejectRoot, 'receipts', receiptName('trench_smg')), 'utf8')).review; assert.match(boundReview.evidence[0].sha256, /^[a-f0-9]{64}$/); assert.equal(boundReview.evidence[0].bytes, 9);
  assert.equal(await run('trench_smg', 'review', rejectRoot, ['--decision', 'rejected', '--reason', 'bad-evidence', '--evidence', `${reviewEvidence[0]},${join(fixtureRoot, 'missing.png')}`]).then(result => result.ok), false);
  assert.equal(await run('trench_smg', 'review', rejectRoot, ['--decision', 'rejected', '--reason', 'corrected-evidence', '--evidence', reviewEvidence.slice(1, 3).join(',')]).then(result => result.ok), true);
  const rejectedPosts = acceptedSubmissions; assert.equal(await run('trench_smg', 'refine', rejectRoot).then(result => result.ok), false); assert.equal(acceptedSubmissions, rejectedPosts); observations.push('artistic rejection stayed charged and blocked refine');

  balance = 990; const retryRoot = join(fixtureRoot, 'intentional-retry');
  assert.equal(await run('automatic_rifle', 'preview', retryRoot).then(result => result.ok), true); assert.equal(await run('automatic_rifle', 'poll', retryRoot).then(result => result.ok), true);
  assert.equal(await run('automatic_rifle', 'review', retryRoot, ['--decision', 'rejected', '--reason', 'wrong-morphology', '--evidence', reviewEvidence.slice(0, 2).join(',')]).then(result => result.ok), true);
  const firstAttempt = JSON.parse(await readFile(join(retryRoot, 'receipts', receiptName('automatic_rifle')), 'utf8'));
  const rejectedAuthorizationPath = join(fixtureRoot, 'rejected-authorization.json'); const rejectedAuthorization = Buffer.from(JSON.stringify({ assetKey: 'automatic_rifle', correctedPrompt: 'malicious', retryAuthorized: false, refineAuthorized: false })); await writeFile(rejectedAuthorizationPath, rejectedAuthorization);
  const rejectedConfig = JSON.parse(await readFile(configPath, 'utf8')); rejectedConfig.retryRecipes.automatic_rifle[0].authorizationArtifact = rejectedAuthorizationPath; rejectedConfig.retryRecipes.automatic_rifle[0].authorizationSha256 = createHash('sha256').update(rejectedAuthorization).digest('hex'); const rejectedConfigPath = join(fixtureRoot, 'rejected-authorization-config.json'); await writeFile(rejectedConfigPath, JSON.stringify(rejectedConfig));
  const rejectedAuthorizationRun = await execute(process.execPath, ['tools/meshy-generate.mjs', '--config', rejectedConfigPath, '--asset', 'automatic_rifle', '--stage', 'retry', '--attempt-id', 'attempt-2', '--reason', 'must-fail', '--out', retryRoot, '--api-base', baseUrl], { cwd: appRoot, env: fixtureEnv, windowsHide: true }).then(() => true, () => false); assert.equal(rejectedAuthorizationRun, false);
  const originalReviewBytes = await readFile(reviewEvidence[0]); await writeFile(reviewEvidence[0], 'changed-after-review'); assert.equal(await run('automatic_rifle', 'retry', retryRoot, ['--attempt-id', 'attempt-2', '--reason', 'changed-evidence']).then(result => result.ok), false); await writeFile(reviewEvidence[0], originalReviewBytes);
  assert.equal(await run('automatic_rifle', 'retry', retryRoot, ['--attempt-id', 'attempt-2', '--reason', 'reviewed-corrected-recipe']).then(result => result.ok), true);
  const archivedAttempt = JSON.parse(await readFile(join(retryRoot, 'attempts', 'automatic_rifle', 'attempt-1.json'), 'utf8')); assert.deepEqual(archivedAttempt, firstAttempt);
  const retryReceipt = JSON.parse(await readFile(join(retryRoot, 'receipts', receiptName('automatic_rifle')), 'utf8')); assert.equal(retryReceipt.state, 'planned'); assert.equal(retryReceipt.attemptId, 'attempt-2'); assert.notEqual(retryReceipt.inputHash, firstAttempt.inputHash);
  assert.equal(await run('automatic_rifle', 'retry', retryRoot, ['--attempt-id', 'attempt-2', '--reason', 'reviewed-corrected-recipe']).then(result => result.ok), true);
  assert.equal(await run('automatic_rifle', 'preview', retryRoot).then(result => result.ok), true);
  const config = JSON.parse(await readFile(configPath, 'utf8')); const retryPost = requests.filter(entry => entry.method === 'POST').at(-1); assert.equal(retryPost.body.prompt, config.retryRecipes.automatic_rifle[0].prompt);
  assert.equal(await run('automatic_rifle', 'retry', retryRoot, ['--attempt-id', 'attempt-2', '--reason', 'unsafe-repeat']).then(result => result.ok), false);
  assert.equal(await run('automatic_rifle', 'poll', retryRoot).then(result => result.ok), true);
  assert.equal(await run('automatic_rifle', 'download-preview', retryRoot).then(result => result.ok), true);
  assert.equal(await run('automatic_rifle', 'review', retryRoot, ['--decision', 'accepted', '--reason', 'corrected-morphology-pass', '--evidence', reviewEvidence.join(',')]).then(result => result.ok), true);
  assert.equal(await run('automatic_rifle', 'refine', retryRoot).then(result => result.ok), true);
  assert.equal(await run('automatic_rifle', 'poll', retryRoot).then(result => result.ok), true);
  assert.equal(await run('automatic_rifle', 'download', retryRoot).then(result => result.ok), true);
  const retryArtifact = join(retryRoot, 'sources', 'automatic_rifle.glb');
  assert.equal(await run('automatic_rifle', 'cleanup', retryRoot, ['--artifact', retryArtifact, '--exporter-version', 'fixture-cleaner-1']).then(result => result.ok), true);
  assert.equal(await run('automatic_rifle', 'audit', retryRoot, ['--artifact', retryArtifact]).then(result => result.ok), true);
  const retryReceiptPath = join(retryRoot, 'receipts', receiptName('automatic_rifle'));
  const retryExternalAudit = await execute(process.execPath, ['scripts/audit-assets.mjs', '--config', configPath, '--receipt', retryReceiptPath, '--artifact', retryArtifact], { cwd: appRoot, env: fixtureEnv, windowsHide: true });
  assert.equal(JSON.parse(retryExternalAudit.stdout).state, 'audit_accepted'); observations.push('reviewed rejection retry preserved immutable charged lineage and completed an externally audited authorized attempt-2');

  const requestCount = requests.length;
  const noKeyEnv = { ...fixtureEnv }; delete noKeyEnv.MESHY_API_KEY;
  assert.equal(await run('pump_shotgun', 'preview', join(fixtureRoot, 'no-key'), [], noKeyEnv).then(result => result.ok), false);
  assert.equal(await run('pump_shotgun', 'preview', join(fixtureRoot, 'wrong-source'), [], { ...fixtureEnv, MESHY_CREDENTIAL_SOURCE: 'legacy-shared-account' }).then(result => result.ok), false);
  assert.equal(await run('pump_shotgun', 'preview', join(fixtureRoot, 'real-source-redirect'), [], { ...fixtureEnv, MESHY_CREDENTIAL_SOURCE: 'ironsight-meshy-20260911' }).then(result => result.ok), false);
  assert.equal(requests.length, requestCount); observations.push('missing and wrong-source credentials made zero requests');
  observations.push('real credential source marker could not enable the local API override');

  mode = 'success'; balance = 990; const balanceRoot = join(fixtureRoot, 'live-balance-accounting');
  assert.equal(await run('supply-wagon', 'preview', balanceRoot).then(result => result.ok), true);
  assert.equal(await run('field-telephone', 'preview', balanceRoot).then(result => result.ok), true);
  const secondBalanceReceipt = JSON.parse(await readFile(join(balanceRoot, 'receipts', receiptName('field-telephone')), 'utf8'));
  assert.equal(secondBalanceReceipt.operations[0].balanceObservedBefore, 970); assert.equal(secondBalanceReceipt.operations[0].projectedBalanceAfterReservations, 950);
  const balanceRead = await run('automatic_rifle', 'balance', balanceRoot); assert.equal(balanceRead.ok, true); assert.equal(JSON.parse(balanceRead.stdout).balance, 950); balance = 990;
  observations.push('live provider balance was not reduced twice by known submitted tasks');

  balance = 330; debitAccepted = false; const staleBalanceRoot = join(fixtureRoot, 'stale-live-balance'); const stalePosts = acceptedSubmissions;
  assert.equal(await run('supply-wagon', 'preview', staleBalanceRoot).then(result => result.ok), true);
  assert.equal(await run('field-telephone', 'preview', staleBalanceRoot).then(result => result.ok), false); assert.equal(acceptedSubmissions, stalePosts + 1);
  debitAccepted = true; balance = 990; observations.push('stale provider balance retained accepted submitted liability at the 300-credit floor');

  for (const status of ['401', '429']) {
    mode = status; const root = join(fixtureRoot, status); const before = acceptedSubmissions;
    const result = await run(status === '401' ? 'pump_shotgun' : 'bolt_service_rifle', 'preview', root); assert.equal(result.ok, false); assert.equal(acceptedSubmissions, before);
    assert.equal(result.stderr.includes('signed.invalid'), false); const receipt = JSON.parse(await readFile(join(root, 'receipts', receiptName(status === '401' ? 'pump_shotgun' : 'bolt_service_rifle')), 'utf8'));
    assert.equal(receipt.operations[0].accounting, 'refunded');
  }
  observations.push('401 and 429 released reservations without leaking provider bodies');

  mode = '500'; const serverErrorRoot = join(fixtureRoot, '500'); const beforeServerError = acceptedSubmissions;
  const serverError = await run('observation-post', 'preview', serverErrorRoot); assert.equal(serverError.ok, false); assert.equal(acceptedSubmissions, beforeServerError);
  const serverErrorPath = join(serverErrorRoot, 'receipts', receiptName('observation-post')); const serverErrorReceipt = JSON.parse(await readFile(serverErrorPath, 'utf8'));
  assert.equal(serverErrorReceipt.state, 'preview_submit_unknown'); assert.equal(serverErrorReceipt.operations[0].accounting, 'unknown');
  const requestsAfter500 = requests.length; assert.equal(await run('observation-post', 'preview', serverErrorRoot).then(result => result.ok), false); assert.equal(requests.length, requestsAfter500); observations.push('HTTP 500 retained an unknown reservation and blocked retry');

  mode = 'success'; const providerFailureRoot = join(fixtureRoot, 'provider-failure');
  assert.equal(await run('brick-rubble', 'preview', providerFailureRoot).then(result => result.ok), true);
  const providerFailurePath = join(providerFailureRoot, 'receipts', receiptName('brick-rubble')); const providerFailure = JSON.parse(await readFile(providerFailurePath, 'utf8'));
  tasks.set(providerFailure.source.previewTaskId, { status: 'FAILED', ai_model: 'meshy-7' }); assert.equal(await run('brick-rubble', 'poll', providerFailureRoot).then(result => result.ok), true);
  const refundedFailure = JSON.parse(await readFile(providerFailurePath, 'utf8')); assert.equal(refundedFailure.operations[0].accounting, 'refunded'); assert.equal(refundedFailure.operations[0].actualCredits, 0); observations.push('provider task failure was recorded as refunded, unlike artistic rejection');

  mode = 'timeout'; const timeoutRoot = join(fixtureRoot, 'timeout'); const beforeTimeout = requests.length;
  assert.equal(await run('service_pistol', 'preview', timeoutRoot).then(result => result.ok), false);
  const unknown = JSON.parse(await readFile(join(timeoutRoot, 'receipts', receiptName('service_pistol')), 'utf8')); assert.equal(unknown.state, 'preview_submit_unknown');
  assert.equal(await run('service_pistol', 'preview', timeoutRoot).then(result => result.ok), false); assert.equal(requests.length, beforeTimeout + 2);
  mode = 'success'; tasks.set('reconciled-preview-id', { status: 'SUCCEEDED', ai_model: 'meshy-7' });
  assert.equal(await run('service_pistol', 'attach', timeoutRoot, ['--operation', 'preview', '--task-id', 'reconciled-preview-id']).then(result => result.ok), true);
  assert.equal(await run('service_pistol', 'poll', timeoutRoot).then(result => result.ok), true); observations.push('ambiguous POST held reservation and resumed only by attached original taskId');

  mode = 'timeout'; const killedRoot = join(fixtureRoot, 'hard-kill');
  const killedArgs = ['tools/meshy-generate.mjs', '--config', configPath, '--asset', 'ammo-crate', '--stage', 'preview', '--out', killedRoot, '--api-base', baseUrl, '--timeout-ms', '5000'];
  const killed = spawn(process.execPath, killedArgs, { cwd: appRoot, env: fixtureEnv, windowsHide: true });
  for (let attempt = 0; attempt < 100; attempt += 1) { try { await readFile(join(killedRoot, 'journal.json')); break; } catch { await new Promise(resolveDelay => setTimeout(resolveDelay, 20)); } }
  const liveRetry = await run('ammo-crate', 'preview', killedRoot); assert.equal(liveRetry.ok, false); assert.equal(killed.exitCode, null); assert.match(liveRetry.stderr, /budget_lock_busy/);
  killed.kill('SIGKILL'); await new Promise(resolveExit => killed.on('exit', resolveExit));
  const postsBeforeRecovery = requests.filter(entry => entry.method === 'POST').length; const recoveredAttach = await run('ammo-crate', 'attach', killedRoot, ['--operation', 'preview', '--task-id', 'recovered-kill-task']); assert.equal(recoveredAttach.ok, true);
  const repaired = JSON.parse(await readFile(join(killedRoot, 'receipts', receiptName('ammo-crate')), 'utf8')); assert.equal(repaired.state, 'preview_submitted'); assert.equal(typeof repaired.operations[0].recoveredAt, 'string'); assert.equal(requests.filter(entry => entry.method === 'POST').length, postsBeforeRecovery); observations.push('dead owner lock recovered and resumed by taskId without stealing live lock or resubmitting');

  const ownershipRoot = join(fixtureRoot, 'task-ownership');
  assert.equal(await run('supply-wagon', 'preview', ownershipRoot).then(result => result.ok), false); assert.equal(await run('field-telephone', 'preview', ownershipRoot).then(result => result.ok), false);
  assert.equal(await run('supply-wagon', 'attach', ownershipRoot, ['--operation', 'preview', '--task-id', 'owned-task-id']).then(result => result.ok), true);
  assert.equal(await run('supply-wagon', 'attach', ownershipRoot, ['--operation', 'preview', '--task-id', 'owned-task-id']).then(result => result.ok), true);
  assert.equal(await run('field-telephone', 'attach', ownershipRoot, ['--operation', 'preview', '--task-id', 'owned-task-id']).then(result => result.ok), false); observations.push('taskId ownership rejected cross-asset attach and allowed same-asset idempotency');

  mode = 'success'; balance = 330; const concurrentRoot = join(fixtureRoot, 'concurrent'); const postsBeforeConcurrent = acceptedSubmissions;
  const concurrent = await Promise.all([run('soldier-khaki', 'preview', concurrentRoot), run('soldier-fieldgrey', 'preview', concurrentRoot)]);
  assert.equal(concurrent.filter(result => result.ok).length, 1); assert.equal(acceptedSubmissions, postsBeforeConcurrent + 1); observations.push('concurrent final-credit reservations admitted one submitter');
  balance = 990; const totalRoot = join(fixtureRoot, 'total-limit'); await mkdir(totalRoot, { recursive: true });
  await writeFile(join(totalRoot, 'journal.json'), JSON.stringify({ schemaVersion: 1, limits: { totalCredits: 600, batchCredits: 150, minimumBalance: 300 }, receipts: { prior: { operations: [{ accounting: 'charged', actualCredits: 590, expectedCredits: 590 }] } } }));
  const postsBeforeTotal = acceptedSubmissions; assert.equal(await run('supply-wagon', 'preview', totalRoot).then(result => result.ok), false); assert.equal(acceptedSubmissions, postsBeforeTotal); observations.push('600-credit aggregate ceiling failed before submit');
  const batchKeys = 'automatic_rifle,trench_smg,pump_shotgun,bolt_service_rifle,service_pistol,soldier-khaki,soldier-fieldgrey,supply-wagon';
  const batchCommand = ['tools/meshy-batch.mjs', '--config', configPath, '--only', batchKeys, '--stage', 'preview', '--out', join(fixtureRoot, 'batch-limit'), '--api-base', baseUrl];
  const batchOver = await execute(process.execPath, batchCommand, { cwd: appRoot, env: fixtureEnv, windowsHide: true }).then(() => true, () => false); assert.equal(batchOver, false); assert.equal(acceptedSubmissions, postsBeforeTotal); observations.push('150-credit invocation ceiling rejected eight previews');
  balance = 319; const postsBeforeFloor = acceptedSubmissions;
  assert.equal(await run('supply-wagon', 'preview', join(fixtureRoot, 'floor')).then(result => result.ok), false); assert.equal(acceptedSubmissions, postsBeforeFloor); observations.push('minimum 300 balance failed before submit');

  const unsafeConfig = JSON.parse(await readFile(configPath, 'utf8')); unsafeConfig.model.ultra = true; unsafeConfig.model.sourceTextureResolution = '8k';
  const unsafePath = join(fixtureRoot, 'unsafe.json'); await writeFile(unsafePath, JSON.stringify(unsafeConfig));
  const unsafeCommand = ['tools/meshy-generate.mjs', '--config', unsafePath, '--asset', 'ammo-crate', '--stage', 'preview', '--out', join(fixtureRoot, 'unsafe'), '--api-base', baseUrl];
  const unsafe = await execute(process.execPath, unsafeCommand, { cwd: appRoot, env: fixtureEnv, windowsHide: true }).then(() => true, () => false); assert.equal(unsafe, false); assert.equal(acceptedSubmissions, postsBeforeFloor); observations.push('8K and Ultra escalation failed before submit');

  const corrupt = Buffer.from(glb); corrupt[corrupt.length - 1] ^= 1; const corruptPath = join(fixtureRoot, 'corrupt.glb'); await writeFile(corruptPath, corrupt);
  const corruptAudit = await execute(process.execPath, ['scripts/audit-assets.mjs', '--config', configPath, '--receipt', acceptedReceiptPath, '--artifact', corruptPath], { cwd: appRoot, env: fixtureEnv, windowsHide: true }).then(() => true, () => false); assert.equal(corruptAudit, false); observations.push('hash mismatch failed provenance audit');
  const originalReceipt = await readFile(acceptedReceiptPath, 'utf8'); const forged = JSON.parse(originalReceipt); forged.inputHash = '0'.repeat(64); await writeFile(acceptedReceiptPath, JSON.stringify(forged));
  const forgedInput = await execute(process.execPath, ['scripts/audit-assets.mjs', '--config', configPath, '--receipt', acceptedReceiptPath, '--artifact', artifact], { cwd: appRoot, env: fixtureEnv, windowsHide: true }).then(() => true, () => false); assert.equal(forgedInput, false);
  forged.inputHash = JSON.parse(originalReceipt).inputHash; forged.sourceSha256 = '1'.repeat(64); await writeFile(acceptedReceiptPath, JSON.stringify(forged));
  const forgedSource = await execute(process.execPath, ['scripts/audit-assets.mjs', '--config', configPath, '--receipt', acceptedReceiptPath, '--artifact', artifact], { cwd: appRoot, env: fixtureEnv, windowsHide: true }).then(() => true, () => false); assert.equal(forgedSource, false); await writeFile(acceptedReceiptPath, originalReceipt); observations.push('canonical input and retained source hashes rejected arbitrary 64-hex lineage');

  let durableArtifacts = null;
  if (reportPath) {
    const evidenceRoot = join(resolve(reportPath, '..'), 'fixture-artifacts'); await mkdir(join(evidenceRoot, 'receipts'), { recursive: true }); await mkdir(join(evidenceRoot, 'sources'), { recursive: true }); await mkdir(join(evidenceRoot, 'outputs'), { recursive: true }); await mkdir(join(evidenceRoot, 'review-evidence'), { recursive: true });
    const durableReceipt = join(evidenceRoot, 'receipts', 'automatic-rifle.json'); const durableSource = join(evidenceRoot, 'sources', 'automatic_rifle.glb'); const durableArtifact = join(evidenceRoot, 'outputs', 'automatic_rifle.glb'); const durableJournal = join(evidenceRoot, 'accepted-journal.json');
    const rejectedReceipt = join(evidenceRoot, 'trench_smg.rejected.receipt.json'); const unknownReceipt = join(evidenceRoot, 'service_pistol.resumed.receipt.json'); const concurrentJournal = join(evidenceRoot, 'concurrent-journal.json');
    const unauthorizedReceipt = join(evidenceRoot, 'pump_shotgun.401.receipt.json'); const throttledReceipt = join(evidenceRoot, 'bolt_service_rifle.429.receipt.json'); const providerFailureReceipt = join(evidenceRoot, 'brick-rubble.provider-failure.receipt.json');
    const serverErrorDurable = join(evidenceRoot, 'observation-post.500-unknown.receipt.json'); const killedDurable = join(evidenceRoot, 'ammo-crate.kill-recovered.receipt.json'); const ownershipJournal = join(evidenceRoot, 'task-ownership-journal.json');
    const retryDurableReceipt = join(evidenceRoot, 'receipts', 'automatic-rifle.attempt-2.json'); const retryDurablePrior = join(evidenceRoot, 'attempts', 'automatic_rifle', 'attempt-1.json'); const retryDurableOutput = join(evidenceRoot, 'outputs', 'automatic_rifle.attempt-2.glb');
    await copyFile(acceptedReceiptPath, durableReceipt); await copyFile(artifact, durableSource); await copyFile(artifact, durableArtifact); await copyFile(join(happyRoot, 'journal.json'), durableJournal);
    await copyFile(join(rejectRoot, 'receipts', receiptName('trench_smg')), rejectedReceipt); await copyFile(join(timeoutRoot, 'receipts', receiptName('service_pistol')), unknownReceipt); await copyFile(join(concurrentRoot, 'journal.json'), concurrentJournal);
    await copyFile(join(fixtureRoot, '401', 'receipts', receiptName('pump_shotgun')), unauthorizedReceipt); await copyFile(join(fixtureRoot, '429', 'receipts', receiptName('bolt_service_rifle')), throttledReceipt);
    await copyFile(providerFailurePath, providerFailureReceipt);
    await copyFile(serverErrorPath, serverErrorDurable); await copyFile(join(killedRoot, 'receipts', receiptName('ammo-crate')), killedDurable); await copyFile(join(ownershipRoot, 'journal.json'), ownershipJournal);
    const durableEvidence = await Promise.all(reviewEvidence.map(async path => { const target = join(evidenceRoot, 'review-evidence', path.split(/[/\\]/).at(-1)); await copyFile(path, target); return target; }));
    const durablePrior = JSON.parse(await readFile(join(retryRoot, 'attempts', 'automatic_rifle', 'attempt-1.json'), 'utf8')); durablePrior.review.evidence.forEach((item, index) => { item.path = durableEvidence[index]; });
    await mkdir(resolve(retryDurablePrior, '..'), { recursive: true }); await writeFile(retryDurablePrior, `${JSON.stringify(durablePrior, null, 2)}\n`);
    const durableRetry = JSON.parse(await readFile(retryReceiptPath, 'utf8')); durableRetry.review.evidence.forEach((item, index) => { item.path = durableEvidence[index]; }); durableRetry.retry.priorReceiptPath = 'attempts/automatic_rifle/attempt-1.json'; durableRetry.retry.priorReceiptSha256 = createHash('sha256').update(await readFile(retryDurablePrior)).digest('hex');
    durableRetry.sourceArtifact.relativePath = 'sources/automatic_rifle.glb'; await copyFile(retryArtifact, join(evidenceRoot, durableRetry.sourceArtifact.relativePath)); await copyFile(retryArtifact, retryDurableOutput); await writeFile(retryDurableReceipt, `${JSON.stringify(durableRetry, null, 2)}\n`);
    const durableRetryAudit = await execute(process.execPath, ['scripts/audit-assets.mjs', '--config', configPath, '--receipt', retryDurableReceipt, '--artifact', retryDurableOutput], { cwd: appRoot, windowsHide: true }); assert.equal(JSON.parse(durableRetryAudit.stdout).state, 'audit_accepted');
    durableArtifacts = { receipt: durableReceipt, source: durableSource, artifact: durableArtifact, journal: durableJournal, retryReceipt: retryDurableReceipt, retryPriorReceipt: retryDurablePrior, retrySource: join(evidenceRoot, durableRetry.sourceArtifact.relativePath), retryArtifact: retryDurableOutput, retryReviewEvidence: durableEvidence, rejectedReceipt, resumedReceipt: unknownReceipt, concurrentJournal, unauthorizedReceipt, throttledReceipt, providerFailureReceipt, serverErrorReceipt: serverErrorDurable, killedRecoveryReceipt: killedDurable, ownershipJournal };
  }
  const report = { verdict: 'PASS', fixtureOnly: true, acceptedSubmissions, requestCount: requests.length, observations, durableArtifacts };
  if (reportPath) await writeFile(resolve(reportPath), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
} finally {
  await new Promise(resolveClose => server.close(resolveClose)); await new Promise(resolveClose => downloadServer.close(resolveClose));
  if (!process.env.MESHY_KEEP_FIXTURE) await rm(fixtureRoot, { recursive: true, force: true });
}
