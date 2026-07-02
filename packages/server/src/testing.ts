/**
 * `@tikron/server/testing` — an in-process test harness for room logic.
 *
 * Drives a {@link Room} subclass with no Durable Object, no WebSocket, and no network:
 * connect fake clients, send intents, advance time, and assert on state, broadcasts, and
 * occupancy. It formalizes the fake-context pattern the framework uses in its own tests
 * into a documented public API so game developers can unit-test their rooms.
 *
 * Two ways to observe state sync:
 *  - **Immediate** (default): the harness sets `syncIntervalMs = 0`, so a mutation flushes
 *    on a microtask. Call `await handle.flush()` after sending intents, then assert — no
 *    fake timers needed. Use this for logic tests.
 *  - **Throttled**: pass `{ sync: "throttled" }` to keep the room's real ~20 Hz coalescing,
 *    then drive `await handle.advance(ms)` (requires the test runner's fake timers).
 *
 * Time-dependent behavior (reconnection windows, occupancy heartbeats, the throttled
 * flush) needs fake timers: call `vi.useFakeTimers()` (vitest) in your test and use
 * `handle.advance(ms)`, or pass `opts.advanceTimers` for a different runner.
 *
 * ```ts
 * import { createTestRoom } from "@tikron/server/testing";
 *
 * const h = await createTestRoom(MyRoom);
 * const a = await h.connect("alice");
 * const b = await h.connect("bob");
 * await a.send("move", { x: 1, y: 2 });
 * await h.flush();
 * expect(h.snapshot().players.alice).toEqual({ x: 1, y: 2 });
 * ```
 */
import {
  Room,
  CLOSE_SESSION_TAKEN_OVER,
  CLOSE_ROOM_FULL,
  CLOSE_INVALID_SESSION,
  CLOSE_UNAUTHORIZED,
  type RoomConnection,
  type RoomContext,
  type RoomStorage,
  type RoomInit,
} from "./room.js";
import { ClientMessageType, ServerMessageType, encode } from "@tikron/protocol";
import { decodeFull, applyDelta, type Codec } from "@tikron/schema";

// Re-exported for convenient assertions on close codes.
export { CLOSE_SESSION_TAKEN_OVER, CLOSE_ROOM_FULL, CLOSE_INVALID_SESSION, CLOSE_UNAUTHORIZED };

/** Binary state-frame header (must match the client SDK): tag u8, tick u32 LE, serverTime f64 LE. */
const STATE_HEADER_BYTES = 13;

/** A room class as constructed by `defineRoom` — `new (init) => Room<TState>`. */
export type TestRoomClass<TState> = new (init: RoomInit) => Room<TState>;

/** One occupancy report the room emitted (join / final leave / heartbeat). */
export interface OccupancyReport {
  count: number;
  sessions: string[];
  seq?: number;
  messages?: number;
}

/** One `broadcast`/state frame the room sent to all connections, parsed. */
export interface BroadcastFrame {
  data: Record<string, unknown>;
  except?: string[];
}

/** In-memory durable storage with the room's live map + alarm exposed for assertions. */
export interface TestStorage extends RoomStorage {
  readonly kv: Map<string, unknown>;
  alarm: number | null;
}

export interface TestRoomOptions {
  /** Room id (default `"test-room"`). */
  id?: string;
  /** Codec for decoding this room's binary state frames in `connection.binaryFrames()`. */
  codec?: Codec<unknown>;
  /**
   * State-sync mode. `"immediate"` (default) sets `syncIntervalMs = 0` so a mutation
   * flushes on a microtask — assert after `await flush()`, no timers needed. `"throttled"`
   * keeps the room's real coalescing; drive it with `await advance(ms)` under fake timers.
   */
  sync?: "immediate" | "throttled";
  /**
   * How `advance(ms)` moves time. Defaults to vitest's `vi.advanceTimersByTimeAsync`
   * (dynamically imported only when `advance` is first called). Pass this to use a
   * different runner's fake-timer control.
   */
  advanceTimers?: (ms: number) => void | Promise<void>;
}

