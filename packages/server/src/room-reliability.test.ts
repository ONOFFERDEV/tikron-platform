import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
// Import room.js directly — index.js pulls in partyserver (a workerd-only
// dependency) which the node test runner cannot load. define-room.ts is likewise
// partyserver-tainted, so the AuthResult DERIVATION (onAuth -> client.auth) and the
// 4004 reject are covered by the gateway's Workers-pool tests; here we test the
// packages/server contract those depend on: _connect threading auth to client.auth.
import {
  Room,
  type Client,
  type ClientAuth,
  type RoomConnection,
  type RoomContext,
  type RoomStorage,
  type RoomErrorContext,
} from "./room.js";
import type { PerfSnapshot } from "./perf.js";

/** In-memory RoomStorage double whose put() can be made to fail (F002). */
class FakeStorage implements RoomStorage {
  readonly kv = new Map<string, unknown>();
  alarm: number | null = null;
  failPut = false;
  putCalls = 0;

  async get<T>(key: string): Promise<T | undefined> {
    return this.kv.get(key) as T | undefined;
  }
  async put(key: string, value: unknown): Promise<void> {
    this.putCalls++;
    if (this.failPut) throw new Error("storage put failed (simulated)");
    this.kv.set(key, structuredClone(value));
  }
  async delete(key: string): Promise<boolean> {
    return this.kv.delete(key);
  }
  async setAlarm(t: number): Promise<void> {
    this.alarm = t;
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
  frames(): Record<string, unknown>[] {
    return this.sent
      .filter((d): d is string => typeof d === "string")
      .map((d) => JSON.parse(d) as Record<string, unknown>);
  }
}

class FakeCtx implements RoomContext {
  readonly roomId = "test-room";
  readonly conns = new Map<string, FakeConn>();
  readonly broadcasts: Record<string, unknown>[] = [];
  constructor(
    readonly storage?: FakeStorage,
    readonly devMode = false,
  ) {}
  connections(): Iterable<RoomConnection> {
    return this.conns.values();
  }
  connection(id: string): RoomConnection | undefined {
    return this.conns.get(id);
  }
  broadcastRaw(data: string): void {
    this.broadcasts.push(JSON.parse(data) as Record<string, unknown>);
  }
  reportOccupancy(): void {}
  open(id: string): FakeConn {
    const conn = new FakeConn(id);
    this.conns.set(id, conn);
    return conn;
  }
  stateBroadcasts(): number {
    return this.broadcasts.filter((b) => b.t === "s:state").length;
  }
}

const cmsg = (type: string, seq: number, payload: unknown = {}): string =>
  JSON.stringify({ t: "c:msg", type, seq, payload });

/** Read a room's private perf snapshot (the tk:stats payload) directly. */
function snap<T>(room: Room<T>): PerfSnapshot {
  return (room as unknown as { perfSnapshot(): PerfSnapshot }).perfSnapshot();
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// --- F106: handler isolation (+ LAT-2 coalescing guard) ---

class IsolationRoom extends Room<{ n: number }> {
  readonly processed: string[] = [];
  readonly errors: RoomErrorContext[] = [];
  override onCreate(): void {
    this.setState({ n: 0 });
    this.queueInputs = true;
    this.sendAcks = true;
    this.syncIntervalMs = 50;
    this.onMessage("ok", (_c, _p, seq) => {
      this.processed.push(`ok:${String(seq)}`);
      this.state.n++;
      this.markStateChanged();
    });
    this.onMessage("boom", () => {
      throw new Error("handler boom");
    });
    this.setSimulationInterval(() => {}, 50);
  }
  protected override onError(_err: unknown, ctx: RoomErrorContext): void {
    this.errors.push(ctx);
  }
}

describe("F106 handler isolation", () => {
  it("a throwing handler doesn't kill the tick batch: 1 & 3 process, all acked, onError once", async () => {
    const ctx = new FakeCtx();
    const room = new IsolationRoom({ id: "r", ctx });
    await room._create();
    const conn = ctx.open("c1");
    await room._connect(conn, "sess");

    await room._message(conn, cmsg("ok", 1));
    await room._message(conn, cmsg("boom", 2)); // handler throws
    await room._message(conn, cmsg("ok", 3));
    expect(room.processed).toEqual([]); // still queued until the tick

    await vi.advanceTimersByTimeAsync(50); // one tick drains the batch

    // 1 and 3 ran despite 2 throwing.
    expect(room.processed).toEqual(["ok:1", "ok:3"]);
    // The throw surfaced exactly once, as an onMessage error naming the type + client.
    expect(room.errors).toEqual([{ phase: "onMessage", type: "boom", clientId: "sess" }]);
    // Every input is acked regardless of the throw (its seq was already consumed).
    expect(conn.frames().filter((f) => f.t === "s:ack").map((f) => f.seq)).toEqual([1, 2, 3]);
  });

  it("LAT-2 guard: the batch still coalesces to exactly one flush despite the throw", async () => {
    const ctx = new FakeCtx();
    const room = new IsolationRoom({ id: "r", ctx });
    await room._create();
    const conn = ctx.open("c1");
    await room._connect(conn, "sess");

    // Let the onCreate setState flush settle first, so we measure only the batch's
    // flush. Empty ticks in this window don't flush.
    await vi.advanceTimersByTimeAsync(100);
    const before = ctx.stateBroadcasts();

    await room._message(conn, cmsg("ok", 1));
    await room._message(conn, cmsg("boom", 2));
    await room._message(conn, cmsg("ok", 3));

    await vi.advanceTimersByTimeAsync(50); // one tick drains (two mutations + one throw)
    await vi.advanceTimersByTimeAsync(60); // let the coalesced flush fire

    // Two mutations + a throwing handler still collapse into ONE state flush.
    expect(ctx.stateBroadcasts() - before).toBe(1);
  });
});

// --- F120: onError hook + onTick isolation ---

class TickErrorRoom extends Room<{ n: number }> {
  throwNext = true;
  ticks = 0;
  readonly errors: RoomErrorContext[] = [];
  captureErrors = true;
  override onCreate(): void {
    this.setState({ n: 0 });
    this.setSimulationInterval(() => {
      this.ticks++;
      if (this.throwNext) {
        this.throwNext = false;
        throw new Error("tick boom");
      }
    }, 50);
  }
  protected override onError(err: unknown, ctx: RoomErrorContext): void {
    if (this.captureErrors) this.errors.push(ctx);
    else super.onError(err, ctx);
  }
}

describe("F120 error hook", () => {
  it("routes a throwing onTick to onError and keeps ticking; errors show on tk:stats", async () => {
    const room = new TickErrorRoom({ id: "r", ctx: new FakeCtx() });
    await room._create();

    await vi.advanceTimersByTimeAsync(50); // tick 1 throws
    expect(room.ticks).toBe(1);
    expect(room.errors).toEqual([{ phase: "onTick" }]);
    expect(snap(room).errors).toBe(1);

    await vi.advanceTimersByTimeAsync(50); // tick 2 runs clean
    expect(room.ticks).toBe(2);
    expect(room.errors).toHaveLength(1); // no new error
  });

  it("the DEFAULT onError logs a structured, greppable console.error line", async () => {
    const room = new TickErrorRoom({ id: "room-xyz", ctx: new FakeCtx() });
    room.captureErrors = false; // fall through to the base console.error
    await room._create();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    await vi.advanceTimersByTimeAsync(50); // throws → default onError

    expect(err).toHaveBeenCalledTimes(1);
    expect(String(err.mock.calls[0]![0])).toContain("room=room-xyz");
    expect(String(err.mock.calls[0]![0])).toContain("phase=onTick");
  });

  it("an onError override that itself throws is caught (no silent failure)", async () => {
    class BadHook extends Room<{ n: number }> {
      override onCreate(): void {
        this.setState({ n: 0 });
        this.setSimulationInterval(() => {
          throw new Error("tick boom");
        }, 50);
      }
      protected override onError(): void {
        throw new Error("hook boom");
      }
    }
    const room = new BadHook({ id: "r", ctx: new FakeCtx() });
    await room._create();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    await vi.advanceTimersByTimeAsync(50); // tick throws → hook throws → caught

    // The throwing hook is caught and falls back to a console.error rather than
    // escaping as an unhandled rejection.
    expect(err).toHaveBeenCalledTimes(1);
    expect(String(err.mock.calls[0]![0])).toContain("onError hook threw");
    // The simulation survived: the next tick also throws and is caught again.
    await vi.advanceTimersByTimeAsync(50);
    expect(err).toHaveBeenCalledTimes(2);
  });
});

// --- F119: drop counters + once-per-type warn ---

class DropRoom extends Room<{ n: number }> {
  constructor(init: { id: string; ctx: RoomContext }, maxRate = 30) {
    super(init);
    this.maxInputsPerSecond = maxRate;
  }
  override onCreate(): void {
    this.setState({ n: 0 });
    this.onMessage("known", () => {});
  }
}

describe("F119 drop diagnostics", () => {
  it("unknown type: counts every drop and warns ONCE PER TYPE even without DEV_MODE", async () => {
    const ctx = new FakeCtx(undefined, /* devMode */ false);
    const room = new DropRoom({ id: "r", ctx });
    await room._create();
    const conn = ctx.open("c1");
    await room._connect(conn, "sess");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await room._message(conn, cmsg("typo", 1));
    await room._message(conn, cmsg("typo", 2)); // same unknown type again
    await room._message(conn, cmsg("otherTypo", 3)); // a different unknown type

    expect(snap(room).drops.unknownType).toBe(3); // counter tracks every drop
    // One warn per DISTINCT type (dedup), unconditional (self-hosted has no DEV_MODE).
    expect(warn).toHaveBeenCalledTimes(2);
    expect(String(warn.mock.calls[0]![0])).toContain("unknown type");
  });

  it("rate-limit drops increment the counter and stay quiet without DEV_MODE", async () => {
    const ctx = new FakeCtx(undefined, false);
    const room = new DropRoom({ id: "r", ctx }, /* maxRate */ 2);
    await room._create();
    const conn = ctx.open("c1");
    await room._connect(conn, "sess");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await room._message(conn, cmsg("known", 1));
    await room._message(conn, cmsg("known", 2));
    await room._message(conn, cmsg("known", 3)); // over 2/s → dropped

    expect(snap(room).drops.rateLimited).toBe(1);
    expect(warn).not.toHaveBeenCalled(); // non-unknown reasons are DEV_MODE-only
  });

  it("under DEV_MODE, a rate-limit drop warns once", async () => {
    const ctx = new FakeCtx(undefined, /* devMode */ true);
    const room = new DropRoom({ id: "r", ctx }, 1);
    await room._create();
    const conn = ctx.open("c1");
    await room._connect(conn, "sess");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await room._message(conn, cmsg("known", 1));
    await room._message(conn, cmsg("known", 2)); // dropped
    await room._message(conn, cmsg("known", 3)); // dropped again

    expect(snap(room).drops.rateLimited).toBe(2);
    expect(warn).toHaveBeenCalledTimes(1); // once, deduped
  });

  it("counts stale-seq drops", async () => {
    const ctx = new FakeCtx();
    const room = new DropRoom({ id: "r", ctx });
    await room._create();
    const conn = ctx.open("c1");
    await room._connect(conn, "sess");

    await room._message(conn, cmsg("known", 5));
    await room._message(conn, cmsg("known", 3)); // seq <= last → stale
    await room._message(conn, cmsg("known", 5)); // replayed → stale

    expect(snap(room).drops.staleSeq).toBe(2);
  });

  it("counts oversized-batch drops", async () => {
    const ctx = new FakeCtx();
    const room = new DropRoom({ id: "r", ctx });
    await room._create();
    const conn = ctx.open("c1");
    await room._connect(conn, "sess");

    const over = JSON.stringify({
      t: "c:mbatch",
      msgs: Array.from({ length: 17 }, (_, i) => ({ t: "c:msg", type: "known", seq: i + 1 })),
    });
    await room._message(conn, over);

    expect(snap(room).drops.oversizedBatch).toBe(1);
  });

  it("caps the warned-key set so a client spamming distinct types can't grow it unbounded", async () => {
    const ctx = new FakeCtx();
    const room = new DropRoom({ id: "r", ctx }, /* maxRate */ 500); // avoid rate-limit interference
    await room._create();
    const conn = ctx.open("c1");
    await room._connect(conn, "sess");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    for (let i = 0; i < 70; i++) {
      await room._message(conn, cmsg(`weird-${i}`, i + 1));
    }

    expect(snap(room).drops.unknownType).toBe(70); // every drop still counted
    expect(warn.mock.calls.length).toBeLessThanOrEqual(64); // but warnings are capped
  });

  it("exposes drops + errors on the tk:stats reply (additive JSON)", async () => {
    const ctx = new FakeCtx();
    const room = new DropRoom({ id: "r", ctx });
    await room._create();
    const conn = ctx.open("c1");
    await room._connect(conn, "sess");
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await room._message(conn, cmsg("typo", 1)); // one unknownType drop
    await room._message(conn, JSON.stringify({ t: "c:msg", type: "tk:stats", seq: 2 }));

    const reply = conn.frames().find((f) => f.type === "tk:stats");
    expect(reply).toBeDefined();
    const payload = reply!.payload as PerfSnapshot;
    expect(payload.drops).toEqual({ rateLimited: 0, staleSeq: 0, oversizedBatch: 0, unknownType: 1 });
    expect(payload.errors).toBe(0);
  });
});

// --- F002: persist-failure surfacing ---

class PersistRoom extends Room<{ n: number }> {
  readonly errors: RoomErrorContext[] = [];
  override onCreate(): void {
    this.setState({ n: 0 });
  }
  protected override onError(_err: unknown, ctx: RoomErrorContext): void {
    this.errors.push(ctx);
  }
  bump(): void {
    this.state.n++;
    this.markStateChanged();
  }
  save(): Promise<void> {
    return this.forcePersist();
  }
  get n(): number {
    return this.state.n;
  }
}

describe("F002 persist-failure", () => {
  it("routes every failed persist to onError but logs actionable guidance once per room", async () => {
    const storage = new FakeStorage();
    const room = new PersistRoom({ id: "r", ctx: new FakeCtx(storage) });
    await room._create();
    room.bump(); // n = 1
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    storage.failPut = true;

    await room.save(); // failure 1
    await room.save(); // failure 2

    // onError fires on EVERY failure (error count reflects both).
    expect(room.errors.filter((c) => c.phase === "persist")).toHaveLength(2);
    // The actionable guidance console.error is emitted once per room.
    expect(err).toHaveBeenCalledTimes(1);
    expect(String(err.mock.calls[0]![0])).toContain("forcePersist");
    // The live in-memory state is untouched by the failed write.
    expect(room.n).toBe(1);
  });
});

// --- F052: forcePersist immediacy ---

describe("F052 forcePersist", () => {
  it("writes immediately without waiting for the coalescing window", async () => {
    const storage = new FakeStorage();
    const room = new PersistRoom({ id: "r", ctx: new FakeCtx(storage) });
    await room._create();
    room.bump(); // schedules a coalesced write only (no put yet)
    expect(storage.putCalls).toBe(0);

    await room.save(); // forcePersist → immediate

    expect(storage.putCalls).toBe(1);
    const written = storage.kv.get("tk:room") as { state: { n: number } };
    expect(written.state.n).toBe(1);
  });
});

// --- F094: client.auth threading (live-only) ---

class AuthRoom extends Room<{ players: Record<string, number> }> {
  readonly joined: Array<{ id: string; authId?: string; keyed: string }> = [];
  reconnectAuth: ClientAuth | undefined | "never" = "never";
  override onCreate(): void {
    this.setState({ players: {} });
  }
  override onJoin(client: Client): void {
    // The leaderboard/identity keying pattern the demos use.
    this.joined.push({ id: client.id, authId: client.auth?.id, keyed: client.auth?.id ?? client.id });
  }
  override onReconnect(client: Client): void {
    this.reconnectAuth = client.auth;
  }
  save(): Promise<void> {
    return this.forcePersist();
  }
}

describe("F094 client.auth (live-only)", () => {
  it("an authed connect exposes client.auth and keys identity on auth.id", async () => {
    const ctx = new FakeCtx();
    const room = new AuthRoom({ id: "r", ctx });
    await room._create();
    const auth: ClientAuth = { id: "user-42", claims: { sub: "user-42", role: "admin" } };
    await room._connect(ctx.open("c1"), "sess-uuid", auth);

    expect(room.joined).toEqual([{ id: "sess-uuid", authId: "user-42", keyed: "user-42" }]);
  });

  it("an anonymous connect has no client.auth and falls back to the session id", async () => {
    const ctx = new FakeCtx();
    const room = new AuthRoom({ id: "r", ctx });
    await room._create();
    await room._connect(ctx.open("c1"), "sess-uuid"); // no auth

    expect(room.joined).toEqual([{ id: "sess-uuid", authId: undefined, keyed: "sess-uuid" }]);
  });

  it("is live-only: a seat restored after eviction carries no auth", async () => {
    const storage = new FakeStorage();
    const ctx1 = new FakeCtx(storage);
    const room1 = new AuthRoom({ id: "r", ctx: ctx1 });
    await room1._create();
    await room1._connect(ctx1.open("c1"), "sess-uuid", { id: "user-42", claims: {} });
    await room1.save(); // persist the seat

    // Cold start against the same storage (simulated eviction), then reattach.
    const ctx2 = new FakeCtx(storage);
    const room2 = new AuthRoom({ id: "r", ctx: ctx2 });
    await room2._create(); // restore() rebuilds the seat with NO auth
    await room2._connect(ctx2.open("c2"), "sess-uuid"); // reattach

    expect(room2.reconnectAuth).toBeUndefined(); // auth was not persisted
  });
});
