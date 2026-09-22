import type { ServerShotResult, ShotAttempt } from '../src/combat-events.js';
export const COMBAT_TELEMETRY_STAGES = [
  'input', 'handler', 'predicted_commit', 'send', 'server_receive',
  'resolve', 'receipt', 'confirmed_paint', 'audio_schedule',
] as const;
type InputKind = 'fire' | 'ads';
type InputPhase = 'press' | 'release';
type Provenance = { readonly source: 'trusted-device' | 'synthetic' | 'unknown'; readonly trusted: boolean };
type LocalStage = 'input' | 'handler' | 'predicted_commit' | 'send' | 'receipt' | 'confirmed_paint' | 'audio_schedule';
type ServerStage = 'server_receive' | 'resolve';
type Entry = {
  readonly id: string;
  readonly generation: number;
  readonly stage: (typeof COMBAT_TELEMETRY_STAGES)[number] | 'reset';
  readonly at: number;
  readonly clock: 'client-monotonic' | 'server-wall';
  readonly provenance?: Provenance;
  readonly detail?: string;
};
type InputRecord = { readonly id: string; readonly kind: InputKind; readonly phase: InputPhase; readonly at: number; readonly provenance: Provenance };
type CommandRef = string | { readonly pressedAt: number };
type ShotTrace = {
  readonly generation: number;
  readonly provenance: Provenance;
  readonly local: Partial<Record<LocalStage, number>>;
  readonly server: Partial<Record<ServerStage, number>>;
  readonly invalid: Set<string>;
  result?: ServerShotResult['kind'];
};
const MAX_BYTES = 2 * 1024 * 1024;
const EXPORT_HEADROOM = 64 * 1024;
const RETAINED_LIFECYCLES = 1024;
const percentile = (values: readonly number[], quantile: number): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * quantile))] ?? null;
};

const metric = (values: readonly number[]) => ({
  count: values.length,
  p50: percentile(values, .5),
  p95: percentile(values, .95),
  p99: percentile(values, .99),
});

export class CombatTelemetry {
  private generationValue = 1;
  private sequence = 0;
  private lastInputAt = -Infinity;
  private readonly entries: Entry[] = [];
  private entryBytes = 0;
  private readonly inputs = new Map<string, InputRecord>();
  private readonly inputOrder: string[] = [];
  private readonly pendingAds: string[] = [];
  private readonly pendingFire: string[] = [];
  private readonly traces = new Map<string, ShotTrace>();
  private readonly traceOrder: string[] = [];
  private readonly counters = {
    blocked: 0, duplicate: 0, invalid: 0, stale: 0, ignoredConfirmation: 0,
    clockReset: 0, adsTransitions: 0, evicted: 0,
  };
  private readonly rejectedConfirmations = { actual: 0, synthetic: 0, unknown: 0 };

  constructor(private readonly options: { readonly enabled?: boolean; readonly capacityBytes?: number; readonly clockUncertaintyMs?: number } = {}) {
    const capacity = options.capacityBytes ?? MAX_BYTES;
    if (!Number.isSafeInteger(capacity) || capacity < EXPORT_HEADROOM || capacity > MAX_BYTES) {
      throw new RangeError('telemetry capacity must be between 64 KiB and 2 MiB');
    }
  }

  get generation(): number { return this.generationValue; }
  private get enabled(): boolean { return this.options.enabled !== false; }
  private get capacityBytes(): number { return this.options.capacityBytes ?? MAX_BYTES; }

  captureInput(kind: InputKind, phase: InputPhase, at: number, provenance: Provenance, active: boolean): string | null {
    if (!this.enabled || !active || !Number.isFinite(at)) return null;
    if (at < this.lastInputAt) this.reset('clock_reset', at);
    this.lastInputAt = at;
    const id = `g${this.generationValue}:${kind}:${++this.sequence}`;
    const input = { id, kind, phase, at, provenance } as const;
    this.inputs.set(id, input); this.inputOrder.push(id);
    if (kind === 'ads') this.pendingAds.push(id);
    else if (phase === 'press') this.pendingFire.push(id);
    this.trimLifecycles(this.inputs, this.inputOrder);
    this.prunePending(this.pendingAds); this.prunePending(this.pendingFire);
    this.push({ id, generation: this.generationValue, stage: 'input', at, clock: 'client-monotonic', provenance });
    return id;
  }