/** A connected fake client. */
export interface TestConnection {
  /** The id the room knows this client by (the session key, or the fake connection id). */
  readonly id: string;
  /** Send a developer intent (auto-incrementing seq unless you pass one). */
  send(type: string, payload?: unknown, seq?: number): Promise<void>;
  /** Every JSON frame the server delivered to this client, parsed and in order. */
  frames(): Record<string, unknown>[];
  /** Binary state frames decoded with a codec (defaults to `opts.codec`), in order. */
  binaryFrames(codec?: Codec<unknown>): unknown[];
  /** The latest state this client has received (last JSON state, else last decoded binary). */
  lastState(): unknown;
  /** Simulate this client's transport dropping (fires the room's `onLeave` path). */
  close(): Promise<void>;
}

/** The harness handle returned by {@link createTestRoom}. */
export interface TestRoomHandle<TState> {
  /** The room under test (its public API is available for advanced cases). */
  readonly room: Room<TState>;
  /** Connect a fake client; `session` keys the seat (survives reconnects) if given. */
  connect(session?: string): Promise<TestConnection>;
  /** Advance fake time by `ms` (reconnection windows, heartbeats, throttled flush). */
  advance(ms: number): Promise<void>;
  /** Drain pending immediate-mode state flushes (a couple of microtasks). */
  flush(): Promise<void>;
  /** A deep copy of the room's current authoritative state. */
  snapshot(): TState;
  /** Occupancy reports emitted so far, in order. */
  readonly reports: readonly OccupancyReport[];
  /** All broadcast/state frames the room sent to every client, in order. */
  readonly broadcasts: readonly BroadcastFrame[];
  /** Broadcast frames whose message tag `t` equals `type` (e.g. `"s:msg"`, `"s:state"`). */
  broadcastsOf(type: string): BroadcastFrame[];
  /** The room's in-memory durable storage (map + alarm) for persistence assertions. */
  readonly storage: TestStorage;
}

/** Bridge to the room's `@internal` glue + protected fields, without widening the class. */
interface RoomInternals<TState> {
  syncIntervalMs: number;
  state: TState;
  _create(): Promise<void>;
  _connect(conn: RoomConnection, session?: string): Promise<void>;
  _message(conn: RoomConnection, raw: string): Promise<void>;
  _close(conn: RoomConnection): Promise<void>;
}

class FakeConnection implements RoomConnection {
  readonly sent: (string | ArrayBuffer | ArrayBufferView)[] = [];
  closed: { code?: number; reason?: string } | null = null;
  constructor(readonly id: string) {}
  send(data: string | ArrayBuffer | ArrayBufferView): void {
    this.sent.push(data);
  }
  close(code?: number, reason?: string): void {
    this.closed = { code, reason };
  }
}

class FakeStorage implements TestStorage {
  readonly kv = new Map<string, unknown>();
  alarm: number | null = null;
  async get<T>(key: string): Promise<T | undefined> {
    return this.kv.get(key) as T | undefined;
  }
  async put(key: string, value: unknown): Promise<void> {
    this.kv.set(key, structuredClone(value)); // match the DO storage clone-on-write contract
  }
  async delete(key: string): Promise<boolean> {
    return this.kv.delete(key);
  }
  async setAlarm(scheduledTime: number): Promise<void> {
    this.alarm = scheduledTime;
  }
  async getAlarm(): Promise<number | null> {
    return this.alarm;
  }
  async deleteAlarm(): Promise<void> {
    this.alarm = null;
  }
}

class FakeContext implements RoomContext {
  readonly conns = new Map<string, FakeConnection>();
  readonly broadcasts: BroadcastFrame[] = [];
  readonly reports: OccupancyReport[] = [];
  constructor(
    readonly roomId: string,
    readonly storage: FakeStorage,
  ) {}
  connections(): Iterable<RoomConnection> {
    return this.conns.values();
  }
  connection(id: string): RoomConnection | undefined {
    return this.conns.get(id);
  }
  broadcastRaw(data: string, exceptIds?: string[]): void {
    this.broadcasts.push({ data: JSON.parse(data) as Record<string, unknown>, except: exceptIds });
    // Deliver to every connection's inbox (except excluded) — as a real WS broadcast would,
    // so a connection's frames()/lastState() reflect everything that client actually sees.
    for (const [id, conn] of this.conns) {
      if (exceptIds?.includes(id)) continue;
      conn.send(data);
    }
  }
  reportOccupancy(count: number, sessions: string[], seq?: number, messages?: number): void {
    this.reports.push({ count, sessions: [...sessions], seq, messages });
  }
}

