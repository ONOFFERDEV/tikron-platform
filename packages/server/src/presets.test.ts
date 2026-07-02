import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
// Import the preset + core modules directly — index.js pulls in partyserver (a
// workerd-only dependency) which the node test runner cannot load.
import { TurnBasedRoom, CasualRealtimeRoom, IoArenaRoom } from "./presets.js";
import { Room, type Client, type RoomConnection, type RoomContext } from "./room.js";
import { schema, mapOf, type Codec } from "@tikron/schema";

// --- test doubles (trimmed from room.test.ts) ---

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
}

class FakeCtx implements RoomContext {
  readonly roomId = "test-room";
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
    const conn = new FakeConn(id);
    this.conns.set(id, conn);
    return conn;
  }
  drop(id: string): void {
    this.conns.delete(id);
  }
}

const tickHandle = (room: Room): unknown => (room as unknown as { tickHandle: unknown }).tickHandle;
const sendAcksOf = (room: Room): boolean => (room as unknown as { sendAcks: boolean }).sendAcks;

// --- concrete rooms per preset ---

interface CardState {
  turn: number;
}
class CardGame extends TurnBasedRoom<CardState> {
  override onCreate(): void {
    this.setState({ turn: 0 });
  }
}

interface CursorState {
  cursors: Record<string, number>;
}
class Whiteboard extends CasualRealtimeRoom<CursorState> {
  readonly expired: string[] = [];
  override onCreate(): void {
    this.setState({ cursors: {} });
  }
  override onJoin(client: Client): void {
    this.state.cursors[client.id] = 0;
  }
  protected override onSeatExpired(client: Client): void {
    this.expired.push(client.id);
    delete this.state.cursors[client.id];
  }
}

interface ArenaState {
  players: Record<string, { x: number; y: number }>;
}
const ArenaSchema: Codec<ArenaState> = schema({ players: mapOf(schema({ x: "f32", y: "f32" })) });

class Arena extends IoArenaRoom<ArenaState> {
  protected readonly codec = ArenaSchema;
  ticks = 0;
  override onReady(): void {
    this.setState({ players: {} });
  }
  protected override onTick(): void {
    this.ticks++;
  }
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("TurnBasedRoom", () => {
  it("runs no simulation tick", async () => {
    const room = new CardGame({ id: "r", ctx: new FakeCtx() });
    await room._create();
    expect(tickHandle(room)).toBeNull();
  });
});

describe("CasualRealtimeRoom", () => {
  it("holds a dropped seat for the window, then calls onSeatExpired on expiry", async () => {
    const ctx = new FakeCtx();
    const room = new Whiteboard({ id: "r", ctx });
    room["reconnectWindowSec"] = 5;
    await room._create();
    const conn = ctx.open("c1");
    await room._connect(conn, "sess-a");
    expect(room["state"].cursors["sess-a"]).toBe(0);

    ctx.drop("c1");
    const closing = room._close(conn); // preset onLeave opens the window

    await vi.advanceTimersByTimeAsync(1000);
    expect(room.expired).toEqual([]); // still inside the window — seat held

    await vi.advanceTimersByTimeAsync(5000);
    await closing;
    expect(room.expired).toEqual(["sess-a"]); // window lapsed → expiry hook ran once
    expect(room["state"].cursors["sess-a"]).toBeUndefined();
  });

  it("does not expire a seat that reconnects within the window", async () => {
    const ctx = new FakeCtx();
    const room = new Whiteboard({ id: "r", ctx });
    room["reconnectWindowSec"] = 5;
    await room._create();
    const conn1 = ctx.open("c1");
    await room._connect(conn1, "sess-a");

    ctx.drop("c1");
    const closing = room._close(conn1);
    await vi.advanceTimersByTimeAsync(1000);
    await room._connect(ctx.open("c2"), "sess-a"); // reattach within window
    await closing;

    expect(room.expired).toEqual([]);
    expect(room["state"].cursors["sess-a"]).toBe(0);
  });
});

describe("IoArenaRoom", () => {
  it("wires binary sync + acks and runs the simulation tick calling onTick", async () => {
    const room = new Arena({ id: "r", ctx: new FakeCtx() });
    room["tickMs"] = 50;
    await room._create();

    expect(sendAcksOf(room)).toBe(true); // input acks on for client reconciliation
    expect(tickHandle(room)).not.toBeNull(); // simulation loop started
    expect(room.ticks).toBe(0);

    await vi.advanceTimersByTimeAsync(150);
    expect(room.ticks).toBeGreaterThanOrEqual(3); // onTick fired each tick
  });

  it("throws an agent-legible error when the codec is missing", async () => {
    class NoCodec extends IoArenaRoom<ArenaState> {
      protected readonly codec = undefined as unknown as Codec<ArenaState>;
      protected override onTick(): void {}
    }
    const room = new NoCodec({ id: "r", ctx: new FakeCtx() });
    await expect(room._create()).rejects.toThrow(/IoArenaRoom requires a binary stateCodec/);
  });
});

describe("agent-friendly config errors", () => {
  it("rejects maxClients < 1 with a fix hint", async () => {
    class Bad extends TurnBasedRoom<CardState> {
      override onCreate(): void {
        this.setState({ turn: 0 });
        this["maxClients"] = 0;
      }
    }
    const room = new Bad({ id: "r", ctx: new FakeCtx() });
    await expect(room._create()).rejects.toThrow(/maxClients must be >= 1/);
  });

  it("rejects syncIntervalMs < 0 with a fix hint", async () => {
    class Bad extends TurnBasedRoom<CardState> {
      override onCreate(): void {
        this.setState({ turn: 0 });
        this["syncIntervalMs"] = -1;
      }
    }
    const room = new Bad({ id: "r", ctx: new FakeCtx() });
    await expect(room._create()).rejects.toThrow(/syncIntervalMs must be >= 0/);
  });

  it("rejects enableAOI() without a stateCodec, naming the fix", async () => {
    class Bad extends Room<ArenaState> {
      override onCreate(): void {
        this.setState({ players: {} });
        this["enableAOI"]({
          viewRadius: 1,
          mapFields: ["players"],
          position: (e) => e as { x: number; y: number },
          viewer: () => null,
        });
      }
    }
    const room = new Bad({ id: "r", ctx: new FakeCtx() });
    await expect(room._create()).rejects.toThrow(/enableAOI\(\) requires a binary stateCodec/);
  });

  it("rejects allowReconnection(seconds <= 0)", async () => {
    class Reco extends Room<CardState> {
      override onCreate(): void {
        this.setState({ turn: 0 });
      }
      hold(client: Client): Promise<void> {
        return this["allowReconnection"](client, 0);
      }
    }
    const ctx = new FakeCtx();
    const room = new Reco({ id: "r", ctx });
    await room._create();
    await room._connect(ctx.open("c1"), "sess-a");
    const client = room["clientList"]()[0]!;
    expect(() => room.hold(client)).toThrow(/allowReconnection\(seconds\) requires seconds > 0/);
  });

  it("warns (does not throw) on a sub-10ms simulation interval", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    class Fast extends IoArenaRoom<ArenaState> {
      protected readonly codec = ArenaSchema;
      protected override tickMs = 5;
      override onReady(): void {
        this.setState({ players: {} });
      }
      protected override onTick(): void {}
    }
    const room = new Fast({ id: "r", ctx: new FakeCtx() });
    await room._create();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/sub-10ms ticks pin the/));
    warn.mockRestore();
  });
});
