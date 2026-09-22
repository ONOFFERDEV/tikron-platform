import { describe, expect, it } from 'vitest';
import { classifyServerLog, createStateImpairment, LoadOptionError, parseLoadOptions, readPerfSnapshot } from '../tools/ironsight-load-options.mjs';
import {
  aggregatePerfSnapshots,
  closeOwnedConnections,
  evaluateStatsCoverage,
  evaluateServerQualification,
  hasNoResidualBacklog,
  readFixtureClient,
  runAbsoluteCadence,
  scenarioChecks,
  verifyManifestFiles,
  verifySourceManifestFile,
} from '../tools/ironsight-load.mjs';

describe('ironsight load tool boundaries', () => {
  it('parses a finite loopback-only capacity run', () => {
    const options = parseLoadOptions(['--url', 'http://127.0.0.1:8896/path', '--clients', '12', '--seconds', '180', '--out', 'report.json', '--server-log', 'server.log', '--source-manifest', 'source.json', '--seed', '17', '--latency-ms', '40', '--jitter-ms', '5', '--state-loss-rate', '.01', '--state-reorder-rate', '.02']);
    expect(options).toMatchObject({ url: 'http://127.0.0.1:8896', clients: 12, seconds: 180, serverLog: 'server.log', sourceManifest: 'source.json', seed: 17, latencyMs: 40, jitterMs: 5, stateLossRate: .01, stateReorderRate: .02, scenario: 'normal' });
  });

  it.each([
    ['remote target', ['--url', 'https://example.com', '--out', 'x.json'], 'loopback_required'],
    ['nonfinite clients', ['--url', 'http://localhost:8896', '--clients', 'Infinity', '--out', 'x.json'], 'invalid_clients'],
    ['fractional clients', ['--url', 'http://localhost:8896', '--clients', '12.5', '--out', 'x.json'], 'invalid_clients'],
    ['invalid loss', ['--url', 'http://localhost:8896', '--state-loss-rate', '1.1', '--out', 'x.json'], 'invalid_state_loss_rate'],
    ['duplicate option', ['--url', 'http://localhost:8896', '--out', 'x.json', '--out', 'y.json'], 'invalid_argument'],
    ['unknown scenario', ['--url', 'http://localhost:8896', '--out', 'x.json', '--scenario', 'packet-loss'], 'invalid_scenario'],
  ])('rejects %s', (_name, argv, code) => {
    expect(() => parseLoadOptions(argv)).toThrowError(new LoadOptionError(code));
  });

  it('makes seeded loss, latency, and reordering deterministic', () => {
    const options = { seed: 91, latencyMs: 30, jitterMs: 7, lossRate: .25, reorderRate: .4 };
    const left = createStateImpairment(options), right = createStateImpairment(options);
    expect(Array.from({ length: 20 }, left)).toEqual(Array.from({ length: 20 }, right));
  });

  it.each(['normal', 'impairment', 'room-cap', 'disconnect', 'expiry', 'join-burst', 'malformed-stale'])
  ('accepts the explicit %s scenario', scenario => {
    expect(parseLoadOptions(['--url', 'http://localhost:8896', '--out', 'x.json', '--scenario', scenario]).scenario)
      .toBe(scenario);
  });

  it('parses only finite complete tk:stats payloads', () => {
    const stats = { tick: { p50: 1, p95: 2, max: 3, n: 4 }, flush: { p50: 1, p95: 2, max: 3, n: 4 }, windowMs: 10_000, drops: { rateLimited: 0, staleSeq: 1, oversizedBatch: 0, unknownType: 0, relayRateLimited: 0, relayOversized: 0, relayBadTarget: 0 }, errors: 0 };
    expect(readPerfSnapshot(stats)?.drops.staleSeq).toBe(1);
    expect(readPerfSnapshot(stats)?.tick.p99).toBeNull();
    expect(readPerfSnapshot({ ...stats, measuredAtMs: 123.5, measuredAtEpochMs: 1_700_000_000_000,
      tick: { ...stats.tick, p99: 2.5 }, flush: { ...stats.flush, p99: 2.75 } }))
      .toMatchObject({ measuredAtMs: 123.5, measuredAtEpochMs: 1_700_000_000_000,
        tick: { p99: 2.5 }, flush: { p99: 2.75 } });
    expect(readPerfSnapshot({ ...stats, errors: Number.NaN })).toBeNull();
    expect(readPerfSnapshot({ ...stats, drops: { ...stats.drops, staleSeq: -1 } })).toBeNull();
  });

  it('keeps absolute cadence under injected work and skips overdue slots instead of bursting', async () => {
    let clock = 0;
    const regular = await runAbsoluteCadence({
      durationMs: 250,
      intervalMs: 50,
      now: () => clock,
      wait: async milliseconds => { clock += milliseconds; },
      onTick: async () => { clock += 30; },
    });
    expect(regular).toMatchObject({ scheduledTicks: 5, executedTicks: 5, skippedTicks: 0, observedActiveMs: 250 });
    let relativeClock = 0;
    for (let tick = 0; tick < 5; tick += 1) { relativeClock += 30; relativeClock += 50; }
    expect(regular.observedActiveMs).toBeLessThan(relativeClock);

    clock = 0;
    const slots: number[] = [];
    const overloaded = await runAbsoluteCadence({
      durationMs: 250,
      intervalMs: 50,
      now: () => clock,
      wait: async milliseconds => { clock += milliseconds; },
      onTick: async ({ tick }) => { slots.push(tick); clock += 80; },
    });
    expect(overloaded.skippedTicks).toBe(1);
    expect(slots).toEqual([...new Set(slots)]);
    expect(overloaded.executedTicks).toBeLessThan(overloaded.scheduledTicks);

    clock = 0;
    const deadlineMiss = await runAbsoluteCadence({
      durationMs: 250,
      intervalMs: 50,
      now: () => clock,
      wait: async milliseconds => { clock += clock === 150 ? milliseconds + 50 : milliseconds; },
      onTick: async () => undefined,
    });
    expect(deadlineMiss).toMatchObject({ scheduledTicks: 5, executedTicks: 4, skippedTicks: 1 });
  });

  it('uses observed active time rather than requested seconds for the duration gate', () => {
    const records = Array.from({ length: 12 }, (_, index) => ({
      index, connectionKind: 'initial' as const, joinedAt: 0, closedAt: 180_000, closeCode: 1000,
      finalBufferedBytes: 0, sent: { move: 1, fire: 1, reload: 1, objective: 1 }, errors: [],
    }));
    const checks = scenarioChecks({ scenario: 'normal', seconds: 180, clients: 12 }, records, 12, null, {
      observedActiveMs: 179_999, scheduledTicks: 3_600, executedTicks: 3_600, skippedTicks: 0,
    });
    expect(checks.durationQualified).toBe(false);
  });

  it('retains an earlier server error or drop when a later stats snapshot is clean', () => {
    const metric = (p99: number | null = 3) => ({ p50: 1, p95: 2, p99, max: 4, n: 5 });
    const earlier = { tick: metric(), flush: metric(), windowMs: 10_000, measuredAtMs: null, measuredAtEpochMs: null, receivedAtMs: null,
      drops: { rateLimited: 1, staleSeq: 0, oversizedBatch: 0, unknownType: 0, relayRateLimited: 0, relayOversized: 0, relayBadTarget: 0 }, errors: 2 };
    const clean = { ...earlier, drops: { ...earlier.drops, rateLimited: 0 }, errors: 0 };
    const aggregate = aggregatePerfSnapshots([{ perfSnapshots: [earlier, clean] }]);
    expect(aggregate?.drops.rateLimited).toBe(1);
    expect(aggregate?.errors).toBe(2);
  });

  it('keeps missing tick or flush p99 explicitly unqualified', () => {
    const metric = { p50: 1, p95: 2, p99: null, max: 4, n: 5 };
    const stats = { tick: metric, flush: metric, windowMs: 10_000, measuredAtMs: null, measuredAtEpochMs: null, receivedAtMs: null,
      drops: { rateLimited: 0, staleSeq: 0, oversizedBatch: 0, unknownType: 0, relayRateLimited: 0, relayOversized: 0, relayBadTarget: 0 }, errors: 0 };
    expect(evaluateServerQualification(stats)).toMatchObject({
      statsP99Available: false,
      tickP99WithinBudget: false,
      flushP99WithinBudget: false,
    });
  });

  it('binds normal and impairment qualification to p99, max, cumulative drops, errors, backlog, and clean closes', () => {
    const metric = { p50: 1, p95: 2, p99: 10, max: 25, n: 200 };
    const activeStart = 1_000_000;
    const drops = { rateLimited: 0, staleSeq: 0, oversizedBatch: 0, unknownType: 0, relayRateLimited: 0, relayOversized: 0, relayBadTarget: 0 };
    const snapshots = Array.from({ length: 18 }, (_, index) => ({ tick: metric, flush: metric, windowMs: 10_000,
      measuredAtMs: 500_000 + (index + 1) * 10_000, measuredAtEpochMs: activeStart + (index + 1) * 10_000,
      receivedAtMs: activeStart + (index + 1) * 10_000 + 1, drops, errors: 0 }));
    const stats = aggregatePerfSnapshots([{ index: 0, perfSnapshots: snapshots }]);
    expect(stats).not.toBeNull();
    const records = Array.from({ length: 12 }, (_, index) => ({
      index, connectionKind: 'initial' as const, openedAt: index, joinedAt: index + 1, closedAt: 180_000,
      closeCode: 1000, finalBufferedBytes: 0, sent: { move: 1, fire: 1, reload: 1, objective: 1 },
      errors: [], stateFrames: { dropped: index === 0 ? 1 : 0, reordered: index === 0 ? 1 : 0 },
    }));
    const timing = { startedAtMonotonicMs: 500_000, finishedAtMonotonicMs: 680_000,
      startedAtEpochMs: activeStart, finishedAtEpochMs: activeStart + 180_000,
      observedActiveMs: 180_000, scheduledTicks: 3_600, executedTicks: 3_600, skippedTicks: 0 };
    expect(Object.values(scenarioChecks({ scenario: 'normal', seconds: 180, clients: 12 }, records, 12, stats, timing)).every(Boolean)).toBe(true);
    const impairmentTiming = { ...timing, finishedAtMonotonicMs: 520_000,
      finishedAtEpochMs: activeStart + 20_000, observedActiveMs: 20_000 };
    expect(Object.values(scenarioChecks({ scenario: 'impairment', seconds: 20, clients: 12, stateReorderRate: .1 }, records, 12, stats,
      impairmentTiming)).every(Boolean)).toBe(true);

    const dropped = { ...stats!, drops: { ...stats!.drops, unknownType: 1 } };
    expect(scenarioChecks({ scenario: 'impairment', seconds: 20, clients: 12, stateReorderRate: .1 }, records, 12, dropped,
      impairmentTiming).noServerDrops).toBe(false);
    const unclean = records.map((record, index) => index === 3 ? { ...record, closeCode: 1006 } : record);
    expect(scenarioChecks({ scenario: 'normal', seconds: 180, clients: 12 }, unclean, 12, stats, timing).cleanClose).toBe(false);
  });

  it('keeps intentional malformed and stale-drop evidence separate from clean normal/impairment checks', () => {
    const metric = { p50: 1, p95: 2, p99: 3, max: 4, n: 5 };
    const stats = aggregatePerfSnapshots([{ index: 0, perfSnapshots: [{ tick: metric, flush: metric, windowMs: 10_000,
      measuredAtMs: null, measuredAtEpochMs: null, receivedAtMs: null,
      drops: { rateLimited: 0, staleSeq: 1, oversizedBatch: 0, unknownType: 0, relayRateLimited: 0, relayOversized: 0, relayBadTarget: 0 }, errors: 1 }] }]);
    expect(stats).not.toBeNull();
    const records = Array.from({ length: 12 }, (_, index) => ({
      connectionKind: 'initial' as const, openedAt: index, joinedAt: index + 1, closedAt: 5_000,
      closeCode: 1000, finalBufferedBytes: 0, sent: { move: 1, fire: 1, reload: 1, objective: 1 },
      errors: index === 0 ? ['malformed_server_frame'] : [], peerLeftAt: [], stateFrames: { dropped: 0, reordered: 0 },
    }));
    const checks = scenarioChecks({ scenario: 'malformed-stale', seconds: 5, clients: 12 }, records, 12, stats!,
      { observedActiveMs: 5_000, scheduledTicks: 100, executedTicks: 100, skippedTicks: 0 });
    expect(checks).toMatchObject({ staleSequenceDropObserved: true, malformedSeparated: true });
    expect(checks).not.toHaveProperty('noServerDrops');
    expect(checks).not.toHaveProperty('noServerErrors');
  });

  it('requires server-measured stats windows to cover the complete active epoch without holes', () => {
    const activeStart = 1_000_000;
    const metric = { p50: 1, p95: 2, p99: 3, max: 4, n: 200 };
    const drops = { rateLimited: 0, staleSeq: 0, oversizedBatch: 0, unknownType: 0, relayRateLimited: 0, relayOversized: 0, relayBadTarget: 0 };
    const snapshot = (measuredAtEpochMs: number) => ({ tick: metric, flush: metric, windowMs: 10_000, drops, errors: 0,
      measuredAtMs: measuredAtEpochMs - activeStart + 500_000, measuredAtEpochMs, receivedAtMs: measuredAtEpochMs + 2 });
    const complete = aggregatePerfSnapshots([{ index: 0,
      perfSnapshots: Array.from({ length: 18 }, (_, index) => snapshot(activeStart + (index + 1) * 10_000)) }]);
    const timing = { startedAtMonotonicMs: 500_000, finishedAtMonotonicMs: 680_000,
      startedAtEpochMs: activeStart, finishedAtEpochMs: activeStart + 180_000,
      observedActiveMs: 180_000, scheduledTicks: 3_600, executedTicks: 3_600, skippedTicks: 0 };
    expect(evaluateStatsCoverage(complete, timing)).toMatchObject({ covered: true, gapCount: 0,
      serverTickRate20Hz: true, serverTickWindowCount: 18, serverTickHzMin: 20, serverTickHzMax: 20 });
    const boundaryTick = aggregatePerfSnapshots([{ index: 0,
      perfSnapshots: Array.from({ length: 18 }, (_, index) => ({ ...snapshot(activeStart + (index + 1) * 10_000),
        tick: { ...metric, n: index % 2 === 0 ? 199 : 201 } })) }]);
    expect(evaluateStatsCoverage(boundaryTick, timing)).toMatchObject({ serverTickRate20Hz: true,
      serverTickHzMin: 19.9, serverTickHzMax: 20.1 });

    const singleEarly = aggregatePerfSnapshots([{ index: 0, perfSnapshots: [snapshot(activeStart + 10_000)] }]);
    expect(evaluateStatsCoverage(singleEarly, timing)).toMatchObject({ covered: false });
    expect(evaluateServerQualification(singleEarly, timing).statsTemporalCoverage).toBe(false);
    const missingStamp = aggregatePerfSnapshots([{ index: 0,
      perfSnapshots: [{ ...snapshot(activeStart + 10_000), measuredAtMs: null }] }]);
    expect(evaluateStatsCoverage(missingStamp, timing)).toMatchObject({ covered: false, timestampsAvailable: false });
    const clockRegression = aggregatePerfSnapshots([{ index: 0, perfSnapshots: [snapshot(activeStart + 10_000),
      { ...snapshot(activeStart + 20_000), measuredAtMs: 499_000 }] }]);
    expect(evaluateStatsCoverage(clockRegression, timing)).toMatchObject({ covered: false, clockProgressConsistent: false });
    const lateReceipt = aggregatePerfSnapshots([{ index: 0, perfSnapshots: [
      { ...snapshot(activeStart + 10_000), receivedAtMs: activeStart + 25_000 }] }]);
    expect(evaluateStatsCoverage(lateReceipt, timing)).toMatchObject({ covered: false, timestampsAvailable: false });
    expect(evaluateStatsCoverage(complete, { ...timing, finishedAtEpochMs: activeStart + 10_000 }))
      .toMatchObject({ covered: false, timestampsAvailable: true, activeClockSpanConsistent: false });
    const slowTick = aggregatePerfSnapshots([{ index: 0,
      perfSnapshots: Array.from({ length: 18 }, (_, index) => ({ ...snapshot(activeStart + (index + 1) * 10_000),
        tick: { ...metric, n: 20 } })) }]);
    expect(evaluateStatsCoverage(slowTick, timing)).toMatchObject({ covered: true, serverTickRate20Hz: false,
      serverTickHzMin: 2 });
  });

  it('closes and awaits every owned socket, including a failed join that opens late', async () => {
    let resolveClosed!: () => void;
    const closed = new Promise<void>(resolve => { resolveClosed = resolve; });
    const socket = { readyState: 0, closeCalls: 0, close() { this.closeCalls += 1; this.readyState = 1;
      queueMicrotask(() => { this.readyState = 3; resolveClosed(); }); } };
    const record = { errors: [] as string[] };
    const result = await closeOwnedConnections([{ socket, closed, record }], { timeoutMs: 100,
      wait: async () => new Promise<void>(() => undefined), reason: 'join-failed' });
    expect(result).toEqual({ attempted: 1, closed: 1, timedOut: 0 });
    expect(socket.closeCalls).toBe(1);
    expect(record.errors).toEqual([]);
  });

  it('verifies every manifest-listed stage file and rejects later byte drift', async () => {
    const manifest = { schemaVersion: 2, stageRoot: 'D:/sealed-stage', head: 'a'.repeat(40),
      files: [{ path: 'src/a.txt', bytes: 5, sha256: '8ed3f6ad685b959ead7022518e1af76cd816f8e8ec7ccdda1ed4018e8f2223f8' }] };
    const good = await verifyManifestFiles(manifest, async () => new TextEncoder().encode('alpha'));
    expect(good).toMatchObject({ fileCount: 1, mismatches: [] });
    await expect(verifyManifestFiles(manifest, async () => new TextEncoder().encode('beta')))
      .rejects.toThrowError('source_manifest_file_mismatch');
  });

  it('binds the source manifest bytes and every listed file at both run boundaries', async () => {
    const manifest = { schemaVersion: 2, stageRoot: 'D:/sealed-stage', head: 'a'.repeat(40), files: [{ path: 'source.txt', bytes: 5,
      sha256: '8ed3f6ad685b959ead7022518e1af76cd816f8e8ec7ccdda1ed4018e8f2223f8' }] };
    let manifestBytes = new TextEncoder().encode(JSON.stringify(manifest)), sourceBytes = new TextEncoder().encode('alpha');
    const dependencies = { readManifest: async () => manifestBytes,
      verifyFiles: (value: unknown) => verifyManifestFiles(value, async () => sourceBytes) };
    const preflight = await verifySourceManifestFile('D:/sealed-stage/manifest.json', null, dependencies);
    expect(preflight.verification).toMatchObject({ fileCount: 1, mismatches: [] });
    const postflight = await verifySourceManifestFile('D:/sealed-stage/manifest.json', preflight.manifestSha256, dependencies);
    expect(postflight.manifestSha256).toBe(preflight.manifestSha256);
    sourceBytes = new TextEncoder().encode('omega');
    await expect(verifySourceManifestFile('D:/sealed-stage/manifest.json', preflight.manifestSha256, dependencies))
      .rejects.toThrowError('source_manifest_file_mismatch');
    sourceBytes = new TextEncoder().encode('alpha'); manifestBytes = new TextEncoder().encode(`${JSON.stringify(manifest)}\n`);
    await expect(verifySourceManifestFile('D:/sealed-stage/manifest.json', preflight.manifestSha256, dependencies))
      .rejects.toThrowError('source_manifest_changed');
  });

  it('accepts an explicit null stats snapshot as not yet observed in a socket fixture', () => {
    const record = {
      index: 0, session: 's', connectionId: 'c', openedAt: 0, joinedAt: 1, closedAt: 2,
      closeCode: 1000, closeReason: 'done', bytesIn: 1, bytesOut: 1, maxBufferedBytes: 0,
      sent: { move: 1, look: 1, fire: 1, reload: 1, stats: 0, time: 1 }, acks: 1,
      stateFrames: { received: 1, applied: 1, dropped: 0, reordered: 0 }, actualRttMs: [1],
      simulatedStateDelayMs: [0], errors: [], peerLeftAt: [], perf: null,
    };
    expect(readFixtureClient(record, 0).perf).toBeNull();
  });

  it('distinguishes transient buffered bytes from residual backlog after close', () => {
    expect(hasNoResidualBacklog([{ joinedAt: 1, closedAt: 2, maxBufferedBytes: 506, finalBufferedBytes: 0 }])).toBe(true);
    expect(hasNoResidualBacklog([{ joinedAt: 1, closedAt: null, maxBufferedBytes: 0, finalBufferedBytes: null }])).toBe(false);
  });

  it('requires startup, health, and same-run request records from a bounded server log capture', () => {
    const valid = classifyServerLog({
      before: '[wrangler:info] Ready on http://127.0.0.1:8896\n[wrangler:info] GET /api/health 200 OK',
      during: Array.from({ length: 12 }, () => '[wrangler:info] GET /api/matchmake 200 OK\n[wrangler:info] GET /parties/arena-room/x 101 Switching Protocols').join('\n'),
      expectedOrigin: 'http://127.0.0.1:8896', expectedRequests: 12,
    });
    expect(valid).toMatchObject({ available: true, startupReady: true, healthReady: true,
      matchmakeRequests: 12, websocketUpgrades: 12, simulationBacklogWarnings: 0, reasons: [] });
    for (const proof of [null, { before: '', during: '', expectedOrigin: 'http://127.0.0.1:8896', expectedRequests: 12 },
      { before: 'Ready on http://127.0.0.1:8896', during: 'unrelated', expectedOrigin: 'http://127.0.0.1:8896', expectedRequests: 12 }]) {
      expect(classifyServerLog(proof).available).toBe(false);
    }
    expect(classifyServerLog({ before: '[wrangler:info] Ready on http://127.0.0.1:8896\n[wrangler:info] GET /api/health 200 OK',
      during: 'simulation fell behind > 5 ticks', expectedOrigin: 'http://127.0.0.1:8896', expectedRequests: 12 }).available).toBe(false);
  });
});
