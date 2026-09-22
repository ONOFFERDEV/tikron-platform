import type { CapacityPerfAggregate, CapacityTiming, ConnectionTiming } from './ironsight-load.mjs';
import type { PerfSnapshot } from './ironsight-load-options.mjs';

export interface StatsCoverage {
  readonly covered: boolean;
  readonly timingModel: 'causal-request-reply-v1';
  readonly timestampsAvailable: boolean;
  readonly activeClockSpanConsistent: boolean;
  readonly clockProgressConsistent: boolean;
  readonly gapCount: number | null;
  readonly validWindowCount: number;
  readonly serverTickRateAvailable: boolean;
  readonly serverTickRate20Hz: boolean;
  readonly serverTickWindowCount: number;
  readonly serverTickHzMin: number | null;
  readonly serverTickHzMax: number | null;
  readonly maxRoundTripUncertaintyMs: number | null;
  readonly activeStartEpochMs: number | null;
  readonly activeEndEpochMs: number | null;
  readonly activeStartMonotonicMs: number | null;
  readonly activeEndMonotonicMs: number | null;
  readonly coveredUntilMonotonicMs: number | null;
}

export function evaluateStatsCoverage(stats: CapacityPerfAggregate | null,
  timing: Partial<CapacityTiming> | null): StatsCoverage;
export function createStatsProbe(record: { errors: string[]; perfSnapshots: PerfSnapshot[]; perf?: PerfSnapshot | null },
  clock?: Readonly<{ monotonicNow?: () => number; epochNow?: () => number }>): Readonly<{
    request(requestSeq: number, transmit: () => void): boolean;
    receive(payload: unknown): void;
  }>;
export function requestTransportClose(connection: Readonly<{
  socket: { readonly readyState: number; close(code: number, reason: string): void };
  record: { -readonly [Key in keyof ConnectionTiming]: ConnectionTiming[Key] };
}>, reason: string, now?: () => number): void;
export function canReconnect(record: ConnectionTiming, now?: number): boolean;
export function hasThreeSecondOutage(initial: ConnectionTiming | null | undefined,
  reconnect: ConnectionTiming | null | undefined): boolean;
