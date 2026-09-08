import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestRoom } from "@tikron/server/testing";
import { ArenaRoomImpl } from "../src/rooms/arena-room.js";
import { ArenaSchema, type ArenaState } from "../src/schema.js";
import { ARENA1 } from "../src/map/arena1.js";
import { ARENA2 } from "../src/map/arena2.js";
import { ARENA3 } from "../src/map/arena3.js";
import { PLAYER } from "../src/config.js";
import { spawnFacingYaw } from "../src/map/spawn.js";

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
      expect(p.yaw).toBeCloseTo(spawnFacingYaw(map, p,
        Math.atan2(map.bounds.width / 2 - p.x, map.bounds.depth / 2 - p.z)));
    }
  });
  it('FFA joins use both authored northern exit views and retain other arrival defaults', async () => {
    const h = await createTestRoom(SpawnArena, { id: 'arena-ffa', codec: ArenaSchema, sync: 'throttled' });
    const state = (h.room as unknown as { state: ArenaState }).state;
    const points = [...ARENA3.spawns.red, ...ARENA3.spawns.blue];
    let authored = 0;
    for (const point of points) {
      // Isolate orientation from the independently tested threat selector.
      for (const player of Object.values(state.players)) player.alive = false;
      const client = await h.connect();
      const p = state.players[client.id]!;
      expect({ x: p.x, y: p.y, z: p.z }).toEqual(point);
      if (p.z === 3 && (p.x === 57 || p.x === 93)) {
        expect(p.yaw).toBeCloseTo(p.x === 57 ? Math.PI / 2 : Math.PI * 1.5);
        authored++;
      } else {
        const expected = Math.atan2(75 - p.x, 50 - p.z);
        expect(Math.sin(p.yaw)).toBeCloseTo(Math.sin(expected));
        expect(Math.cos(p.yaw)).toBeCloseTo(Math.cos(expected));
      }
      expect(p.yaw).toBeGreaterThanOrEqual(0);
      expect(p.yaw).toBeLessThan(Math.PI * 2);
      expect(p.pitch).toBe(0);
      await h.advance(100); // Wait for the room's normal coalesced state flush.
      const received = (client.lastState() as ArenaState).players[client.id]!;
      // Exercise the real Welcome/binary codec path, including west-facing yaw.
      expect(received.yaw).toBeCloseTo(p.yaw, 2);
      expect(received.pitch).toBeCloseTo(0, 2);
    }
    expect(authored).toBe(2);
  });
});
