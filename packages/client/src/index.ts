import {
  ClientMessageType,
  ServerMessageType,
  encode,
  decodeServerMessage,
  type ClientMessage,
  type ClientGameMessage,
  type ServerMessage,
  type WelcomeMessage,
  type ErrorMessage,
  type RawData,
} from "@tikron/protocol";
import { decodeFull, applyDelta, type Codec } from "@tikron/schema";
import {
  createPartySocketTransport,
  type Transport,
  type TransportFactory,
  type ReconnectOptions,
} from "./transport.js";
import { ClockSync } from "./clock.js";
import { withNetworkConditions, type NetworkConditions } from "./net-conditions.js";

export type { Transport, TransportFactory, TransportOptions, ReconnectOptions } from "./transport.js";
export {
  createPartySocketTransport,
  reconnectDelay,
  shouldReconnectAfterClose,
  installReconnectJitter,
} from "./transport.js";
export { InputPredictor, SnapshotBuffer } from "./netcode.js";
export type { Predictable, Snapshot } from "./netcode.js";
export { ClockSync } from "./clock.js";
export type { ClockSyncOptions } from "./clock.js";
export { withNetworkConditions } from "./net-conditions.js";
export type { NetworkConditions } from "./net-conditions.js";

/** Warn once (not per room) when the dev network simulator is active. */
let networkConditionsWarned = false;

/** Warn once when subtick timestamps are requested without clock sync to back them. */
let subtickClockWarned = false;

export type ServerMessageHandler = (message: ServerMessage) => void;
export type PayloadHandler = (payload: unknown) => void;
export type StateHandler = (state: unknown) => void;
export type Unsubscribe = () => void;

/**
 * Rejection thrown by {@link GameClient.joinOrCreate} (and anything awaiting
 * {@link Room.connected}) when the socket closes or errors BEFORE the server sends
 * its Welcome frame — the join failed rather than the room going live. `code` is the
 * server Error frame's code when one arrived before the close (e.g. `"room_full"`
 * ahead of a 4002 close), otherwise `"connection-closed"`. Catch it to route the
 * player to another room or surface a message instead of hanging on `joinOrCreate`.
 */
export class RoomJoinError extends Error {
  /** Pre-Welcome server Error code (e.g. `"room_full"`), else `"connection-closed"`. */
  readonly code: string;
  constructor(code: string, message?: string) {
    super(message ?? `room join failed: ${code}`);
    this.name = "RoomJoinError";
    this.code = code;
  }
}

export interface GameClientOptions {
  /** Party (Durable Object binding) name. Defaults to "game-room". */
  party?: string;
  /** API key for multi-tenant routing (forwarded as `?apiKey=`). */
  apiKey?: string;
  /** Player auth token (JWT); forwarded as `?_auth=` for the room's onAuth hook. */
  authToken?: string;
  /** WebSocket implementation for non-browser environments (e.g. the `ws` package). */
  WebSocketPolyfill?: unknown;
  /** Binary state codec (from `@tikron/schema`) matching the room's server codec. */
  stateCodec?: Codec<unknown>;
  /** Disable automatic clock synchronization (`room.clock` stays at offset 0). */
  disableClockSync?: boolean;
  /**
   * Stamp each `send()` with a subtick timestamp (the estimated server-clock time of
   * the input, via {@link ClockSync}) so the room can rewind lag compensation to the
   * exact moment of the input rather than the tick boundary (the CS2 subtick model).
   * Off by default; enable for FPS-grade hit registration. Requires clock sync.
   */
  subtickTimestamps?: boolean;
  /**
   * Coalesce every `send()` in a fixed window of this many ms — opened by the first
   * buffered input and closed that many ms later — into a single WebSocket frame,
   * cutting the server's inbound request rate (headroom under the Durable Object soft
   * limit). 0 (default) sends each input immediately. For FPS input rates 16–33ms
   * (about one simulation tick) is a good window; inputs still flush instantly on
   * `leave()`. A window carrying one input ships as a plain `c:msg`.
   *
   * Only enable against a server that understands the `c:mbatch` frame (a room built
   * with this SDK's matching `@tikron/server`). An older server that predates batching
   * rejects the unknown frame, so every multi-input window is DROPPED — the inputs are
   * silently lost. Leave this off (0) when targeting such a server.
   */
  inputBatchMs?: number;
  /** Reconnection backoff policy (defaults: 500ms base, doubling, 5 retries + jitter). */
  reconnect?: ReconnectOptions;
  /**
   * Dev-only: wrap the transport in a simulated bad network (latency/jitter/loss) to
   * test how the game feels under adverse conditions. Leave unset in production.
   */
  networkConditions?: NetworkConditions;
  /** Override the transport factory. Primarily for tests. */
  createTransport?: TransportFactory;
}

