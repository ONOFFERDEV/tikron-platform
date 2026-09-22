import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import {
  EXIT,
  VERDICT,
  buildReport,
  classifyCapabilities,
  loadScenarioManifest,
  resolveScenarioPlan,
  validateManifest,
  validateScenarioResult,
  validateSnapshotRef,
  validateStages,
  writeReport,
} from '../scripts/aside-common.mjs';
import { classifyLatencyTelemetry, classifyNetworkCapacity } from '../scripts/aside-scenarios/performance.mjs';
import { PersistentAsideRepl, ReplProtocolBuffer, normalizeReplCode, stripAnsi } from '../scripts/aside-repl.mjs';
import { pointerLockCapability } from '../scripts/aside-pointer-lock.mjs';
import { auditScenarioHandlers } from '../scripts/aside-qa.mjs';
import { aggregatePerfSnapshots, evaluateStatsCoverage } from '../tools/ironsight-load.mjs';
import * as performanceScenario from '../scripts/aside-scenarios/performance.mjs';

const canonicalManifest = new URL('../scripts/aside-scenarios/manifest.json', import.meta.url);

function scenario(id, compose = [], cases = ['normal']) {
  return {
    id,
    ownerTask: 6,
    module: 'apps/ironsight/scripts/aside-scenarios/performance.mjs',
    cases,
    compose,
    command: `node apps/ironsight/scripts/aside-qa.mjs --scenario ${id}`,
  };
}

function resultCase(id, verdict = VERDICT.PASS) {
  return { id, verdict, reasons: verdict === VERDICT.PASS ? [] : [{ code: 'expected_failure' }], observations: {}, artifacts: [] };
}

test('canonical registry contains the exact 31 scenarios and four aliases', async () => {
  const manifest = await loadScenarioManifest(canonicalManifest);
  assert.equal(manifest.scenarios.length, 31);
  assert.deepEqual(Object.keys(manifest.aliases).sort(), [
    'map-infantry',
    'perf-render-budget',
    'perf-target-device',
    'ui-01-primitives',
  ]);
  assert.equal(resolveScenarioPlan(manifest, 'perf-target-device').at(-1).id, 'perf-target');
});

test('registry rejects duplicate ids, empty cases, missing dependencies, and cycles', () => {
  assert.throws(
    () => validateManifest({ schemaVersion: 1, aliases: {}, scenarios: [scenario('a'), scenario('a')] }),
    /duplicate scenario id: a/,
  );
  assert.throws(
    () => validateManifest({ schemaVersion: 1, aliases: {}, scenarios: [scenario('a', [], [])] }),
    /scenario a has no cases/,
  );
  assert.throws(
    () => validateManifest({ schemaVersion: 1, aliases: {}, scenarios: [scenario('a', ['missing'])] }),
    /scenario a composes unknown scenario: missing/,
  );
  assert.throws(
    () => validateManifest({ schemaVersion: 1, aliases: {}, scenarios: [scenario('a', ['b']), scenario('b', ['a'])] }),
    /scenario composition cycle: a -> b -> a/,
  );
});

test('scenario planning expands dependencies once and rejects unknown aliases', () => {
  const manifest = validateManifest({
    schemaVersion: 1,
    aliases: { all: 'c' },
    scenarios: [scenario('a'), scenario('b', ['a']), scenario('c', ['a', 'b'])],
  });
  assert.deepEqual(resolveScenarioPlan(manifest, 'all').map(item => item.id), ['a', 'b', 'c']);
  assert.throws(() => resolveScenarioPlan(manifest, 'absent'), /unknown scenario: absent/);
});

test('field results require exact case coverage and valid verdicts', () => {
  const definition = scenario('a', [], ['normal', 'failure']);
  assert.throws(
    () => validateScenarioResult(definition, { cases: [resultCase('normal')] }),
    /scenario a missing cases: failure/,
  );
  assert.throws(
    () => validateScenarioResult(definition, { cases: [resultCase('normal'), resultCase('extra')] }),
    /scenario a returned unknown case: extra/,
  );
  assert.throws(
    () => validateScenarioResult(definition, { cases: [{ ...resultCase('normal'), verdict: 'SKIP' }, resultCase('failure')] }),
    /scenario a case normal has invalid verdict: SKIP/,
  );
  assert.throws(
    () => validateScenarioResult(definition, { cases: [{ id: 'normal', verdict: VERDICT.PASS }, resultCase('failure')] }),
    /scenario a case normal has invalid reasons/,
  );
  assert.throws(
    () => validateScenarioResult(definition, { cases: [{ ...resultCase('normal'), observations: 'looks fine' }, resultCase('failure')] }),
    /scenario a case normal has invalid observations/,
  );
  assert.throws(
    () => validateScenarioResult(definition, { cases: [{ ...resultCase('normal'), artifacts: ['screenshot.png'] }, resultCase('failure')] }),
    /scenario a case normal has an invalid artifact/,
  );
});

