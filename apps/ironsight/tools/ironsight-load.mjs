import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canReconnect, createStatsProbe, evaluateStatsCoverage, hasThreeSecondOutage, requestTransportClose } from './ironsight-load-timing.mjs';
export { evaluateStatsCoverage } from './ironsight-load-timing.mjs';
import { classifyServerLog, createStateImpairment, LoadOptionError, parseLoadOptions, readPerfSnapshot } from './ironsight-load-options.mjs';

class LoadRunError extends Error {
  constructor(code, record = null) { super(code); this.name = 'LoadRunError'; this.code = code; this.record = record; }
}
const sleep = milliseconds => new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const bytesOf = data => typeof data === 'string' ? Buffer.byteLength(data) : data instanceof ArrayBuffer ? data.byteLength : data?.size ?? 0;
const percentile = (values, p) => values.length === 0 ? null : [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * p))];

export async function verifyManifestFiles(manifest, readBytes = readFile) {
  if (!manifest || manifest.schemaVersion !== 2 || typeof manifest.stageRoot !== 'string' || !isAbsolute(manifest.stageRoot)
    || !/^[0-9a-f]{40}$/.test(manifest.head) || !Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new LoadRunError('invalid_source_manifest');
  }
  const root = resolve(manifest.stageRoot), seen = new Set();
  for (const file of manifest.files) {
    if (typeof file?.path !== 'string' || file.path.length === 0 || isAbsolute(file.path) || seen.has(file.path)
      || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || !/^[0-9a-f]{64}$/.test(file.sha256)) {
      throw new LoadRunError('invalid_source_manifest');
    }
    seen.add(file.path);
  }
  const results = await Promise.all(manifest.files.map(async file => {
    const path = resolve(root, file.path), relativePath = relative(root, path);
    if (relativePath.startsWith('..') || isAbsolute(relativePath)) return { path: file.path, reason: 'outside_stage_root' };
    try {
      const bytes = await readBytes(path), actualSha256 = sha256(bytes);
      return bytes.byteLength === file.bytes && actualSha256 === file.sha256 ? null
        : { path: file.path, reason: 'content_mismatch', expectedBytes: file.bytes, actualBytes: bytes.byteLength,
          expectedSha256: file.sha256, actualSha256 };
    } catch (error) { return { path: file.path, reason: 'read_failed', error: error instanceof Error ? error.message : String(error) }; }
  }));
  const mismatches = results.filter(Boolean);
  if (mismatches.length > 0) throw new LoadRunError('source_manifest_file_mismatch', { mismatches });
  return { stageRoot: root, fileCount: manifest.files.length, mismatches: [], verifiedAt: new Date().toISOString() };
}

export async function verifySourceManifestFile(manifestPath, expectedManifestSha256 = null,
  { readManifest = readFile, verifyFiles = verifyManifestFiles } = {}) {
  const resolvedPath = resolve(manifestPath), bytes = await readManifest(resolvedPath);
  const manifestSha256 = sha256(bytes);
  if (expectedManifestSha256 !== null && manifestSha256 !== expectedManifestSha256) {
    throw new LoadRunError('source_manifest_changed');
  }
  let manifest;
  try { manifest = JSON.parse(Buffer.from(bytes).toString('utf8')); } catch { throw new LoadRunError('invalid_source_manifest'); }
  const verification = await verifyFiles(manifest);
  return { manifest, manifestPath: resolvedPath, manifestSha256, verification };
}