/**
 * A live connection to a single room. Wraps a {@link Transport}, decodes the
 * authoritative message stream, and tracks room state: `state` sync
 * (`onStateChange`), developer messages (`send`/`onMessage(type)`), presence, input
 * acks (`onAck`), and clock sync. Client-side prediction and interpolation are
 * opt-in helpers ({@link InputPredictor}, {@link SnapshotBuffer}).
 */
export class Room {
  connectionId: string | null = null;
  readonly name: string;

  /** Latest authoritative state from the server (undefined until first sync). */
  state: unknown = undefined;

  /** Last input seq the server has acknowledged (0 until the first ack). */
  lastAckSeq = 0;

  /** Simulation tick of the most recent authoritative state (0 until first sync). */
  lastStateTick = 0;

  /** Server time (epoch ms) stamped on the most recent state, or null if absent. */
  lastStateServerTime: number | null = null;

  /**
   * Clock synchronization against the server. `clock.serverNow()` places snapshots
   * on the server's timeline for jitter-free interpolation; `clock.offsetMs` /
   * `clock.rttMs` expose the estimates. Runs automatically unless disabled.
   */
  readonly clock: ClockSync;

  private readonly transport: Transport;
  private readonly rawHandlers = new Set<ServerMessageHandler>();
  private readonly typeHandlers = new Map<string, Set<PayloadHandler>>();
  private readonly stateHandlers = new Set<StateHandler>();
  private readonly ackHandlers = new Set<(seq: number) => void>();
  private readonly welcome: Promise<WelcomeMessage>;
  /** True once the welcome promise has settled (resolved on Welcome or rejected). */
  private welcomeSettled = false;
  /** A server Error frame seen BEFORE Welcome, surfaced in a join rejection. */
  private preWelcomeError: ErrorMessage | null = null;
  /** Reject side of {@link welcome}; wired in the constructor. */
  private failWelcome: (err: RoomJoinError) => void = () => {};
  private readonly stateCodec?: Codec<unknown>;
  private readonly clockEnabled: boolean;
  private readonly subtickTimestamps: boolean;
  private readonly inputBatchMs: number;
  /** Buffered developer messages awaiting the batch window flush (empty when off). */
  private readonly inputBatch: ClientGameMessage[] = [];
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;