test('capability gaps are UNQUALIFIED with a nonzero exit and stable reason codes', () => {
  const result = classifyCapabilities({
    pointerLock: { supported: true, acquired: false, error: 'WrongDocumentError' },
    viewport: { requested: [1920, 1080], css: [1440, 900], drawingBuffer: [1440, 900] },
    capture: { annotatedScreenshot: true, rawScreenshot: false },
    session: { persistent: true, alive: true },
  });
  assert.equal(result.verdict, VERDICT.UNQUALIFIED);
  assert.equal(result.exitCode, EXIT.UNQUALIFIED);
  assert.deepEqual(result.reasons.map(reason => reason.code), [
    'pointer_lock_unavailable',
    'viewport_mismatch',
    'drawing_buffer_mismatch',
  ]);
});

test('ended sessions, stale snapshot refs, and unsupported capture stay explicit', () => {
  const stale = validateSnapshotRef({ generation: 3, currentGeneration: 4, sessionAlive: false });
  assert.equal(stale.verdict, VERDICT.FAIL);
  assert.deepEqual(stale.issues.map(issue => issue.code), ['session_ended', 'stale_snapshot_ref']);

  const unsupported = classifyCapabilities({
    pointerLock: { supported: true, acquired: true },
    viewport: { requested: [1440, 900], css: [1440, 900], drawingBuffer: [1440, 900] },
    capture: { annotatedScreenshot: false, rawScreenshot: false },
    session: { persistent: true, alive: true },
  });
  assert.equal(unsupported.verdict, VERDICT.UNQUALIFIED);
  assert.deepEqual(unsupported.reasons.map(reason => reason.code), ['capture_unavailable']);
});

test('missing, stale, and clock-reversed telemetry stages fail explicitly', () => {
  assert.deepEqual(
    validateStages(['input', 'handler', 'paint'], [
      { name: 'input', at: 100 },
      { name: 'paint', at: 110 },
    ], { now: 110 }).issues.map(issue => issue.code),
    ['missing_stage'],
  );
  assert.deepEqual(
    validateStages(['input', 'handler'], [
      { name: 'input', at: 200, observedAt: 2_000 },
      { name: 'handler', at: 190, observedAt: 2_001 },
    ], { now: 2_001, staleAfterMs: 1_000 }).issues.map(issue => issue.code),
    ['stale_stage', 'clock_reversed'],
  );
});

