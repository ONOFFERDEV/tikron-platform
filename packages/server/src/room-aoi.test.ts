import { describe, it, expect } from "vitest";
// Import room.js directly — index.js pulls in partyserver (workerd-only).
import { Room, type RoomConnection, type RoomContext } from "./room.js";
import { ClientMessageType, ServerMessageType, encode } from "@tikron/protocol";
import { schema, mapOf, decodeFull, applyDelta, type Codec } from "@tikron/schema";

// --- test doubles ---

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
}

// --- AOI room under test ---

interface St {
  players: Record<string, { x: number; y: number }>;
}
const StSchema: Codec<St> = schema({ players: mapOf(schema({ x: "f32", y: "f32" })) });

class AoiRoom extends Room<St> {
  override onCreate(): void {
    this.stateCodec = StSchema;
    this.syncIntervalMs = 0; // flush on a microtask — no fake timers needed
    this.setState({ players: {} });
    this.enableAOI({
      viewRadius: 100,
      mapFields: ["players"],
      position: (e) => e as { x: number; y: number },
      viewer: (s, id) => s.players[id] ?? null,
    });
  }
  join(id: string, x: number, y: number): void {
    this.state.players[id] = { x, y };
    this.markStateChanged();
  }
  /** Mutate a live entity IN PLACE (the queryRadius aliasing hazard). */
  mutateInPlace(id: string, x: number, y: number): void {
    const p = this.state.players[id];
    if (p) {
      p.x = x;
      p.y = y;
    }
    this.markStateChanged();
  }
  poke(): void {
    this.markStateChanged();
  }
}

// Drain immediate-mode microtask flushes.
async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

const STATE_HEADER_BYTES = 13;

/** Decode the binary state frames a connection received (full/delta stream). */
function decodeStates(conn: FakeConn): St[] {
  const out: St[] = [];
  let prev: St | undefined;
  for (const d of conn.sent) {
    if (typeof d === "string") continue;
    const bytes = d instanceof Uint8Array ? d : new Uint8Array(d as ArrayBuffer);
    if (bytes.length < STATE_HEADER_BYTES) continue;
    const body = bytes.subarray(STATE_HEADER_BYTES);
    if (bytes[0] === 0x01) prev = decodeFull(StSchema, body);
    else if (bytes[0] === 0x02) prev = applyDelta(StSchema, prev, body);
    else continue;
    out.push(prev);
  }
  return out;
}

function binaryCount(conn: FakeConn): number {
  return conn.sent.filter((d) => typeof d !== "string").length;
}

describe("flushAOI global change-guard", () => {
  it("skips the entire flush (no frame) when nothing changed and no full is pending", async () => {
    const ctx = new FakeCtx();
    const room = new AoiRoom({ id: "r", ctx });
    await room._create();
    const a = ctx.open("c1");
    await room._connect(a, "a");
    room.join("a", 0, 0);
    await flush();
    const afterFirst = binaryCount(a);
    expect(afterFirst).toBeGreaterThanOrEqual(1); // got the initial full snapshot

    // A flush with no state change must send this client nothing more.
    room.poke();
    await flush();
    expect(binaryCount(a)).toBe(afterFirst);
  });
});

describe("flushAOI baseline is a value snapshot, not a live reference", () => {
  it("delivers a moved entity after an in-place mutation (no aliasing corruption)", async () => {
    const ctx = new FakeCtx();
    const room = new AoiRoom({ id: "r", ctx });
    await room._create();
    const a = ctx.open("c1");
    await room._connect(a, "a");
    room.join("a", 0, 0);
    await flush();

    // Mutate the SAME entity object queryRadius handed to the last baseline. If the
    // baseline had stored that live ref, prev would already equal the new view and
    // encodeDeltaOrNull would return null — the client would never see the move.
    room.mutateInPlace("a", 50, 0);
    await flush();

    const states = decodeStates(a);
    expect(states.at(-1)!.players.a).toEqual({ x: 50, y: 0 });
  });
});