export async function runAbsoluteCadence({ durationMs, intervalMs = 50, now = () => performance.now(), wait = sleep, onTick }) {
  const startedAt = now(), deadline = startedAt + durationMs, scheduledTicks = Math.ceil(durationMs / intervalMs);
  let slot = 0, executedTicks = 0, skippedTicks = 0, maxLatenessMs = 0;
  while (slot < scheduledTicks) {
    const target = startedAt + slot * intervalMs;
    const beforeWait = now();
    if (beforeWait < target) await wait(target - beforeWait);
    const actualAt = now();
    if (actualAt >= deadline) break;
    const dueSlot = Math.min(scheduledTicks - 1, Math.floor((actualAt - startedAt) / intervalMs));
    if (dueSlot > slot) { skippedTicks += dueSlot - slot; slot = dueSlot; }
    const scheduledAt = startedAt + slot * intervalMs;
    maxLatenessMs = Math.max(maxLatenessMs, actualAt - scheduledAt);
    await onTick({ tick: slot, scheduledAt, actualAt });
    executedTicks += 1;
    slot += 1;
  }
  if (slot < scheduledTicks) skippedTicks += scheduledTicks - slot;
  const beforeDeadline = now();
  if (beforeDeadline < deadline) await wait(deadline - beforeDeadline);
  const finishedAt = now(), observedActiveMs = finishedAt - startedAt;
  return { startedAtMonotonicMs: startedAt, finishedAtMonotonicMs: finishedAt,
    intervalMs, scheduledTicks, executedTicks, skippedTicks, maxLatenessMs,
    observedActiveMs, overrunMs: Math.max(0, observedActiveMs - durationMs),
    effectiveHz: observedActiveMs > 0 ? executedTicks * 1000 / observedActiveMs : 0 };
}

function message(type, seq, payload) { return JSON.stringify({ t: 'c:msg', type, seq, payload }); }
function websocketUrl(origin, party, room, session) {
  const url = new URL(origin); url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `/parties/${encodeURIComponent(party)}/${encodeURIComponent(room)}`; url.searchParams.set('_session', session); return url.href;
}
function socketRecord(index) {
  return { index, connectionKind: 'initial', session: null, connectionId: null, openedAt: null, joinedAt: null, closedAt: null,
    connectRequestedAtMonotonicMs: null, openedAtMonotonicMs: null, joinedAtMonotonicMs: null,
    closeRequestedAtMonotonicMs: null, transportUnusableAtMonotonicMs: null, closedAtMonotonicMs: null, closeReadyState: null,
    closeCode: null, closeReason: null, bytesIn: 0, bytesOut: 0, maxBufferedBytes: 0, finalBufferedBytes: null, sent: { move: 0, look: 0, fire: 0, reload: 0, objective: 0, stats: 0, time: 0 }, acks: 0, stateFrames: { received: 0, applied: 0, dropped: 0, reordered: 0 }, actualRttMs: [], simulatedStateDelayMs: [], errors: [], peerLeftAt: [], perfSnapshots: [] };
}
export function readFixtureClient(value, index) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new LoadRunError('invalid_fixture');
  const baseline = socketRecord(index), allowed = new Set([...Object.keys(baseline), 'perf']);
  if (Object.keys(value).some(key => !allowed.has(key)) || value.index !== index || ![value.session, value.connectionId, value.closeReason].every(item => item === null || typeof item === 'string') || ![value.openedAt, value.joinedAt, value.closedAt, value.closeCode].every(item => item === null || Number.isSafeInteger(item) && item >= 0) || ![value.bytesIn, value.bytesOut, value.maxBufferedBytes, value.acks].every(item => Number.isSafeInteger(item) && item >= 0) || value.finalBufferedBytes !== undefined && value.finalBufferedBytes !== null && (!Number.isSafeInteger(value.finalBufferedBytes) || value.finalBufferedBytes < 0)) throw new LoadRunError('invalid_fixture');
  const counters = object => object && typeof object === 'object' && Object.values(object).every(item => Number.isSafeInteger(item) && item >= 0);
  const samples = array => Array.isArray(array) && array.every(item => typeof item === 'number' && Number.isFinite(item) && item >= 0);
  if (Object.keys(baseline).filter(key => key.endsWith('AtMonotonicMs')).some(key =>
    value[key] !== undefined && value[key] !== null && !samples([value[key]]))
    || value.closeReadyState !== undefined && value.closeReadyState !== null && ![0, 1, 2, 3].includes(value.closeReadyState)) throw new LoadRunError('invalid_fixture');
  if (!counters(value.sent) || !counters(value.stateFrames) || !samples(value.actualRttMs) || !samples(value.simulatedStateDelayMs) || !Array.isArray(value.errors) || value.errors.some(item => typeof item !== 'string') || !Array.isArray(value.peerLeftAt) || !samples(value.peerLeftAt)) throw new LoadRunError('invalid_fixture');
  const perf = value.perf === undefined || value.perf === null ? undefined : readPerfSnapshot(value.perf);
  if (value.perf !== undefined && value.perf !== null && !perf) throw new LoadRunError('invalid_fixture');
  const rawPerfSnapshots = value.perfSnapshots ?? [];
  if (!Array.isArray(rawPerfSnapshots)) throw new LoadRunError('invalid_fixture');
  const perfSnapshots = rawPerfSnapshots.map(readPerfSnapshot);
  if (perfSnapshots.some(item => item === null)) throw new LoadRunError('invalid_fixture');
  return { ...baseline, ...value, perfSnapshots, ...(perf ? { perf } : {}) };
}
function send(record, socket, raw) { socket.send(raw); record.bytesOut += Buffer.byteLength(raw); record.maxBufferedBytes = Math.max(record.maxBufferedBytes, socket.bufferedAmount); }

