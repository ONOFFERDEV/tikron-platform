import { describe, expect, it } from "vitest";
import { ARENA1 } from "../src/map/arena1.js";
import { canStand, nearestBox } from "../src/physics.js";
import { PLAYER, MOVE, MATCH } from "../src/config.js";
import { PRACTICE_SHOWCASE_BOTS } from "../src/modes.js";
import { walkSeconds } from "../src/map/nav.js";

describe("Relay encounter safety", () => {
  it("keeps expanded 6v6 density and all objective sprint rotations in the reference band", () => {
    expect(ARENA1.bounds.width * ARENA1.bounds.depth / MATCH.maxClients).toBeGreaterThanOrEqual(1250);
    const caps = Object.values(ARENA1.caps);
    for (let i = 0; i < caps.length; i++) for (const to of caps.slice(i + 1)) {
      const seconds = walkSeconds(ARENA1, caps[i]!, to, MOVE.sprint);
      expect(seconds).toBeGreaterThanOrEqual(10);
      expect(seconds).toBeLessThanOrEqual(15);
    }
    for (const box of ARENA1.boxes) {
      const height = box.max.y - box.min.y;
      expect((height >= 1 && height <= 1.25) || height >= 1.75).toBe(true);
    }
    expect(new Set(ARENA1.boxes.filter(b => b.max.y >= 1.75).map(b => b.max.y))).toEqual(new Set([3, 6]));
    expect(ARENA1.ramps!.every(r => r.topY === 3)).toBe(true);
  });
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
      expect(ARENA1.boxes.some(b => b.min.x === ARENA1.bounds.width - a.max.x && b.max.x === ARENA1.bounds.width - a.min.x
        && b.min.z === a.min.z && b.max.z === a.max.z && b.max.y === a.max.y)).toBe(true);
    }
  });
  it("rifle test corridor stays open, so combat tests measure hits rather than walls", () => {
    for (const z of [25.8, 27, 28.2]) {
      expect(nearestBox({ x: 55, y: PLAYER.standEye, z }, { x: 1, y: 0, z: 0 }, ARENA1.boxes, 40)).toBe(Infinity);
    }
  });
});
