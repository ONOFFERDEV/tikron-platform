import { describe, expect, it } from "vitest";
import { ARENA1 } from "../src/map/arena1.js";
import { canStand, nearestBox } from "../src/physics.js";
import { PLAYER } from "../src/config.js";
import { PRACTICE_SHOWCASE_BOTS } from "../src/modes.js";
import { walkSeconds } from "../src/map/nav.js";

describe("Relay encounter safety", () => {
  it("no team spawn has a direct eye-height shot into any opposing spawn", () => {
    for (const a of ARENA1.spawns.red) for (const b of ARENA1.spawns.blue) {
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      const hit = nearestBox({ ...a, y: PLAYER.standEye },
        { x: (b.x - a.x) / length, y: 0, z: (b.z - a.z) / length }, ARENA1.boxes, length);
      expect(hit, `${a.x},${a.z} -> ${b.x},${b.z}`).toBeLessThan(length);
    }
  });
  it("each deployment has two open lateral exits", () => {
    for (const spawn of [...ARENA1.spawns.red, ...ARENA1.spawns.blue]) {
      for (const dz of [-2, 2]) {
        expect(canStand(spawn.x, 0, spawn.z + dz, PLAYER.radius, PLAYER.standHeight, ARENA1.boxes, ARENA1.bounds)).toBe(true);
      }
    }
  });
  it("all practice targets have standing room and a route from the player spawn", () => {
    for (const bot of PRACTICE_SHOWCASE_BOTS) {
      expect(canStand(bot.x, 0, bot.z, PLAYER.radius, PLAYER.standHeight, ARENA1.boxes, ARENA1.bounds)).toBe(true);
      expect(walkSeconds(ARENA1, ARENA1.spawns.red[0]!, { x: bot.x, y: 0, z: bot.z })).toBeLessThan(Infinity);
    }
  });
  it("all solid volumes mirror east/west, including their gameplay heights", () => {
    for (const a of ARENA1.boxes) {
      expect(ARENA1.boxes.some(b => b.min.x === 60 - a.max.x && b.max.x === 60 - a.min.x
        && b.min.z === a.min.z && b.max.z === a.max.z && b.max.y === a.max.y)).toBe(true);
    }
  });
  it("rifle test corridor stays open, so combat tests measure hits rather than walls", () => {
    expect(nearestBox({ x: 5, y: PLAYER.standEye, z: 11 }, { x: 1, y: 0, z: 0 }, ARENA1.boxes, 50)).toBe(Infinity);
  });
});