async function matchmake(options) {
  const response = await fetch(`${options.url}/api/matchmake?mode=tdm`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new LoadRunError('matchmake_failed'); const value = await response.json();
  if (!value || typeof value !== 'object' || typeof value.party !== 'string' || typeof value.room !== 'string' || typeof value.session !== 'string' || !Number.isSafeInteger(value.contentRevision)) throw new LoadRunError('invalid_matchmake');
  return value;
}

async function connectOne(options, index, startedAt, burst, priorAllocation = null, ownedConnections = null) {
  if (!burst && index > 0) await sleep(100);
  const allocation = priorAllocation ?? await matchmake(options), record = socketRecord(index);
  record.connectionKind = priorAllocation ? 'reconnect' : 'initial'; record.session = allocation.session;
  const impairment = createStateImpairment({ seed: options.seed + index, latencyMs: options.latencyMs, jitterMs: options.jitterMs, lossRate: options.stateLossRate, reorderRate: options.stateReorderRate });
  record.connectRequestedAtMonotonicMs = performance.now();
  const socket = new WebSocket(websocketUrl(options.url, allocation.party, allocation.room, allocation.session)); socket.binaryType = 'arraybuffer';
  const statsProbe = createStatsProbe(record);
  let resolveJoin, rejectJoin, resolveClose;
  const joined = new Promise((resolvePromise, rejectPromise) => { resolveJoin = resolvePromise; rejectJoin = rejectPromise; });
  const closed = new Promise(resolvePromise => { resolveClose = resolvePromise; });
  socket.addEventListener('open', () => { record.openedAtMonotonicMs = performance.now(); record.openedAt = Date.now() - startedAt; });
  socket.addEventListener('error', () => { record.errors.push('transport_error'); rejectJoin(new LoadRunError('socket_error', record)); });
  socket.addEventListener('close', event => { record.closedAtMonotonicMs = performance.now(); record.closedAt = Date.now() - startedAt; record.closeCode = event.code; record.closeReason = event.reason; record.finalBufferedBytes = socket.bufferedAmount; resolveClose(); if (record.joinedAt === null) rejectJoin(new LoadRunError(event.code === 4002 ? 'room_full' : 'closed_before_join', record)); });
  socket.addEventListener('message', event => {
    record.bytesIn += bytesOf(event.data);
    if (event.data instanceof ArrayBuffer) {
      record.stateFrames.received += 1; const outcome = impairment();
      if (outcome.kind === 'drop') { record.stateFrames.dropped += 1; return; }
      record.simulatedStateDelayMs.push(outcome.delayMs); if (outcome.reordered) record.stateFrames.reordered += 1;
      setTimeout(() => { record.stateFrames.applied += 1; }, outcome.delayMs); return;
    }
    let frame; try { frame = JSON.parse(String(event.data)); } catch { record.errors.push('malformed_server_frame'); return; }
    if (frame.t === 's:welcome') { record.connectionId = frame.connectionId; record.joinedAtMonotonicMs = performance.now(); record.joinedAt = Date.now() - startedAt; send(record, socket, message('contentReady', 1, { revision: allocation.contentRevision })); resolveJoin(); }
    else if (frame.t === 's:ack') record.acks += 1;
    else if (frame.t === 's:time' && Number.isFinite(frame.t0)) record.actualRttMs.push(Math.max(0, Date.now() - frame.t0));
    else if (frame.t === 's:msg' && frame.type === 'tk:stats') statsProbe.receive(frame.payload);
    else if (frame.t === 's:peer-left') record.peerLeftAt.push(Date.now() - startedAt);
    else if (frame.t === 's:error') record.errors.push(typeof frame.code === 'string' ? frame.code : 'server_error');
  });
  const ownership = { socket, record, closed };
  if (ownedConnections) ownedConnections.push(ownership);
  try { await Promise.race([joined, sleep(5000).then(() => { throw new LoadRunError('join_timeout', record); })]); }
  catch (error) { await closeOwnedConnections([ownership], { timeoutMs: 5000, reason: 'join-failed' }); throw error; }
  return { socket, record, nextSeq: 2, allocation, closed, statsProbe };
}

function sendStats(client) {
  const seq = client.nextSeq++;
  if (client.statsProbe.request(seq, () => send(client.record, client.socket, message('tk:stats', seq, {})))) client.record.sent.stats += 1;
}

function sendIntents(client, tick, now) {
  const move = { mx: Math.sin((tick + client.record.index) / 20), mz: tick % 80 < 40 ? 1 : -1, jump: false, crouch: false, sprint: tick % 60 < 20, ads: tick % 40 < 20 };
  send(client.record, client.socket, message('move', client.nextSeq++, move)); client.record.sent.move += 1;
  if (tick % 4 === 0) { send(client.record, client.socket, message('look', client.nextSeq++, { yaw: (tick / 20) % 6.28, pitch: 0 })); client.record.sent.look += 1; }
  if (tick % 20 === 0) { send(client.record, client.socket, JSON.stringify({ t: 'c:time', t0: now })); client.record.sent.time += 1; }
  if (tick % 40 === 0) { send(client.record, client.socket, message('fire', client.nextSeq++, { fireSeq: tick / 40 + 1 })); client.record.sent.fire += 1; }
  if (tick % 100 === 0) { send(client.record, client.socket, message('reload', client.nextSeq++, {})); client.record.sent.reload += 1; }
  if (tick % 80 === 0) { send(client.record, client.socket, message('ping', client.nextSeq++, { yaw: 0, pitch: 0, intent: 'go' })); client.record.sent.objective += 1; }
}

function peakConcurrent(records) {
  const events = records.flatMap(record => [
    ...(record.openedAt === null ? [] : [{ at: record.openedAt, delta: 1 }]),
    ...(record.closedAt === null ? [] : [{ at: record.closedAt, delta: -1 }]),
  ]).sort((left, right) => left.at - right.at || right.delta - left.delta);
  let current = 0, peak = 0;
  for (const event of events) { current += event.delta; peak = Math.max(peak, current); }
  return peak;
}

export function hasNoResidualBacklog(records) {
  return records.filter(record => record.joinedAt !== null)
    .every(record => record.closedAt !== null && record.finalBufferedBytes === 0);
}

export async function closeOwnedConnections(connections, { timeoutMs = 35_000, wait = sleep, reason = 'load-complete' } = {}) {
  let attempted = 0;
  for (const connection of connections) {
    if (connection.socket.readyState > WebSocket.OPEN) continue;
    attempted += 1;
    try { requestTransportClose(connection, reason); } catch { connection.record.errors.push('close_failed'); }
  }
  const outcomes = await Promise.all(connections.map(async connection => {
    if (connection.socket.readyState === WebSocket.CLOSED) return true;
    return Promise.race([connection.closed.then(() => true), wait(timeoutMs).then(() => false)]);
  }));
  outcomes.forEach((closed, index) => { if (!closed && !connections[index].record.errors.includes('close_timeout')) connections[index].record.errors.push('close_timeout'); });
  return { attempted, closed: outcomes.filter(Boolean).length, timedOut: outcomes.filter(closed => !closed).length };
}

const DROP_KEYS = ['rateLimited', 'staleSeq', 'oversizedBatch', 'unknownType', 'relayRateLimited', 'relayOversized', 'relayBadTarget'];

export function aggregatePerfSnapshots(records) {
  const series = records.flatMap(record => (record.perfSnapshots?.length ? record.perfSnapshots : record.perf ? [record.perf] : [])
    .map((snapshot, snapshotIndex) => ({ socketIndex: record.index ?? null, snapshotIndex, snapshot })));
  if (series.length === 0) return null;
  const stage = name => {
    const values = series.map(entry => entry.snapshot[name]);
    const p99Available = values.every(value => Number.isFinite(value.p99));
    return { p50: Math.max(...values.map(value => value.p50)), p95: Math.max(...values.map(value => value.p95)),
      p99: p99Available ? Math.max(...values.map(value => value.p99)) : null,
      max: Math.max(...values.map(value => value.max)), n: Math.max(...values.map(value => value.n)) };
  };
  return { tick: stage('tick'), flush: stage('flush'), windowMs: Math.max(...series.map(entry => entry.snapshot.windowMs)),
    measuredAtMs: null, measuredAtEpochMs: null, receivedAtMs: null,
    drops: Object.fromEntries(DROP_KEYS.map(key => [key, Math.max(...series.map(entry => entry.snapshot.drops[key]))])),
    errors: Math.max(...series.map(entry => entry.snapshot.errors)), snapshotCount: series.length, series };
}

export function evaluateServerQualification(stats, timing = null) {
  const statsAvailable = stats !== null && stats !== undefined;
  const statsP99Available = statsAvailable && Number.isFinite(stats.tick.p99) && Number.isFinite(stats.flush.p99);
  const serverDrops = stats ? Object.values(stats.drops).reduce((sum, value) => sum + value, 0) : null;
  const coverage = evaluateStatsCoverage(stats, timing);
  return { statsTemporalCoverage: coverage.covered, statsP99Available,
    serverTickRate20Hz: coverage.serverTickRate20Hz,
    tickP99WithinBudget: statsP99Available && stats.tick.p99 <= 10,
    flushP99WithinBudget: statsP99Available && stats.flush.p99 <= 10,
    tickSamplesObserved: statsAvailable && stats.tick.n > 0,
    flushSamplesObserved: statsAvailable && stats.flush.n > 0,
    tickMaxWithinBudget: statsAvailable && stats.tick.max <= 25,
    flushMaxWithinBudget: statsAvailable && stats.flush.max <= 25,
    noServerDrops: serverDrops === 0, noServerErrors: statsAvailable && stats.errors === 0 };
}

export function scenarioChecks(options, records, joined, stats, timing) {
  const initial = records.filter(record => record.connectionKind === 'initial');
  const reconnects = records.filter(record => record.connectionKind === 'reconnect');
  const rejected = initial.filter(record => record.joinedAt === null);
  const requiredSeconds = { normal: 180, impairment: 20, 'room-cap': 5,
    disconnect: 8, expiry: 34, 'join-burst': 5, 'malformed-stale': 5 }[options.scenario] ?? Infinity;
  const common = {
    durationQualified: timing !== null && timing.observedActiveMs >= requiredSeconds * 1000,
    cadenceObserved: timing !== null,
    cadenceNoSkippedTicks: timing !== null && timing.skippedTicks === 0 && timing.executedTicks === timing.scheduledTicks,
    twelveConcurrent: peakConcurrent(records) >= 12,
    traffic: initial.filter(record => record.joinedAt !== null).every(record => record.sent.move > 0
      && record.sent.fire > 0 && record.sent.reload > 0 && record.sent.objective > 0),
    stats: stats !== null,
  };
  if (options.scenario === 'room-cap') return { ...common, thirteenthRejected: initial.length === 13 && joined === 12
    && rejected.length === 1 && rejected[0].errors.includes('room_full') };
  if (options.scenario === 'disconnect') return { ...common, disconnectedForThreeSeconds: reconnects.length === 1
    && hasThreeSecondOutage(initial[0], reconnects[0]), reconnectedSameSession: reconnects.length === 1
    && typeof reconnects[0].session === 'string' && reconnects[0].session.length > 0
    && reconnects[0].session === initial[0]?.session && reconnects[0].joinedAt !== null };
  if (options.scenario === 'expiry') return { ...common, seatExpired: options.seconds >= 34
    && records.some(record => record.peerLeftAt.length > 0), noReconnectAttempt: reconnects.length === 0 };
  const operational = { allRequestedJoined: initial.length === options.clients && joined === options.clients,
    ...evaluateServerQualification(stats, timing), noClientErrors: records.every(record => record.errors.length === 0),
    noBacklog: hasNoResidualBacklog(records), cleanClose: records.filter(record => record.joinedAt !== null)
      .every(record => record.closedAt !== null && record.closeCode === 1000) };
  if (options.scenario === 'impairment') return { ...common, ...operational,
    seededDropsObserved: records.some(record => record.stateFrames.dropped > 0),
    seededReorderObserved: options.stateReorderRate === 0 || records.some(record => record.stateFrames.reordered > 0) };
  if (options.scenario === 'malformed-stale') return { ...common, staleSequenceDropObserved: (stats?.drops.staleSeq ?? 0) > 0,
    malformedSeparated: records.some(record => record.errors.includes('malformed_server_frame')) || (stats?.errors ?? 0) > 0 };
  return options.scenario === 'normal' ? { ...common, ...operational } : common;
}

function summarize(options, clients, startedAt, runKind, timing = null) {
  const records = clients.map(client => client.record), stats = aggregatePerfSnapshots(records);
  const statsCoverage = evaluateStatsCoverage(stats, timing);
  const actualRtt = records.flatMap(record => record.actualRttMs), simulatedDelay = records.flatMap(record => record.simulatedStateDelayMs);
  const joined = records.filter(record => record.joinedAt !== null).length, closed = records.filter(record => record.closedAt !== null).length;
  const serverDrops = stats ? Object.values(stats.drops).reduce((sum, value) => sum + value, 0) : null;
  const checks = scenarioChecks(options, records, joined, stats, timing);
  const passed = Object.values(checks).every(Boolean);
  return { schemaVersion: 1, runKind, target: { origin: options.url, loopback: true, sharedDeployment: false }, scenario: options.scenario, requestedClients: options.clients, actualSockets: records.length, peakConcurrentSockets: peakConcurrent(records), joined, closed, durationMs: Date.now() - startedAt, measurement: timing, transport: { kind: 'WebSocket', tcpPacketLossMeasured: false }, impairment: { label: 'seeded application-state-frame loss/reorder/latency', seed: options.seed, lossRate: options.stateLossRate, reorderRate: options.stateReorderRate, latencyMs: options.latencyMs, jitterMs: options.jitterMs }, perSocket: records, aggregate: { bytesIn: records.reduce((sum, record) => sum + record.bytesIn, 0), bytesOut: records.reduce((sum, record) => sum + record.bytesOut, 0), maxSocketBacklogBytes: Math.max(0, ...records.map(record => record.maxBufferedBytes)), actualRttMs: { p50: percentile(actualRtt, .5), p95: percentile(actualRtt, .95), samples: actualRtt.length }, simulatedStateDelayMs: { p50: percentile(simulatedDelay, .5), p95: percentile(simulatedDelay, .95), samples: simulatedDelay.length }, server: stats, statsCoverage, serverDrops, serverErrors: stats?.errors ?? null, clientErrors: records.reduce((sum, record) => sum + record.errors.length, 0) }, checks, qualification: runKind === 'live' && passed ? 'PASS_LOCAL_SCENARIO' : 'UNQUALIFIED' };
}

async function runLive(options) {
  const startedAt = Date.now(), clients = [], ownedConnections = [], burst = options.scenario === 'join-burst';
  let timing = null, completed = false;
  try {
    const attempts = burst ? await Promise.allSettled(Array.from({ length: options.clients }, (_, index) => connectOne(options, index, startedAt, true, null, ownedConnections))) : [];
    if (burst) for (const attempt of attempts) { if (attempt.status === 'fulfilled') clients.push(attempt.value); else { const record = attempt.reason instanceof LoadRunError && attempt.reason.record ? attempt.reason.record : socketRecord(clients.length); record.errors.push(attempt.reason instanceof Error ? attempt.reason.message : 'join_failed'); clients.push({ record }); } }
    else for (let index = 0; index < options.clients; index++) { try { clients.push(await connectOne(options, index, startedAt, false, null, ownedConnections)); } catch (error) { const record = error instanceof LoadRunError && error.record ? error.record : socketRecord(index); record.errors.push(error instanceof Error ? error.message : 'join_failed'); clients.push({ record }); if (options.scenario !== 'room-cap') throw error; } }
    const liveClients = clients.filter(client => client.socket);
    let disconnected = false, malformedSent = false, reconnectStarted = false, reconnectPromise = null, nextStatsTick = 0;
    const startedAtEpochMs = Date.now();
    const cadence = await runAbsoluteCadence({ durationMs: options.seconds * 1000, onTick: async ({ tick }) => {
      const now = Date.now(); for (const client of liveClients) if (client.socket.readyState === WebSocket.OPEN) sendIntents(client, tick, now);
      if (tick >= nextStatsTick && liveClients[0]?.socket.readyState === WebSocket.OPEN) {
        sendStats(liveClients[0]);
        nextStatsTick = (Math.floor(tick / 20) + 1) * 20;
      }
      if (!malformedSent && options.scenario === 'malformed-stale' && tick >= 20 && liveClients[0]) {
        malformedSent = true; send(liveClients[0].record, liveClients[0].socket, '{'); send(liveClients[0].record, liveClients[0].socket, message('move', 2, {}));
      }
      if (!disconnected && (options.scenario === 'disconnect' || options.scenario === 'expiry') && tick >= 60 && liveClients[0]) {
        disconnected = true;
        requestTransportClose(liveClients[0], options.scenario === 'disconnect' ? 'intentional-3s-disconnect' : 'intentional-expiry');
      }
      if (!reconnectStarted && options.scenario === 'disconnect' && liveClients[0] && canReconnect(liveClients[0].record)) {
        reconnectStarted = true;
        reconnectPromise = connectOne(options, liveClients[0].record.index, startedAt, true, liveClients[0].allocation, ownedConnections)
          .then(reconnected => { clients.push(reconnected); liveClients.push(reconnected); })
          .catch(error => { const record = error instanceof LoadRunError && error.record ? error.record : socketRecord(liveClients[0].record.index);
            record.connectionKind = 'reconnect'; record.errors.push(error instanceof Error ? error.message : 'reconnect_failed'); clients.push({ record }); });
      }
    } });
    timing = { ...cadence, startedAtEpochMs, finishedAtEpochMs: Date.now() };
    if (reconnectPromise) await reconnectPromise;
    await sleep(1000);
    if (liveClients[0]?.socket.readyState === WebSocket.OPEN) {
      sendStats(liveClients[0]);
      await sleep(500);
    }
    completed = true;
  } finally {
    await closeOwnedConnections(ownedConnections, { reason: completed ? 'load-complete' : 'load-failed' });
  }
  return summarize(options, clients, startedAt, 'live', timing);
}

async function runFixture(options) {
  const value = JSON.parse(await readFile(resolve(options.fixture), 'utf8'));
  if (!value || typeof value !== 'object' || value.schemaVersion !== 1 || !Array.isArray(value.clients) || value.clients.length !== options.clients) throw new LoadRunError('invalid_fixture');
  const clients = value.clients.map((record, index) => ({ record: readFixtureClient(record, index) })); return summarize(options, clients, Date.now(), 'controlled-fixture');
}

export async function runLoad(options) {
  if (!options.fixture && (!options.serverLog || !options.sourceManifest)) throw new LoadRunError('missing_evidence_argument');
  const runId = randomUUID(), startedAtIso = new Date().toISOString();
  let beforeLog = null, source = null, manifest = null;
  if (!options.fixture) {
    beforeLog = await readFile(resolve(options.serverLog));
    const checkedSource = await verifySourceManifestFile(options.sourceManifest);
    manifest = checkedSource.manifest;
    const preflight = checkedSource.verification;
    source = { manifestPath: checkedSource.manifestPath, manifestSha256: checkedSource.manifestSha256, head: manifest.head,
      stageRoot: preflight.stageRoot, fileCount: preflight.fileCount, preflight };
  }
  const initial = options.fixture ? await runFixture(options) : await runLive(options);
  if (manifest) {
    const postflight = await verifySourceManifestFile(options.sourceManifest, source.manifestSha256);
    source = { ...source, postflight: postflight.verification };
  }
  const finishedAtIso = new Date().toISOString();
  const afterLog = options.fixture ? null : await readFile(resolve(options.serverLog));
  const logContinuous = beforeLog !== null && afterLog !== null && afterLog.length >= beforeLog.length
    && afterLog.subarray(0, beforeLog.length).equals(beforeLog);
  const duringLog = logContinuous ? afterLog.subarray(beforeLog.length) : Buffer.alloc(0);
  const classifiedLog = classifyServerLog(options.fixture ? null : { before: beforeLog.toString('utf8'),
    during: duringLog.toString('utf8'), expectedOrigin: options.url, expectedRequests: options.clients });
  const serverRuntime = { ...classifiedLog, available: classifiedLog.available && logContinuous, runId,
    origin: options.url, sourceManifestSha256: source?.manifestSha256 ?? null,
    reasons: [...classifiedLog.reasons, ...(!logContinuous ? ['log_replaced_or_truncated'] : [])],
    logPath: options.serverLog ? resolve(options.serverLog) : null, captureStartByte: beforeLog?.length ?? null,
    captureEndByte: afterLog?.length ?? null, capturedBytes: duringLog.length,
    capturedSha256: duringLog.length > 0 ? sha256(duringLog) : null, captureStartedAt: startedAtIso,
    captureFinishedAt: finishedAtIso };
  const checks = { ...initial.checks,
    noSimulationBacklog: serverRuntime.available && serverRuntime.simulationBacklogWarnings === 0 };
  const runIdentity = options.fixture ? null : { runId, evidenceKind: 'actual-loopback-websocket',
    startedAt: startedAtIso, finishedAt: finishedAtIso, origin: options.url,
    requestedDurationSeconds: options.seconds, sourceManifestSha256: source.manifestSha256, sourceHead: source.head };
  const report = { ...initial, schemaVersion: 2, runIdentity, serverRuntime, source, checks,
    qualification: initial.runKind === 'live' && serverRuntime.available && Object.values(checks).every(Boolean)
      ? 'PASS_LOCAL_SCENARIO' : 'UNQUALIFIED' };
  await mkdir(dirname(resolve(options.out)), { recursive: true });
  if (afterLog) {
    const logArtifactPath = resolve(options.out).replace(/\.json$/i, '') + '.server.log';
    await writeFile(logArtifactPath, afterLog);
    report.serverRuntime.logArtifact = basename(logArtifactPath);
    report.serverRuntime.logArtifactSha256 = sha256(afterLog);
  }
  await writeFile(resolve(options.out), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}
async function main() { const options = parseLoadOptions(process.argv.slice(2)); const report = await runLoad(options); console.log(JSON.stringify({ out: resolve(options.out), qualification: report.qualification, joined: report.joined, actualSockets: report.actualSockets })); }
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error instanceof LoadOptionError || error instanceof LoadRunError ? error.code : 'unexpected_load_error'); process.exitCode = 1; });
