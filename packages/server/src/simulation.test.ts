import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Room, type Client, type RoomConnection, type RoomContext } from "./room.js";

// --- minimal fakes ---

class FakeConn implements RoomConnection {
  readonly sent: (string | ArrayBuffer | ArrayBufferView)[] = [];
  closed = false;
  constructor(readonly id: string) {}
  send(data: string | ArrayBuffer | ArrayBufferView): void {
    this.sent.push(data);
  }
  close(): void {
    this.closed = true;
  }
  frames(): Record<string, unknown>[] {
    return this.sent
      .filter((d): d is string => typeof d === "string")
      .map((d) => JSON.parse(d) as Record<string, unknown>);
  }
}

class FakeCtx implements RoomContext {
  readonly roomId = "sim-room";
  readonly conns = new Map<string, FakeConn>();
  connections(): Iterable<RoomConnection> {
    return this.conns.values();
  }
  connection(id: string): RoomConnection | undefined {
    return this.conns.get(id);
  }
  broadcastRaw(): void {}
  reportOccupancy(): void {}
  open(id: string): FakeConn {
    const c = new FakeConn(id);
    this.conns.set(id, c);
    return c;
  }
}

const cmsg = (type: string, payload: unknown, seq: number): string =>
  JSON.stringify({ t: "c:msg", type, seq, payload });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

// --- accumulator (fixed timestep) ---

class TickRoom extends Room<{ n: number }> {
  readonly dts: number[] = [];
  lagCount = 0;
  override onCreate(): void {
    this.setState({ n: 0 });
    this.setSimulationInterval((dt) => this.dts.push(dt), 50);
  }
  protected override onSimulationLag(): void {
    this.lagCount++;
  }
  get tick(): number {
    return this["currentTick"];
  }
  backdateLastTick(ms: number): void {
    this["lastTickAt"] = Date.now() - ms;
  }
}

describe("fixed-timestep accumulator", () => {
  it("calls the tick fn with a FIXED dt once per interval and advances currentTick", async () => {
    const room = new TickRoom({ id: "r", ctx: new FakeCtx() });
    await room._create();

    await vi.advanceTimersByTimeAsync(150); // three 50ms fires
    expect(room.dts).toEqual([50, 50, 50]);
    expect(room.tick).toBe(3);
    expect(room.lagCount).toBe(0);
  });

  it("caps catch-up at 5 ticks and reports the lag once when far behind", async () => {
    const room = new TickRoom({ id: "r", ctx: new FakeCtx() });
    await room._create();

    // Simulate a 1000ms stall since the last tick, then a single interval fire:
    // 1050ms / 50 = 21 steps, capped to 5, backlog dropped.
    room.backdateLastTick(1000);
    await vi.advanceTimersByTimeAsync(50);

    expect(room.dts).toHaveLength(5);
    expect(room.dts.every((d) => d === 50)).toBe(true);
    expect(room.lagCount).toBe(1);
  });
});

// --- tick-aligned input queue ---

class QueueRoom extends Room<{ n: number }> {
  readonly processed: Array<{ type: string; seq?: number }> = [];
  override onCreate(): void {
    this.setState({ n: 0 });
    this.queueInputs = true;
    this.sendAcks = true;
    this.onMessage("a", (_c, _p, seq) => void this.processed.push({ type: "a", seq }));
    this.onMessage("b", (_c, _p, seq) => void this.processed.push({ type: "b", seq }));
    this.setSimulationInterval(() => {}, 50);
  }
}

describe("tick-aligned input queue", () => {
  it("defers inputs to the next tick, draining them in arrival order and acking on process", async () => {
    const ctx = new FakeCtx();
    const room = new QueueRoom({ id: "r", ctx });
    await room._create();
    const conn = ctx.open("c1");
    await room._connect(conn, "sess");

    await room._message(conn, cmsg("a", {}, 1));
    await room._message(conn, cmsg("b", {}, 2));
    await room._message(conn, cmsg("a", {}, 3));

    // Nothing processed yet — inputs are queued until the tick boundary.
    expect(room.processed).toEqual([]);
    expect(conn.frames().filter((f) => f.t === "s:ack")).toEqual([]);

    await vi.advanceTimersByTimeAsync(50); // one tick → drain

    expect(room.processed).toEqual([
      { type: "a", seq: 1 },
      { type: "b", seq: 2 },
      { type: "a", seq: 3 },
    ]);
    // Acks are sent when the queued input is PROCESSED (at the tick), in order.
    expect(conn.frames().filter((f) => f.t === "s:ack").map((f) => f.seq)).toEqual([1, 2, 3]);
  });

  it("rejects queueInputs without a simulation interval, with a fix hint", async () => {
    class BadQueue extends Room<{ n: number }> {
      override onCreate(): void {
        this.setState({ n: 0 });
        this.queueInputs = true; // but no setSimulationInterval → nothing drains it
      }
    }
    const room = new BadQueue({ id: "r", ctx: new FakeCtx() });
    await expect(room._create()).rejects.toThrow(/queueInputs requires a simulation interval/);
  });
});

// --- clock-sync answer ---

class PlainRoom extends Room<{ n: number }> {
  override onCreate(): void {
    this.setState({ n: 0 });
  }
}

describe("clock-sync (server answers c:time)", () => {
  it("replies to c:time with s:time echoing t0 plus the server time", async () => {
    const ctx = new FakeCtx();
    const room = new PlainRoom({ id: "r", ctx });
    await room._create();
    const conn = ctx.open("c1");
    await room._connect(conn, "sess");

    await room._message(conn, JSON.stringify({ t: "c:time", t0: 12345 }));

    const reply = conn.frames().find((f) => f.t === "s:time");
    expect(reply).toBeDefined();
    expect(reply!.t0).toBe(12345);
    expect(typeof reply!.serverTime).toBe("number");
  });
});
