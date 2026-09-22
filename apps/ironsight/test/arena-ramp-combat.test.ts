import { createTestRoom, type TestConnection, type TestRoomHandle } from "@tikron/server/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PLAYER, TICK_MS } from "../src/config.js";
import { ARENA1 } from "../src/map/arena1.js";
import type { MapDef } from "../src/map/types.js";
import { ArenaRoomImpl } from "../src/rooms/arena-room.js";
import { ArenaSchema, type ArenaState } from "../src/schema.js";

const ramp = { minX: 14, maxX: 16, minZ: 10, maxZ: 12, baseY: 0, topY: 3,
  axis: "x", dir: 1 } as const;
const bodyPitch = Math.atan2(1 - PLAYER.standEye, 10);

class RampCombatArena extends ArenaRoomImpl {
  protected override fillToPlayers = 0;
  protected override startInWarmup = false;
  protected override spawnProtectMs = 0;
}

type Setup = {
  harness: TestRoomHandle<ArenaState>;
  shooter: TestConnection;
  target: TestConnection;
};

async function setup(): Promise<Setup> {
  const harness = await createTestRoom(RampCombatArena, { id: "arena-tdm", codec: ArenaSchema, sync: "throttled" });
  (harness.room as unknown as { map: MapDef }).map = { ...ARENA1, ramps: [ramp] };
  const shooter = await harness.connect();
  const target = await harness.connect();
  const state = (harness.room as unknown as { state: ArenaState }).state;
  Object.assign(state.players[shooter.id]!, { x: 10, y: 0, z: 11, yaw: Math.PI / 2,
    pitch: bodyPitch, hp: PLAYER.maxHp, alive: true, prot: false });
  Object.assign(state.players[target.id]!, { x: 20, y: 0, z: 11,
    hp: PLAYER.maxHp, alive: true, prot: false });
  await harness.advance(TICK_MS * 3);
  return { harness, shooter, target };
}

function latestShot(connection: TestConnection): { hit: boolean; dist: number; hits: unknown[] } {
  const frame = connection.frames().filter(value => value.t === "s:msg" && value.type === "shot").at(-1);
  if (!frame) throw new Error("authoritative shot frame missing");
  return frame.payload as { hit: boolean; dist: number; hits: unknown[] };
}

describe("ArenaRoom ramp combat wiring", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("blocks the real analytic room resolver and terminates its tracer at the ramp", async () => {
    const { harness, shooter, target } = await setup();
    await shooter.send("fire");
    await harness.advance(TICK_MS);

    expect(harness.snapshot().players[target.id]!.hp).toBe(PLAYER.maxHp);
    expect(latestShot(shooter)).toMatchObject({ hit: false, hits: [] });
    expect(latestShot(shooter).dist).toBeGreaterThan(4);
    expect(latestShot(shooter).dist).toBeLessThan(8);
  });

  it("rejects a body claim through the ramp and keeps the analytic fallback blocked", async () => {
    const { harness, shooter, target } = await setup();
    await shooter.send("fire", { claim: { id: target.id, part: "body" } });
    await harness.advance(TICK_MS);

    expect(harness.snapshot().players[target.id]!.hp).toBe(PLAYER.maxHp);
    expect(latestShot(shooter)).toMatchObject({ hit: false, hits: [] });
    expect(latestShot(shooter).dist).toBeLessThan(8);
  });
});
