export interface ConnectionTiming {
  readonly connectRequestedAtMonotonicMs?: number | null;
  readonly openedAtMonotonicMs?: number | null;
  readonly joinedAtMonotonicMs?: number | null;
  readonly closeRequestedAtMonotonicMs?: number | null;
  readonly transportUnusableAtMonotonicMs?: number | null;
  readonly closedAtMonotonicMs?: number | null;
  readonly closeReadyState?: number | null;
}
export interface SocketFixtureRecord extends ConnectionTiming {
  readonly index: number;
  readonly connectionKind: 'initial' | 'reconnect';
  readonly session: string | null;
  readonly connectionId: string | null;
  readonly openedAt: number | null;
  readonly joinedAt: number | null;
  readonly closedAt: number | null;
  readonly closeCode: number | null;
  readonly closeReason: string | null;
  readonly bytesIn: number;
  readonly bytesOut: number;
  readonly maxBufferedBytes: number;
  readonly finalBufferedBytes: number | null;
  readonly sent: Readonly<Record<string, number>>;
  readonly acks: number;
  readonly stateFrames: Readonly<Record<string, number>>;
  readonly actualRttMs: readonly number[];
  readonly simulatedStateDelayMs: readonly number[];
  readonly errors: readonly string[];
  readonly peerLeftAt: readonly number[];
  readonly perf?: unknown;
  readonly perfSnapshots: readonly unknown[];
}

export interface CapacityTiming {
  readonly startedAtMonotonicMs: number;
  readonly finishedAtMonotonicMs: number;
  readonly intervalMs: number;
  readonly scheduledTicks: number;
  readonly executedTicks: number;
  readonly skippedTicks: number;
  readonly maxLatenessMs: number;
  readonly observedActiveMs: number;
  readonly overrunMs: number;
  readonly effectiveHz: number;
  readonly startedAtEpochMs?: number;
  readonly finishedAtEpochMs?: number;
}

export interface CapacityPerfStage { readonly p50: number; readonly p95: number; readonly p99: number | null; readonly max: number; readonly n: number }
export interface CapacityPerfSnapshot { readonly tick: CapacityPerfStage; readonly flush: CapacityPerfStage; readonly windowMs: number; readonly measuredAtMs: number | null; readonly measuredAtEpochMs: number | null; readonly receivedAtMs: number | null; readonly drops: Readonly<Record<string, number>>; readonly errors: number;
  readonly requestSeq?: number | null; readonly requestedAtMs?: number | null;
  readonly requestedAtMonotonicMs?: number | null; readonly receivedAtMonotonicMs?: number | null }
export interface CapacityPerfAggregate extends CapacityPerfSnapshot { readonly snapshotCount: number; readonly series: readonly Readonly<{ socketIndex: number | null; snapshotIndex: number; snapshot: CapacityPerfSnapshot }>[] }

export function runAbsoluteCadence(options: Readonly<{
  durationMs: number;
  intervalMs?: number;
  now?: () => number;
  wait?: (milliseconds: number) => Promise<void>;
  onTick: (tick: Readonly<{ tick: number; scheduledAt: number; actualAt: number }>) => Promise<void> | void;
}>): Promise<Readonly<CapacityTiming>>;
export function aggregatePerfSnapshots(records: readonly Readonly<{ index?: number; perf?: CapacityPerfSnapshot; perfSnapshots?: readonly CapacityPerfSnapshot[] }>[]): CapacityPerfAggregate | null;
export { evaluateStatsCoverage } from './ironsight-load-timing.mjs';
export function evaluateServerQualification(stats: CapacityPerfSnapshot | CapacityPerfAggregate | null, timing?: Readonly<{ startedAtEpochMs?: number; finishedAtEpochMs?: number }> | null): Readonly<Record<string, boolean>>;
export function scenarioChecks(options: Readonly<{ scenario: string; seconds: number; clients: number; stateReorderRate?: number }>, records: readonly Readonly<{
  connectionKind: 'initial' | 'reconnect'; openedAt?: number | null; joinedAt: number | null; closedAt: number | null;
  closeCode?: number | null; finalBufferedBytes?: number | null; sent: Readonly<Record<string, number>>; errors: readonly string[];
  stateFrames?: Readonly<Record<string, number>>; session?: string | null; peerLeftAt?: readonly number[];
} & ConnectionTiming>[], joined: number, stats: CapacityPerfAggregate | null, timing: Pick<CapacityTiming, 'observedActiveMs' | 'scheduledTicks' | 'executedTicks' | 'skippedTicks'> & Readonly<{ startedAtEpochMs?: number; finishedAtEpochMs?: number }> | null): Readonly<Record<string, boolean>>;

export function closeOwnedConnections(connections: readonly Readonly<{
  socket: { readyState: number; close(code: number, reason: string): void };
  closed: Promise<void>;
  record: { errors: string[] };
}>[], options?: Readonly<{ timeoutMs?: number; wait?: (milliseconds: number) => Promise<void>; reason?: string }>): Promise<Readonly<{ attempted: number; closed: number; timedOut: number }>>;
export function verifyManifestFiles(manifest: unknown, readBytes?: (path: string) => Promise<Uint8Array>): Promise<Readonly<{ stageRoot: string; fileCount: number; mismatches: readonly never[]; verifiedAt: string }>>;
export function verifySourceManifestFile(manifestPath: string, expectedManifestSha256?: string | null, dependencies?: Readonly<{ readManifest?: (path: string) => Promise<Uint8Array>; verifyFiles?: typeof verifyManifestFiles }>): Promise<Readonly<{ manifest: unknown; manifestPath: string; manifestSha256: string; verification: Readonly<{ stageRoot: string; fileCount: number; mismatches: readonly never[]; verifiedAt: string }> }>>;

export function readFixtureClient(value: unknown, index: number): SocketFixtureRecord;
export function hasNoResidualBacklog(records: readonly Readonly<{
  joinedAt: number | null;
  closedAt: number | null;
  maxBufferedBytes: number;
  finalBufferedBytes: number | null;
}>[]): boolean;
