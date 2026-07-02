import {
  PROTOCOL_VERSION,
  ClientMessageType,
  ServerMessageType,
  encode,
  decodeClientMessage,
  ProtocolError,
  type RawData,
  type ClientGameMessage,
} from "@tikron/protocol";
import { encodeFull, encodeDelta, encodeDeltaOrNull, type Codec } from "@tikron/schema";
import { RateLimiter } from "./rate-limit.js";
import { buildGrid, queryRadius, type Grid } from "./aoi-grid.js";
import { DurationRing, type PerfSnapshot } from "./perf.js";

/** A connected player, as seen by developer room code. */
export interface Client {
  /**
   * Stable client id. When the connection supplied a session key this is that
   * key (it survives reconnects); otherwise it is the transport connection id.
   */
  readonly id: string;
  /** Send a developer-defined message to just this client. */
  send(type: string, payload?: unknown): void;
  /** Scratch space for per-connection server-side data (never synced to clients). */
  readonly data: Record<string, unknown>;
  /**
   * The client's latest round-trip time in ms, as reported on its clock-sync
   * pings (0 until the first RTT-bearing ping arrives). Used by server-side lag
   * compensation to rewind hit checks to what this client saw.
   */
  readonly rttMs: number;
}

/** Minimal transport surface a Room needs; provided by the partyserver host. */
export interface RoomConnection {
  readonly id: string;
  send(data: string | ArrayBuffer | ArrayBufferView): void;
  close(code?: number, reason?: string): void;
}

/**
 * Narrow durable-storage surface a Room needs to survive Durable Object
 * eviction — a key/value store plus a single DO alarm. Wired by `defineRoom`
 * from `ctx.storage`; kept minimal so the core stays transport-agnostic and
 * testable with an in-memory fake. All values must be structured-clone-able
 * (the DO storage serialization contract).
 */
export interface RoomStorage {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
  setAlarm(scheduledTime: number): Promise<void>;
  getAlarm(): Promise<number | null>;
  deleteAlarm(): Promise<void>;
}

/** How a submitted score combines with a player's existing score on a board. */
export type ScoreMode = "max" | "sum" | "last";

/** A single server-authoritative leaderboard submission from room code. */
export interface LeaderboardSubmit {
  /** Board name (a namespace within the project); created on first submit. */
  board: string;
  /** Stable player id to attribute the score to (usually `client.id`). */
  playerId: string;
  /** The score to record. */
  score: number;
  /** Optional display name shown on the board. */
  displayName?: string;
  /** How to combine with any existing score for this player (default "max"). */
  mode?: ScoreMode;
}

/**
 * Optional platform services the host wires into a room. Kept narrow and optional
 * (like {@link RoomContext.storage} and reportOccupancy) so the core stays
 * platform-agnostic: a service is simply absent when unavailable — unit tests and
 * local dev without a database — and room code calls it optionally, e.g.
 * `this.services.leaderboard?.submit({ board: "weekly", playerId: client.id, score })`.
 */
export interface RoomServices {
  /** Per-project leaderboards backed by the platform database (write-only here). */
  leaderboard?: {
    /** Record a score (server-authoritative, fire-and-forget). */
    submit(entry: LeaderboardSubmit): void;
  };
}

/** The transport context a Room is constructed with (implemented by `defineRoom`). */
export interface RoomContext {
  readonly roomId: string;
  connections(): Iterable<RoomConnection>;
  connection(id: string): RoomConnection | undefined;
  broadcastRaw(data: string, exceptIds?: string[]): void;
  /**
   * Optional occupancy reporter (wired by the host, e.g. to a matchmaker).
   * `sessions` are the stable client ids currently holding a seat — including
   * clients inside a reconnection window. `seq` increases monotonically per
   * room so receivers can discard reports delivered out of order (reports are
   * fire-and-forget RPCs with no ordering guarantee). `messages` is the count of
   * developer messages processed since the previous report (usage metering).
   */
  reportOccupancy?(count: number, sessions: string[], seq: number, messages?: number): void;
  /**
   * Optional durable storage (the room's DO storage). When present the room
   * persists its state + seats so it can be restored after eviction, and uses
   * the DO alarm as a durable backstop that finalizes reconnection windows even
   * if the DO is evicted mid-window. Absent (e.g. in unit tests) → in-memory
   * only, exactly as before.
   */
  storage?: RoomStorage;
  /**
   * Optional platform services (leaderboards, etc.) wired by the host. Absent in
   * unit tests / local dev without a database — room code accesses them via the
   * always-present {@link Room.services} accessor and calls each optionally.
   */
  services?: RoomServices;
}

/** Shared empty services object so {@link Room.services} is never undefined. */
const NO_SERVICES: RoomServices = Object.freeze({});

/** Storage key holding a room's persisted snapshot. */
const ROOM_STORAGE_KEY = "tk:room";

/**
 * Grace window granted on restore to seats persisted while still CONNECTED
 * (deadline null — the DO died under them, so no reconnection window was ever
 * opened). Without one, a player who never returns would hold the seat forever.
 */
const RESTORE_GRACE_MS = 60_000;

/** A single seat as persisted (transport-independent, structured-clone-able). */
interface PersistedSeat {
  id: string;
  data: Record<string, unknown>;
  /** Reconnection-window deadline (epoch ms) while disconnected, else null. */
  deadline: number | null;
}

/** A room's durable snapshot. Restored on the next cold start after eviction. */
interface PersistedRoom<TState> {
  /** Snapshot-envelope format version (structural; unrelated to game state). */
  v: 1;
  /**
   * The game's state-shape version ({@link Room.stateVersion}) at persist time.
   * On restore, a mismatch routes `state` through {@link Room.migrateState}.
   * Absent in pre-versioning snapshots → treated as version 1.
   */
  stateVersion?: number;
  state: TState;
  seats: PersistedSeat[];
  occupancySeq: number;
}

/**
 * Per-input metadata handed to a message handler alongside the payload. Currently
 * carries the optional subtick timestamp; a fourth handler argument keeps the common
 * `(client, payload, seq)` shape untouched for handlers that don't need it.
 */
export interface InputMeta {
  /**
   * The input's subtick timestamp on the SERVER timeline (epoch ms), already clamped
   * to `[now - 250ms, now]` on receipt (so a client can't backdate or postdate an
   * input to cheat lag compensation). Present only when the client opted into
   * `subtickTimestamps`; otherwise undefined. Pair it with lag compensation to
   * rewind hit checks to the exact instant the shooter aimed:
   * `this.rewind(client, input.ts)`.
   */
  ts?: number;
}

export type MessageHandler = (
  client: Client,
  payload: unknown,
  seq?: number,
  input?: InputMeta,
) => void | Promise<void>;

export interface RoomInit {
  id: string;
  ctx: RoomContext;
}

/**
 * One distance band of the optional AOI priority-tier schedule. Entities within a
 * band's `radius` of the viewer refresh at most once every `interval` flushes.
 */
export interface AOITier {
  /** Inclusive outer edge of the band (world units), measured from the viewpoint. */
  radius: number;
  /**
   * Refresh cadence for entities in this band: `1` = every flush (full rate), `2`
   * = every other flush, `4` = quarter rate, etc. Must be a positive integer.
   */
  interval: number;
}

