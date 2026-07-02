import { describe, it, expect } from "vitest";
import { OrbGrid } from "../src/rooms/orb-grid.js";

type Orb = { x: number; y: number };

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0xffffffff;
  };
}

/** Reference: the full O(orbs) scan the grid replaces. */
function naiveWithin(orbs: Record<string, Orb>, x: number, y: number, radius: number): string[] {
  const r2 = radius * radius;
  const out: string[] = [];
  for (const [id, o] of Object.entries(orbs)) {
    const dx = o.x - x;
    const dy = o.y - y;
    if (dx * dx + dy * dy <= r2) out.push(id);
  }
  return out.sort();
}

/** What collectOrbs would collect: forEachNear candidates, distance-filtered. */
function gridWithin(
  grid: OrbGrid,
  orbs: Record<string, Orb>,
  x: number,
  y: number,
  radius: number,
): string[] {
  const r2 = radius * radius;
  const out: string[] = [];
  grid.forEachNear(x, y, (id) => {
    const o = orbs[id];
    if (!o) return;
    const dx = o.x - x;
    const dy = o.y - y;
    if (dx * dx + dy * dy <= r2) out.push(id);
  });
  return out.sort();
}

describe("OrbGrid", () => {
  const world = 2000;
  const radius = 50; // cell side = collect radius

  it("matches the naive within-radius scan exactly (300 orbs × 200 queries)", () => {
    const rng = makeRng(0x51ce9a7d);
    const orbs: Record<string, Orb> = {};
    const grid = new OrbGrid(radius);
    for (let i = 0; i < 300; i++) {
      const o = { x: rng() * world, y: rng() * world };
      orbs[`orb${i}`] = o;
      grid.add(`orb${i}`, o.x, o.y);
    }
    for (let q = 0; q < 200; q++) {
      const x = rng() * world;
      const y = rng() * world;
      expect(gridWithin(grid, orbs, x, y, radius)).toEqual(naiveWithin(orbs, x, y, radius));
    }
  });

  it("stays consistent with the orb set across incremental add/remove", () => {
    const rng = makeRng(0x0badf00d);
    const orbs: Record<string, Orb> = {};
    const grid = new OrbGrid(radius);
    for (let i = 0; i < 100; i++) {
      const o = { x: rng() * world, y: rng() * world };
      orbs[`orb${i}`] = o;
      grid.add(`orb${i}`, o.x, o.y);
    }
    // Remove half, add fresh ones (mirrors collect + respawn).
    for (let i = 0; i < 100; i += 2) {
      grid.remove(`orb${i}`, orbs[`orb${i}`]!.x, orbs[`orb${i}`]!.y);
      delete orbs[`orb${i}`];
    }
    for (let i = 0; i < 30; i++) {
      const o = { x: rng() * world, y: rng() * world };
      orbs[`new${i}`] = o;
      grid.add(`new${i}`, o.x, o.y);
    }
    for (let q = 0; q < 100; q++) {
      const x = rng() * world;
      const y = rng() * world;
      expect(gridWithin(grid, orbs, x, y, radius)).toEqual(naiveWithin(orbs, x, y, radius));
    }
  });

  it("finds an orb exactly on the radius boundary", () => {
    const grid = new OrbGrid(radius);
    grid.add("a", 50, 0);
    expect(gridWithin(grid, { a: { x: 50, y: 0 } }, 0, 0, radius)).toEqual(["a"]);
  });
});
