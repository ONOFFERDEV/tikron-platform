import { describe, it, expect } from "vitest";
import type { Vec2 } from "@tikron/sim";
import { pickSpawn, makeRng, type SpawnConfig } from "../src/rooms/shooter-spawn.js";
import { SHOOTER } from "../src/rooms/shooter-schema.js";

// The room's live config, so these tests exercise the exact tuning production runs.
const CFG: SpawnConfig = {
  world: SHOOTER.world,
  minSeparation: SHOOTER.spawnMinSep,
  ringMin: SHOOTER.spawnRingMin,
  ringMax: SHOOTER.spawnRingMax,
  centerJitter: SHOOTER.spawnCenterJitter,
};

const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
const inBounds = (p: Vec2, world: number): boolean =>
  p.x >= 0 && p.x <= world && p.y >= 0 && p.y <= world;

describe("pickSpawn (spread spawning)", () => {
  it("empty room: spawns near map center, in bounds", () => {
    const c = CFG.world / 2;
    for (let seed = 1; seed <= 50; seed++) {
      const p = pickSpawn([], makeRng(seed), CFG);
      expect(inBounds(p, CFG.world)).toBe(true);
      // Within the center jitter box.
      expect(Math.abs(p.x - c)).toBeLessThanOrEqual(CFG.centerJitter);
      expect(Math.abs(p.y - c)).toBeLessThanOrEqual(CFG.centerJitter);
    }
  });

  it("single survivor: candidate lands on the [ringMin, ringMax] ring", () => {
    // A lone survivor at center: no clamp bites and 300u separation is trivially
    // met by the 400u inner ring, so the first ring candidate is always accepted.
    const survivor: Vec2 = { x: CFG.world / 2, y: CFG.world / 2 };
    for (let seed = 1; seed <= 100; seed++) {
      const p = pickSpawn([survivor], makeRng(seed), CFG);
      const d = dist(p, survivor);
      expect(d).toBeGreaterThanOrEqual(CFG.ringMin - 1e-6);
      expect(d).toBeLessThanOrEqual(CFG.ringMax + 1e-6);
      expect(inBounds(p, CFG.world)).toBe(true);
    }
  });

  it("crowd: spawn never lands within minSeparation of any survivor", () => {
    // Survivors spread across the map, leaving plenty of valid space at 3000² so a
    // ring or random candidate is always found within the attempt budget.
    const survivors: Vec2[] = [
      { x: 500, y: 500 },
      { x: 2500, y: 500 },
      { x: 500, y: 2500 },
      { x: 2500, y: 2500 },
      { x: 1500, y: 1500 },
    ];
    for (let seed = 1; seed <= 300; seed++) {
      const p = pickSpawn(survivors, makeRng(seed), CFG);
      expect(inBounds(p, CFG.world)).toBe(true);
      for (const s of survivors) {
        expect(dist(p, s)).toBeGreaterThanOrEqual(CFG.minSeparation - 1e-6);
      }
    }
  });

  it("is deterministic for a given seed + survivors", () => {
    const survivors: Vec2[] = [{ x: 1200, y: 1800 }];
    const a = pickSpawn(survivors, makeRng(42), CFG);
    const b = pickSpawn(survivors, makeRng(42), CFG);
    expect(a).toEqual(b);
  });
});
