import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
// Import room.js / testing.js directly — index.js pulls in partyserver (a
// workerd-only dependency) which the node test runner cannot load.
import { Room, type Client, type RelayConfig, type RoomConnection } from "./room.js";
import { createTestRoom, type TestConnection } from "./testing.js";
import type { PerfSnapshot } from "./perf.js";
import { ClientMessageType, ServerMessageType, encode } from "@tikron/protocol";

interface GameState {
  moves: number;
}

/** Read a room's private perf snapshot (the tk:stats payload) directly. */
function snap<T>(room: Room<T>): PerfSnapshot {
  return (room as unknown as { perfSnapshot(): PerfSnapshot }).perfSnapshot();
}

/** The relayed `rtc` frames a connection actually received, payloads only. */
function relayed(c: TestConnection): Record<string, unknown>[] {
  return c
    .frames()
    .filter((f) => f.t === ServerMessageType.Message && f.type === "rtc")
    .map((f) => f.payload as Record<string, unknown>);
}

/** Feed a raw client frame straight into the room (batch frames, unseated conns). */
function deliver<T>(room: Room<T>, conn: RoomConnection, raw: string): Promise<void> {
  return (room as unknown as { _message(c: RoomConnection, r: string): Promise<void> })._message(
    conn,
    raw,
  );
}

/** The live transport connection behind a fake client (`conn-1` is the first connect). */
function connOf<T>(room: Room<T>, id: string): RoomConnection {
  const ctx = (room as unknown as { ctx: { connection(i: string): RoomConnection | undefined } }).ctx;
  const conn = ctx.connection(id);
  if (!conn) throw new Error(`no live connection ${id}`);
  return conn;
}

/** Developer message types a connection received, in order (relay ordering checks). */
function msgTypes(c: TestConnection): string[] {
  return c
    .frames()
    .filter((f) => f.t === ServerMessageType.Message)
    .map((f) => f.type as string);
}

/**
 * Baseline signaling room: `rtc` is relayed, `move` is an ordinary input. The two
 * budgets are deliberately tiny and DIFFERENT so a test can exhaust one and prove
 * the other is untouched.
 */
class SignalRoom extends Room<GameState> {
  protected override relay: RelayConfig = { types: ["rtc"], maxBytes: 64, perSecond: 4 };
  protected override maxInputsPerSecond = 3;
  readonly moves: string[] = [];

  override onCreate(): void {
    this.setState({ moves: 0 });
    this.onMessage("move", (client) => {
      this.moves.push(client.id);
      this.state.moves++;
      this.markStateChanged();
    });
  }

  /** Hold the seat so a test can address a seated-but-disconnected client. */
  override onLeave(client: Client): void {
    void this.allowReconnection(client, 30).catch(() => {});
  }
}

/** Same, but with a developer handler registered for the relayed type. */
class InspectingRoom extends SignalRoom {
  readonly seen: { id: string; payload: unknown }[] = [];

  override onCreate(): void {
    super.onCreate();
    this.onMessage("rtc", (client, payload) => {
      this.seen.push({ id: client.id, payload });
      // Observable ordering probe: peers see this AFTER the relayed frame.
      this.broadcast("marker", { n: this.seen.length });
    });
  }
}

/** Tick-aligned inputs — the relay must still bypass the queue entirely. */
class QueuedRoom extends Room<GameState> {
  protected override relay: RelayConfig = { types: ["rtc"] };
  protected override queueInputs = true;
  readonly moves: string[] = [];

  override onCreate(): void {
    this.setState({ moves: 0 });
    this.onMessage("move", (client: Client) => {
      this.moves.push(client.id);
    });
    this.setSimulationInterval(() => {}, 50);
  }
}

