export type LoadScenario = 'normal' | 'impairment' | 'room-cap' | 'disconnect' | 'expiry' | 'join-burst' | 'malformed-stale';
export interface LoadOptions { readonly url: string; readonly clients: number; readonly seconds: number; readonly out: string; readonly serverLog: string | null; readonly sourceManifest: string | null; readonly seed: number; readonly latencyMs: number; readonly jitterMs: number; readonly stateLossRate: number; readonly stateReorderRate: number; readonly scenario: LoadScenario; readonly fixture: string | null }
export class LoadOptionError extends Error { readonly code: string }
export function parseLoadOptions(argv: readonly string[]): LoadOptions;
export function createStateImpairment(options: { readonly seed: number; readonly latencyMs: number; readonly jitterMs: number; readonly lossRate: number; readonly reorderRate: number }): () => Readonly<{ kind: 'drop'; delayMs: 0 } | { kind: 'deliver'; delayMs: number; reordered: boolean }>;
export interface PerfStage { readonly p50: number; readonly p95: number; readonly p99: number | null; readonly max: number; readonly n: number }
export interface PerfSnapshot { readonly tick: Readonly<PerfStage>; readonly flush: Readonly<PerfStage>; readonly windowMs: number; readonly measuredAtMs: number | null; readonly measuredAtEpochMs: number | null; readonly receivedAtMs: number | null; readonly drops: Readonly<Record<string, number>>; readonly errors: number;
  readonly requestSeq?: number | null; readonly requestedAtMs?: number | null;
  readonly requestedAtMonotonicMs?: number | null; readonly receivedAtMonotonicMs?: number | null }
export function readPerfSnapshot(value: unknown): Readonly<PerfSnapshot> | null;
export function classifyServerLog(capture: unknown): Readonly<{ available: boolean; startupReady: boolean; healthReady: boolean; matchmakeRequests: number; websocketUpgrades: number; simulationBacklogWarnings: number | null; reasons: readonly string[] }>;
