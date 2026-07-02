import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
// Import room.js directly — index.js pulls in partyserver (a workerd-only
// dependency), which the node test runner cannot load.
import {
  Room,
  CLOSE_SESSION_TAKEN_OVER,
  type Client,
  type RoomConnection,
  type RoomContext,
} from "./room.js";

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
});