/** Configuration for the opt-in interest-management (AOI) module. */
export interface AOIConfig<TState> {
  /** View radius; entities farther than this from the viewer are filtered out. */
  viewRadius: number;
  /** State fields that are string-keyed entity maps to filter per viewer. */
  mapFields: string[];
  /** Extract an entity's world position. */
  position: (entity: unknown) => { x: number; y: number };
  /** The viewpoint position for a viewer (e.g. their own entity), or null if none. */
  viewer: (state: TState, viewerId: string) => { x: number; y: number } | null;
  /**
   * Optional priority-tier schedule (Tribes/Halo-style differential update rates):
   * concentric distance bands, ordered by **strictly ascending `radius`**, that
   * throttle how often FAR entities refresh in each viewer's delta. A near band
   * with `interval: 1` refreshes every flush; outer bands refresh less often, so a
   * 100-player fan-out sends far movement at a fraction of the tick rate — the
   * single biggest downlink lever at high CCU.
   *
   * Semantics (no visible flicker): a throttled far entity is never dropped from
   * the view — off its refresh flush the viewer simply keeps the value it already
   * has (it rides through the delta as "unchanged"), so it is always present, only
   * stale. Two events always bypass throttling and fire immediately: an entity's
   * FIRST appearance in a viewer's view (nothing to be stale from) and its removal
   * when it leaves the view radius. Per-viewer phase offsets stagger the far
   * refreshes so they do not all land on the same flush across the room.
   *
   * Leaving this unset preserves the exact byte-for-byte pre-tier behavior (every
   * in-view entity refreshes every flush).
   *
   * @example
   * // FPS preset: full rate within 250 u, quarter rate out to the 500 u view edge.
   * // Sheds ~3/4 of far-entity downlink; a mid-far player's position lags at most
   * // interval × syncIntervalMs (4 × 50 ms = 200 ms) before it catches up.
   * tiers: [
   *   { radius: 250, interval: 1 },
   *   { radius: 500, interval: 4 },
   * ]
   *
   * Trade-off: a throttled entity's position (and every other synced field) can be
   * up to `interval × syncIntervalMs` stale on the client. Keep the near band at
   * `interval: 1` so anything a player can fight is always live, and reserve the
   * throttled bands for entities far enough that a fraction-of-a-second lag is
   * imperceptible. Client-side interpolation/extrapolation hides the rest.
   */
  tiers?: AOITier[];
}

/** A precompiled AOI tier: squared radius (for distance²-only comparison) + cadence. */
interface CompiledTier {
  r2: number;
  interval: number;
}

/**
 * Validate and precompile an {@link AOIConfig.tiers} schedule into squared radii so
 * the hot path compares distance² only. Returns undefined when tiers are unset or
 * empty (the pre-tier code path is then taken verbatim). Throws with a one-line fix
 * on a non-ascending radius or a non-positive-integer interval.
 */
function compileTiers(tiers: AOITier[] | undefined): CompiledTier[] | undefined {
  if (!tiers || tiers.length === 0) return undefined;
  const compiled: CompiledTier[] = [];
  let prevRadius = -Infinity;
  for (const t of tiers) {
    if (!(t.radius > 0)) {
      throw new Error(
        `AOI tiers: radius must be > 0 (got ${t.radius}). Fix: give each band a positive outer ` +
          "radius, ordered ascending, e.g. [{ radius: 250, interval: 1 }, { radius: 500, interval: 4 }].",
      );
    }
    if (t.radius <= prevRadius) {
      throw new Error(
        `AOI tiers: radius must strictly ascend (got ${t.radius} after ${prevRadius}). Fix: order ` +
          "the bands from nearest to farthest, e.g. [{ radius: 250, interval: 1 }, { radius: 500, interval: 4 }].",
      );
    }
    if (!Number.isInteger(t.interval) || t.interval < 1) {
      throw new Error(
        `AOI tiers: interval must be a positive integer (got ${t.interval}). Fix: use 1 for every ` +
          "flush, 2 for half rate, 4 for quarter rate, etc.",
      );
    }
    prevRadius = t.radius;
    compiled.push({ r2: t.radius * t.radius, interval: t.interval });
  }
  return compiled;
}

/**
 * Stable per-viewer phase offset (FNV-1a hash of the viewer id), used to stagger
 * tiered far-entity refreshes so they do not all bunch onto the same flush across
 * the room's fan-out. Deterministic and allocation-free on the hot path.
 * @internal exported for tests to reproduce a viewer's refresh schedule.
 */