test('report aggregation never converts failure or unqualified cases to PASS', async () => {
  const failed = buildReport({ scenario: 'perf-input', cases: [
    { id: 'session', verdict: VERDICT.PASS },
    { id: 'pointer-lock', verdict: VERDICT.UNQUALIFIED, reasons: [{ code: 'pointer_lock_unavailable' }] },
    { id: 'receipt', verdict: VERDICT.FAIL, reasons: [{ code: 'missing_stage' }] },
  ] });
  assert.equal(failed.verdict, VERDICT.FAIL);
  assert.equal(failed.exitCode, EXIT.FAIL);

  const unqualified = buildReport({ scenario: 'perf-input', cases: [
    { id: 'session', verdict: VERDICT.PASS },
    { id: 'pointer-lock', verdict: VERDICT.UNQUALIFIED, reasons: [{ code: 'pointer_lock_unavailable' }] },
  ] });
  assert.equal(unqualified.verdict, VERDICT.UNQUALIFIED);
  assert.equal(unqualified.exitCode, EXIT.UNQUALIFIED);

  const directory = await mkdtemp(path.join(tmpdir(), 'aside-report-'));
  try {
    const reportPath = path.join(directory, 'report.json');
    await writeReport(reportPath, unqualified);
    assert.deepEqual(JSON.parse(await readFile(reportPath, 'utf8')), unqualified);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('persistent REPL framing handles ANSI, split prompts, and terminal errors', () => {
  assert.equal(stripAnsi('\u001b[32mrepl \u001b[33m>\u001b[0m'), 'repl >');
  assert.equal(normalizeReplCode('const value = 1;\nconsole.log(value)'), 'const value = 1; console.log(value)');
  const protocol = new ReplProtocolBuffer();
  assert.equal(protocol.push('value\n\u001b[2m[ok | 5ms]\u001b[0m\nre'), null);
  assert.equal(protocol.push('pl > '), 'value\n[ok | 5ms]');
  assert.equal(protocol.push('Error: boom\n[error | 2ms]\nrepl > '), 'Error: boom\n[error | 2ms]');
  assert.equal(protocol.hasError('Error: boom\n[error | 2ms]'), true);
});

test('a timed-out REPL is poisoned before a late frame can satisfy the next command', async () => {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.exitCode = null;
  child.stdin = {
    write(value) {
      if (value.includes('slow-command')) {
        setTimeout(() => child.stdout.emit('data', 'slow-result\n[ok | 25ms]\nrepl > '), 25);
      }
    },
  };
  child.kill = () => { child.exitCode = 1; child.emit('exit', 1, 'SIGTERM'); };

  const repl = new PersistentAsideRepl({ executable: 'fake-aside', timeoutMs: 5, spawnProcess: () => child });
  queueMicrotask(() => child.stdout.emit('data', 'sessionDir: C:/tmp/fake-aside\nrepl > '));
  await repl.start();
  await assert.rejects(repl.run('slow-command'), /timed out after 5ms/);
  assert.equal(repl.isUsable(), false);
  await assert.rejects(repl.run('next-command'), /poisoned after timeout/);
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(repl.transcript.length, 0);
  await repl.close();
});

test('replJson preserves an Aside command error that occurs before its response marker', async () => {
  const repl = {
    run: async () => 'Error: Selector ".deploy" not found\n[error | 21ms]',
  };
  await assert.rejects(
    performanceScenario.replJson(repl, 'return true', { allowError: true }),
    /command failed before response marker:[\s\S]*Selector "\.deploy" not found/,
  );
});

test('writeReport uses atomic replacement and leaves parseable JSON', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'aside-atomic-'));
  try {
    const reportPath = path.join(directory, 'nested', 'report.json');
    const report = buildReport({ scenario: 'perf-input', cases: [{ id: 'session', verdict: VERDICT.PASS }] });
    await writeReport(reportPath, report);
    await writeFile(`${reportPath}.tmp-orphan`, 'orphan');
    assert.equal(JSON.parse(await readFile(reportPath, 'utf8')).verdict, VERDICT.PASS);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function replFrame(code, payload) {
  const marker = /console\.log\('([^']+)'\+JSON\.stringify/.exec(code)?.[1];
  assert.ok(marker);
  return `${marker}${JSON.stringify(payload)}\n[ok | 1ms]`;
}

test('Fetch recovery retries once and records the causal browser-wide disable', async () => {
  let calls = 0;
  const repl = {
    run: async code => {
      calls += 1;
      if (calls === 1) throw new Error('transient transport loss');
      return replFrame(code, { supported: true, disabled: true });
    },
  };

  const receipt = await performanceScenario.recoverStaleFetchInterception(repl, { attemptLimit: 2 });

  assert.equal(receipt.disabled, true);
  assert.equal(receipt.attempts, 2);
  assert.equal(receipt.errors.length, 1);
});

test('Fetch recovery returns an explicit failure when the persistent session is dead', async () => {
  const repl = { run: async () => { throw new Error('Aside REPL session is not alive'); } };

  const receipt = await performanceScenario.recoverStaleFetchInterception(repl, { attemptLimit: 2 });

  assert.equal(receipt.disabled, false);
  assert.equal(receipt.attempts, 2);
  assert.equal(receipt.errors.length, 2);
});

test('owned tab cleanup disables Fetch before closing the target', async () => {
  let command = '';
  const repl = {
    run: async code => {
      command = code;
      return replFrame(code, { fetchDisabled: true, ownedUrl: 'about:blank', metricsCleared: false, tabs: [] });
    },
  };

  const receipt = await performanceScenario.closeOwnedTab(repl);

  assert.equal(receipt.fetchDisabled, true);
  assert.ok(command.indexOf("Fetch.disable") < command.indexOf('closeTab(page)'));
});

test('readiness classification exposes compositor progress and elapsed timeout', () => {
  assert.equal(performanceScenario.READINESS_TIMEOUT_MS >= 90_000, true);
  assert.equal(performanceScenario.classifyReadinessStage({ canvas: true, inert: true, marks: { uiStart: true, uiEnd: false, playReady: false } }), 'compositor');
  assert.equal(performanceScenario.classifyReadinessStage({ canvas: true, inert: false, marks: { uiStart: true, uiEnd: true, playReady: true } }), 'play-ready');
  assert.equal(performanceScenario.classifyReadinessStage({ canvas: false, inert: null, marks: { uiStart: false, uiEnd: false, playReady: false } }), 'network-or-scene');
});

test('latency scenario never promotes synthetic or incomplete traces to actual PASS', () => {
  const definition = { cases: ['actual gesture trace stages', 'stale/missing stages', 'mixed clocks', 'late confirmation'] };
  const cases = classifyLatencyTelemetry(definition, {
    metrics: { actual: { validShots: 0 }, synthetic: { validShots: 100 } },
    hud: { status: 'unavailable' },
    counts: { stale: 0, invalid: 0, ignoredConfirmation: 0 },
    clockPairs: { crossClockSubtraction: false },
  });
  assert.equal(cases[0].verdict, VERDICT.UNQUALIFIED);
  assert.equal(cases[1].verdict, VERDICT.UNQUALIFIED);
  assert.equal(cases[2].verdict, VERDICT.PASS);
  assert.equal(cases[3].verdict, VERDICT.UNQUALIFIED);
});

test('latency scenario does not promote a synthetic late confirmation injection', () => {
  const definition = { cases: ['actual gesture trace stages', 'stale/missing stages', 'mixed clocks', 'late confirmation'] };
  const cases = classifyLatencyTelemetry(definition, {
    metrics: { actual: { validShots: 0 } }, hud: { status: 'unavailable' },
    counts: { stale: 1, invalid: 1, ignoredConfirmation: 1 },
    rejectedConfirmations: { actual: 0, synthetic: 1, unknown: 0 },
    clockPairs: { crossClockSubtraction: false },
  });
  assert.equal(cases[3].verdict, VERDICT.UNQUALIFIED);
});

test('latency scenario requires every measured shot pair and trusted ADS coverage', () => {
  const definition = { cases: ['actual gesture trace stages', 'stale/missing stages', 'mixed clocks', 'late confirmation'] };
  const metric = count => ({ count, p50: 1, p95: 1, p99: 1 });
  const cases = classifyLatencyTelemetry(definition, {
    metrics: { actual: { validShots: 100, validAdsTransitions: 0,
      predictedMs: metric(100), rttMs: metric(100), serverResolveMs: metric(0),
      audioScheduleMs: metric(0), confirmationMs: metric(0) } },
    hud: { status: 'ready' }, counts: {}, clockPairs: { crossClockSubtraction: false },
  });
  assert.equal(cases[0].verdict, VERDICT.UNQUALIFIED);
  assert.deepEqual(cases[0].reasons.map(({ code }) => code),
    ['insufficient_ads_samples', 'missing_stage_samples']);
});

const CAPACITY_HASH = 'a'.repeat(64);
const CAPACITY_SOURCE_VERIFICATION = { stageRoot: 'D:/sealed-capacity-stage', fileCount: 3, mismatches: [] };
const capacityLog = clients => {
  const before = Buffer.from('[wrangler:info] Ready on http://127.0.0.1:8896\n[wrangler:info] GET /api/health 200 OK\n');
  const during = Buffer.from(Array.from({ length: clients }, () => '[wrangler:info] GET /api/matchmake 200 OK\n[wrangler:info] GET /parties/arena-room/x 101 Switching Protocols').join('\n'));
  return { before, during, all: Buffer.concat([before, during]) };
};
const capacityRun = (scenario, finishedAt = Date.now()) => {
  const clients = scenario === 'room-cap' ? 13 : 12;
  const seconds = { normal: 180, impairment: 20, 'room-cap': 5, disconnect: 8, expiry: 34 }[scenario];
  const startedAt = finishedAt - seconds * 1000;
  const socket = index => ({ index, connectionKind: 'initial', session: `session-${index}`,
    openedAt: 0, joinedAt: 1, closedAt: seconds * 1000, closeCode: 1000, finalBufferedBytes: 0,
    sent: { move: 1, fire: 1, reload: 1, objective: 1, stats: 1, time: 1 },
    stateFrames: { received: 2, applied: 2, dropped: 0, reordered: 0 }, errors: [], peerLeftAt: [], perfSnapshots: [] });
  const perSocket = Array.from({ length: clients }, (_, index) => socket(index));
  if (scenario === 'room-cap') Object.assign(perSocket[12], { joinedAt: null, closeCode: 4002, errors: ['room_full'] });
  if (scenario === 'impairment') Object.assign(perSocket[0].stateFrames, { dropped: 1, reordered: 1 });
  if (scenario === 'disconnect') {
    perSocket[0].closedAt = 1000;
    Object.assign(perSocket[0], { closeRequestedAtMonotonicMs: 501_000, transportUnusableAtMonotonicMs: 501_000,
      closedAtMonotonicMs: 501_000, closeReadyState: 2 });
    perSocket.push({ ...socket(12), connectionKind: 'reconnect', session: 'session-0', openedAt: 4000, joinedAt: 4100,
      connectRequestedAtMonotonicMs: 504_000, openedAtMonotonicMs: 504_000, joinedAtMonotonicMs: 504_100 });
  }
  if (scenario === 'expiry') perSocket[1].peerLeftAt = [32_000];
  const drops = { rateLimited: 0, staleSeq: 0, oversizedBatch: 0, unknownType: 0,
    relayRateLimited: 0, relayOversized: 0, relayBadTarget: 0 };
  const windowMs = Math.min(10_000, seconds * 1000);
  const snapshots = Array.from({ length: Math.ceil(seconds * 1000 / windowMs) }, (_, index) => {
    const elapsed = Math.min((index + 1) * windowMs, seconds * 1000);
    const samples = Math.round(windowMs / 50);
    return { tick: { p50: 1, p95: 2, p99: 2.5, max: 3, n: samples },
      flush: { p50: 1, p95: 2, p99: 2.5, max: 3, n: samples }, windowMs, measuredAtMs: 500_000 + elapsed,
      measuredAtEpochMs: startedAt + elapsed, receivedAtMs: startedAt + elapsed + 1, requestSeq: index + 1,
      requestedAtMs: startedAt + elapsed, requestedAtMonotonicMs: 500_000 + elapsed,
      receivedAtMonotonicMs: 500_000 + elapsed, drops, errors: 0 };
  });
  perSocket[0].perfSnapshots = snapshots; perSocket[0].perf = snapshots.at(-1);
  const stats = aggregatePerfSnapshots(perSocket);
  const measurement = { startedAtMonotonicMs: 500_000, finishedAtMonotonicMs: 500_000 + seconds * 1000,
    startedAtEpochMs: startedAt, finishedAtEpochMs: finishedAt, intervalMs: 50, scheduledTicks: seconds * 20,
    executedTicks: seconds * 20, skippedTicks: 0, maxLatenessMs: 1, observedActiveMs: seconds * 1000,
    overrunMs: 0, effectiveHz: 20 };
  const statsCoverage = evaluateStatsCoverage(stats, measurement);
  const runId = `run-${scenario}-1234567890`, log = capacityLog(clients);
  return { schemaVersion: 2, runKind: 'live', scenario, requestedClients: clients,
    actualSockets: perSocket.length, peakConcurrentSockets: scenario === 'room-cap' ? 13 : 12,
    joined: perSocket.filter(record => record.joinedAt !== null).length, closed: perSocket.length,
    durationMs: seconds * 1000, target: { origin: 'http://127.0.0.1:8896', loopback: true, sharedDeployment: false },
    measurement, impairment: { lossRate: scenario === 'impairment' ? .1 : 0, reorderRate: scenario === 'impairment' ? .1 : 0 }, perSocket,
    aggregate: { server: stats, statsCoverage, serverDrops: 0, serverErrors: 0,
      clientErrors: perSocket.reduce((sum, record) => sum + record.errors.length, 0) },
    source: { manifestSha256: CAPACITY_HASH, stageRoot: CAPACITY_SOURCE_VERIFICATION.stageRoot,
      fileCount: CAPACITY_SOURCE_VERIFICATION.fileCount,
      preflight: { ...CAPACITY_SOURCE_VERIFICATION, verifiedAt: new Date(startedAt).toISOString() },
      postflight: { ...CAPACITY_SOURCE_VERIFICATION, verifiedAt: new Date(finishedAt).toISOString() } },
    runIdentity: { runId, evidenceKind: 'actual-loopback-websocket', startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date(finishedAt).toISOString(), origin: 'http://127.0.0.1:8896', requestedDurationSeconds: seconds,
      sourceManifestSha256: CAPACITY_HASH, sourceHead: 'b'.repeat(40) },
    serverRuntime: { available: true, runId, origin: 'http://127.0.0.1:8896', sourceManifestSha256: CAPACITY_HASH,
      logArtifact: `capacity-${scenario}.server.log`, logArtifactSha256: createHash('sha256').update(log.all).digest('hex'),
      capturedSha256: createHash('sha256').update(log.during).digest('hex'), captureStartByte: log.before.length,
      captureEndByte: log.all.length, capturedBytes: log.during.length,
      startupReady: true, healthReady: true, matchmakeRequests: clients, websocketUpgrades: clients,
      simulationBacklogWarnings: 0 } };
};

test('network scenario rejects check-only JSON at the report trust boundary', () => {
  const definition = { cases: ['12 sockets plus actual Aside client', 'seeded impairments', '13th reject', 'three-second disconnect'] };
  const live = checks => ({ runKind: 'live', checks });
  const common = { durationQualified: true, noSimulationBacklog: true, twelveConcurrent: true, traffic: true, stats: true };
  const cases = classifyNetworkCapacity(definition, {
    normal: live({ ...common, noServerDrops: true, noClientErrors: true, noBacklog: true }),
    impairment: live({ ...common, seededDropsObserved: true, seededReorderObserved: true }),
    roomCap: live({ ...common, thirteenthRejected: true }),
    disconnect: live({ ...common, disconnectedForThreeSeconds: true, reconnectedSameSession: true }),
    expiry: live({ durationQualified: true, noSimulationBacklog: true, seatExpired: true, noReconnectAttempt: true }),
  });
  assert.deepEqual(cases.map(item => item.verdict), [VERDICT.UNQUALIFIED, VERDICT.UNQUALIFIED,
    VERDICT.UNQUALIFIED, VERDICT.UNQUALIFIED]);
  const absentExpiry = classifyNetworkCapacity(definition, {
    disconnect: live({ ...common, disconnectedForThreeSeconds: true, reconnectedSameSession: true }),
  });
  assert.equal(absentExpiry[3].verdict, VERDICT.UNQUALIFIED);
});

test('network scenario recomputes valid raw runs and rejects stale or source-mismatched evidence', () => {
  const definition = { cases: ['normal', 'impairment', 'cap', 'reconnect'] }, now = Date.now();
  const runs = { normal: capacityRun('normal', now), impairment: capacityRun('impairment', now),
    roomCap: capacityRun('room-cap', now), disconnect: capacityRun('disconnect', now), expiry: capacityRun('expiry', now) };
  const logArtifacts = Object.fromEntries(['normal', 'impairment', 'room-cap', 'disconnect', 'expiry']
    .map(scenario => [scenario, capacityLog(scenario === 'room-cap' ? 13 : 12).all]));
  const evidence = { sourceManifestSha256: CAPACITY_HASH, sourceManifestVerification: CAPACITY_SOURCE_VERIFICATION,
    now, logArtifacts };
  assert.deepEqual(classifyNetworkCapacity(definition, runs, evidence)
    .map(item => item.verdict), [VERDICT.PASS, VERDICT.PASS, VERDICT.PASS, VERDICT.PASS]);
  const stale = { ...runs, normal: capacityRun('normal', now - 25 * 60 * 60 * 1000) };
  assert.equal(classifyNetworkCapacity(definition, stale, evidence)[0].verdict, VERDICT.UNQUALIFIED);
  assert.equal(classifyNetworkCapacity(definition, runs, { ...evidence, sourceManifestSha256: 'd'.repeat(64) })[0].verdict, VERDICT.UNQUALIFIED);
  const tamperedLogs = { ...logArtifacts, normal: Buffer.from('unrelated') };
  assert.equal(classifyNetworkCapacity(definition, runs, { ...evidence, logArtifacts: tamperedLogs })[0].verdict, VERDICT.UNQUALIFIED);
  const missingStats = structuredClone(runs); delete missingStats.normal.aggregate.server.tick;
  assert.equal(classifyNetworkCapacity(definition, missingStats, evidence)[0].verdict, VERDICT.UNQUALIFIED);
  const malformedStats = structuredClone(runs); malformedStats.normal.aggregate.server.errors = -1;
  assert.equal(classifyNetworkCapacity(definition, malformedStats, evidence)[0].verdict, VERDICT.UNQUALIFIED);
  const forgedAggregate = structuredClone(runs);
  Object.assign(forgedAggregate.normal.perSocket[0].perfSnapshots[0], {
    tick: { ...forgedAggregate.normal.perSocket[0].perfSnapshots[0].tick, p99: 99 },
    drops: { ...forgedAggregate.normal.perSocket[0].perfSnapshots[0].drops, unknownType: 1 }, errors: 1,
  });
  assert.equal(classifyNetworkCapacity(definition, forgedAggregate, evidence)[0].verdict, VERDICT.UNQUALIFIED);
  const singleEarlyWindow = structuredClone(runs);
  singleEarlyWindow.normal.perSocket[0].perfSnapshots = singleEarlyWindow.normal.perSocket[0].perfSnapshots.slice(0, 1);
  singleEarlyWindow.normal.perSocket[0].perf = singleEarlyWindow.normal.perSocket[0].perfSnapshots[0];
  singleEarlyWindow.normal.aggregate.server = aggregatePerfSnapshots(singleEarlyWindow.normal.perSocket);
  singleEarlyWindow.normal.aggregate.statsCoverage = evaluateStatsCoverage(
    singleEarlyWindow.normal.aggregate.server, singleEarlyWindow.normal.measurement,
  );
  assert.equal(classifyNetworkCapacity(definition, singleEarlyWindow, evidence)[0].verdict, VERDICT.FAIL);
  const mismatchedClockSpan = structuredClone(runs);
  mismatchedClockSpan.normal.measurement.finishedAtEpochMs = mismatchedClockSpan.normal.measurement.startedAtEpochMs + 10_000;
  mismatchedClockSpan.normal.aggregate.statsCoverage = evaluateStatsCoverage(
    mismatchedClockSpan.normal.aggregate.server, mismatchedClockSpan.normal.measurement,
  );
  assert.equal(classifyNetworkCapacity(definition, mismatchedClockSpan, evidence)[0].verdict, VERDICT.FAIL);
  const slowServerTick = structuredClone(runs);
  for (const snapshot of slowServerTick.normal.perSocket[0].perfSnapshots) snapshot.tick.n = 20;
  slowServerTick.normal.aggregate.server = aggregatePerfSnapshots(slowServerTick.normal.perSocket);
  slowServerTick.normal.aggregate.statsCoverage = evaluateStatsCoverage(
    slowServerTick.normal.aggregate.server, slowServerTick.normal.measurement,
  );
  assert.equal(classifyNetworkCapacity(definition, slowServerTick, evidence)[0].verdict, VERDICT.FAIL);
  assert.equal(classifyNetworkCapacity(definition, runs, { ...evidence, sourceManifestVerification: null })[0].verdict,
    VERDICT.UNQUALIFIED);
});

test('pointer-lock reporting preserves the native rejection from a trusted connected-canvas request', () => {
  const result = pointerLockCapability(
    { pointerLockSupported: true },
    {
      locked: false,
      request: {
        event: { kind: 'click', trusted: true, userActive: true },
        isConnected: true,
        ownerIsDocument: true,
        rejected: 'WrongDocumentError:The root document of this element is not valid for pointer lock.',
      },
    },
  );
  assert.deepEqual(result, {
    supported: true,
    acquired: false,
    attempted: true,
    trusted: true,
    error: 'WrongDocumentError:The root document of this element is not valid for pointer lock.',
  });
});

test('pointer-lock reporting does not claim an unobserved request', () => {
  assert.deepEqual(pointerLockCapability({ pointerLockSupported: true }, null), {
    supported: true,
    acquired: false,
    attempted: false,
    trusted: false,
    error: 'pointer_lock_request_not_observed',
  });
});

test('pointer-lock reporting accepts an acquired native lock without a failure reason', () => {
  assert.deepEqual(pointerLockCapability(
    { pointerLockSupported: true },
    { locked: true, request: { event: { trusted: true }, resolved: true } },
  ), {
    supported: true,
    acquired: true,
    attempted: true,
    trusted: true,
    error: null,
  });
});

test('handler audit names every manifest scenario whose module is missing or fails to load', async () => {
  const manifest = { scenarios: [
    { id: 'ready', module: 'ready.mjs' },
    { id: 'missing', module: 'missing.mjs' },
    { id: 'broken', module: 'broken.mjs' },
  ] };
  const report = await auditScenarioHandlers(manifest, async (definition) => {
    if (definition.id === 'ready') return () => {};
    if (definition.id === 'broken') throw new TypeError('bad import');
    return null;
  });
  assert.equal(report.verdict, VERDICT.FAIL);
  assert.equal(report.exitCode, EXIT.FAIL);
  assert.equal(report.implemented, 1);
  assert.deepEqual(report.missing, [
    { id: 'missing', module: 'missing.mjs', code: 'handler_missing' },
    { id: 'broken', module: 'broken.mjs', code: 'module_load_failed', detail: 'TypeError:bad import' },
  ]);
});

async function asideLeaseFixture(mode, output, runnerUrl) {
  const { mock } = await import('node:test');
  const { fileURLToPath } = await import('node:url');
  const { readFile, mkdir } = await import('node:fs/promises');
  const events = [];
  let held = false;
  const browserActivity = name => events.push({ name, held });
  const timestamp = Date.now();
  Date.now = () => timestamp;
  const relative = name => new URL(name, runnerUrl).href;
  mock.module(relative('./inspection-lease.mjs'), { namedExports: {
    acquireInspectionLease: async label => {
      events.push({ name: 'acquire', label });
      if (mode === 'acquire-error') throw new Error('lease unavailable');
      if (mode === 'contention') await new Promise(resolve => setImmediate(() => {
        events.push({ name: 'pending-acquisition', browserActivities: events.filter(item => 'held' in item).length });
        resolve();
      }));
      held = true;
      events.push({ name: 'acquired' });
      return { release: async () => {
        events.push({ name: 'release' });
        held = false;
        if (mode === 'release-error') throw new Error('lease release failed');
      } };
    },
  } });
  mock.module('node:child_process', { namedExports: {
    spawnSync: () => { browserActivity('version'); return { status: 0, stdout: 'aside-fixture' }; },
  } });
  mock.module(relative('./aside-source.mjs'), { namedExports: { sourceIdentity: async () => ({ fixture: true }) } });
  mock.module(relative('./aside-repl.mjs'), { namedExports: {
    discoverAsideExecutable: async () => {
      browserActivity('discover');
      if (mode === 'discovery-error') throw new Error('discovery failed');
      return 'aside-fixture';
    },
    PersistentAsideRepl: class {
      sessionDir = output;
      transcript = [{ command: 'fixture' }];
      isUsable() { return true; }
      async start() {
        browserActivity('start');
        if (mode === 'startup-error') throw new Error('startup failed');
        return { sessionDir: output };
      }
      async close() {
        browserActivity('close-start');
        await new Promise(resolve => setImmediate(resolve));
        browserActivity('close-end');
        if (mode === 'close-error') throw new Error('close failed');
      }
    },
  } });
  mock.module(relative(`./aside-scenarios/performance.mjs?qa=${timestamp}`), { namedExports: {
    scenarioHandlers: { 'perf-input': async ({ definition, recordCleanup }) => {
      browserActivity('scenario');
      try {
        if (mode === 'scenario-error') throw new Error('scenario failed');
        return { cases: definition.cases.map(id => ({ id, verdict: 'PASS', reasons: [], observations: {}, artifacts: [] })), inputProvenance: 'fixture' };
      } finally {
        await new Promise(resolve => setImmediate(resolve));
        browserActivity('tab-cleanup');
        recordCleanup({ action: 'fixture-tab-close' });
      }
    } },
  } });
  if (mode === 'audit') {
    process.argv = [process.execPath, fileURLToPath(runnerUrl), '--audit-handlers', '--output', `${output}/audit.json`];
    await import(runnerUrl);
    const report = JSON.parse(await readFile(`${output}/audit.json`, 'utf8'));
    console.log(JSON.stringify({ events, report, held }));
    process.exitCode = 0;
    return;
  }
  if (mode === 'report-error') await mkdir(`${output}/report.json`);
  const { run } = await import(runnerUrl);
  let report = null;
  let error = null;
  try {
    report = await run({ output, scenario: 'perf-input', url: 'http://127.0.0.1:8896/', viewport: { width: 1280, height: 720 } });
  } catch (caught) { error = caught.message; }
  const persisted = report ? JSON.parse(await readFile(`${output}/report.json`, 'utf8')) : null;
  console.log(JSON.stringify({ events, held, report, persisted, error }));
}

async function runAsideLeaseFixture(mode) {
  const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
  const tempRoot = path.join(repoRoot, 'apps', 'ironsight', '.inspect');
  await mkdir(tempRoot, { recursive: true });
  const directory = await mkdtemp(path.join(tempRoot, 'aside-lease-test-'));
  try {
    const runnerUrl = new URL('../scripts/aside-qa.mjs', import.meta.url).href;
    const script = `(${asideLeaseFixture.toString()})(${JSON.stringify(mode)},${JSON.stringify(directory)},${JSON.stringify(runnerUrl)})`;
    const { stdout } = await promisify(execFile)(process.execPath, ['--experimental-test-module-mocks', '--input-type=module', '-e', script], {
      cwd: repoRoot, timeout: 15_000, maxBuffer: 1024 * 1024,
    });
    return JSON.parse(stdout.trim().split('\n').at(-1));
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tempRoot));
    await rm(directory, { recursive: true, force: true });
  }
}

