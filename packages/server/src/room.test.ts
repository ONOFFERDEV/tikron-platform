import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
// Import room.js directly — index.js pulls in partyserver (a workerd-only
// dependency), which the node test runner cannot load.
import {
  Room,
  CLOSE_SESSION_TAKEN_OVER,
  CLOSE_ROOM_FULL,
  type Client,
  type RoomConnection,
  type RoomContext,
  type RoomStorage,
} from "./room.js";

/** In-memory RoomStorage double (structured-clone on put, like real DO storage). */
class FakeStorage implements RoomStorage {
  readonly kv = new Map<string, unknown>();
  alarm: number | null = null;

  async get<T>(key: string): Promise<T | undefined> {
    return this.kv.get(key) as T | undefined;
  }
  async put(key: string, value: unknown): Promise<void> {
    this.kv.set(key, structuredClone(value));
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

class FakeConn implements RoomConnection {
  readonly sent: (string | ArrayBuffer | ArrayBufferView)[] = [];
  closed: { code?: number; reason?: string } | null = null;

  constructor(readonly id: string) {}

  send(data: string | ArrayBuffer | ArrayBufferView): void {
    this.sent.push(data);
  }
  close(code?: number, reason?: string): void {
    this.closed = { code, reason };
  }

  /** JSON frames sent to this connection, parsed. */
  frames(): Record<string, unknown>[] {
    return this.sent
      .filter((d): d is string => typeof d === "string")
      .map((d) => JSON.parse(d) as Record<string, unknown>);
  }
}

class FakeCtx implements RoomContext {
  readonly roomId = "test-room";
  readonly conns = new Map<string, FakeConn>();
  readonly broadcasts: { data: Record<string, unknown>; except?: string[] }[] = [];
  readonly reports: { count: number; sessions: string[] }[] = [];

  constructor(readonly storage?: FakeStorage) {}

  connections(): Iterable<RoomConnection> {
    return this.conns.values();
  }
  connection(id: string): RoomConnection | undefined {
    return this.conns.get(id);
  }
  broadcastRaw(data: string, exceptIds?: string[]): void {
    this.broadcasts.push({ data: JSON.parse(data) as Record<string, unknown>, except: exceptIds });
  }
  reportOccupancy(count: number, sessions: string[]): void {
    this.reports.push({ count, sessions });
  }

  open(id: string): FakeConn {
    const conn = new FakeConn(id);
    this.conns.set(id, conn);
    return conn;
  }
  drop(id: string): void {
    this.conns.delete(id);
  }
  broadcastsOf(t: string): { data: Record<string, unknown>; except?: string[] }[] {
    return this.broadcasts.filter((b) => b.data.t === t);
  }
}

interface TestState {
  players: Record<string, number>;
}

class TestRoom extends Room<TestState> {
  windowSec = 5;
  useReconnection = true;
  /** Simulate the consumer mistake: await allowReconnection with NO try/catch. */
  unsafeLeave = false;
  readonly events: string[] = [];

  override onCreate(): void {
    this.setState({ players: {} });
    this.onMessage("noop", () => {
      this.events.push("noop");
    });
  }
  override onJoin(client: Client): void {
    this.events.push(`join:${client.id}`);
    this.state.players[client.id] = 0;
    client.data.token = `data-${client.id}`;
  }
  override async onLeave(client: Client): Promise<void> {
    this.events.push(`leave:${client.id}`);
    if (!this.useReconnection) {
      delete this.state.players[client.id];
      return;
    }
    if (this.unsafeLeave) {
      // Rejection (window expiry) escapes onLeave — the core must still finalize.
      await this.allowReconnection(client, this.windowSec);
      this.events.push(`kept:${client.id}`);
      return;
    }
    try {
      await this.allowReconnection(client, this.windowSec);
      this.events.push(`kept:${client.id}`);
    } catch {
      this.events.push(`expired:${client.id}`);
      delete this.state.players[client.id];
    }
  }
  override onReconnect(client: Client): void {
    this.events.push(`reconnect:${client.id}:${String(client.data.token)}`);
  }
  override onDispose(): void {
    this.events.push("dispose");
  }

  get playerIds(): string[] {
    return Object.keys(this.state.players);
  }
}

async function setup(): Promise<{ ctx: FakeCtx; room: TestRoom }> {
  const ctx = new FakeCtx();
  const room = new TestRoom({ id: ctx.roomId, ctx });
  // These tests aren't about flush timing — use immediate (microtask) flushing so
  // state assertions don't need to advance the sync-throttle timer. The throttle
  // itself is covered by "Room flush throttling".
  room["syncIntervalMs"] = 0;
  await room._create();
  return { ctx, room };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("Room session keying", () => {
  it("keys the client by the session key and reports it in Welcome", async () => {
    const { ctx, room } = await setup();
    const conn = ctx.open("conn-1");
    await room._connect(conn, "sess-a");

    const welcome = conn.frames().find((f) => f.t === "s:welcome")!;
    expect(welcome.connectionId).toBe("sess-a");
    expect(room.playerIds).toEqual(["sess-a"]);
  });

  it("falls back to the connection id without a session key", async () => {
    const { ctx, room } = await setup();
    const conn = ctx.open("conn-1");
    await room._connect(conn);

    const welcome = conn.frames().find((f) => f.t === "s:welcome")!;
    expect(welcome.connectionId).toBe("conn-1");
    expect(room.playerIds).toEqual(["conn-1"]);
  });
});

describe("Room reconnection", () => {
  it("preserves the seat when the client reconnects within the window", async () => {
    const { ctx, room } = await setup();
    const connA = ctx.open("conn-1");
    await room._connect(connA, "sess-a");

    ctx.drop("conn-1");
    const closing = room._close(connA); // onLeave suspends on allowReconnection

    await vi.advanceTimersByTimeAsync(1000); // inside the window
    const connB = ctx.open("conn-2");
    await room._connect(connB, "sess-a");
    await closing;

    // Seat preserved: same id, same client.data, no leave finalization.
    expect(room.events).toContain("kept:sess-a");
    expect(room.events).toContain("reconnect:sess-a:data-sess-a");
    expect(room.events.filter((e) => e === "join:sess-a")).toHaveLength(1);
    expect(room.playerIds).toEqual(["sess-a"]);

    // The reattach Welcome is flagged and peers never saw a PeerLeft.
    const welcome = connB.frames().find((f) => f.t === "s:welcome")!;
    expect(welcome.reconnected).toBe(true);
    expect(ctx.broadcastsOf("s:peer-left")).toHaveLength(0);
  });

  it("finalizes the leave when the window expires", async () => {
    const { ctx, room } = await setup();
    const connA = ctx.open("conn-1");
    await room._connect(connA, "sess-a");

    ctx.drop("conn-1");
    const closing = room._close(connA);
    await vi.advanceTimersByTimeAsync(room.windowSec * 1000);
    await closing;

    expect(room.events).toContain("expired:sess-a");
    expect(room.events).toContain("dispose");
    expect(room.playerIds).toEqual([]);
    expect(ctx.broadcastsOf("s:peer-left")).toHaveLength(1);
  });

  it("counts a client inside the window as still seated", async () => {
    const { ctx, room } = await setup();
    const connA = ctx.open("conn-1");
    await room._connect(connA, "sess-a");
    const connB = ctx.open("conn-2");
    await room._connect(connB, "sess-b");

    ctx.drop("conn-1");
    const closing = room._close(connA);
    await vi.advanceTimersByTimeAsync(1000);

    expect(room["clientCount"]).toBe(2); // seat held during the window

    await vi.advanceTimersByTimeAsync(room.windowSec * 1000);
    await closing;
    expect(room["clientCount"]).toBe(1);
  });

  it("finalizes even when onLeave lets the window rejection escape", async () => {
    const { ctx, room } = await setup();
    room.unsafeLeave = true;
    const connA = ctx.open("conn-1");
    await room._connect(connA, "sess-a");

    ctx.drop("conn-1");
    const closing = room._close(connA);
    await vi.advanceTimersByTimeAsync(room.windowSec * 1000);
    await closing;

    // The uncaught rejection must not leak the seat or skip teardown.
    expect(room["clientCount"]).toBe(0);
    expect(ctx.broadcastsOf("s:peer-left")).toHaveLength(1);
    expect(room.events).toContain("dispose");
    expect(ctx.reports.at(-1)).toEqual({ count: 0, sessions: [] });
  });

  it("leaves immediately when room code does not opt in", async () => {
    const { ctx, room } = await setup();
    room.useReconnection = false;
    const connA = ctx.open("conn-1");
    await room._connect(connA, "sess-a");

    ctx.drop("conn-1");
    await room._close(connA); // resolves without any timer advance

    expect(room.playerIds).toEqual([]);
    expect(ctx.broadcastsOf("s:peer-left")).toHaveLength(1);
    expect(room.events).toContain("dispose");
  });

  it("resets the input replay floor after a reattach", async () => {
    const { ctx, room } = await setup();
    const connA = ctx.open("conn-1");
    await room._connect(connA, "sess-a");
    await room._message(connA, JSON.stringify({ t: "c:msg", type: "noop", seq: 50 }));
    expect(room.events.filter((e) => e === "noop")).toHaveLength(1);

    ctx.drop("conn-1");
    const closing = room._close(connA);
    const connB = ctx.open("conn-2");
    await room._connect(connB, "sess-a");
    await closing;

    // A fresh transport restarts its seq counter; seq 1 must be accepted again.
    await room._message(connB, JSON.stringify({ t: "c:msg", type: "noop", seq: 1 }));
    expect(room.events.filter((e) => e === "noop")).toHaveLength(2);
  });
});

describe("Room session takeover", () => {
  it("closes the old connection and moves the seat to the new one", async () => {
    const { ctx, room } = await setup();
    const connA = ctx.open("conn-1");
    await room._connect(connA, "sess-a");

    const connB = ctx.open("conn-2");
    await room._connect(connB, "sess-a"); // same session while conn-1 is still open

    expect(connA.closed?.code).toBe(CLOSE_SESSION_TAKEN_OVER);
    expect(room.playerIds).toEqual(["sess-a"]);
    expect(room.events.filter((e) => e.startsWith("join:"))).toHaveLength(1);

    // The zombie connection's close event must not evict the reattached seat.
    ctx.drop("conn-1");
    await room._close(connA);
    expect(room.playerIds).toEqual(["sess-a"]);
    expect(ctx.broadcastsOf("s:peer-left")).toHaveLength(0);

    // The new connection still works.
    await room._message(connB, JSON.stringify({ t: "c:msg", type: "noop", seq: 1 }));
    expect(room.events).toContain("noop");
  });
});

describe("Room occupancy reporting", () => {
  it("reports on join and on final leave, with seated session ids", async () => {
    const { ctx, room } = await setup();
    const connA = ctx.open("conn-1");
    await room._connect(connA, "sess-a");
    expect(ctx.reports.at(-1)).toEqual({ count: 1, sessions: ["sess-a"] });

    const connB = ctx.open("conn-2");
    await room._connect(connB, "sess-b");
    expect(ctx.reports.at(-1)).toEqual({ count: 2, sessions: ["sess-a", "sess-b"] });

    room.useReconnection = false;
    ctx.drop("conn-2");
    await room._close(connB);
    expect(ctx.reports.at(-1)).toEqual({ count: 1, sessions: ["sess-a"] });
  });

  it("does not report while a reconnection window holds the seat", async () => {
    const { ctx, room } = await setup();
    const connA = ctx.open("conn-1");
    await room._connect(connA, "sess-a");
    const joins = ctx.reports.length;

    ctx.drop("conn-1");
    const closing = room._close(connA);
    await vi.advanceTimersByTimeAsync(1000);
    expect(ctx.reports.length).toBe(joins); // seat still held — no report

    await vi.advanceTimersByTimeAsync(room.windowSec * 1000);
    await closing;
    expect(ctx.reports.at(-1)).toEqual({ count: 0, sessions: [] });
  });

  it("emits periodic occupancy heartbeats while seated, and stops when empty", async () => {
    const { ctx, room } = await setup();
    room["occupancyHeartbeatMs"] = 1000;
    const connA = ctx.open("conn-1");
    await room._connect(connA, "sess-a");
    const afterJoin = ctx.reports.length;

    await vi.advanceTimersByTimeAsync(1000);
    expect(ctx.reports.length).toBe(afterJoin + 1);
    expect(ctx.reports.at(-1)).toEqual({ count: 1, sessions: ["sess-a"] });

    await vi.advanceTimersByTimeAsync(1000);
    expect(ctx.reports.length).toBe(afterJoin + 2); // still ticking while seated

    room.useReconnection = false;
    ctx.drop("conn-1");
    await room._close(connA);
    const afterLeave = ctx.reports.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(ctx.reports.length).toBe(afterLeave); // heartbeat cleared once empty
  });
});

describe("Room capacity enforcement", () => {
  it("rejects a new seat when the room is at capacity", async () => {
    const { ctx, room } = await setup();
    room["maxClients"] = 1;
    const connA = ctx.open("conn-1");
    await room._connect(connA, "sess-a");

    const connB = ctx.open("conn-2");
    await room._connect(connB, "sess-b");

    const err = connB.frames().find((f) => f.t === "s:error");
    expect(err?.code).toBe("room_full");
    expect(connB.closed?.code).toBe(CLOSE_ROOM_FULL);
    expect(room.playerIds).toEqual(["sess-a"]); // no seat created for the rejected conn
  });

  it("_raiseMaxClients raises the cap but never lowers it (dev-override semantics)", async () => {
    const { ctx, room } = await setup();
    room["maxClients"] = 1;

    // A below-cap or non-finite value is ignored — production capacity is unchanged.
    room._raiseMaxClients(0);
    room._raiseMaxClients(1);
    room._raiseMaxClients(Number.NaN);
    expect(room["maxClients"]).toBe(1);

    // Raising takes effect: a second new seat is now admitted instead of rejected.
    room._raiseMaxClients(2);
    expect(room["maxClients"]).toBe(2);
    await room._connect(ctx.open("conn-1"), "sess-a");
    const connB = ctx.open("conn-2");
    await room._connect(connB, "sess-b");
    expect(connB.closed).toBeNull();
    expect(room.playerIds.sort()).toEqual(["sess-a", "sess-b"]);
  });

  it("still allows an existing seat to reattach when the room is full", async () => {
    const { ctx, room } = await setup();
    room["maxClients"] = 1;
    const connA = ctx.open("conn-1");
    await room._connect(connA, "sess-a");

    // Drop then reconnect the same session while the room is at capacity (1/1).
    ctx.drop("conn-1");
    const closing = room._close(connA);
    await vi.advanceTimersByTimeAsync(1000);
    const connB = ctx.open("conn-2");
    await room._connect(connB, "sess-a"); // reattach — not a new seat
    await closing;

    const welcome = connB.frames().find((f) => f.t === "s:welcome");
    expect(welcome?.reconnected).toBe(true);
    expect(connB.closed).toBeNull();
    expect(room.playerIds).toEqual(["sess-a"]);
  });

  it("allows a takeover of an existing seat even at capacity", async () => {
    const { ctx, room } = await setup();
    room["maxClients"] = 1;
    const connA = ctx.open("conn-1");
    await room._connect(connA, "sess-a");

    const connB = ctx.open("conn-2");
    await room._connect(connB, "sess-a"); // same session, conn-1 still open

    expect(connA.closed?.code).toBe(CLOSE_SESSION_TAKEN_OVER);
    expect(connB.closed).toBeNull();
    expect(room.playerIds).toEqual(["sess-a"]);
  });

  it("accepts a new seat again after a full room's seat is finalized", async () => {
    const { ctx, room } = await setup();
    room["maxClients"] = 1;
    room.useReconnection = false;
    const connA = ctx.open("conn-1");
    await room._connect(connA, "sess-a");

    ctx.drop("conn-1");
    await room._close(connA); // no window — finalizes immediately, freeing the seat
    expect(room.playerIds).toEqual([]);

    const connB = ctx.open("conn-2");
    await room._connect(connB, "sess-b");
    expect(connB.closed).toBeNull();
    expect(room.playerIds).toEqual(["sess-b"]);
  });
});

describe("Room persistence (hibernation backstop)", () => {
  const build = (storage: FakeStorage) => {
    const ctx = new FakeCtx(storage);
    const room = new TestRoom({ id: "r", ctx });
    room["syncIntervalMs"] = 0; // immediate flush — these tests exercise persistence, not throttling
    return { ctx, room };
  };

  it("persists a snapshot promptly on join and coalesces state changes", async () => {
    const storage = new FakeStorage();
    const { ctx, room } = build(storage);
    await room._create();
    const conn = ctx.open("c1");
    await room._connect(conn, "sess-a"); // new seat → immediate persist

    const snap = storage.kv.get("tk:room") as Record<string, any>;
    expect(snap.v).toBe(1);
    expect(snap.seats).toEqual([{ id: "sess-a", data: { token: "data-sess-a" }, deadline: null }]);
    expect(snap.state.players["sess-a"]).toBe(0);

    // A state change coalesces: not written until persistIntervalMs elapses.
    room["setState"]({ players: { "sess-a": 42 } });
    await Promise.resolve(); // run the markStateChanged flush microtask
    expect((storage.kv.get("tk:room") as Record<string, any>).state.players["sess-a"]).toBe(0);
    await vi.advanceTimersByTimeAsync(room["persistIntervalMs"]);
    expect((storage.kv.get("tk:room") as Record<string, any>).state.players["sess-a"]).toBe(42);
  });

  it("restores state + seats on a cold start, and a client reclaims its seat", async () => {
    const storageA = new FakeStorage();
    {
      const { ctx, room } = build(storageA);
      await room._create();
      const conn = ctx.open("c1");
      await room._connect(conn, "sess-a");
    }
    const snap = structuredClone(storageA.kv.get("tk:room"));

    // Cold start: a fresh room instance over storage seeded with the snapshot.
    const storageB = new FakeStorage();
    storageB.kv.set("tk:room", snap);
    const { ctx: ctx2, room: room2 } = build(storageB);
    await room2._create();

    expect(room2.playerIds).toEqual(["sess-a"]);
    expect(room2["clientCount"]).toBe(1);
    expect(room2["clientList"]()[0].data.token).toBe("data-sess-a"); // client.data survived

    // The restored seat is disconnected; a reconnect reclaims it (reattach).
    const conn2 = ctx2.open("c2");
    await room2._connect(conn2, "sess-a");
    const welcome = conn2.frames().find((f) => f.t === "s:welcome");
    expect(welcome?.reconnected).toBe(true);
    expect(room2["clientCount"]).toBe(1);
  });

  it("drops the snapshot and alarm when the room empties", async () => {
    const storage = new FakeStorage();
    const { ctx, room } = build(storage);
    room.useReconnection = false;
    await room._create();
    const conn = ctx.open("c1");
    await room._connect(conn, "sess-a");
    expect(storage.kv.has("tk:room")).toBe(true);

    ctx.drop("c1");
    await room._close(conn); // no window → dispose → clearPersisted
    expect(storage.kv.has("tk:room")).toBe(false);
    expect(storage.alarm).toBeNull();
  });

  it("persists an open reconnection window and arms the alarm", async () => {
    const storage = new FakeStorage();
    const { ctx, room } = build(storage);
    room.windowSec = 5;
    await room._create();
    const conn = ctx.open("c1");
    await room._connect(conn, "sess-a");

    ctx.drop("c1");
    void room._close(conn); // onLeave opens a window → persist deadline + arm alarm
    await vi.advanceTimersByTimeAsync(1); // settle the persist/alarm microtasks

    const snap = storage.kv.get("tk:room") as Record<string, any>;
    expect(snap.seats[0].deadline).toBeTypeOf("number");
    expect(storage.alarm).toBeGreaterThan(0);
  });

  it("finalizes an elapsed reconnection window from the alarm after a cold start", async () => {
    // Room A opens a window and persists its deadline.
    const storageA = new FakeStorage();
    const { ctx: ctxA, room: roomA } = build(storageA);
    roomA.windowSec = 5;
    await roomA._create();
    const connA = ctxA.open("c1");
    await roomA._connect(connA, "sess-a");
    ctxA.drop("c1");
    void roomA._close(connA);
    await vi.advanceTimersByTimeAsync(1);
    const snap = structuredClone(storageA.kv.get("tk:room"));

    // Cold start: fresh room restores the disconnected seat + its window.
    const storageB = new FakeStorage();
    storageB.kv.set("tk:room", snap);
    const { ctx: ctxB, room: roomB } = build(storageB);
    roomB.windowSec = 5;
    await roomB._create();
    expect(roomB["clientCount"]).toBe(1);

    // The window elapsed while evicted; the alarm fires and finalizes the seat.
    const seat = (roomB as unknown as { records: Map<string, { reconnectDeadline: number }> })
      .records;
    seat.get("sess-a")!.reconnectDeadline = Date.now() - 1;
    await roomB._alarm();

    expect(roomB.playerIds).toEqual([]); // room code's expiry cleanup ran
    expect(roomB["clientCount"]).toBe(0);
    expect(roomB.events).toContain("expired:sess-a");
    expect(ctxB.reports.at(-1)).toEqual({ count: 0, sessions: [] }); // occupancy reported
    expect(storageB.kv.has("tk:room")).toBe(false); // disposed → snapshot dropped
  });

  it("grants restored connected seats a grace window instead of holding them forever", async () => {
    // Persist while the client is still CONNECTED (deadline null — the DO died
    // under them; no reconnection window was ever opened).
    const storageA = new FakeStorage();
    {
      const { ctx, room } = build(storageA);
      await room._create();
      await room._connect(ctx.open("c1"), "sess-a");
    }
    const snap = structuredClone(storageA.kv.get("tk:room")) as Record<string, any>;
    expect(snap.seats[0].deadline).toBeNull();

    const storageB = new FakeStorage();
    storageB.kv.set("tk:room", snap);
    const { ctx: ctxB, room: roomB } = build(storageB);
    await roomB._create();

    // The seat must carry an expiry now, and the alarm must be armed for it.
    expect(storageB.alarm).toBeGreaterThan(0);

    // Player never returns: past the grace window the alarm finalizes the seat.
    await vi.advanceTimersByTimeAsync(61_000);
    await roomB._alarm();
    expect(roomB["clientCount"]).toBe(0);
    expect(ctxB.reports.at(-1)).toEqual({ count: 0, sessions: [] });
  });
});

describe("Room flush throttling", () => {
  it("coalesces many mutations in one window into a single broadcast", async () => {
    const ctx = new FakeCtx();
    const room = new TestRoom({ id: ctx.roomId, ctx }); // default syncIntervalMs = 50
    await room._create(); // onCreate's setState schedules one flush (timer pending)

    // Several more mutations before the window boundary — all fold into that flush.
    room["setState"]({ players: { a: 1 } });
    room["markStateChanged"]();
    room["markStateChanged"]();
    expect(ctx.broadcastsOf("s:state")).toHaveLength(0); // nothing sent mid-window

    await vi.advanceTimersByTimeAsync(50);
    expect(ctx.broadcastsOf("s:state")).toHaveLength(1); // exactly one flush for the window
  });

  it("flushes immediately on a microtask when syncIntervalMs is 0", async () => {
    const ctx = new FakeCtx();
    const room = new TestRoom({ id: ctx.roomId, ctx });
    room["syncIntervalMs"] = 0;
    await room._create();
    const before = ctx.broadcastsOf("s:state").length;

    room["setState"]({ players: { a: 1 } });
    await Promise.resolve(); // no timer advance — the microtask flush runs on its own
    expect(ctx.broadcastsOf("s:state")).toHaveLength(before + 1);
  });

  it("clears the pending flush timer when the room disposes", async () => {
    const ctx = new FakeCtx();
    const room = new TestRoom({ id: ctx.roomId, ctx });
    room.useReconnection = false;
    await room._create();
    const conn = ctx.open("c1");
    await room._connect(conn, "sess-a"); // onJoin marks a change → flush timer pending

    ctx.drop("c1");
    await room._close(conn); // finalize → dispose → clearFlushTimer()

    const flushes = ctx.broadcastsOf("s:state").length;
    await vi.advanceTimersByTimeAsync(500);
    expect(ctx.broadcastsOf("s:state")).toHaveLength(flushes); // no leaked timer fired
  });
});

// --- state-shape versioning + migration ---

interface V2State {
  members: Record<string, number>;
}

/** Current-shape room (stateVersion 2) with a v1→v2 migration. */
class MigratedRoom extends Room<V2State> {
  protected override stateVersion = 2;
  migrateCalled = false;
  override onCreate(): void {
    this.setState({ members: {} });
  }
  override onJoin(client: Client): void {
    this.state.members[client.id] = 1;
  }
  protected override migrateState(from: number, old: unknown): V2State | null {
    this.migrateCalled = true;
    if (from !== 1) return null;
    // v1 had `players: Record<id, number>`; v2 renames it to `members`.
    const players = (old as { players?: Record<string, number> }).players ?? {};
    return { members: { ...players } };
  }
  get memberIds(): string[] {
    return Object.keys(this.state.members);
  }
}

/** Current-shape room with NO migration override → default discards on mismatch. */
class DiscardRoom extends Room<V2State> {
  protected override stateVersion = 2;
  override onCreate(): void {
    this.setState({ members: {} });
  }
  get memberIds(): string[] {
    return Object.keys(this.state.members);
  }
}

describe("Room state versioning + migration", () => {
  /** Persist a v1 snapshot (via the default-version TestRoom) and return it. */
  async function persistV1(): Promise<unknown> {
    const storage = new FakeStorage();
    const ctx = new FakeCtx(storage);
    const room = new TestRoom({ id: "r", ctx });
    room["syncIntervalMs"] = 0;
    await room._create();
    await room._connect(ctx.open("c1"), "sess-a"); // player sess-a = 0, snapshot v1
    const snap = storage.kv.get("tk:room") as Record<string, unknown>;
    expect(snap.stateVersion).toBe(1);
    return structuredClone(snap);
  }

  it("stamps the state version into the snapshot", async () => {
    const storage = new FakeStorage();
    const ctx = new FakeCtx(storage);
    const room = new MigratedRoom({ id: "r", ctx });
    room["syncIntervalMs"] = 0;
    await room._create();
    await room._connect(ctx.open("c1"), "sess-a");
    expect((storage.kv.get("tk:room") as Record<string, unknown>).stateVersion).toBe(2);
  });

  it("migrates an older snapshot through migrateState and restores its seats", async () => {
    const snap = await persistV1();
    const storage = new FakeStorage();
    storage.kv.set("tk:room", snap);

    const ctx = new FakeCtx(storage);
    const room = new MigratedRoom({ id: "r", ctx });
    room["syncIntervalMs"] = 0;
    await room._create();

    expect(room.migrateCalled).toBe(true);
    expect(room.memberIds).toEqual(["sess-a"]); // v1 players → v2 members
    expect(room["clientCount"]).toBe(1); // seats survived the migration
  });

  it("does not migrate when the versions already match", async () => {
    // Persist a v2 snapshot, then cold-start another v2 room over it.
    const storageA = new FakeStorage();
    const ctxA = new FakeCtx(storageA);
    const roomA = new MigratedRoom({ id: "r", ctx: ctxA });
    roomA["syncIntervalMs"] = 0;
    await roomA._create();
    await roomA._connect(ctxA.open("c1"), "sess-a");
    const snap = structuredClone(storageA.kv.get("tk:room"));

    const storageB = new FakeStorage();
    storageB.kv.set("tk:room", snap);
    const ctxB = new FakeCtx(storageB);
    const roomB = new MigratedRoom({ id: "r", ctx: ctxB });
    roomB["syncIntervalMs"] = 0;
    await roomB._create();

    expect(roomB.migrateCalled).toBe(false); // same version → migrate skipped
    expect(roomB.memberIds).toEqual(["sess-a"]);
  });

  it("discards a mismatched snapshot (and its seats) cleanly when no hook transforms it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const snap = await persistV1();
    const storage = new FakeStorage();
    storage.kv.set("tk:room", snap);

    const ctx = new FakeCtx(storage);
    const room = new DiscardRoom({ id: "r", ctx });
    room["syncIntervalMs"] = 0;
    await room._create(); // must not throw

    expect(room.memberIds).toEqual([]); // fresh onCreate state
    expect(room["clientCount"]).toBe(0); // seats dropped with the discarded state
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/Discarded a persisted snapshot/));
    warn.mockRestore();
  });
});