  constructor(
    name: string,
    transport: Transport,
    stateCodec?: Codec<unknown>,
    opts: { disableClockSync?: boolean; subtickTimestamps?: boolean; inputBatchMs?: number } = {},
  ) {
    this.name = name;
    this.transport = transport;
    this.stateCodec = stateCodec;
    this.clockEnabled = !opts.disableClockSync;
    this.subtickTimestamps = opts.subtickTimestamps ?? false;
    this.inputBatchMs = opts.inputBatchMs ?? 0;

    // Subtick timestamps need clock sync to place inputs on the server's timeline.
    // Without it, serverNow() is just the raw local clock, which the server then
    // clamps hard — degrading (not helping) lag compensation. Warn once in dev.
    if (this.subtickTimestamps && !this.clockEnabled && !subtickClockWarned) {
      subtickClockWarned = true;
      // eslint-disable-next-line no-console
      console.warn(
        "[@tikron/client] subtickTimestamps is on but clock sync is disabled — inputs " +
          "will be stamped with the raw local clock and clamped by the server, which " +
          "hurts lag compensation. Remove disableClockSync to get accurate subtick timing.",
      );
    }

    this.clock = new ClockSync({
      // Include the current RTT estimate so the server can populate
      // `client.rttMs` (used by lag compensation / rewind on the room side).
      send: (t0) =>
        this.transport.send(
          encode({
            t: ClientMessageType.Time,
            t0,
            ...(this.clock && this.clock.rttMs > 0 ? { rtt: Math.round(this.clock.rttMs) } : {}),
          }),
        ),
    });

    this.welcome = new Promise<WelcomeMessage>((resolve, reject) => {
      this.failWelcome = reject;
      const off = this.onMessage((msg) => {
        if (this.welcomeSettled) return;
        if (msg.t === ServerMessageType.Error) {
          // A server Error frame arriving BEFORE Welcome (e.g. `room_full` sent just
          // ahead of a 4002 close) — capture it so the following close/error surfaces
          // its code ("room_full") in the join rejection instead of a generic one.
          this.preWelcomeError = msg;
        } else if (msg.t === ServerMessageType.Welcome) {
          this.welcomeSettled = true;
          this.connectionId = msg.connectionId;
          off();
          if (this.clockEnabled) this.clock.start(); // begin syncing once connected
          resolve(msg);
        }
      });
    });
    // joinOrCreate always awaits connected() (a single promise chain), so a
    // pre-Welcome rejection propagates cleanly. This guard keeps a Room built without
    // that await from ever surfacing an unhandled rejection.
    void this.welcome.catch(() => {});

    transport.onMessage((raw) => this.dispatch(raw));
    // A socket close or error BEFORE Welcome means the join failed (e.g. room_full →
    // 4002 close): reject connected() so joinOrCreate rejects instead of hanging.
    transport.onClose(() => this.failJoinIfPending());
    transport.onError((err) => this.failJoinIfPending(err));
  }

  /**
   * Reject the welcome/connected promise when the socket closes or errors before the
   * server's Welcome frame — otherwise joinOrCreate awaits connected() forever. The
   * rejection carries the code of any Error frame seen pre-Welcome (e.g. "room_full"),
   * else "connection-closed". No-op once the room has connected (a later close is
   * ordinary teardown, not a failed join).
   */
  private failJoinIfPending(err?: unknown): void {
    if (this.welcomeSettled) return; // already connected — or already failed
    this.welcomeSettled = true;
    const code = this.preWelcomeError?.code ?? "connection-closed";
    const message =
      this.preWelcomeError?.message ??
      (err instanceof Error ? err.message : "connection closed before welcome");
    this.failWelcome(new RoomJoinError(code, message));
    // Tear down the underlying PartySocket so a rejected join leaks nothing and never
    // reconnects: close() trips PartySocket's _closeCalled guard, and the settled
    // latch above neutralizes our own message/close/error handlers.
    this.clock.stop();
    this.transport.close();
  }

  private dispatch(raw: RawData): void {
    if (typeof raw !== "string") {
      this.applyBinaryState(raw);
      return;
    }

    let msg: ServerMessage;
    try {
      msg = decodeServerMessage(raw);
    } catch {
      return; // ignore malformed frames
    }

    if (msg.t === ServerMessageType.Welcome) {
      // Re-sent after an automatic reconnect; the id is stable when a session
      // key was supplied, so handlers keyed on connectionId keep working.
      this.connectionId = msg.connectionId;
    } else if (msg.t === ServerMessageType.State) {
      this.state = msg.state;
      if (typeof msg.tick === "number") this.lastStateTick = msg.tick;
      this.lastStateServerTime = typeof msg.serverTime === "number" ? msg.serverTime : null;
      for (const handler of this.stateHandlers) handler(msg.state);
    } else if (msg.t === ServerMessageType.Message) {
      const set = this.typeHandlers.get(msg.type);
      if (set) for (const handler of set) handler(msg.payload);
    } else if (msg.t === ServerMessageType.Ack) {
      this.lastAckSeq = msg.seq;
      for (const handler of this.ackHandlers) handler(msg.seq);
    } else if (msg.t === ServerMessageType.Time) {
      this.clock.accept(msg.t0, msg.serverTime);
    }

    for (const handler of this.rawHandlers) handler(msg);
  }

