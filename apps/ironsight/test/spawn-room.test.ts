import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestRoom } from "@tikron/server/testing";
import { ArenaRoomImpl } from "../src/rooms/arena-room.js";
import { ArenaSchema, type ArenaState } from "../src/schema.js";
import { ARENA1 } from "../src/map/arena1.js";
import { ARENA2 } from "../src/map/arena2.js";
import { ARENA3 } from "../src/map/arena3.js";
import { PLAYER } from "../src/config.js";

class SpawnArena extends ArenaRoomImpl {
  protected override fillToPlayers = 0;
  protected override startInWarmup = false;
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(1_000_000); });
afterEach(() => vi.useRealTimers());

describe("real room spawn routing", () => {
  it.each([
    ["arena-tdm", ARENA1], ["arena-dom", ARENA2], ["arena-ffa", ARENA3],
  ] as const)("%s avoids the occupied next rotation point on join", async (id, map) => {
    const h = await createTestRoom(SpawnArena, { id, codec: ArenaSchema, sync: "throttled" });
    const first = await h.connect();
    const second = await h.connect();
    const state = (h.room as unknown as { state: ArenaState }).state;
    const candidate = map.spawns.red[id === "arena-ffa" ? 2 : 1]!;
    const occupant = state.players[second.id]!;
    Object.assign(occupant, candidate);
    // Move the first player away from the spawn pool; the next player must
    // still respect the second player in FFA despite their identical team ids.
    Object.assign(state.players[first.id]!, { x: 30, y: 0, z: 20 });
    const arriving = await h.connect();
    const p = state.players[arriving.id]!;
    expect(Math.hypot(p.x - candidate.x, p.z - candidate.z)).toBeGreaterThan(PLAYER.radius * 2 + 0.3);
    expect([...map.spawns.red, ...map.spawns.blue]).toContainEqual({ x: p.x, y: p.y, z: p.z });
    expect(p.prot).toBe(true);
    expect(p.hp).toBe(PLAYER.maxHp);
    if (id === "arena-ffa") {
      expect(p.yaw).toBeCloseTo(Math.atan2(map.bounds.width / 2 - p.x, map.bounds.depth / 2 - p.z));
    }
  });
});
