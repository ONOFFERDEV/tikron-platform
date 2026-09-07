import { describe, it, expect } from "vitest";
import { Room, type RoomConnection, type RoomContext } from "./room.js";

/** Minimal connection sink — the room only needs `send`/`close` to seat a client. */
class FakeConn implements RoomConnection {
  readonly sent: (string | ArrayBuffer)[] = [];
  constructor(readonly id: string) {}
  send(data: string | ArrayBuffer): void {
    this.sent.push(data);
  }
  close(): void {}
}

/** A context that keeps the FULL report, including the matchmaking `meta` arg. */
class MetaCtx implements RoomContext {
  readonly roomId = "r1";
  readonly conns = new Map<string, FakeConn>();
  readonly reports: { count: number; meta?: { filter?: string; maxClients?: number } }[] = [];

  connections(): Iterable<RoomConnection> {
    return this.conns.values();
  }
  connection(id: string): RoomConnection | undefined {
    return this.conns.get(id);
  }
  broadcastRaw(): void {}
  reportOccupancy(
    count: number,
    _sessions: string[],
    _seq: number,
    _messages?: number,
    meta?: { filter?: string; maxClients?: number },
  ): void {
    this.reports.push({ count, meta });
  }
  open(id: string): FakeConn {
    const conn = new FakeConn(id);
    this.conns.set(id, conn);
    return conn;
  }
}

class PlainRoom extends Room<Record<string, never>> {
  protected override occupancyHeartbeatMs = 0;
}

class RankedRoom extends Room<Record<string, never>> {
  protected override occupancyHeartbeatMs = 0;
  protected override matchFilter = "ranked";
  protected override maxClients = 4;
}

async function seat(RoomImpl: new (init: never) => Room<Record<string, never>>) {
  const ctx = new MetaCtx();
  const room = new RoomImpl({ id: ctx.roomId, ctx } as never);
  await room._create();
  await room._connect(ctx.open("c1"));
  return ctx;
}

describe("occupancy reports carry the room's matchmaking knobs", () => {
  it("reports matchFilter + maxClients when the room declares them", async () => {
    const ctx = await seat(RankedRoom);
    expect(ctx.reports.at(-1)).toEqual({ count: 1, meta: { filter: "ranked", maxClients: 4 } });
  });

  it("omits both for a default room, so the reported body is unchanged", async () => {
    const ctx = await seat(PlainRoom);
    // Undefined, not "" / Infinity: JSON.stringify drops them, keeping a
    // pre-0.7 report byte-identical (and leaving the room un-matchmakable).
    expect(ctx.reports.at(-1)).toEqual({ count: 1, meta: { filter: undefined, maxClients: undefined } });
  });
});