  beginShot(attempt: ShotAttempt, command: CommandRef | null, times: { readonly handlerAt: number; readonly sendAt: number }): void {
    if (!this.enabled || this.traces.has(attempt.shotId)) { if (this.traces.has(attempt.shotId)) this.counters.duplicate += 1; return; }
    const resolvedCommandId = this.resolveFireCommand(command);
    const input = resolvedCommandId ? this.inputs.get(resolvedCommandId) : undefined;
    const provenance = input?.provenance ?? { source: 'unknown', trusted: false };
    const trace: ShotTrace = { generation: this.generationValue, provenance, local: {}, server: {}, invalid: new Set() };
    if (!input || input.kind !== 'fire' || input.phase !== 'press') this.invalidate(trace, 'missing_input');
    else trace.local.input = input.at;
    trace.local.handler = times.handlerAt;
    trace.local.send = times.sendAt;
    this.validateOrder(trace, ['input', 'handler', 'send']);
    this.retainTrace(attempt.shotId, trace);
    for (const stage of ['input', 'handler', 'send'] as const) {
      const at = trace.local[stage];
      if (at !== undefined) this.push({ id: attempt.shotId, generation: trace.generation, stage, at, clock: 'client-monotonic', provenance });
    }
  }

  predictedCommitted(shotId: string, at: number): void { this.localStage(shotId, 'predicted_commit', at); }
  audioScheduled(shotId: string, at: number): void { this.localStage(shotId, 'audio_schedule', at); }

  shotResult(result: ServerShotResult, times: { readonly receiptAt: number; readonly serverReceiveAt?: number; readonly serverResolveAt?: number }): void {
    const trace = this.traces.get(result.shotId);
    if (!trace || trace.generation !== this.generationValue) { this.counters.stale += 1; return; }
    if (trace.result !== undefined) { this.counters.duplicate += 1; return; }
    trace.result = result.kind;
    if (result.kind === 'blocked') this.counters.blocked += 1;
    this.localStage(result.shotId, 'receipt', times.receiptAt);
    if (times.serverReceiveAt !== undefined && times.serverResolveAt !== undefined) {
      trace.server.server_receive = times.serverReceiveAt; trace.server.resolve = times.serverResolveAt;
      if (!this.validPair(times.serverReceiveAt, times.serverResolveAt)) this.invalidate(trace, 'server_clock_reversed');
      for (const stage of ['server_receive', 'resolve'] as const) {
        this.push({ id: result.shotId, generation: trace.generation, stage, at: trace.server[stage]!, clock: 'server-wall' });
      }
    }
  }

  confirmed(shotId: string, stage: 'confirmed_paint', at: number): void {
    const trace = this.traces.get(shotId);
    if (!trace || trace.generation !== this.generationValue || trace.result !== 'accepted') {
      this.counters.ignoredConfirmation += 1;
      if (trace?.provenance.source === 'trusted-device' && trace.provenance.trusted) this.rejectedConfirmations.actual += 1;
      else if (trace?.provenance.source === 'synthetic' && !trace.provenance.trusted) this.rejectedConfirmations.synthetic += 1;
      else this.rejectedConfirmations.unknown += 1;
      return;
    }
    this.localStage(shotId, stage, at);
  }