/** Only `types` set — exercises the documented `maxBytes` default (16384). */
class DefaultsRoom extends Room<GameState> {
  protected override relay: RelayConfig = { types: ["rtc"] };
  override onCreate(): void {
    this.setState({ moves: 0 });
  }
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("opaque peer relay", () => {
  it("stamps the real sender id over a client-supplied `from`", async () => {
    const h = await createTestRoom(SignalRoom);
    const alice = await h.connect("alice");
    const bob = await h.connect("bob");

    await alice.send("rtc", { from: "bob", sdp: "o" }); // spoofed sender

    expect(relayed(bob)).toEqual([{ from: "alice", sdp: "o" }]);
  });

  it("broadcasts to every peer except the sender when there is no `to`", async () => {
    const h = await createTestRoom(SignalRoom);
    const alice = await h.connect("alice");
    const bob = await h.connect("bob");
    const carol = await h.connect("carol");

    await alice.send("rtc", { sdp: "o" });

    expect(relayed(bob)).toEqual([{ from: "alice", sdp: "o" }]);
    expect(relayed(carol)).toEqual([{ from: "alice", sdp: "o" }]);
    expect(relayed(alice)).toEqual([]); // never echoed back
  });

  it("unicasts to the named `to` and no one else", async () => {
    const h = await createTestRoom(SignalRoom);
    const alice = await h.connect("alice");
    const bob = await h.connect("bob");
    const carol = await h.connect("carol");

    await alice.send("rtc", { to: "bob", ice: "c1" });

    expect(relayed(bob)).toEqual([{ to: "bob", ice: "c1", from: "alice" }]);
    expect(relayed(carol)).toEqual([]);
    expect(relayed(alice)).toEqual([]);
  });

  it("drops a `to` that names no seated client and counts relayBadTarget", async () => {
    const h = await createTestRoom(SignalRoom);
    const alice = await h.connect("alice");
    const bob = await h.connect("bob");

    await alice.send("rtc", { to: "mallory", ice: "c1" });

    expect(relayed(bob)).toEqual([]);
    expect(snap(h.room).drops.relayBadTarget).toBe(1);
  });

  it("drops a payload over maxBytes and counts relayOversized", async () => {
    const h = await createTestRoom(SignalRoom);
    const alice = await h.connect("alice");
    const bob = await h.connect("bob");

    await alice.send("rtc", { sdp: "x".repeat(100) }); // > the room's 64-byte cap

    expect(relayed(bob)).toEqual([]);
    expect(snap(h.room).drops.relayOversized).toBe(1);
  });

  it("applies the 16384-byte default cap when only `types` is configured", async () => {
    const h = await createTestRoom(DefaultsRoom);
    const alice = await h.connect("alice");
    const bob = await h.connect("bob");

    await alice.send("rtc", { sdp: "x".repeat(16_380) }); // 16390 encoded bytes
    expect(relayed(bob)).toEqual([]);
    expect(snap(h.room).drops.relayOversized).toBe(1);

    await alice.send("rtc", { sdp: "x".repeat(16_370) }); // 16380 encoded bytes — under
    expect(relayed(bob)).toHaveLength(1);
  });

  it("drops a non-object payload", async () => {
    const h = await createTestRoom(SignalRoom);
    const alice = await h.connect("alice");
    const bob = await h.connect("bob");

    await alice.send("rtc", "just-a-string");
    await alice.send("rtc", [1, 2, 3]);

    expect(relayed(bob)).toEqual([]);
  });

  it("ignores a relay from a connection that holds no seat", async () => {
    const h = await createTestRoom(SignalRoom);
    const bob = await h.connect("bob");
    const rogue: RoomConnection = { id: "rogue", send: () => {}, close: () => {} };

    await deliver(
      h.room,
      rogue,
      encode({ t: ClientMessageType.Message, type: "rtc", seq: 1, payload: { sdp: "o" } }),
    );

    expect(relayed(bob)).toEqual([]);
    expect(snap(h.room).drops.relayRateLimited).toBe(0);
  });

  it("spends the relay budget without touching the input budget", async () => {
    const h = await createTestRoom(SignalRoom);
    const alice = await h.connect("alice");
    const bob = await h.connect("bob");

    for (let i = 0; i < 9; i++) await alice.send("rtc", { n: i }); // perSecond = 4
    await alice.send("move", { x: 1 });

    expect(relayed(bob)).toHaveLength(4);
    expect(snap(h.room).drops.relayRateLimited).toBe(5);
    expect((h.room as SignalRoom).moves).toEqual(["alice"]); // the input got through the flood
    expect(snap(h.room).drops.rateLimited).toBe(0);
  });

  it("spends the input budget without touching the relay budget", async () => {
    const h = await createTestRoom(SignalRoom);
    const alice = await h.connect("alice");
    const bob = await h.connect("bob");

    for (let i = 0; i < 4; i++) await alice.send("move", { x: i }); // maxInputsPerSecond = 3
    await alice.send("rtc", { sdp: "o" });

    expect((h.room as SignalRoom).moves).toHaveLength(3);
    expect(snap(h.room).drops.rateLimited).toBe(1);
    expect(relayed(bob)).toEqual([{ from: "alice", sdp: "o" }]); // signaling still flows
    expect(snap(h.room).drops.relayRateLimited).toBe(0);
  });

  it("delivers relays immediately even when queueInputs defers ordinary inputs", async () => {
    const h = await createTestRoom(QueuedRoom);
    const alice = await h.connect("alice");
    const bob = await h.connect("bob");

    await alice.send("move", { x: 1 });
    await alice.send("rtc", { sdp: "o" });

    const room = h.room as QueuedRoom;
    expect(relayed(bob)).toEqual([{ from: "alice", sdp: "o" }]); // no tick needed
    expect(room.moves).toEqual([]); // the input is still waiting for the tick

    await h.advance(50);
    expect(room.moves).toEqual(["alice"]);
  });

  it("runs a handler registered for the relayed type after delivering the relay", async () => {
    const h = await createTestRoom(InspectingRoom);
    const alice = await h.connect("alice");
    const bob = await h.connect("bob");

    await alice.send("rtc", { sdp: "o" });

    expect(relayed(bob)).toEqual([{ from: "alice", sdp: "o" }]);
    expect((h.room as InspectingRoom).seen).toEqual([{ id: "alice", payload: { sdp: "o" } }]);
    // The handler's marker lands after the relayed frame, not before it.
    expect(msgTypes(bob)).toEqual(["rtc", "marker"]);
    expect(snap(h.room).drops.unknownType).toBe(0);
  });

  it("drops a `to` whose seat is inside a reconnection window", async () => {
    const h = await createTestRoom(SignalRoom);
    const alice = await h.connect("alice");
    const bob = await h.connect("bob");

    void bob.close(); // seat held, transport gone

    await alice.send("rtc", { to: "bob", ice: "c1" });

    expect(relayed(bob)).toEqual([]);
    expect(snap(h.room).drops.relayBadTarget).toBe(1);
  });

  it("caps broadcast fan-out on a room-wide budget that unicast bypasses", async () => {
    const h = await createTestRoom(SignalRoom);
    const alice = await h.connect("alice");
    const bob = await h.connect("bob");
    const carol = await h.connect("carol");

    for (let i = 0; i < 4; i++) await alice.send("rtc", { n: i }); // fills the room bucket
    await bob.send("rtc", { n: "bcast" }); // bob's own bucket is free, the room's is not
    await bob.send("rtc", { to: "alice", ice: "c1" }); // unicast is exempt

    expect(relayed(carol)).toHaveLength(4); // bob's broadcast never landed
    expect(snap(h.room).drops.relayRateLimited).toBe(1);
    expect(relayed(alice)).toEqual([{ to: "alice", ice: "c1", from: "bob" }]);
  });

  it("relays and processes inputs from the same c:mbatch frame", async () => {
    const h = await createTestRoom(SignalRoom);
    const alice = await h.connect("alice");
    const bob = await h.connect("bob");

    await deliver(
      h.room,
      connOf(h.room, "conn-1"),
      encode({
        t: ClientMessageType.MessageBatch,
        msgs: [
          { t: ClientMessageType.Message, type: "rtc", seq: 1, payload: { sdp: "o" } },
          { t: ClientMessageType.Message, type: "move", seq: 2, payload: { x: 1 } },
        ],
      }),
    );

    expect(relayed(bob)).toEqual([{ from: "alice", sdp: "o" }]);
    expect((h.room as SignalRoom).moves).toEqual(["alice"]);
    expect(snap(h.room).drops.relayRateLimited).toBe(0);
    expect(snap(h.room).drops.rateLimited).toBe(0);
  });
});
