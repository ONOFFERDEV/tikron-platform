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

function frame(tag: number, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(body.length + 1);
  out[0] = tag;
  out.set(body, 1);
  return out;
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
 */
export abstract class Room<TState = unknown> {
  /** Authoritative room state. Mutate it, then call {@link markStateChanged}. */
  protected state: TState = undefined as TState;

  /** Optional binary codec. When set, state syncs as binary deltas, not JSON. */
  protected stateCodec?: Codec<TState>;

  /** Max developer messages accepted per client per second before dropping. */
  protected maxInputsPerSecond = 30;

  /** When true, ack each processed input's seq (enables client reconciliation). */
  protected sendAcks = false;

  readonly id: string;

  private readonly ctx: RoomContext;
  private readonly handlers = new Map<string, MessageHandler>();
  private readonly clients = new Map<string, Client>();
  private readonly lastSeq = new Map<string, number>();
  private readonly rate = new RateLimiter();
  private readonly pendingFull = new Set<string>();
  private readonly clientBaselines = new Map<string, TState>();
  private baseline: TState | undefined;
  private aoi?: AOIConfig<TState>;
  private stateFlushScheduled = false;
  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private lastTickAt = 0;

  constructor(init: RoomInit) {
    this.id = init.id;
    this.ctx = init.ctx;
  }

  // --- lifecycle hooks (override in your room) ---
  onCreate(): void | Promise<void> {}
  onJoin(_client: Client): void | Promise<void> {}
  onLeave(_client: Client): void | Promise<void> {}
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
    this.ctx.broadcastRaw(
      encode({ t: ServerMessageType.Message, type, payload }),
      exceptId ? [exceptId] : undefined,
    );
  }

  protected clientList(): Client[] {
    return [...this.clients.values()];
  }

  protected get clientCount(): number {
    return this.clients.size;
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
  async _connect(conn: RoomConnection): Promise<void> {
    const client = this.makeClient(conn);
    this.clients.set(conn.id, client);

    const peers = [...this.ctx.connections()].map((c) => c.id).filter((id) => id !== conn.id);
    conn.send(
      encode({
        t: ServerMessageType.Welcome,
        connectionId: conn.id,
        room: this.id,
        protocol: PROTOCOL_VERSION,
        peers,
      }),
    );

    if (this.state !== undefined) {
      if (this.stateCodec) {
        // Deliver a full binary snapshot on the next flush (avoids a mid-stream
        // baseline mismatch for clients that join between deltas).
        this.pendingFull.add(conn.id);
        this.markStateChanged();
      } else {
        conn.send(encode({ t: ServerMessageType.State, state: this.state }));
      }
    }

    await this.onJoin(client);
    this.ctx.broadcastRaw(encode({ t: ServerMessageType.PeerJoined, connectionId: conn.id }), [
      conn.id,
    ]);
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

    const client = this.clients.get(conn.id);
    if (!client) return;

    if (!this.rate.allow(conn.id, Date.now(), this.maxInputsPerSecond)) return; // dropped

    if (typeof msg.seq === "number") {
      const last = this.lastSeq.get(conn.id) ?? 0;
      if (msg.seq <= last) return; // stale / replayed input
      this.lastSeq.set(conn.id, msg.seq);
    }

    const handler = this.handlers.get(msg.type);
    if (handler) await handler(client, msg.payload, msg.seq);

    if (this.sendAcks && typeof msg.seq === "number") {
      conn.send(encode({ t: ServerMessageType.Ack, seq: msg.seq }));
    }
  }

  /** @internal */
  async _close(conn: RoomConnection): Promise<void> {
    const client = this.clients.get(conn.id);
    this.clients.delete(conn.id);
    this.lastSeq.delete(conn.id);
    this.pendingFull.delete(conn.id);
    this.clientBaselines.delete(conn.id);
    this.rate.forget(conn.id);

    if (client) await this.onLeave(client);
    this.ctx.broadcastRaw(encode({ t: ServerMessageType.PeerLeft, connectionId: conn.id }), [
      conn.id,
    ]);

    if (this.clients.size === 0) {
      this.clearSimulationInterval();
      await this.onDispose();
    }
  }

  private makeClient(conn: RoomConnection): Client {
    return {
      id: conn.id,
      data: {},
      send: (type, payload) => {
        conn.send(encode({ t: ServerMessageType.Message, type, payload }));
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
      const view = this.aoiFilter(conn.id);
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