  adsApplied(held: boolean, handlerAt: number, predictedAt: number): void {
    const phase = held ? 'press' : 'release';
    let index = this.pendingAds.length - 1;
    while (index >= 0 && this.inputs.get(this.pendingAds[index]!)?.phase !== phase) index -= 1;
    if (index < 0) return;
    const [id] = this.pendingAds.splice(index, 1);
    const input = id ? this.inputs.get(id) : undefined;
    if (!input || !this.validPair(input.at, handlerAt) || !this.validPair(handlerAt, predictedAt)) {
      this.counters.invalid += 1; return;
    }
    this.counters.adsTransitions += 1;
    this.push({ id: input.id, generation: this.generationValue, stage: 'handler', at: handlerAt, clock: 'client-monotonic', provenance: input.provenance });
    this.push({ id: input.id, generation: this.generationValue, stage: 'predicted_commit', at: predictedAt, clock: 'client-monotonic', provenance: input.provenance });
  }

  reset(reason: 'clock_reset' | 'reconnect' | 'round' | 'dispose', at: number): void {
    if (reason === 'clock_reset') this.counters.clockReset += 1;
    this.generationValue += 1; this.sequence = 0; this.lastInputAt = at;
    this.inputs.clear(); this.inputOrder.length = 0; this.pendingAds.length = 0; this.pendingFire.length = 0;
    this.traces.clear(); this.traceOrder.length = 0;
    this.push({ id: `g${this.generationValue}`, generation: this.generationValue, stage: 'reset', at, clock: 'client-monotonic', detail: reason });
  }

  snapshot() {
    const actual = this.collect('trusted-device', true);
    const synthetic = this.collect('synthetic', false);
    const validSamples = actual.validShots;
    return {
      schemaVersion: 1,
      generation: this.generationValue,
      maxBytes: this.capacityBytes,
      retainedBytes: this.entryBytes,
      counts: { ...this.counters },
      rejectedConfirmations: { ...this.rejectedConfirmations },
      stages: COMBAT_TELEMETRY_STAGES,
      clockPairs: {
        local: ['input→handler', 'handler→send', 'send→predicted_commit', 'send→receipt',
          'receipt→confirmed_paint', 'predicted_commit→audio_schedule'],
        server: ['server_receive→resolve'],
        crossClockSubtraction: false,
      },
      metrics: { actual, synthetic },
      hud: validSamples > 0
        ? { status: 'ready', validSamples, clockUncertaintyMs: this.options.clockUncertaintyMs ?? 1 }
        : { status: 'unavailable', validSamples: 0, clockUncertaintyMs: this.options.clockUncertaintyMs ?? 1 },
      inputProvenance: { actualRequires: { source: 'trusted-device', trusted: true }, deviceLatencyMeasured: false },
      retained: { inputs: this.inputs.size, traces: this.traces.size,
        pendingAds: this.pendingAds.length, pendingFire: this.pendingFire.length },
      events: [...this.entries],
    } as const;
  }

  csv(): string {
    const quote = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const rows = this.entries.map(entry => [entry.id, entry.generation, entry.stage, entry.at, entry.clock,
      entry.provenance?.source, entry.provenance?.trusted, entry.detail].map(quote).join(','));
    return ['id,generation,stage,at,clock,source,trusted,detail', ...rows].join('\n');
  }

  private localStage(shotId: string, stage: LocalStage, at: number): void {
    const trace = this.traces.get(shotId);
    if (!trace || trace.generation !== this.generationValue) { this.counters.stale += 1; return; }
    if (trace.local[stage] !== undefined) { this.counters.duplicate += 1; return; }
    trace.local[stage] = at;
    const before = stage === 'receipt' ? trace.local.send
      : stage === 'confirmed_paint' ? trace.local.receipt
        : stage === 'predicted_commit' ? trace.local.send
          : stage === 'audio_schedule' ? trace.local.predicted_commit : undefined;
    if (before === undefined || !this.validPair(before, at)) this.invalidate(trace, `${stage}_out_of_order`);
    this.push({ id: shotId, generation: trace.generation, stage, at, clock: 'client-monotonic', provenance: trace.provenance });
  }

