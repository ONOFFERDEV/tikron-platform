import { describe, expect, it, vi } from "vitest";
import { createTestRoom } from "@tikron/server/testing";
import { ArenaRoomImpl } from "../src/rooms/arena-room.js";
import { ArenaSchema } from "../src/schema.js";
import { GroundNavigator } from "../src/map/navigation.js";
import { ARENA1 } from "../src/map/arena1.js";
import { PLAYER } from "../src/config.js";
import { canStand } from "../src/physics.js";

describe("Relay ground navigation", () => {
  it("walks around the deployment screen to every objective without clipping", () => {
    const nav = new GroundNavigator(ARENA1);
    for (const spawn of [...ARENA1.spawns.red, ...ARENA1.spawns.blue]) for (const goal of Object.values(ARENA1.caps)) {
      let p = { x: spawn.x, z: spawn.z }, steps = 0;
      while (Math.hypot(goal.x - p.x, goal.z - p.z) > 0.4 && steps++ < 1500) {
        const target = nav.next(p, goal);
        const d = Math.hypot(target.x - p.x, target.z - p.z);
        if (d < 0.001) break;
        const amount = Math.min(0.12, d);
        p = { x: p.x + (target.x - p.x) / d * amount, z: p.z + (target.z - p.z) / d * amount };
        expect(canStand(p.x, 0, p.z, PLAYER.radius, PLAYER.standHeight, ARENA1.boxes, ARENA1.bounds)).toBe(true);
      }
      expect(Math.hypot(goal.x - p.x, goal.z - p.z), `${spawn.x},${spawn.z} to ${goal.x},${goal.z}`).toBeLessThan(0.5);
    }
  });
  it("keeps an unobstructed target direct rather than making an open route zigzag", () => {
    const nav = new GroundNavigator(ARENA1), target = { x: 95, z: 27 };
    expect(nav.next({ x: 55, z: 27 }, target)).toEqual(target);
  });
  it("does not invent a route into a solid objective", () => {
    const nav = new GroundNavigator(ARENA1), from = { x: 5, z: 5 };
    expect(nav.next(from, { x: 15, z: 45 })).toEqual(from);
  });
  it("real filler bots leave deployment and exchange kills on Relay", async () => {
    vi.useFakeTimers(); vi.setSystemTime(1_000_000);
    vi.spyOn(crypto, "getRandomValues").mockImplementation(arr => {
      if (arr) new Uint32Array(arr.buffer, arr.byteOffset, 1)[0] = 0x12345678;
      return arr;
    });
    try {
      class PatrolArena extends ArenaRoomImpl {
        protected override fillToPlayers = 6;
        protected override startInWarmup = false;
      }
      const h = await createTestRoom(PatrolArena, { codec: ArenaSchema, sync: "throttled" });
      await h.connect();
      let contestedVisits = 0, kills = 0;
      for (let i = 0; i < 600; i++) {
        await h.advance(100);
        const state = h.snapshot();
        const bots = Object.entries(state.players).filter(([id]) => id.startsWith("bot-"));
        if (bots.some(([, p]) => p.x > 18 && p.x < 42)) contestedVisits++;
        kills = Math.max(kills, bots.reduce((sum, [, p]) => sum + p.k, 0));
      }
      expect(contestedVisits).toBeGreaterThan(100);
      expect(kills).toBeGreaterThan(0);
    } finally { vi.restoreAllMocks(); vi.useRealTimers(); }
  });
});