test('Aside runner waits for its inspection lease and retains it through tab and REPL cleanup', async () => {
  const result = await runAsideLeaseFixture('contention');
  assert.deepEqual(result.events.map(item => item.name), [
    'acquire', 'pending-acquisition', 'acquired', 'discover', 'version', 'start', 'scenario', 'tab-cleanup', 'close-start', 'close-end', 'release',
  ]);
  assert.equal(result.events.find(item => item.name === 'pending-acquisition').browserActivities, 0);
  assert.ok(result.events.filter(item => 'held' in item).every(item => item.held));
  assert.equal(result.held, false);
  assert.equal(result.error, null);
  assert.equal(result.report.verdict, VERDICT.PASS);
  assert.equal(result.report.exitCode, EXIT.PASS);
  assert.deepEqual(result.persisted, result.report);
  assert.deepEqual(result.report.cleanup, [{ scenario: 'perf-input', action: 'fixture-tab-close' }]);
  assert.equal(result.report.cases.length, 4);
});

test('Aside runner refuses browser activity when inspection lease acquisition fails', async () => {
  const result = await runAsideLeaseFixture('acquire-error');
  assert.equal(result.error, 'lease unavailable');
  assert.deepEqual(result.events.map(item => item.name), ['acquire']);
  assert.equal(result.report, null);
  assert.equal(result.held, false);
});

