const SCENARIOS = new Set(['normal', 'impairment', 'room-cap', 'disconnect', 'expiry', 'join-burst', 'malformed-stale']);
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1']);
export class LoadOptionError extends Error { constructor(code) { super(code); this.name = 'LoadOptionError'; this.code = code; } }

function finite(name, value, { min, max, integer = false }) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max || (integer && !Number.isSafeInteger(parsed))) throw new LoadOptionError(`invalid_${name}`);
  return parsed;
}

export function parseLoadOptions(argv) {
  const allowed = new Set(['--url', '--clients', '--seconds', '--out', '--server-log', '--source-manifest', '--seed', '--latency-ms', '--jitter-ms', '--state-loss-rate', '--state-reorder-rate', '--scenario', '--fixture']);
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index], value = argv[index + 1];
    if (!allowed.has(name) || value === undefined || values.has(name)) throw new LoadOptionError('invalid_argument');
    values.set(name, value);
  }
  const rawUrl = values.get('--url'), out = values.get('--out');
  if (!rawUrl || !out) throw new LoadOptionError('missing_argument');
  let url;
  try { url = new URL(rawUrl); } catch { throw new LoadOptionError('invalid_url'); }
  if (!['http:', 'https:'].includes(url.protocol) || !LOOPBACK.has(url.hostname) || url.username || url.password || url.hash) throw new LoadOptionError('loopback_required');
  const scenario = values.get('--scenario') ?? 'normal'; if (!SCENARIOS.has(scenario)) throw new LoadOptionError('invalid_scenario');
  return Object.freeze({
    url: url.origin, clients: finite('clients', values.get('--clients') ?? '12', { min: 1, max: 24, integer: true }),
    seconds: finite('seconds', values.get('--seconds') ?? '180', { min: 1, max: 1800, integer: true }), out,
    seed: finite('seed', values.get('--seed') ?? '1', { min: 0, max: 0xffffffff, integer: true }),
    latencyMs: finite('latency_ms', values.get('--latency-ms') ?? '0', { min: 0, max: 5000 }),
    jitterMs: finite('jitter_ms', values.get('--jitter-ms') ?? '0', { min: 0, max: 5000 }),
    stateLossRate: finite('state_loss_rate', values.get('--state-loss-rate') ?? '0', { min: 0, max: 1 }),
    stateReorderRate: finite('state_reorder_rate', values.get('--state-reorder-rate') ?? '0', { min: 0, max: 1 }),
    scenario, fixture: values.get('--fixture') ?? null, serverLog: values.get('--server-log') ?? null,
    sourceManifest: values.get('--source-manifest') ?? null,
  });
}

export function classifyServerLog(capture) {
  const unavailable = reasons => Object.freeze({ available: false, startupReady: false, healthReady: false,
    matchmakeRequests: 0, websocketUpgrades: 0, simulationBacklogWarnings: null, reasons });
  if (!capture || typeof capture !== 'object' || typeof capture.before !== 'string'
    || typeof capture.during !== 'string' || typeof capture.expectedOrigin !== 'string'
    || !Number.isSafeInteger(capture.expectedRequests) || capture.expectedRequests < 1) return unavailable(['invalid_capture']);
  const escapedOrigin = capture.expectedOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const startupReady = new RegExp(`Ready on ${escapedOrigin}(?:\\s|$)`).test(capture.before);
  const healthReady = /GET \/api\/health 200 (?:OK|Response)/.test(capture.before);
  const matchmakeRequests = capture.during.match(/GET \/api\/matchmake(?:\?[^ ]*)? 200 (?:OK|Response)/g)?.length ?? 0;
  const websocketUpgrades = capture.during.match(/GET \/parties\/[^ ]+ 101 Switching Protocols/g)?.length ?? 0;
  const simulationBacklogWarnings = capture.during.match(/simulation fell behind > 5 ticks/g)?.length ?? 0;
  const reasons = [
    ...(!startupReady ? ['startup_record_missing'] : []),
    ...(!healthReady ? ['health_record_missing'] : []),
    ...(matchmakeRequests < capture.expectedRequests ? ['matchmake_records_missing'] : []),
    ...(websocketUpgrades < capture.expectedRequests ? ['websocket_records_missing'] : []),
  ];
  return Object.freeze({ available: reasons.length === 0, startupReady, healthReady, matchmakeRequests,
    websocketUpgrades, simulationBacklogWarnings, reasons });
}

function mulberry32(seed) { let value = seed >>> 0; return () => { value = (value + 0x6d2b79f5) | 0; let next = Math.imul(value ^ (value >>> 15), 1 | value); next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next; return ((next ^ (next >>> 14)) >>> 0) / 4294967296; }; }

export function createStateImpairment(options) {
  const random = mulberry32(options.seed);
  return () => {
    if (options.lossRate > 0 && random() < options.lossRate) return Object.freeze({ kind: 'drop', delayMs: 0 });
    const jitter = options.jitterMs > 0 ? (random() * 2 - 1) * options.jitterMs : 0;
    const reordered = options.reorderRate > 0 && random() < options.reorderRate;
    return Object.freeze({ kind: 'deliver', delayMs: Math.max(0, options.latencyMs + jitter + (reordered ? Math.max(1, options.jitterMs * 2) : 0)), reordered });
  };
}

const finiteNumber = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export function readPerfSnapshot(value) {
  if (!value || typeof value !== 'object') return null;
  const duration = stage => stage && typeof stage === 'object' && finiteNumber(stage.p50) && finiteNumber(stage.p95)
    && (stage.p99 === undefined || finiteNumber(stage.p99)) && finiteNumber(stage.max)
    && Number.isSafeInteger(stage.n) && stage.n >= 0
    ? { p50: stage.p50, p95: stage.p95, p99: stage.p99 ?? null, max: stage.max, n: stage.n } : null;
  const tick = duration(value.tick), flush = duration(value.flush), drops = value.drops;
  const measuredAtMs = value.measuredAtMs === undefined ? null : value.measuredAtMs;
  const measuredAtEpochMs = value.measuredAtEpochMs === undefined ? null : value.measuredAtEpochMs;
  const receivedAtMs = value.receivedAtMs === undefined ? null : value.receivedAtMs;
  const dropKeys = ['rateLimited', 'staleSeq', 'oversizedBatch', 'unknownType', 'relayRateLimited', 'relayOversized', 'relayBadTarget'];
  if (!tick || !flush || !Number.isSafeInteger(value.windowMs) || value.windowMs < 1
    || measuredAtMs !== null && !finiteNumber(measuredAtMs)
    || measuredAtEpochMs !== null && (!Number.isSafeInteger(measuredAtEpochMs) || measuredAtEpochMs < 0)
    || receivedAtMs !== null && (!Number.isSafeInteger(receivedAtMs) || receivedAtMs < 0)
    || !drops || typeof drops !== 'object' || dropKeys.some(key => !Number.isSafeInteger(drops[key]) || drops[key] < 0)
    || !Number.isSafeInteger(value.errors) || value.errors < 0) return null;
  return Object.freeze({ tick, flush, windowMs: value.windowMs, measuredAtMs, measuredAtEpochMs, receivedAtMs,
    drops: Object.fromEntries(dropKeys.map(key => [key, drops[key]])), errors: value.errors });
}