  private applyBinaryState(raw: ArrayBuffer | Uint8Array): void {
    if (!this.stateCodec) return;
    const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
    // Header: [tag(u8), tick(u32 LE), serverTimeMs(f64 LE)] then the codec body.
    if (bytes.length < 13) return;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tag = bytes[0];
    const tick = view.getUint32(1, true);
    const serverTime = view.getFloat64(5, true);
    const body = bytes.subarray(13);
    if (tag === 0x01) this.state = decodeFull(this.stateCodec, body);
    else if (tag === 0x02) this.state = applyDelta(this.stateCodec, this.state, body);
    else return;
    this.lastStateTick = tick;
    this.lastStateServerTime = serverTime;
    for (const handler of this.stateHandlers) handler(this.state);
  }

  /** Subscribe to every decoded server message (raw). */
  onMessage(handler: ServerMessageHandler): Unsubscribe;
  /** Subscribe to developer-defined server messages of a given `type`. */
  onMessage(type: string, handler: PayloadHandler): Unsubscribe;
  onMessage(a: ServerMessageHandler | string, b?: PayloadHandler): Unsubscribe {
    if (typeof a === "string") {
      const handler = b as PayloadHandler;
      const set = this.typeHandlers.get(a) ?? new Set<PayloadHandler>();
      set.add(handler);
      this.typeHandlers.set(a, set);
      return () => {
        set.delete(handler);
      };
    }
    this.rawHandlers.add(a);
    return () => {
      this.rawHandlers.delete(a);
    };
  }

  /** Subscribe to authoritative state updates. */
  onStateChange(handler: StateHandler): Unsubscribe {
    this.stateHandlers.add(handler);
    return () => {
      this.stateHandlers.delete(handler);
    };
  }

  /** Subscribe to input acknowledgements (the last input seq the server processed). */
  onAck(handler: (seq: number) => void): Unsubscribe {
    this.ackHandlers.add(handler);
    return () => {
      this.ackHandlers.delete(handler);
    };
  }

  /** Resolves once the server has sent its Welcome frame. */
  connected(): Promise<WelcomeMessage> {
    return this.welcome;
  }

  /** Send a developer-defined message (intent) with an auto-incrementing seq. */
  send(type: string, payload?: unknown): void {
    const msg: ClientGameMessage = { t: ClientMessageType.Message, type, seq: ++this.seq, payload };
    // Subtick: stamp the input with its server-clock time (best estimate); the room
    // clamps it and can rewind lag compensation to this instant instead of the tick.
    if (this.subtickTimestamps) msg.ts = Math.round(this.clock.serverNow());

    if (this.inputBatchMs <= 0) {
      this.transport.send(encode(msg));
      return;
    }
    // Coalesce into the current window; the timer flushes it as one frame.
    this.inputBatch.push(msg);
    if (this.batchTimer === null) {
      this.batchTimer = setTimeout(() => this.flushInput(), this.inputBatchMs);
    }
  }