export function aoiPhase(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Binary state frame tags (first byte of a binary WebSocket frame).
const STATE_FULL = 0x01;
const STATE_DELTA = 0x02;

/**
 * Binary state-frame header, little-endian: `[tag(u8), tick(u32), serverTimeMs(f64)]`
 * (13 bytes) followed by the codec body. `tick` is the room's monotonic simulation
 * tick and `serverTimeMs` its wall clock when the frame was produced, so a client
 * interpolates on authoritative time rather than jittery receive time.
 */
const STATE_HEADER_BYTES = 13;

/** Max simulation ticks processed in one catch-up burst (spiral-of-death guard). */
const MAX_CATCHUP_TICKS = 5;

/** Trailing window the `tk:stats` timing report summarizes (ms). */
const PERF_WINDOW_MS = 10_000;

/**
 * Ring capacity for the tick/flush timing samples — comfortably covers the
 * {@link PERF_WINDOW_MS} window even at 60 Hz (600 samples/10 s), so no in-window
 * sample is ever overwritten before it can be reported.
 */
const PERF_RING_CAPACITY = 1024;

/**
 * Core-reserved developer message type: a client sends `tk:stats` to poll this
 * room's recent tick/flush timing. Handled by the core before game handlers (and
 * before the input queue) so it never collides with a room's own `onMessage`.
 */
const PERF_STATS_MESSAGE = "tk:stats";

/**
 * How far back a client-supplied subtick timestamp may sit behind server-receipt
 * time before it is clamped forward. Bounds how far lag compensation can be
 * rewound from a single input, defeating backdated-input cheats. Matches the
 * default lag-compensation history depth (250 ms).
 */
const INPUT_TS_MAX_AGE_MS = 250;

/**
 * Max developer messages in one `c:mbatch` frame. A frame carrying more is rejected
 * whole (a cheap length check) rather than partially processed, so batch semantics
 * stay all-or-nothing. This caps per-frame *dispatch* work, not parse cost — the
 * frame is already fully parsed by here, and its size is bounded upstream by the
 * Cloudflare Workers incoming-message limit (~1 MiB per WebSocket frame). Each
 * unpacked message still counts against the per-second rate limit.
 */
const INPUT_BATCH_MAX = 16;

/** Close code sent to a superseded connection when its session is taken over. */
export const CLOSE_SESSION_TAKEN_OVER = 4001;

/** Close code sent to a new connection rejected because the room is at capacity. */
export const CLOSE_ROOM_FULL = 4002;

/** Close code sent to a connection whose supplied session key failed validation. */
export const CLOSE_INVALID_SESSION = 4003;

/** Close code sent to a connection that failed player-token authentication. */
export const CLOSE_UNAUTHORIZED = 4004;

function frame(tag: number, tick: number, serverTimeMs: number, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(STATE_HEADER_BYTES + body.length);
  const view = new DataView(out.buffer);
  out[0] = tag;
  view.setUint32(1, tick >>> 0, true);
  view.setFloat64(5, serverTimeMs, true);
  out.set(body, STATE_HEADER_BYTES);
  return out;
}

/** A developer message captured for tick-aligned processing (opt-in input queue). */
interface QueuedInput {
  record: ClientRecord;
  type: string;
  payload: unknown;
  seq?: number;
  /** Clamped subtick timestamp (server timeline), if the client supplied one. */
  ts?: number;
}

/** A client's seat in the room; survives transport reconnects (session-keyed). */
interface ClientRecord {
  client: Client;
  /** Live transport connection id, or null while disconnected. */
  connId: string | null;
  /** True while an `allowReconnection` window is open for this client. */
  awaitingReconnect: boolean;
  /** The pending reconnection promise (settles once: reattach or timeout). */
  reconnectPromise: Promise<void> | null;
  reconnectResolve: (() => void) | null;
  reconnectReject: ((err: Error) => void) | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  /** Reconnection-window deadline (epoch ms) while disconnected; persisted. */
  reconnectDeadline: number | null;
  /** Latest client-reported round-trip time (ms), from its clock-sync pings. */
  lastRttMs: number;
  /**
   * Set true only on the durable alarm-expiry path (window elapsed while the DO
   * was evicted) so a re-invoked `onLeave` sees `allowReconnection` reject at
   * once and runs its cleanup, instead of opening a fresh in-memory window.
   */
  windowExpired: boolean;
}

/**
 * Genre-agnostic authoritative room core.
 *
 * The core knows nothing about ticks, movement, or interest management — those
 * are opt-in modules layered on top. A turn-based or card game uses only this
 * core (state broadcasts happen on mutation, never requiring a tick); a realtime
 * .io game additionally starts a simulation loop and calls movement validation.
 *
 * State sync uses JSON by default. Set {@link stateCodec} to a `@tikron/schema`
 * codec to switch to binary delta sync (recommended for realtime rooms).
 *
 * Clients are keyed by a **session key** when the connection provides one
 * (`?_session=` query param), falling back to the transport connection id.
 * Session keying is what makes {@link allowReconnection} possible: a client
 * that reconnects with the same session key within the window reclaims its
 * seat — `Client.id`, `client.data`, and room state keyed by the id all
 * survive the transport drop.
 */
export abstract class Room<TState = unknown> {
  /** Authoritative room state. Mutate it, then call {@link markStateChanged}. */
  protected state: TState = undefined as TState;

  /** Optional binary codec. When set, state syncs as binary deltas, not JSON. */
  protected stateCodec?: Codec<TState>;

  /** Max developer messages accepted per client per second before dropping. */
  protected maxInputsPerSecond = 30;

  /**
   * Hard seat cap enforced by the room itself (not just the matchmaker, which is
   * advisory — a client connecting directly to the room URL bypasses it). A new
   * seat that would exceed this is rejected with a `room_full` error and closed;
   * reattaching/taking over an existing seat is always allowed. Default: no cap.
   */
  protected maxClients = Infinity;

  /**
   * Interval for periodic occupancy heartbeats while the room holds any seats.
   * The matchmaker uses these to prune phantom rooms (a room DO that dies without
   * a clean final leave). No timer runs while the room is empty. Overridable so
   * tests can shorten it; set to 0 or below to disable heartbeats entirely.
   */
  protected occupancyHeartbeatMs = 30_000;

  /** When true, ack each processed input's seq (enables client reconciliation). */
  protected sendAcks = false;

  /**
   * When true, developer messages are not dispatched on arrival but queued and
   * drained — in arrival order — at the START of each simulation tick, before the
   * tick function runs. This gives `onTick` a single, consistent batch of inputs
   * per tick instead of interleaving handlers between ticks. Acks (if enabled) are
   * sent when a queued input is PROCESSED, not when received. Requires a simulation
   * interval (a non-tick room has nothing to drain the queue) — enforced at create.
   * The {@link IoArenaRoom} preset enables this.
   */
  protected queueInputs = false;

  /**
   * Minimum interval between state-sync broadcasts (trailing-edge coalescing).
   * All mutations within a window collapse into one flush at the next boundary,
   * so the broadcast rate is bounded (~20 Hz default) instead of tracking the
   * input-arrival rate — the difference between a room surviving a full lobby and
   * flooding the Durable Object's output. A turn-based room's ≤50 ms sync delay is
   * imperceptible. Set to 0 to restore immediate microtask flushing (unbounded
   * rate — only safe when some other cadence already bounds mutations).
   */
  protected syncIntervalMs = 50;

  /**
   * Max interval between durable state snapshots. State writes triggered by the
   * (possibly 20–30 Hz) sync flush are coalesced to at most one write per this
   * window; seat and reconnection-window changes persist immediately regardless.
   * Overridable so tests can shorten it.
   */
  protected persistIntervalMs = 5_000;

  /**
   * Version of this room's persisted state SHAPE. Bump it whenever `TState`
   * changes incompatibly. On a cold start, if a snapshot's recorded version
   * differs from this one, {@link migrateState} is consulted before the snapshot
   * is applied — so a redeploy that changes the state shape doesn't silently
   * restore the old shape (the pre-R2 behavior). Snapshots written before
   * versioning are treated as version 1.
   */
  protected stateVersion = 1;

  /**
   * Migrate a persisted snapshot whose {@link stateVersion} differs from the
   * current one. Return the state transformed into the current shape, or `null`
   * to DISCARD the snapshot — the room then starts fresh from `onCreate`'s state
   * and the persisted seats are dropped too (a discarded state can't seat players
   * that referenced it). The default returns `null` (discard); override it to
   * carry old rooms forward:
   *
   * ```ts
   * protected override stateVersion = 2;
   * protected override migrateState(from: number, old: unknown): MyState | null {
   *   if (from === 1) return { ...(old as V1), addedField: 0 }; // v1 → v2
   *   return null; // unknown version — start fresh
   * }
   * ```
   */
  protected migrateState(_fromVersion: number, _oldState: unknown): TState | null {
    return null;
  }

  readonly id: string;

  private readonly ctx: RoomContext;
  private readonly handlers = new Map<string, MessageHandler>();
  /** Seats, keyed by stable client id (session key or conn id). */
  private readonly records = new Map<string, ClientRecord>();
  /** Live transport connection id -> stable client id. */
  private readonly connToClient = new Map<string, string>();
  private readonly lastSeq = new Map<string, number>();
  private readonly rate = new RateLimiter();
  private readonly pendingFull = new Set<string>();
  private readonly clientBaselines = new Map<string, TState>();
  private baseline: TState | undefined;
  #aoi?: AOIConfig<TState>;
  /** Precompiled priority tiers (ascending r²), or undefined when tiers are unset. */
  #aoiTiers?: CompiledTier[];
  /** Monotonic per-working-flush counter driving the tier refresh schedule. */
  #aoiFlushSeq = 0;
  private stateFlushScheduled = false;
  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private lastTickAt = 0;
  /** Monotonic simulation-tick counter (carried on every state frame). */
  #tick = 0;
  /** True while a simulation interval is active (affects how `tick` advances). */
  #simRunning = false;
  /** Leftover time carried between fixed-step catch-up bursts. */
  #accumulatorMs = 0;
  /** Reentrancy guard so a slow tick can't overlap the next interval fire. */
  #ticking = false;
  /** One-shot flag so the spiral-of-death warning logs at most once per room. */
  #laggedWarned = false;
  /** Tick-aligned input queue (populated only when {@link queueInputs}). */
  #inputQueue: QueuedInput[] = [];
  private occupancySeq = 0;
  private messagesSinceReport = 0;
  /** Recent simulation-tick and state-flush processing times (F0 instrumentation). */
  private readonly tickDurations = new DurationRing(PERF_RING_CAPACITY);
  private readonly flushDurations = new DurationRing(PERF_RING_CAPACITY);
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(init: RoomInit) {
    this.id = init.id;
    this.ctx = init.ctx;
  }

  // --- lifecycle hooks (override in your room) ---
  onCreate(): void | Promise<void> {}
  onJoin(_client: Client): void | Promise<void> {}
  onLeave(_client: Client): void | Promise<void> {}
  /** Called when a client reattaches within an {@link allowReconnection} window. */
  onReconnect(_client: Client): void | Promise<void> {}
  onDispose(): void | Promise<void> {}
  /**
   * Called on a cold start once a persisted snapshot has been restored INTO
   * `this.state` (after any {@link migrateState}), and only when a snapshot was
   * actually applied — not on a fresh room, a missing snapshot, or a discarded
   * migration. Rebuild here any derived, in-memory index that mirrors `this.state`
   * but is not itself persisted (e.g. a spatial grid seeded in `onReady`), since
   * `onReady`/`onCreate` ran against the fresh pre-restore state. Default: no-op.
   */
  protected onRestore(): void | Promise<void> {}

  // --- core developer API ---

  /** Replace the authoritative state and schedule a sync to clients. */
  protected setState(state: TState): void {
    this.state = state;
    this.markStateChanged();
  }

  /**
   * Call after mutating `this.state` in place to sync it to clients. Flushes are
   * coalesced to at most one per {@link syncIntervalMs} (trailing edge): the first
   * change after an idle period is broadcast after the window, and every further
   * change in that window folds into the same flush. Turn-based rooms incur only
   * that ≤`syncIntervalMs` delay. With `syncIntervalMs = 0` this reverts to an
   * immediate next-microtask flush.
   */
  protected markStateChanged(): void {
    if (this.stateFlushScheduled) return;
    this.stateFlushScheduled = true;
    if (this.syncIntervalMs <= 0) {
      queueMicrotask(() => {
        this.stateFlushScheduled = false;
        this.flushState();
      });
      return;
    }
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.stateFlushScheduled = false;
      this.flushState();
    }, this.syncIntervalMs);
  }

  /** Register a handler for a developer-defined client message `type`. */
  protected onMessage(type: string, handler: MessageHandler): void {
    this.handlers.set(type, handler);
  }

  /** Send a developer-defined message to every client (optionally excluding one). */
  protected broadcast(type: string, payload?: unknown, exceptId?: string): void {
    const exceptConn = exceptId ? this.records.get(exceptId)?.connId : undefined;
    this.ctx.broadcastRaw(
      encode({ t: ServerMessageType.Message, type, payload }),
      exceptConn ? [exceptConn] : undefined,
    );
  }

  protected clientList(): Client[] {
    return [...this.records.values()].map((r) => r.client);
  }

  /**
   * Optional platform services wired by the host (e.g. leaderboards). Always an
   * object, so a service that is unavailable (unit tests, local dev without a
   * database) is a no-op when called optionally:
   * `this.services.leaderboard?.submit({ board, playerId: client.id, score })`.
   */
  protected get services(): RoomServices {
    return this.ctx.services ?? NO_SERVICES;
  }

  /** Seated clients, including any inside a reconnection window. */
  protected get clientCount(): number {
    return this.records.size;
  }

  /**
   * The room's current simulation tick — monotonic, carried on every state frame.
   * Advances once per fixed step when a simulation interval runs, otherwise once
   * per state flush. Useful for tick-stamping game events.
   */
  protected get currentTick(): number {
    return this.#tick;
  }

  /**
   * Called once when the simulation falls far enough behind that catch-up is
   * capped and the backlog is dropped (a spiral-of-death guard tripped). Override
   * to record it; the default logs a single warning. Not called again for the
   * lifetime of the room.
   */
  protected onSimulationLag(): void {}

  /**
   * Hold a disconnected client's seat open for `seconds`. Call from `onLeave`:
   *
   * ```ts
   * override async onLeave(client: Client) {
   *   try {
   *     await this.allowReconnection(client, 30); // resolves on reattach
   *   } catch {
   *     delete this.state.players[client.id];     // window expired — real leave
   *   }
   * }
   * ```
   *
   * While the window is open the client keeps its record (`Client.id`,
   * `client.data`, seat count) and peers receive no PeerLeft. On reattach the
   * server re-sends Welcome (`reconnected: true`) plus a full state snapshot,
   * and the promise resolves. On timeout it rejects and the leave finalizes.
   *
   * Requires the client to connect with a session key (`?_session=`); without
   * one the client id is the connection id, which a new transport can't reclaim.
   */
  protected allowReconnection(client: Client, seconds: number): Promise<void> {
    if (!(seconds > 0)) {
      throw new Error(
        `allowReconnection(seconds) requires seconds > 0 (got ${seconds}). Fix: pass a positive ` +
          "hold time, e.g. this.allowReconnection(client, 30), or skip it to drop the seat at once.",
      );
    }
    const record = this.records.get(client.id);
    if (!record) return Promise.reject(new Error(`unknown client: ${client.id}`));
    // Durable backstop re-invoked onLeave after the window already elapsed while
    // the DO was evicted: reject at once so room code runs its expiry cleanup.
    if (record.windowExpired) return Promise.reject(new Error("reconnection window expired"));
    // Already back (reconnected before onLeave got here) — window is satisfied.
    if (record.connId !== null) return Promise.resolve();
    if (record.reconnectPromise) return record.reconnectPromise;

    record.awaitingReconnect = true;
    record.reconnectDeadline = Date.now() + seconds * 1000;
    record.reconnectPromise = new Promise<void>((resolve, reject) => {
      record.reconnectResolve = resolve;
      record.reconnectReject = reject;
      record.reconnectTimer = setTimeout(() => {
        this.settleReconnection(record, new Error("reconnection window expired"));
      }, seconds * 1000);
    });
    // Avoid an unhandled rejection when room code doesn't await the promise
    // (the returned promise is unaffected — callers still observe rejection).
    record.reconnectPromise.catch(() => {});
    // Persist the open window + arm the DO alarm so an eviction mid-window still
    // finalizes the seat when the alarm fires on a cold-started instance.
    void this.persistNow();
    void this.syncReconnectAlarm();
    return record.reconnectPromise;
  }

  /** Settle a pending reconnection window (resolve on reattach, reject on timeout). */
  private settleReconnection(record: ClientRecord, error?: Error): void {
    if (record.reconnectTimer !== null) {
      clearTimeout(record.reconnectTimer);
      record.reconnectTimer = null;
    }
    record.awaitingReconnect = false;
    record.reconnectDeadline = null;
    const resolve = record.reconnectResolve;
    const reject = record.reconnectReject;
    record.reconnectResolve = null;
    record.reconnectReject = null;
    if (error) reject?.(error);
    else resolve?.();
    // The window closed (reattach or timeout): update the durable snapshot and
    // re-point the alarm at the next-earliest pending window (or clear it).
    void this.persistNow();
    void this.syncReconnectAlarm();
  }

  // --- opt-in Simulation module (turn-based rooms simply never call this) ---

  /**
   * Start a fixed-timestep authoritative loop (realtime games only). The interval
   * fires roughly every `intervalMs`, but `fn` is always called with a FIXED
   * `intervalMs` delta, zero-to-N times per fire, so the simulation advances
   * deterministically regardless of timer jitter: elapsed time accumulates and is
   * consumed in whole steps, carrying the remainder. A slow/backgrounded room can
   * fall behind; catch-up is capped at {@link MAX_CATCHUP_TICKS} steps and the
   * backlog dropped (a spiral-of-death guard), so a hitch never stalls the room.
   */
  protected setSimulationInterval(fn: (deltaMs: number) => void, intervalMs: number): void {
    if (intervalMs < 10) {
      // Not fatal — but sub-10ms ticks pin the Durable Object's CPU and cannot be
      // backed by DO alarms (which are unsuitable below ~1s). 20–30 Hz (33–50ms)
      // is the sweet spot for realtime rooms.
      console.warn(
        `setSimulationInterval(${intervalMs}ms) is very fast: sub-10ms ticks pin the ` +
          "Durable Object CPU and can't be alarm-backed. Fix: use ~33–50ms (20–30 Hz).",
      );
    }
    this.clearSimulationInterval();
    this.#simRunning = true;
    this.#accumulatorMs = 0;
    this.lastTickAt = Date.now();
    this.tickHandle = setInterval(() => void this.advanceSimulation(fn, intervalMs), intervalMs);
  }

  /** Consume accumulated time in fixed steps, draining queued inputs before each. */
  private async advanceSimulation(fn: (deltaMs: number) => void, intervalMs: number): Promise<void> {
    if (this.#ticking) return; // a previous (async) tick is still running — try next fire
    this.#ticking = true;
    try {
      const now = Date.now();
      this.#accumulatorMs += now - this.lastTickAt;
      this.lastTickAt = now;

      let steps = Math.floor(this.#accumulatorMs / intervalMs);
      if (steps <= 0) return;
      if (steps > MAX_CATCHUP_TICKS) {
        steps = MAX_CATCHUP_TICKS;
        this.#accumulatorMs = 0; // drop the backlog rather than spiral
        this.simulationLag();
      } else {
        this.#accumulatorMs -= steps * intervalMs;
      }

      for (let i = 0; i < steps; i++) {
        this.#tick++;
        const t0 = performance.now();
        await this.drainInputQueue(); // queued inputs process at the tick boundary
        fn(intervalMs); // always a fixed dt
        const t1 = performance.now();
        this.tickDurations.record(t1, t1 - t0); // F0: input-drain + onTick time
      }
    } finally {
      this.#ticking = false;
    }
  }

  /** Warn once, then hand off to the overridable hook. */
  private simulationLag(): void {
    if (!this.#laggedWarned) {
      this.#laggedWarned = true;
      console.warn(
        `simulation fell behind > ${MAX_CATCHUP_TICKS} ticks; dropping the backlog to avoid a ` +
          "spiral of death. Fix: lighten onTick, raise the tick interval, or reduce room load.",
      );
    }
    this.onSimulationLag();
  }

  /** Process every queued developer input in arrival order (tick-aligned inputs). */
  private async drainInputQueue(): Promise<void> {
    if (this.#inputQueue.length === 0) return;
    const batch = this.#inputQueue;
    this.#inputQueue = [];
    for (const q of batch) {
      const handler = this.handlers.get(q.type);
      if (handler) {
        await handler(q.record.client, q.payload, q.seq, q.ts !== undefined ? { ts: q.ts } : undefined);
      }
      // Ack when PROCESSED (not on receipt), addressed to the client's live conn.
      if (this.sendAcks && typeof q.seq === "number" && q.record.connId !== null) {
        this.ctx.connection(q.record.connId)?.send(encode({ t: ServerMessageType.Ack, seq: q.seq }));
      }
    }
  }

  protected clearSimulationInterval(): void {
    if (this.tickHandle !== null) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
    this.#simRunning = false;
  }

  /**
   * Opt-in interest management (AOI). Each client receives only entities within
   * `viewRadius` of its viewpoint — a bandwidth win AND a security boundary:
   * unseen entities never enter a client's packets, defeating map/wallhacks by
   * construction. Requires a {@link stateCodec}.
   */
  protected enableAOI(config: AOIConfig<TState>): void {
    if (!this.stateCodec) {
      throw new Error(
        "enableAOI() requires a binary stateCodec. Fix: this.stateCodec = schema({...}) " +
          "from @tikron/schema (AOI filters per-client binary deltas, so it needs the codec).",
      );
    }
    this.#aoi = config;
    this.#aoiTiers = compileTiers(config.tiers);
  }

  // --- internal glue (invoked by the defineRoom host; not part of the dev API) ---

  /** @internal */
  async _create(): Promise<void> {
    await this.onCreate();
    this.validateConfig();
    await this.restore();
  }

  /**
   * @internal Raise this room's seat cap — a dev/loadtest-only escape hatch the
   * host wires behind its own gate (see `defineRoom`, which honors `?maxClients=`
   * only when `DEV_MODE` is on). It never LOWERS the cap room code set, so a room's
   * production capacity is unchanged whenever the host does not call this.
   */
  _raiseMaxClients(cap: number): void {
    if (Number.isFinite(cap) && cap > this.maxClients) this.maxClients = cap;
  }

  /** Recent tick/flush timing summary — the `tk:stats` reply payload. */
  private perfSnapshot(): PerfSnapshot {
    const now = performance.now();
    return {
      tick: this.tickDurations.stats(now, PERF_WINDOW_MS),
      flush: this.flushDurations.stats(now, PERF_WINDOW_MS),
      windowMs: PERF_WINDOW_MS,
    };
  }

  /**
   * Fail fast on misconfigured knobs once `onCreate` has run (so a subclass's
   * settings are in place). Each message names what is wrong and the one-line fix.
   */
  private validateConfig(): void {
    if (!(this.maxClients >= 1)) {
      throw new Error(
        `maxClients must be >= 1 (got ${this.maxClients}). Fix: set this.maxClients to a ` +
          "positive integer in onCreate(), or leave it unset for no cap.",
      );
    }
    if (this.syncIntervalMs < 0) {
      throw new Error(
        `syncIntervalMs must be >= 0 (got ${this.syncIntervalMs}). Fix: use 50 for the default ` +
          "~20 Hz throttle, or 0 for immediate (per-mutation) flushing.",
      );
    }
    if (this.queueInputs && !this.#simRunning) {
      throw new Error(
        "queueInputs requires a simulation interval to drain the queue (otherwise queued " +
          "inputs never process). Fix: call this.setSimulationInterval(fn, ms) in onCreate " +
          "(or use the IoArenaRoom preset), or leave queueInputs = false.",
      );
    }
  }

  /** @internal */
  async _connect(conn: RoomConnection, session?: string): Promise<void> {
    const clientId = session && session.length > 0 ? session : conn.id;
    const existing = this.records.get(clientId);

    if (existing) {
      await this.reattach(existing, clientId, conn);
      return;
    }

    // A NEW seat is subject to the capacity cap; reattach/takeover (handled
    // above) never counts as new, so a reconnecting player is never locked out.
    if (this.records.size >= this.maxClients) {
      conn.send(
        encode({
          t: ServerMessageType.Error,
          code: "room_full",
          message: "room is at capacity",
        }),
      );
      conn.close(CLOSE_ROOM_FULL, "room is at capacity");
      return;
    }

    const record: ClientRecord = {
      client: this.makeClient(clientId),
      connId: conn.id,
      awaitingReconnect: false,
      reconnectPromise: null,
      reconnectResolve: null,
      reconnectReject: null,
      reconnectTimer: null,
      reconnectDeadline: null,
      lastRttMs: 0,
      windowExpired: false,
    };
    this.records.set(clientId, record);
    this.connToClient.set(conn.id, clientId);

    conn.send(
      encode({
        t: ServerMessageType.Welcome,
        connectionId: clientId,
        room: this.id,
        protocol: PROTOCOL_VERSION,
        peers: this.peersOf(clientId),
      }),
    );

    this.sendInitialState(conn);

    await this.onJoin(record.client);
    this.ctx.broadcastRaw(encode({ t: ServerMessageType.PeerJoined, connectionId: clientId }), [
      conn.id,
    ]);
    this.reportOccupancy();
    void this.persistNow(); // new seat — persist promptly, not on the coalesced timer
  }

  /** Attach a new transport connection to an existing seat (reconnect/takeover). */
  private async reattach(record: ClientRecord, clientId: string, conn: RoomConnection): Promise<void> {
    if (record.connId !== null) {
      // Session takeover: a newer connection claims the seat (tab duplicated, or
      // a zombie socket the server hasn't noticed dropping). Detach the old conn
      // first so its close event can't finalize the seat, then close it.
      const old = this.ctx.connection(record.connId);
      this.connToClient.delete(record.connId);
      this.pendingFull.delete(record.connId);
      this.clientBaselines.delete(record.connId);
      this.rate.forget(record.connId);
      old?.close(CLOSE_SESSION_TAKEN_OVER, "session taken over by a new connection");
    }

    record.connId = conn.id;
    this.connToClient.set(conn.id, clientId);
    // The transport is new: its input seq counter may have restarted. Reset the
    // replay floor rather than dropping every input after a page reload.
    this.lastSeq.delete(clientId);
    this.settleReconnection(record);
    record.reconnectPromise = null;

    conn.send(
      encode({
        t: ServerMessageType.Welcome,
        connectionId: clientId,
        room: this.id,
        protocol: PROTOCOL_VERSION,
        peers: this.peersOf(clientId),
        reconnected: true,
      }),
    );

    this.sendInitialState(conn);
    await this.onReconnect(record.client);
    // Peers never saw a PeerLeft for this client, so no PeerJoined either.
  }

  /** Send the current state to a newly attached connection (full snapshot). */
  private sendInitialState(conn: RoomConnection): void {
    if (this.state === undefined) return;
    if (this.stateCodec) {
      // Deliver a full binary snapshot on the next flush (avoids a mid-stream
      // baseline mismatch for clients that join between deltas).
      this.pendingFull.add(conn.id);
      this.markStateChanged();
    } else {
      conn.send(
        encode({
          t: ServerMessageType.State,
          state: this.state,
          tick: this.#tick,
          serverTime: Date.now(),
        }),
      );
    }
  }

  private peersOf(clientId: string): string[] {
    return [...this.records.keys()].filter((id) => id !== clientId);
  }

  /** @internal */
  async _message(conn: RoomConnection, raw: RawData): Promise<void> {
    let msg;
    try {
      msg = decodeClientMessage(raw);
    } catch (err) {
      conn.send(
        encode({
          t: ServerMessageType.Error,
          code: "bad_message",
          message: err instanceof ProtocolError ? err.message : "invalid message",
        }),
      );
      return;
    }

    // Clock-sync ping: answer immediately with the server's time (cheap, unseated).
    if (msg.t === ClientMessageType.Time) {
      conn.send(encode({ t: ServerMessageType.Time, t0: msg.t0, serverTime: Date.now() }));
      // Track the client's reported RTT (if any) for server-side lag compensation.
      if (typeof msg.rtt === "number" && msg.rtt >= 0) {
        const cid = this.connToClient.get(conn.id);
        const rec = cid ? this.records.get(cid) : undefined;
        if (rec) rec.lastRttMs = msg.rtt;
      }
      return;
    }

    // Core routes only developer messages (single `c:msg` or a `c:mbatch` of them).
    if (msg.t !== ClientMessageType.Message && msg.t !== ClientMessageType.MessageBatch) return;

    const clientId = this.connToClient.get(conn.id);
    const record = clientId ? this.records.get(clientId) : undefined;
    if (!clientId || !record || record.connId !== conn.id) return;

    // Batch: unpack and run each inner message through the same per-message path
    // (rate limit, seq/ack, dispatch). A frame over the cap is rejected whole (cheap
    // length check) so batch handling stays all-or-nothing rather than silently
    // truncating a client's inputs.
    if (msg.t === ClientMessageType.MessageBatch) {
      const inner = Array.isArray(msg.msgs) ? msg.msgs : [];
      if (inner.length > INPUT_BATCH_MAX) return; // oversized batch dropped
      for (let i = 0; i < inner.length; i++) {
        const m = inner[i];
        if (m && m.t === ClientMessageType.Message && typeof m.type === "string") {
          await this.processGameMessage(conn, clientId, record, m);
        }
      }
      return;
    }

    await this.processGameMessage(conn, clientId, record, msg);
  }

  /**
   * Handle one developer message — the shared path for a standalone `c:msg` and for
   * each message unpacked from a `c:mbatch`. Applies the per-second rate limit (one
   * count per message), the core timing poll, and the seq replay guard, then either
   * queues the input for the next tick or dispatches it immediately (with its ack).
   */
  private async processGameMessage(
    conn: RoomConnection,
    clientId: string,
    record: ClientRecord,
    msg: ClientGameMessage,
  ): Promise<void> {
    if (!this.rate.allow(conn.id, Date.now(), this.maxInputsPerSecond)) return; // dropped

    // Core-reserved timing poll: answered only AFTER the seat + rate-limit checks
    // (so an unseated or flooding client can't drive the perfSnapshot cost), and
    // handled before the input queue / game handlers so it never collides with a
    // room's own onMessage(type). Not billable and does not consume the seq.
    if (msg.type === PERF_STATS_MESSAGE) {
      conn.send(
        encode({ t: ServerMessageType.Message, type: PERF_STATS_MESSAGE, payload: this.perfSnapshot() }),
      );
      return;
    }

    if (typeof msg.seq === "number") {
      const last = this.lastSeq.get(clientId) ?? 0;
      if (msg.seq <= last) return; // stale / replayed input
      this.lastSeq.set(clientId, msg.seq);
    }

    this.messagesSinceReport++; // billable inbound developer message (passed rate/seq checks)

    // Subtick timestamp: clamp a client-supplied `ts` to [now-250ms, now] on the
    // server timeline, so a client can neither backdate nor postdate an input to
    // move lag-compensation rewind outside the recent window.
    let ts: number | undefined;
    if (typeof msg.ts === "number") {
      const now = Date.now();
      ts = Math.min(now, Math.max(now - INPUT_TS_MAX_AGE_MS, msg.ts));
    }

    // Tick-aligned queue: defer dispatch (and the ack) to the next simulation tick,
    // so onTick sees a consistent batch. Otherwise dispatch + ack immediately.
    if (this.queueInputs) {
      this.#inputQueue.push({ record, type: msg.type, payload: msg.payload, seq: msg.seq, ts });
      return;
    }

    const handler = this.handlers.get(msg.type);
    if (handler) {
      await handler(record.client, msg.payload, msg.seq, ts !== undefined ? { ts } : undefined);
    }

    if (this.sendAcks && typeof msg.seq === "number") {
      conn.send(encode({ t: ServerMessageType.Ack, seq: msg.seq }));
    }
  }

  /** @internal */
  async _close(conn: RoomConnection): Promise<void> {
    const clientId = this.connToClient.get(conn.id);
    this.connToClient.delete(conn.id);
    this.pendingFull.delete(conn.id);
    this.clientBaselines.delete(conn.id);
    this.rate.forget(conn.id);

    if (!clientId) return; // detached earlier (e.g. superseded by a takeover)
    const record = this.records.get(clientId);
    if (!record || record.connId !== conn.id) return;

    record.connId = null;
    try {
      await this.onLeave(record.client); // room code may open a reconnection window
    } catch {
      // A throwing onLeave (e.g. an un-caught allowReconnection timeout) must
      // not leak the seat — finalization below still runs exactly once.
    }

    // If room code opened a window without awaiting it, wait for the outcome
    // here so there is exactly one finalization point.
    if (record.reconnectPromise) {
      try {
        await record.reconnectPromise;
      } catch {
        // window expired — fall through to finalize
      }
    }
    if (record.connId !== null) return; // client reattached — seat lives on

    await this.finalizeLeave(clientId, record);
  }

  /** Remove a seat for good: PeerLeft, occupancy report, dispose-if-empty. */
  private async finalizeLeave(clientId: string, record: ClientRecord): Promise<void> {
    if (this.records.get(clientId) !== record) return; // already finalized
    this.records.delete(clientId);
    this.lastSeq.delete(clientId);
    // Drop any not-yet-drained queued inputs from this now-departed client.
    if (this.#inputQueue.length > 0) {
      this.#inputQueue = this.#inputQueue.filter((q) => q.record !== record);
    }

    this.ctx.broadcastRaw(encode({ t: ServerMessageType.PeerLeft, connectionId: clientId }));
    this.reportOccupancy();

    if (this.records.size === 0) {
      this.#inputQueue = [];
      this.clearSimulationInterval();
      this.clearHeartbeat();
      this.clearFlushTimer(); // no recipients left — drop any pending flush
      // Room is empty and disposing: drop its durable snapshot + any pending
      // alarm so a future room reusing this id (DO) cold-starts clean.
      await this.clearPersisted();
      await this.onDispose();
    } else {
      void this.persistNow(); // seat removed — keep the snapshot current
    }
  }

  private reportOccupancy(): void {
    this.ctx.reportOccupancy?.(
      this.records.size,
      [...this.records.keys()],
      ++this.occupancySeq,
      this.messagesSinceReport,
    );
    this.messagesSinceReport = 0;
    this.syncHeartbeat();
  }

  /** Run the occupancy heartbeat iff the room is occupied; idempotent. */
  private syncHeartbeat(): void {
    const shouldRun = this.records.size > 0 && this.occupancyHeartbeatMs > 0;
    if (shouldRun && this.heartbeatTimer === null) {
      this.heartbeatTimer = setInterval(() => this.reportOccupancy(), this.occupancyHeartbeatMs);
    } else if (!shouldRun) {
      this.clearHeartbeat();
    }
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private clearFlushTimer(): void {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.stateFlushScheduled = false;
  }

  // --- durable persistence (no-op when the host wires no storage) ---

  /** Coalesce a state snapshot to at most one write per {@link persistIntervalMs}. */
  private schedulePersist(): void {
    if (!this.ctx.storage || this.persistTimer !== null) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.persistNow();
    }, this.persistIntervalMs);
  }

  /** Write the current state + seats snapshot now, cancelling any coalesced write. */
  private async persistNow(): Promise<void> {
    const storage = this.ctx.storage;
    if (this.persistTimer !== null) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    if (!storage || this.state === undefined) return;
    const snapshot: PersistedRoom<TState> = {
      v: 1,
      stateVersion: this.stateVersion,
      state: this.state,
      seats: [...this.records.values()].map((r) => ({
        id: r.client.id,
        data: r.client.data,
        deadline: r.reconnectDeadline,
      })),
      occupancySeq: this.occupancySeq,
    };
    try {
      await storage.put(ROOM_STORAGE_KEY, snapshot);
    } catch {
      // Best-effort: a failed persist just means a cold start restores an older
      // snapshot (or none). The live in-memory room is unaffected.
    }
  }

  /** Drop the durable snapshot + pending alarm when the room disposes (empty). */
  private async clearPersisted(): Promise<void> {
    const storage = this.ctx.storage;
    if (this.persistTimer !== null) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    if (!storage) return;
    try {
      await storage.delete(ROOM_STORAGE_KEY);
      await storage.deleteAlarm();
    } catch {
      // ignore
    }
  }

  /**
   * Restore a snapshot after a cold start (DO eviction). Seats come back as
   * disconnected records — a reconnecting client reclaims one via {@link reattach},
   * and any whose window already elapsed is finalized by {@link _alarm}. Only
   * `this.state` and each `client.data` survive; ad-hoc room-instance fields do
   * not (persist anything durable through `this.state`).
   */
  private async restore(): Promise<void> {
    const storage = this.ctx.storage;
    if (!storage) return;
    let snapshot: PersistedRoom<TState> | undefined;
    try {
      snapshot = await storage.get<PersistedRoom<TState>>(ROOM_STORAGE_KEY);
    } catch {
      return;
    }
    if (!snapshot || snapshot.v !== 1) return;

    // Route a shape-version mismatch through migrateState before applying it.
    // Pre-versioning snapshots have no stateVersion → treat as version 1.
    const persistedVersion = snapshot.stateVersion ?? 1;
    if (persistedVersion !== this.stateVersion) {
      const migrated = this.migrateState(persistedVersion, snapshot.state);
      if (migrated === null) {
        // Discard: keep the fresh onCreate-seeded state and drop the persisted
        // seats too (they referenced a state shape that no longer exists).
        console.warn(
          `Discarded a persisted snapshot: state version ${persistedVersion} != current ` +
            `${this.stateVersion} and migrateState returned null. The room starts fresh and its ` +
            "persisted seats are dropped. Fix: override migrateState(fromVersion, oldState) to " +
            "transform the old shape, or accept the reset.",
        );
        return;
      }
      this.state = migrated;
    } else {
      this.state = snapshot.state;
    }
    // State is now the restored one — let room code rebuild any derived in-memory
    // index that mirrors it (onReady/onCreate ran against the pre-restore state).
    await this.onRestore();

    this.occupancySeq = snapshot.occupancySeq;
    for (const seat of snapshot.seats) {
      // Every restored seat is disconnected and must eventually expire: seats
      // persisted mid-window keep their deadline; seats persisted while still
      // connected get a fresh grace window instead of lingering forever.
      const deadline = seat.deadline ?? Date.now() + RESTORE_GRACE_MS;
      this.records.set(seat.id, {
        client: this.makeClient(seat.id, seat.data),
        connId: null,
        awaitingReconnect: true,
        reconnectPromise: null,
        reconnectResolve: null,
        reconnectReject: null,
        reconnectTimer: null,
        reconnectDeadline: deadline,
        lastRttMs: 0,
        windowExpired: false,
      });
    }
    // Resume heartbeats for a restored-but-occupied room, and make sure the alarm
    // matches the restored windows (defensive — the DO alarm persists on its own).
    this.syncHeartbeat();
    await this.syncReconnectAlarm();
  }

  /** Point the single DO alarm at the earliest pending reconnection deadline. */
  private async syncReconnectAlarm(): Promise<void> {
    const storage = this.ctx.storage;
    if (!storage) return;
    let earliest: number | null = null;
    for (const r of this.records.values()) {
      if (r.connId === null && r.reconnectDeadline !== null) {
        earliest = earliest === null ? r.reconnectDeadline : Math.min(earliest, r.reconnectDeadline);
      }
    }
    try {
      if (earliest === null) {
        await storage.deleteAlarm();
      } else {
        const current = await storage.getAlarm();
        if (current === null || current > earliest) await storage.setAlarm(earliest);
      }
    } catch {
      // ignore
    }
  }

  /**
   * @internal Durable reconnection-window backstop. Fires from the DO alarm (even
   * on a cold-started instance after eviction): finalizes every seat whose window
   * has elapsed — running the room's expiry cleanup via `onLeave` — then re-points
   * the alarm at the next pending window.
   */
  async _alarm(): Promise<void> {
    const now = Date.now();
    for (const [id, record] of [...this.records]) {
      if (record.connId !== null || record.reconnectDeadline === null) continue;
      if (record.reconnectDeadline > now) continue;
      record.windowExpired = true;
      try {
        await this.onLeave(record.client); // expiry branch runs (allowReconnection rejects)
      } catch {
        // finalize regardless
      }
      if (record.reconnectPromise) {
        try {
          await record.reconnectPromise;
        } catch {
          // window expired — fall through
        }
      }
      if (this.records.get(id) === record && record.connId === null) {
        await this.finalizeLeave(id, record);
      }
    }
    await this.syncReconnectAlarm();
  }

  private makeClient(clientId: string, data: Record<string, unknown> = {}): Client {
    const room = this;
    return {
      id: clientId,
      data,
      get rttMs(): number {
        return room.records.get(clientId)?.lastRttMs ?? 0;
      },
      send: (type, payload) => {
        const connId = this.records.get(clientId)?.connId;
        if (!connId) return; // disconnected (possibly inside a reconnection window)
        this.ctx.connection(connId)?.send(encode({ t: ServerMessageType.Message, type, payload }));
      },
    };
  }

  private flushState(): void {
    if (this.state === undefined) return;
    const t0 = performance.now();
    try {
      this.flushStateInner();
    } finally {
      const t1 = performance.now();
      this.flushDurations.record(t1, t1 - t0); // F0: state-flush processing time
    }
  }

  /** The flush body proper; timed by {@link flushState}. */
  private flushStateInner(): void {
    // A tick room advances its counter in the sim loop; a non-tick room advances
    // it once per flush so every state frame still carries a monotonic tick.
    if (!this.#simRunning) this.#tick++;
    const tick = this.#tick;
    const serverTime = Date.now();
    this.schedulePersist(); // coalesced durable snapshot (state changed)
    const codec = this.stateCodec;

    if (!codec) {
      this.ctx.broadcastRaw(
        encode({ t: ServerMessageType.State, state: this.state, tick, serverTime }),
      );
      return;
    }

    if (this.#aoi) {
      this.flushAOI(codec, tick, serverTime);
      return;
    }

    const changed = this.baseline === undefined || !codec.equals(this.baseline, this.state);
    if (!changed && this.pendingFull.size === 0) return;

    let fullFrame: Uint8Array | undefined;
    let deltaFrame: Uint8Array | undefined;
    for (const conn of this.ctx.connections()) {
      if (this.pendingFull.has(conn.id)) {
        fullFrame ??= frame(STATE_FULL, tick, serverTime, encodeFull(codec, this.state));
        conn.send(fullFrame);
      } else if (changed) {
        deltaFrame ??= frame(STATE_DELTA, tick, serverTime, encodeDelta(codec, this.baseline, this.state));
        conn.send(deltaFrame);
      }
    }

    this.pendingFull.clear();
    // Binary path has a codec, so snapshot the baseline with the same codec-shaped
    // value copy the AOI path uses (cheaper than structuredClone). The JSON path
    // above returns before here — it has no codec and never reaches this.
    this.baseline = codec.clone(this.state);
  }

  /** Per-client filtered binary sync when AOI is enabled (each client differs). */
  private flushAOI(codec: Codec<TState>, tick: number, serverTime: number): void {
    const aoi = this.#aoi!;
    const state = this.state as Record<string, unknown>;

    // Global change-guard (mirrors the non-AOI path): if nothing in the whole room
    // changed since the last flush — and no client is owed a full snapshot — skip
    // the grid build AND the entire per-viewer loop. An idle room then costs one
    // O(entities) equals per flush instead of the full O(viewers×entities) sweep.
    if (
      this.baseline !== undefined &&
      this.pendingFull.size === 0 &&
      codec.equals(this.baseline, this.state)
    ) {
      return;
    }

    // Per-working-flush counter driving the tier schedule (advanced only past the
    // change-guard, so idle flushes never consume a schedule slot). Stays 0 — and
    // the whole tier path inert — when no tiers are configured (byte-for-byte parity).
    const flushSeq = this.#aoiTiers ? this.#aoiFlushSeq++ : 0;

    // Build one spatial-hash grid per filtered field for THIS flush (cell side =
    // viewRadius), so each viewer's filter is a 3×3 neighborhood scan instead of
    // a full O(entities) sweep — the naive scan was O(viewers×entities).
    const grids = new Map<string, Grid>();
    for (const field of aoi.mapFields) {
      const map = state[field] as Record<string, unknown> | undefined;
      if (map) grids.set(field, buildGrid(map, aoi.position, aoi.viewRadius));
    }

    for (const conn of this.ctx.connections()) {
      const viewerId = this.connToClient.get(conn.id) ?? conn.id;
      const prev = this.clientBaselines.get(conn.id);
      const view = this.aoiView(viewerId, grids, prev, flushSeq);
      if (this.pendingFull.has(conn.id) || prev === undefined) {
        conn.send(frame(STATE_FULL, tick, serverTime, encodeFull(codec, view)));
      } else {
        // One pass: emit a delta, or null when this viewer's view is unchanged
        // (skip the send) — replacing the old equals-then-encodeDelta two-pass.
        const delta = encodeDeltaOrNull(codec, prev, view);
        if (delta !== null) conn.send(frame(STATE_DELTA, tick, serverTime, delta));
      }
      // Snapshot the view as a codec-shaped VALUE copy, not the live entity
      // references queryRadius shares (aoi-grid returns them straight from state):
      // storing those refs would let the next tick's in-place mutation corrupt this
      // baseline, making a moved entity look unchanged. codec.clone walks only the
      // codec's own shape — far cheaper than a blanket structuredClone.
      this.clientBaselines.set(conn.id, codec.clone(view));
    }
    this.pendingFull.clear();
    // Maintain the global baseline for the next flush's change-guard: one clone per
    // flush (not per viewer).
    this.baseline = codec.clone(this.state);
  }

  /**
   * The AOI-filtered state a specific viewer is allowed to see, using the
   * per-flush grids. Without tiers this is a naive circle scan: each filtered field
   * becomes the entities within `viewRadius` of the viewpoint (empty if the viewer
   * has no viewpoint), non-map fields pass through unchanged.
   *
   * With tiers configured (and a prior baseline `prev` for this viewer), far
   * off-schedule entities are rewritten back to their baseline value so they drop
   * out of the delta — see {@link applyTiers}. `prev === undefined` (a viewer's
   * first frame, which is sent in full) always yields the untouched fresh view.
   */
  private aoiView(
    viewerId: string,
    grids: Map<string, Grid>,
    prev: TState | undefined,
    flushSeq: number,
  ): TState {
    const aoi = this.#aoi!;
    const out: Record<string, unknown> = { ...(this.state as Record<string, unknown>) };
    const vp = aoi.viewer(this.state, viewerId);
    const tiers = this.#aoiTiers;
    // One id hash per viewer per flush; only needed when a tier throttle can apply.
    const phase = tiers && vp && prev !== undefined ? aoiPhase(viewerId) : 0;
    const prevState = prev as Record<string, unknown> | undefined;
    for (const field of aoi.mapFields) {
      const grid = grids.get(field);
      const fresh = vp && grid ? queryRadius(grid, vp, aoi.viewRadius, aoi.position) : {};
      if (tiers && vp && prevState !== undefined) {
        const prevField = prevState[field] as Record<string, unknown> | undefined;
        this.applyTiers(fresh, prevField, vp, phase, flushSeq, tiers);
      }
      out[field] = fresh;
    }
    return out as TState;
  }

  /**
   * Apply the priority-tier throttle to one viewer's freshly filtered field, in
   * place. An entity already in the viewer's baseline (`prevField`) that sits in a
   * throttled band and is NOT due this flush has its value replaced by that baseline
   * value, so the map codec sees it as unchanged and omits it from the delta —
   * "stale but present", no add/remove flicker. Entities new to this viewer (absent
   * from `prevField`) and near-band entities are left fresh, so first appearances
   * and close-range motion are never delayed. Distance uses squared radii only.
   */
  private applyTiers(
    fresh: Record<string, unknown>,
    prevField: Record<string, unknown> | undefined,
    vp: { x: number; y: number },
    phase: number,
    flushSeq: number,
    tiers: CompiledTier[],
  ): void {
    if (prevField === undefined) return;
    const position = this.#aoi!.position;
    const farInterval = tiers[tiers.length - 1]!.interval;
    for (const id in fresh) {
      if (!(id in prevField)) continue; // new to this viewer — appear immediately
      const p = position(fresh[id]);
      const dx = p.x - vp.x;
      const dy = p.y - vp.y;
      const d2 = dx * dx + dy * dy;
      // Innermost band whose radius still contains the entity; beyond the last
      // band (but within viewRadius) falls to the farthest band's cadence.
      let interval = farInterval;
      for (let i = 0; i < tiers.length; i++) {
        if (d2 <= tiers[i]!.r2) {
          interval = tiers[i]!.interval;
          break;
        }
      }
      if (interval <= 1) continue; // full-rate band — always fresh
      if ((flushSeq + phase) % interval === 0) continue; // due this flush — refresh
      fresh[id] = prevField[id]!; // off schedule — hold the baseline value (stale)
    }
  }
}
