import {
  PROTOCOL_VERSION,
  ClientMessageType,
  ServerMessageType,
  encode,
  decodeClientMessage,
  ProtocolError,
  type RawData,
} from "@playedge/protocol";
import { encodeFull, encodeDelta, type Codec } from "@playedge/schema";
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
   * fire-and-forget RPCs with no ordering guarantee).
   */
  reportOccupancy?(count: number, sessions: string[], seq: number): void;
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
}

/**
 * Genre-agnostic authoritative room core.
 *
 * The core knows nothing about ticks, movement, or interest management — those
 * are opt-in modules layered on top. A turn-based or card game uses only this
 * core (state broadcasts happen on mutation, never requiring a tick); a realtime
 * .io game additionally starts a simulation loop and calls movement validation.
 *
 * State sync uses JSON by default. Set {@link stateCodec} to a `@playedge/schema`
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
  private aoi?: AOIConfig<TState>;
  private stateFlushScheduled = false;
  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private lastTickAt = 0;
  private occupancySeq = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

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

  /** Call after mutating `this.state` in place to sync it to clients (coalesced). */
  protected markStateChanged(): void {
    if (this.stateFlushScheduled) return;
    this.stateFlushScheduled = true;
    queueMicrotask(() => {
      this.stateFlushScheduled = false;
      this.flushState();
    });
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
    const record = this.records.get(client.id);
    if (!record) return Promise.reject(new Error(`unknown client: ${client.id}`));
    // Already back (reconnected before onLeave got here) — window is satisfied.
    if (record.connId !== null) return Promise.resolve();
    if (record.reconnectPromise) return record.reconnectPromise;

    record.awaitingReconnect = true;
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
    return record.reconnectPromise;
  }

  /** Settle a pending reconnection window (resolve on reattach, reject on timeout). */
  private settleReconnection(record: ClientRecord, error?: Error): void {
    if (record.reconnectTimer !== null) {
      clearTimeout(record.reconnectTimer);
      record.reconnectTimer = null;
    }
    record.awaitingReconnect = false;
    const resolve = record.reconnectResolve;
    const reject = record.reconnectReject;
    record.reconnectResolve = null;
    record.reconnectReject = null;
    if (error) reject?.(error);
    else resolve?.();
  }

  // --- opt-in Simulation module (turn-based rooms simply never call this) ---

  /** Start a fixed-timestep authoritative loop. Realtime games only. */
  protected setSimulationInterval(fn: (deltaMs: number) => void, intervalMs: number): void {
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
    this.aoi = config;
  }

  // --- internal glue (invoked by the defineRoom host; not part of the dev API) ---

  /** @internal */
  async _create(): Promise<void> {
    await this.onCreate();
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
      await this.onDispose();
    }
  }

  private reportOccupancy(): void {
    this.ctx.reportOccupancy?.(this.records.size, [...this.records.keys()], ++this.occupancySeq);
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

  private makeClient(clientId: string): Client {
    return {
      id: clientId,
      data: {},
      send: (type, payload) => {
        const connId = this.records.get(clientId)?.connId;
        if (!connId) return; // disconnected (possibly inside a reconnection window)
        this.ctx.connection(connId)?.send(encode({ t: ServerMessageType.Message, type, payload }));
      },
    };
  }

  private flushState(): void {
    if (this.state === undefined) return;
    const codec = this.stateCodec;

    if (!codec) {
      this.ctx.broadcastRaw(encode({ t: ServerMessageType.State, state: this.state }));
      return;
    }

    if (this.aoi) {
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
    const aoi = this.aoi!;
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