  /**
   * Flush any buffered batched inputs now. A single buffered input ships as a plain
   * `c:msg` (no batch overhead, and old servers still understand it); two or more
   * ship as one `c:mbatch` frame. Called on the batch timer and on {@link leave}.
   */
  private flushInput(): void {
    if (this.batchTimer !== null) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    if (this.inputBatch.length === 0) return;
    if (this.inputBatch.length === 1) {
      this.transport.send(encode(this.inputBatch[0]!));
    } else {
      this.transport.send(encode({ t: ClientMessageType.MessageBatch, msgs: [...this.inputBatch] }));
    }
    this.inputBatch.length = 0;
  }

  private sendRaw(message: ClientMessage): void {
    this.transport.send(encode(message));
  }

  hello(name?: string): void {
    this.sendRaw({ t: ClientMessageType.Hello, name });
  }

  echo(text: string): void {
    this.sendRaw({ t: ClientMessageType.Echo, text });
  }

  broadcastText(text: string): void {
    this.sendRaw({ t: ClientMessageType.Broadcast, text });
  }

  leave(): void {
    this.flushInput(); // don't drop inputs still sitting in an open batch window
    this.clock.stop();
    this.transport.close();
  }
}

/** Entry point for the browser SDK. */
export class GameClient {
  private readonly host: string;
  private readonly options: GameClientOptions;
  private readonly party: string;

  constructor(host: string, options: GameClientOptions = {}) {
    this.host = host;
    this.options = options;
    this.party = options.party ?? "game-room";
  }

  /**
   * Ask the matchmaker for a room of this client's party (type), optionally
   * filtered by `mode` and placed near a `region` (Cloudflare location hint:
   * wnam, enam, weur, eeur, apac, oc, afr, me — applies only when a NEW room is
   * created). Returns the room id, a reserved session id, and the room's region
   * (echoed back). Pass the region into `joinOrCreate` params so first contact
   * carries the placement hint:
   * `client.joinOrCreate(m.roomId, { _session: m.sessionId, ...(m.region ? { region: m.region } : {}) })`
   * (Browser-oriented: uses a same-origin `/api/matchmake` request.)
   */
  async matchmake(
    opts: { type?: string; mode?: string; maxClients?: number; region?: string } = {},
  ): Promise<{ roomId: string; sessionId: string; region?: string }> {
    const query = new URLSearchParams({
      type: opts.type ?? this.party,
      mode: opts.mode ?? "",
      max: String(opts.maxClients ?? 8),
    });
    if (opts.region) query.set("region", opts.region);
    const res = await fetch(`/api/matchmake?${query.toString()}`);
    if (!res.ok) throw new Error(`matchmake failed: HTTP ${res.status}`);
    return (await res.json()) as { roomId: string; sessionId: string; region?: string };
  }

  /**
   * Join a room by name (creating it on first join) by opening a connection to the
   * room's Durable Object. To let the platform pick and reserve a room, call
   * {@link matchmake} first and pass its `roomId`/`sessionId` here.
   */
  async joinOrCreate(room: string, params: Record<string, string> = {}): Promise<Room> {
    const query: Record<string, string> = { ...params };
    if (this.options.apiKey) query.apiKey = this.options.apiKey;
    if (this.options.authToken) query._auth = this.options.authToken;

    const factory = this.options.createTransport ?? createPartySocketTransport;
    let transport = factory({
      host: this.host,
      room,
      party: this.party,
      query,
      WebSocketPolyfill: this.options.WebSocketPolyfill,
      reconnect: this.options.reconnect,
    });

    if (this.options.networkConditions) {
      transport = withNetworkConditions(transport, this.options.networkConditions);
      if (!networkConditionsWarned) {
        networkConditionsWarned = true;
        // eslint-disable-next-line no-console
        console.warn(
          "[@tikron/client] networkConditions is active — simulating a degraded network. " +
            "Remove it for production.",
        );
      }
    }

    const roomHandle = new Room(room, transport, this.options.stateCodec, {
      disableClockSync: this.options.disableClockSync,
      subtickTimestamps: this.options.subtickTimestamps,
      inputBatchMs: this.options.inputBatchMs,
    });
    await roomHandle.connected();
    return roomHandle;
  }
}
