import {
  PROTOCOL_VERSION,
  ClientMessageType,
  ServerMessageType,
  encode,
  decodeClientMessage,
  ProtocolError,
  type RawData,
} from "@tikron/protocol";
import { encodeFull, encodeDelta, type Codec } from "@tikron/schema";
import { RateLimiter } from "./rate-limit.js";

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
  v: 1;
  state: TState;
  seats: PersistedSeat[];
  occupancySeq: number;
}

export type MessageHandler = (
  client: Client,
  payload: unknown,
  seq?: number,
) => void | Promise<void>;

export interface RoomInit {
  id: string;
  ctx: RoomContext;
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
}

// Binary state frame tags (first byte of a binary WebSocket frame).
const STATE_FULL = 0x01;
const STATE_DELTA = 0x02;

/** Close code sent to a superseded connection when its session is taken over. */
export const CLOSE_SESSION_TAKEN_OVER = 4001;

/** Close code sent to a new connection rejected because the room is at capacity. */
export const CLOSE_ROOM_FULL = 4002;

/** Close code sent to a connection whose supplied session key failed validation. */
export const CLOSE_INVALID_SESSION = 4003;

/** Close code sent to a connection that failed player-token authentication. */
export const CLOSE_UNAUTHORIZED = 4004;

function frame(tag: number, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(body.length + 1);
  out[0] = tag;
  out.set(body, 1);
  return out;
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
  private stateFlushScheduled = false;
  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private lastTickAt = 0;
  private occupancySeq = 0;
  private messagesSinceReport = 0;
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

  /** Start a fixed-timestep authoritative loop. Realtime games only. */
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
    this.lastTickAt = Date.now();
    this.tickHandle = setInterval(() => {
      const now = Date.now();
      const dt = now - this.lastTickAt;
      this.lastTickAt = now;
      fn(dt);
    }, intervalMs);
  }

  protected clearSimulationInterval(): void {
    if (this.tickHandle !== null) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
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
  }

  // --- internal glue (invoked by the defineRoom host; not part of the dev API) ---

  /** @internal */
  async _create(): Promise<void> {
    await this.onCreate();
    this.validateConfig();
    await this.restore();
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
      conn.send(encode({ t: ServerMessageType.State, state: this.state }));
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

    if (msg.t !== ClientMessageType.Message) return; // core routes only developer messages

    const clientId = this.connToClient.get(conn.id);
    const record = clientId ? this.records.get(clientId) : undefined;
    if (!clientId || !record || record.connId !== conn.id) return;

    if (!this.rate.allow(conn.id, Date.now(), this.maxInputsPerSecond)) return; // dropped

    if (typeof msg.seq === "number") {
      const last = this.lastSeq.get(clientId) ?? 0;
      if (msg.seq <= last) return; // stale / replayed input
      this.lastSeq.set(clientId, msg.seq);
    }

    this.messagesSinceReport++; // billable inbound developer message (passed rate/seq checks)
    const handler = this.handlers.get(msg.type);
    if (handler) await handler(record.client, msg.payload, msg.seq);

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

    this.ctx.broadcastRaw(encode({ t: ServerMessageType.PeerLeft, connectionId: clientId }));
    this.reportOccupancy();

    if (this.records.size === 0) {
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

    this.state = snapshot.state;
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
    return {
      id: clientId,
      data,
      send: (type, payload) => {
        const connId = this.records.get(clientId)?.connId;
        if (!connId) return; // disconnected (possibly inside a reconnection window)
        this.ctx.connection(connId)?.send(encode({ t: ServerMessageType.Message, type, payload }));
      },
    };
  }

  private flushState(): void {
    if (this.state === undefined) return;
    this.schedulePersist(); // coalesced durable snapshot (state changed)
    const codec = this.stateCodec;

    if (!codec) {
      this.ctx.broadcastRaw(encode({ t: ServerMessageType.State, state: this.state }));
      return;
    }

    if (this.#aoi) {
      this.flushAOI(codec);
      return;
    }

    const changed = this.baseline === undefined || !codec.equals(this.baseline, this.state);
    if (!changed && this.pendingFull.size === 0) return;

    let fullFrame: Uint8Array | undefined;
    let deltaFrame: Uint8Array | undefined;
    for (const conn of this.ctx.connections()) {
      if (this.pendingFull.has(conn.id)) {
        fullFrame ??= frame(STATE_FULL, encodeFull(codec, this.state));
        conn.send(fullFrame);
      } else if (changed) {
        deltaFrame ??= frame(STATE_DELTA, encodeDelta(codec, this.baseline, this.state));
        conn.send(deltaFrame);
      }
    }

    this.pendingFull.clear();
    this.baseline = structuredClone(this.state);
  }

  /** Per-client filtered binary sync when AOI is enabled (each client differs). */
  private flushAOI(codec: Codec<TState>): void {
    for (const conn of this.ctx.connections()) {
      const viewerId = this.connToClient.get(conn.id) ?? conn.id;
      const view = this.aoiFilter(viewerId);
      const prev = this.clientBaselines.get(conn.id);
      if (this.pendingFull.has(conn.id) || prev === undefined) {
        conn.send(frame(STATE_FULL, encodeFull(codec, view)));
      } else if (!codec.equals(prev, view)) {
        conn.send(frame(STATE_DELTA, encodeDelta(codec, prev, view)));
      }
      this.clientBaselines.set(conn.id, structuredClone(view));
    }
    this.pendingFull.clear();
  }

  /** Build the AOI-filtered state a specific viewer is allowed to see. */
  private aoiFilter(viewerId: string): TState {
    const aoi = this.#aoi!;
    const state = this.state as Record<string, unknown>;
    const out: Record<string, unknown> = { ...state };
    const vp = aoi.viewer(this.state, viewerId);
    const r2 = aoi.viewRadius * aoi.viewRadius;

    for (const field of aoi.mapFields) {
      const map = state[field] as Record<string, unknown> | undefined;
      if (!map) continue;
      const filtered: Record<string, unknown> = {};
      if (vp) {
        for (const [k, v] of Object.entries(map)) {
          const p = aoi.position(v);
          const dx = p.x - vp.x;
          const dy = p.y - vp.y;
          if (dx * dx + dy * dy <= r2) filtered[k] = v;
        }
      }
      out[field] = filtered;
    }
    return out as TState;
  }
}