describe("flushAOI per-viewer delta-or-null", () => {
  it("sends a delta only to viewers whose own view changed", async () => {
    const ctx = new FakeCtx();
    const room = new AoiRoom({ id: "r", ctx });
    await room._create();
    const a = ctx.open("c1");
    await room._connect(a, "a");
    const b = ctx.open("c2");
    await room._connect(b, "b");
    room.join("a", 0, 0);
    room.join("b", 1000, 1000); // far outside A's/B's mutual view radius (100)
    await flush();
    const aBefore = binaryCount(a);
    const bBefore = binaryCount(b);

    // A moves within its own cell; B (far away) sees no change → B gets no frame.
    room.mutateInPlace("a", 10, 0);
    await flush();
    expect(binaryCount(a)).toBe(aBefore + 1); // A's view changed → delta
    expect(binaryCount(b)).toBe(bBefore); // B's view unchanged → skipped
  });
});

describe("tk:stats timing report", () => {
  it("answers a tk:stats poll with the p50/p95/max/n contract", async () => {
    const ctx = new FakeCtx();
    const room = new AoiRoom({ id: "r", ctx });
    await room._create();
    const a = ctx.open("c1");
    await room._connect(a, "a");
    room.join("a", 0, 0);
    await flush(); // at least one flush recorded

    await room._message(
      a,
      encode({ t: ClientMessageType.Message, type: "tk:stats", seq: 1, payload: undefined }),
    );

    const reply = a.sent
      .filter((d): d is string => typeof d === "string")
      .map((d) => JSON.parse(d) as Record<string, unknown>)
      .find((m) => m.t === ServerMessageType.Message && m.type === "tk:stats");
    expect(reply).toBeDefined();

    const payload = reply!.payload as {
      tick: { p50: number; p95: number; max: number; n: number };
      flush: { p50: number; p95: number; max: number; n: number };
      windowMs: number;
    };
    expect(payload.windowMs).toBe(10_000);
    for (const stage of [payload.tick, payload.flush]) {
      for (const k of ["p50", "p95", "max", "n"] as const) {
        expect(typeof stage[k]).toBe("number");
      }
    }
    expect(payload.flush.n).toBeGreaterThanOrEqual(1); // a flush happened
  });

  it("ignores tk:stats once the client's rate limit is exhausted", async () => {
    const ctx = new FakeCtx();
    const room = new AoiRoom({ id: "r", ctx });
    await room._create();
    room["maxInputsPerSecond"] = 1; // one developer message per second
    const a = ctx.open("c1");
    await room._connect(a, "a");

    const poll = (): Promise<void> =>
      room._message(
        a,
        encode({ t: ClientMessageType.Message, type: "tk:stats", seq: 0, payload: undefined }),
      );
    await poll(); // consumes the single token → answered
    await poll(); // over the limit → dropped before the tk:stats branch

    const replies = a.sent
      .filter((d): d is string => typeof d === "string")
      .map((d) => JSON.parse(d) as Record<string, unknown>)
      .filter((mm) => mm.t === ServerMessageType.Message && mm.type === "tk:stats");
    expect(replies.length).toBe(1); // the flooding second poll produced no snapshot
  });

  it("ignores tk:stats from a connection with no seat", async () => {
    const ctx = new FakeCtx();
    const room = new AoiRoom({ id: "r", ctx });
    await room._create();
    const ghost = ctx.open("ghost"); // never went through _connect → unseated
    await room._message(
      ghost,
      encode({ t: ClientMessageType.Message, type: "tk:stats", seq: 1, payload: undefined }),
    );
    const replies = ghost.sent.filter((d) => typeof d === "string");
    expect(replies.length).toBe(0); // seat check rejected it before perfSnapshot
  });

  it("does not route tk:stats to a game handler or count it as input", async () => {
    const ctx = new FakeCtx();
    const room = new AoiRoom({ id: "r", ctx });
    await room._create();
    const a = ctx.open("c1");
    await room._connect(a, "a");

    let gameHandlerCalls = 0;
    room["onMessage"]("tk:stats", () => {
      gameHandlerCalls++;
    });
    await room._message(
      a,
      encode({ t: ClientMessageType.Message, type: "tk:stats", seq: 1, payload: undefined }),
    );
    expect(gameHandlerCalls).toBe(0); // core intercepted it before any game handler
  });
});