for (const mode of ['discovery-error', 'startup-error', 'scenario-error', 'close-error', 'report-error', 'release-error']) {
  test(`Aside runner releases its inspection lease on ${mode}`, async () => {
    const result = await runAsideLeaseFixture(mode);
    assert.equal(result.events.at(-1).name, 'release');
    assert.equal(result.events.filter(item => item.name === 'release').length, 1);
    assert.ok(result.events.filter(item => 'held' in item).every(item => item.held));
    assert.equal(result.held, false);
    if (mode === 'startup-error' || mode === 'scenario-error') {
      assert.equal(result.report.verdict, VERDICT.FAIL);
      assert.equal(result.report.exitCode, EXIT.FAIL);
      assert.deepEqual(result.persisted, result.report);
      assert.ok(result.report.cases.every(item => item.reasons[0].code === 'scenario_execution_error'));
      assert.equal(result.error, null);
    } else {
      assert.equal(result.report, null);
      assert.ok(result.error);
    }
    if (!['discovery-error'].includes(mode)) {
      const closeIndex = result.events.findIndex(item => item.name === 'close-end');
      assert.ok(closeIndex >= 0);
      assert.ok(closeIndex < result.events.findIndex(item => item.name === 'release'));
    }
  });
}

test('Aside handler audit CLI does not acquire an inspection lease or touch the browser', async () => {
  const result = await runAsideLeaseFixture('audit');
  assert.deepEqual(result.events, []);
  assert.equal(result.held, false);
  assert.equal(result.report.total, 31);
  assert.equal(result.report.schemaVersion, 1);
});
