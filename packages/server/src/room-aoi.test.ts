import { describe, it, expect } from "vitest";
// Import room.js directly — index.js pulls in partyserver (workerd-only).
import { Room, aoiPhase, type RoomConnection, type RoomContext } from "./room.js";
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

// --- AOI priority tiers (differential update rate) ---

/** A wide-radius AOI room with NO tiers (parity reference). */
class WideRoom extends AoiRoom {
  override onCreate(): void {
    this.stateCodec = StSchema;
    this.syncIntervalMs = 0;
    this.setState({ players: {} });
    this.enableAOI({
      viewRadius: 1000,
      mapFields: ["players"],
      position: (e) => e as { x: number; y: number },
      viewer: (s, id) => s.players[id] ?? null,
    });
  }
}

/** Near band (≤100) refreshes every flush; far band (100–1000) every 4th flush. */
class TieredRoom extends AoiRoom {
  override onCreate(): void {
    this.stateCodec = StSchema;
    this.syncIntervalMs = 0;
    this.setState({ players: {} });
    this.enableAOI({
      viewRadius: 1000,
      mapFields: ["players"],
      position: (e) => e as { x: number; y: number },
      viewer: (s, id) => s.players[id] ?? null,
      tiers: [
        { radius: 100, interval: 1 },
        { radius: 1000, interval: 4 },
      ],
    });
  }
}

/** Seat a viewer whose own entity is its viewpoint, then drain the initial full. */
async function seat(ctx: FakeCtx, room: AoiRoom, id: string, x: number, y: number): Promise<FakeConn> {
  const conn = ctx.open(`conn:${id}`);
  await room._connect(conn, id);
  room.join(id, x, y);
  return conn;
}

describe("AOI tiers — parity when unset", () => {
  it("refreshes a far in-view entity every flush when no tiers are configured", async () => {
    const ctx = new FakeCtx();
    const room = new WideRoom({ id: "r", ctx });
    await room._create();
    const a = await seat(ctx, room, "a", 0, 0);
    room.join("f", 500, 0); // far but inside the 1000 view radius
    await flush();
    const before = binaryCount(a);

    // Without tiers, every move of the far entity produces a delta to A.
    for (let i = 1; i <= 8; i++) {
      room.mutateInPlace("f", 500 + i, 0);
      await flush();
    }
    expect(binaryCount(a) - before).toBe(8); // one frame per flush — no throttling
  });
});

describe("AOI tiers — far entity throttled, stale but present", () => {
  it("refreshes a far entity only on its interval and never drops it between", async () => {
    const ctx = new FakeCtx();
    const room = new TieredRoom({ id: "r", ctx });
    await room._create();
    const a = await seat(ctx, room, "a", 0, 0);
    room.join("f", 500, 0); // far band (interval 4)
    await flush();
    const before = binaryCount(a);

    for (let i = 1; i <= 8; i++) {
      room.mutateInPlace("f", 500 + i, 0);
      await flush();
      // Present on every flush — throttling must not flicker it out of the view.
      expect(decodeStates(a).at(-1)!.players.f).toBeDefined();
    }
    // 8 consecutive flushes contain exactly 2 refresh slots at interval 4 (phase-independent).
    expect(binaryCount(a) - before).toBe(2);

    // Staleness: F passed through 9 distinct positions (500..508) but A only ever
    // saw 3 of them (the initial full + 2 throttled refreshes) — it held stale
    // values for the 6 flushes in between.
    const delivered = new Set(
      decodeStates(a)
        .map((s) => s.players.f?.x)
        .filter((v): v is number => v !== undefined),
    );
    expect(delivered.size).toBe(3);
  });
});

describe("AOI tiers — first appearance is immediate", () => {
  it("delivers a newly-entered far entity on the very next flush", async () => {
    const ctx = new FakeCtx();
    const room = new TieredRoom({ id: "r", ctx });
    await room._create();
    const a = await seat(ctx, room, "a", 0, 0);
    await flush(); // baseline: A sees only itself
    expect(decodeStates(a).at(-1)!.players.g).toBeUndefined();

    room.join("g", 700, 0); // new far entity (interval 4 band) — but never seen before
    await flush();
    // Not in A's baseline → tier throttle does not apply → appears at once.
    expect(decodeStates(a).at(-1)!.players.g).toEqual({ x: 700, y: 0 });
  });
});

describe("AOI tiers — leaving the view is immediate", () => {
  it("removes a far entity the flush it exits the radius, not on its interval", async () => {
    const ctx = new FakeCtx();
    const room = new TieredRoom({ id: "r", ctx });
    await room._create();
    const a = await seat(ctx, room, "a", 0, 0);
    room.join("f", 500, 0);
    await flush();
    expect(decodeStates(a).at(-1)!.players.f).toBeDefined();

    room.mutateInPlace("f", 5000, 0); // now outside the 1000 view radius
    await flush();
    expect(decodeStates(a).at(-1)!.players.f).toBeUndefined(); // removed at once
  });
});

describe("AOI tiers — per-viewer phase staggering", () => {
  it("refreshes the same far entity on different flushes for different viewers", async () => {
    const interval = 4;
    // Pick two viewer ids whose tier phase differs mod the interval, so their far
    // refreshes fall on different flushes rather than bunching together.
    const candidates = ["v0", "v1", "v2", "v3", "v4", "v5", "v6", "v7"];
    let idA = candidates[0]!;
    let idB = candidates[1]!;
    outer: for (const x of candidates) {
      for (const y of candidates) {
        if (x !== y && aoiPhase(x) % interval !== aoiPhase(y) % interval) {
          idA = x;
          idB = y;
          break outer;
        }
      }
    }
    expect(aoiPhase(idA) % interval).not.toBe(aoiPhase(idB) % interval);

    const ctx = new FakeCtx();
    const room = new TieredRoom({ id: "r", ctx });
    await room._create();
    const a = await seat(ctx, room, idA, 0, 0);
    const b = await seat(ctx, room, idB, 20, 0);
    room.join("far", 500, 0); // in both viewers' far band (interval 4)
    await flush();

    const aUpdates: number[] = [];
    const bUpdates: number[] = [];
    for (let i = 1; i <= 8; i++) {
      const aBefore = binaryCount(a);
      const bBefore = binaryCount(b);
      room.mutateInPlace("far", 500 + i, 0);
      await flush();
      if (binaryCount(a) > aBefore) aUpdates.push(i);
      if (binaryCount(b) > bBefore) bUpdates.push(i);
    }
    // Both throttled to the same rate, but landing on different flushes.
    expect(aUpdates.length).toBe(2);
    expect(bUpdates.length).toBe(2);
    expect(aUpdates).not.toEqual(bUpdates);
  });
});
