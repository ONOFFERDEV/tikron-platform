import { createTestRoom } from "@tikron/server/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PLAYER, TICK_MS } from "../src/config.js";
import { ARENA1 } from "../src/map/arena1.js";
import type { MapDef } from "../src/map/types.js";
import { ArenaRoomImpl } from "../src/rooms/arena-room.js";
import { ArenaSchema, type ArenaState } from "../src/schema.js";

class AuditArena extends ArenaRoomImpl {
  protected override fillToPlayers = 0;
  protected override startInWarmup = false;
  protected override spawnProtectMs = 0;
}

const ramp = { minX: 14, maxX: 16, minZ: 10, maxZ: 12, baseY: 0, topY: 3,
  axis: "x", dir: 1 } as const;
const bodyPitch = Math.atan2(1 - PLAYER.standEye, 10);

async function fireWithClaim(claim: unknown, blocked: boolean): Promise<string[]> {
  const harness = await createTestRoom(AuditArena, { id: "arena-tdm", codec: ArenaSchema, sync: "throttled" });
  (harness.room as unknown as { map: MapDef }).map = { ...ARENA1, ramps: blocked ? [ramp] : [] };
  const shooter = await harness.connect();
  const target = await harness.connect();
  const state = (harness.room as unknown as { state: ArenaState }).state;
  Object.assign(state.players[shooter.id]!, { x: 10, y: 0, z: 11, yaw: Math.PI / 2,
    pitch: bodyPitch, hp: PLAYER.maxHp, alive: true, prot: false });
  Object.assign(state.players[target.id]!, { x: 20, y: 0, z: 11,
    hp: PLAYER.maxHp, alive: true, prot: false });
  await harness.advance(TICK_MS * 3);

  const messages: string[] = [];
  const record = (value: unknown) => { if (typeof value === "string" && value.includes('"tag":"hybridHit"')) messages.push(value); };
  const log = vi.spyOn(console, "log").mockImplementation(record);
  const warn = vi.spyOn(console, "warn").mockImplementation(record);
  try {
    if (claim === undefined) await shooter.send("fire");
    else await shooter.send("fire", { claim });
    await harness.advance(TICK_MS);
  } finally {
    log.mockRestore();
    warn.mockRestore();
  }
  return messages.map(message => (JSON.parse(message) as { result: string }).result);
}

describe("hybrid hit audit classification", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("emits one exclusive outcome for accepted, rejected, and absent claims", async () => {
    expect(await fireWithClaim({ id: "conn-2", part: "body" }, false)).toEqual(["accepted"]);
    expect(await fireWithClaim({ id: "conn-2", part: "body" }, true)).toEqual(["rejected"]);
    expect(await fireWithClaim(undefined, false)).toEqual(["no-claim"]);
  });
});
