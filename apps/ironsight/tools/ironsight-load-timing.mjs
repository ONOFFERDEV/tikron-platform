import { readPerfSnapshot } from './ironsight-load-options.mjs';

const timestamp = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const epoch = value => Number.isSafeInteger(value) && value >= 0;

export function createStatsProbe(record, { monotonicNow = () => performance.now(), epochNow = Date.now } = {}) {
  let pending = null;
  return {
    request(requestSeq, transmit) {
      if (pending !== null) { record.errors.push('stats_request_pending'); return false; }
      pending = { requestSeq, requestedAtMs: epochNow(), requestedAtMonotonicMs: monotonicNow() };
      transmit();
      return true;
    },
    receive(payload) {
      const receivedAtMonotonicMs = monotonicNow(), receivedAtMs = epochNow();
      if (pending === null) { record.errors.push('unmatched_tk_stats'); return; }
      const snapshot = readPerfSnapshot({ ...payload, ...pending, receivedAtMs, receivedAtMonotonicMs });
      pending = null;
      if (snapshot === null) { record.errors.push('invalid_tk_stats'); return; }
      record.perf = snapshot;
      record.perfSnapshots.push(snapshot);
    },
  };
}

export function requestTransportClose(connection, reason, now = () => performance.now()) {
  const wasOpen = connection.socket.readyState === 1;
  connection.record.closeRequestedAtMonotonicMs = now();
  connection.socket.close(1000, reason);
  connection.record.closeReadyState = connection.socket.readyState;
  if (wasOpen && connection.socket.readyState >= 2) connection.record.transportUnusableAtMonotonicMs = now();
}

export function canReconnect(record, now = performance.now()) {
  return timestamp(record.transportUnusableAtMonotonicMs) && now - record.transportUnusableAtMonotonicMs >= 3000;
}

export function hasThreeSecondOutage(initial, reconnect) {
  if (!initial || !reconnect) return false;
  const requested = initial.closeRequestedAtMonotonicMs, unusable = initial.transportUnusableAtMonotonicMs;
  const attempt = reconnect.connectRequestedAtMonotonicMs, opened = reconnect.openedAtMonotonicMs;
  const joined = reconnect.joinedAtMonotonicMs;
  return [requested, unusable, attempt, opened, joined].every(timestamp)
    && [2, 3].includes(initial.closeReadyState) && unusable >= requested
    && attempt - unusable >= 3000 && opened >= attempt && joined >= opened;
}