  private collect(source: Provenance['source'], trusted: boolean) {
    const predicted: number[] = [], rtt: number[] = [], confirmation: number[] = [], audio: number[] = [], server: number[] = [];
    const ads = new Map<string, Set<string>>();
    for (const entry of this.entries) if (entry.generation === this.generationValue && entry.id.includes(':ads:')
      && entry.provenance?.source === source && entry.provenance.trusted === trusted
      && (entry.stage === 'handler' || entry.stage === 'predicted_commit')) {
      const stages = ads.get(entry.id) ?? new Set<string>(); stages.add(entry.stage); ads.set(entry.id, stages);
    }
    let validShots = 0;
    for (const trace of this.traces.values()) {
      const complete = (['input', 'handler', 'predicted_commit', 'send', 'receipt'] as const)
        .every(stage => trace.local[stage] !== undefined);
      if (!complete || trace.invalid.size || trace.result !== 'accepted'
        || trace.provenance.source !== source || trace.provenance.trusted !== trusted) continue;
      validShots += 1;
      this.addPair(predicted, trace.local.input, trace.local.predicted_commit);
      this.addPair(rtt, trace.local.send, trace.local.receipt);
      this.addPair(confirmation, trace.local.receipt, trace.local.confirmed_paint);
      this.addPair(audio, trace.local.predicted_commit, trace.local.audio_schedule);
      this.addPair(server, trace.server.server_receive, trace.server.resolve);
    }
    return { validShots, validAdsTransitions: [...ads.values()].filter(stages => stages.size === 2).length,
      predictedMs: metric(predicted), rttMs: metric(rtt), confirmationMs: metric(confirmation),
      audioScheduleMs: metric(audio), serverResolveMs: metric(server) };
  }

  private addPair(target: number[], before?: number, after?: number): void {
    if (before !== undefined && after !== undefined && this.validPair(before, after)) target.push(after - before);
  }

  private validPair(before: number, after: number): boolean { return Number.isFinite(before) && Number.isFinite(after) && after >= before; }
  private invalidate(trace: ShotTrace, reason: string): void { if (!trace.invalid.has(reason)) { trace.invalid.add(reason); this.counters.invalid += 1; } }
  private validateOrder(trace: ShotTrace, stages: readonly LocalStage[]): void {
    for (let index = 1; index < stages.length; index += 1) {
      const before = trace.local[stages[index - 1]!], after = trace.local[stages[index]!];
      if (before !== undefined && after !== undefined && !this.validPair(before, after)) this.invalidate(trace, 'local_clock_reversed');
    }
  }

  private retainTrace(id: string, trace: ShotTrace): void {
    this.traces.set(id, trace); this.traceOrder.push(id); this.trimLifecycles(this.traces, this.traceOrder);
  }

  private trimLifecycles<T>(map: Map<string, T>, order: string[]): void {
    while (order.length > RETAINED_LIFECYCLES) { const id = order.shift(); if (id !== undefined) map.delete(id); }
  }

  private resolveFireCommand(command: CommandRef | null): string | null {
    if (typeof command === 'string') return this.inputs.has(command) ? command : null;
    if (command) {
      const matches = [...this.inputs.values()].filter(input => input.kind === 'fire' && input.phase === 'press'
        && Math.abs(input.at - command.pressedAt) <= 8);
      if (matches.length !== 1) return null;
      const id = matches[0]!.id, pending = this.pendingFire.indexOf(id);
      if (pending >= 0) this.pendingFire.splice(pending, 1);
      return id;
    }
    return this.pendingFire.pop() ?? null;
  }

  private prunePending(queue: string[]): void {
    while (queue[0] !== undefined && !this.inputs.has(queue[0])) queue.shift();
    if (queue.length > RETAINED_LIFECYCLES) queue.splice(0, queue.length - RETAINED_LIFECYCLES);
  }

  private push(entry: Entry): void {
    const bytes = JSON.stringify(entry).length * 2 + 2;
    this.entries.push(entry); this.entryBytes += bytes;
    const limit = this.capacityBytes - EXPORT_HEADROOM;
    while (this.entryBytes > limit && this.entries.length > 0) {
      const removed = this.entries.shift()!;
      this.entryBytes -= JSON.stringify(removed).length * 2 + 2;
      this.counters.evicted += 1;
    }
  }
}