class TestConnectionImpl implements TestConnection {
  #seq = 0;
  constructor(
    readonly id: string,
    private readonly conn: FakeConnection,
    private readonly ctx: FakeContext,
    private readonly internals: RoomInternals<unknown>,
    private readonly codec?: Codec<unknown>,
  ) {}

  async send(type: string, payload?: unknown, seq?: number): Promise<void> {
    const s = seq ?? ++this.#seq;
    await this.internals._message(this.conn, encode({ t: ClientMessageType.Message, type, seq: s, payload }));
  }

  frames(): Record<string, unknown>[] {
    return this.conn.sent
      .filter((d): d is string => typeof d === "string")
      .map((d) => JSON.parse(d) as Record<string, unknown>);
  }

  binaryFrames(codec?: Codec<unknown>): unknown[] {
    const c = codec ?? this.codec;
    if (!c) {
      throw new Error("binaryFrames() needs a codec — pass one, or set `codec` in createTestRoom options.");
    }
    const out: unknown[] = [];
    let prev: unknown;
    for (const d of this.conn.sent) {
      if (typeof d === "string") continue;
      const bytes = d instanceof Uint8Array ? d : new Uint8Array(d as ArrayBuffer);
      if (bytes.length < STATE_HEADER_BYTES) continue;
      const tag = bytes[0];
      const body = bytes.subarray(STATE_HEADER_BYTES);
      if (tag === 0x01) prev = decodeFull(c, body);
      else if (tag === 0x02) prev = applyDelta(c, prev, body);
      else continue;
      out.push(prev);
    }
    return out;
  }

  lastState(): unknown {
    let last: unknown;
    let sawJson = false;
    for (const f of this.frames()) {
      if (f.t === ServerMessageType.State) {
        last = (f as { state?: unknown }).state;
        sawJson = true;
      }
    }
    if (sawJson) return last;
    if (this.codec) {
      const decoded = this.binaryFrames();
      return decoded.length ? decoded[decoded.length - 1] : undefined;
    }
    return undefined;
  }

  close(): Promise<void> {
    // Detach the transport, then run the room's close path (which may open a
    // reconnection window — for windowed rooms, advance() the returned promise).
    this.ctx.conns.delete(this.conn.id);
    return this.internals._close(this.conn);
  }
}

/**
 * Build a room under test with fake transport + storage. `await` it (the room restores
 * any persisted snapshot on create). See {@link TestRoomHandle} for the returned API.
 */
export async function createTestRoom<TState>(
  RoomClass: TestRoomClass<TState>,
  opts: TestRoomOptions = {},
): Promise<TestRoomHandle<TState>> {
  const id = opts.id ?? "test-room";
  const storage = new FakeStorage();
  const ctx = new FakeContext(id, storage);
  const room = new RoomClass({ id, ctx });
  const internals = room as unknown as RoomInternals<TState>;

  if ((opts.sync ?? "immediate") === "immediate") {
    internals.syncIntervalMs = 0; // flush on a microtask so logic tests need no timers
  }
  await internals._create();

  let connSeq = 0;

  return {
    room,
    async connect(session?: string): Promise<TestConnection> {
      const conn = new FakeConnection(`conn-${++connSeq}`);
      ctx.conns.set(conn.id, conn);
      await internals._connect(conn, session);
      const clientId = session && session.length > 0 ? session : conn.id;
      return new TestConnectionImpl(
        clientId,
        conn,
        ctx,
        internals as RoomInternals<unknown>,
        opts.codec,
      );
    },
    async advance(ms: number): Promise<void> {
      if (opts.advanceTimers) {
        await opts.advanceTimers(ms);
        return;
      }
      const vitest = await import("vitest").catch(() => null);
      if (!vitest) {
        throw new Error(
          "advance(ms) needs fake timers. Call vi.useFakeTimers() (vitest) in your test, " +
            "or pass opts.advanceTimers for another runner.",
        );
      }
      await vitest.vi.advanceTimersByTimeAsync(ms);
    },
    async flush(): Promise<void> {
      // Immediate-mode flushes run on the microtask queue; drain a couple of turns.
      await Promise.resolve();
      await Promise.resolve();
    },
    snapshot(): TState {
      return structuredClone(internals.state);
    },
    reports: ctx.reports,
    broadcasts: ctx.broadcasts,
    broadcastsOf(type: string): BroadcastFrame[] {
      return ctx.broadcasts.filter((b) => b.data.t === type);
    },
    storage,
  };
}