export function evaluateStatsCoverage(stats, timing) {
  const activeStart = timing?.startedAtMonotonicMs, activeEnd = timing?.finishedAtMonotonicMs;
  const epochStart = timing?.startedAtEpochMs, epochEnd = timing?.finishedAtEpochMs;
  const observedActiveMs = timing?.observedActiveMs;
  const timingClocksAvailable = timestamp(activeStart) && timestamp(activeEnd) && activeEnd >= activeStart
    && epoch(epochStart) && epoch(epochEnd) && epochEnd >= epochStart && timestamp(observedActiveMs);
  const activeClockSpanConsistent = timingClocksAvailable
    && Math.abs((epochEnd - epochStart) - observedActiveMs) <= 1000
    && Math.abs((activeEnd - activeStart) - observedActiveMs) <= 1000;
  const series = stats?.series;
  const timestampsAvailable = timingClocksAvailable && Array.isArray(series) && series.length > 0
    && series.every(({ snapshot: sample }) => timestamp(sample.measuredAtMs) && epoch(sample.measuredAtEpochMs)
      && epoch(sample.requestedAtMs) && epoch(sample.receivedAtMs)
      && Number.isSafeInteger(sample.requestSeq) && sample.requestSeq > 0
      && timestamp(sample.requestedAtMonotonicMs) && timestamp(sample.receivedAtMonotonicMs)
      && sample.receivedAtMonotonicMs >= sample.requestedAtMonotonicMs
      && Number.isSafeInteger(sample.windowMs) && sample.windowMs > 0
      && sample.receivedAtMonotonicMs - sample.requestedAtMonotonicMs < sample.windowMs);
  const empty = { covered: false, timingModel: 'causal-request-reply-v1', timestampsAvailable,
    activeClockSpanConsistent, clockProgressConsistent: false, gapCount: null, validWindowCount: 0,
    serverTickRateAvailable: false, serverTickRate20Hz: false, serverTickWindowCount: 0,
    serverTickHzMin: null, serverTickHzMax: null, maxRoundTripUncertaintyMs: null,
    activeStartEpochMs: epochStart ?? null, activeEndEpochMs: epochEnd ?? null,
    activeStartMonotonicMs: activeStart ?? null, activeEndMonotonicMs: activeEnd ?? null,
    coveredUntilMonotonicMs: null };
  if (!timestampsAvailable || !activeClockSpanConsistent) return empty;
  const ordered = [...series].sort((left, right) => left.snapshot.receivedAtMonotonicMs - right.snapshot.receivedAtMonotonicMs);
  const previousBySocket = new Map();
  const clockProgressConsistent = ordered.every((entry, index) => {
    const current = entry.snapshot, previousRequest = previousBySocket.get(entry.socketIndex);
    previousBySocket.set(entry.socketIndex, current);
    if (previousRequest && (current.requestSeq <= previousRequest.requestSeq
      || current.requestedAtMonotonicMs < previousRequest.receivedAtMonotonicMs)) return false;
    if (index === 0) return true;
    const prior = ordered[index - 1].snapshot;
    const monotonicDelta = current.measuredAtMs - prior.measuredAtMs;
    const epochDelta = current.measuredAtEpochMs - prior.measuredAtEpochMs;
    return monotonicDelta > 0 && epochDelta > 0 && Math.abs(monotonicDelta - epochDelta) <= 1000;
  });
  const maxRoundTripUncertaintyMs = Math.max(...series.map(({ snapshot }) =>
    snapshot.receivedAtMonotonicMs - snapshot.requestedAtMonotonicMs));
  if (!clockProgressConsistent) return { ...empty, maxRoundTripUncertaintyMs };
  // The server measures after this request and before its reply. Only the inner interval is guaranteed covered.
  const intervals = series.filter(entry => entry.snapshot.tick.n > 0 && entry.snapshot.flush.n > 0)
    .map(({ snapshot }) => ({ start: snapshot.receivedAtMonotonicMs - snapshot.windowMs,
      end: snapshot.requestedAtMonotonicMs }))
    .sort((left, right) => left.start - right.start || left.end - right.end);
  let coveredUntil = activeStart, gapCount = 0;
  for (const interval of intervals) {
    if (interval.end < activeStart || interval.start > activeEnd) continue;
    if (interval.start > coveredUntil) gapCount += 1;
    if (interval.start <= coveredUntil) coveredUntil = Math.max(coveredUntil, interval.end);
  }
  if (coveredUntil < activeEnd) gapCount += 1;
  // Rate attribution requires the entire possible outer window to lie within the active period.
  const fullWindows = series.filter(({ snapshot }) => snapshot.requestedAtMonotonicMs - snapshot.windowMs >= activeStart
    && snapshot.receivedAtMonotonicMs <= activeEnd);
  const rates = fullWindows.map(({ snapshot }) => snapshot.tick.n * 1000 / snapshot.windowMs);
  return { ...empty, covered: gapCount === 0 && coveredUntil >= activeEnd, clockProgressConsistent: true,
    gapCount, validWindowCount: intervals.length, maxRoundTripUncertaintyMs,
    serverTickRateAvailable: fullWindows.length > 0,
    serverTickRate20Hz: fullWindows.length > 0 && fullWindows.every(({ snapshot }) =>
      Math.abs(snapshot.tick.n - snapshot.windowMs / 50) <= 1),
    serverTickWindowCount: fullWindows.length, serverTickHzMin: rates.length ? Math.min(...rates) : null,
    serverTickHzMax: rates.length ? Math.max(...rates) : null, coveredUntilMonotonicMs: coveredUntil };
}
