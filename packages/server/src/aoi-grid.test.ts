import { describe, it, expect } from "vitest";
import { buildGrid, queryRadius } from "./aoi-grid.js";
import type { Vec2 } from "@tikron/sim";

const position = (e: unknown): Vec2 => e as Vec2;

/** Reference implementation: the naive O(entities) circle scan the grid replaces. */
function naiveFilter(
  map: Record<string, Vec2>,
  vp: Vec2,
  viewRadius: number,
): Record<string, unknown> {
  const r2 = viewRadius * viewRadius;
  const out: Record<string, unknown> = {};
  for (const [id, e] of Object.entries(map)) {
    const dx = e.x - vp.x;
    const dy = e.y - vp.y;
    if (dx * dx + dy * dy <= r2) out[id] = e;
  }
  return out;
}

// Deterministic PRNG so a failure is reproducible.
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

describe("AOI spatial grid", () => {
  it("matches the naive circle scan exactly (200 entities × 50 viewers)", () => {
    const rng = makeRng(0x1234abcd);
    const world = 2000;
    const viewRadius = 300;

    const entities: Record<string, Vec2> = {};
    for (let i = 0; i < 200; i++) {
      entities[`e${i}`] = { x: rng() * world, y: rng() * world };
    }
    const grid = buildGrid(entities, position, viewRadius);

    for (let v = 0; v < 50; v++) {
      const vp = { x: rng() * world, y: rng() * world };
      const fromGrid = queryRadius(grid, vp, viewRadius, position);
      const fromNaive = naiveFilter(entities, vp, viewRadius);
      // Identical id sets AND identical entity references.
      expect(Object.keys(fromGrid).sort()).toEqual(Object.keys(fromNaive).sort());
      for (const id of Object.keys(fromNaive)) expect(fromGrid[id]).toBe(fromNaive[id]);
    }
  });

  it("returns an empty set for an empty grid", () => {
    const grid = buildGrid({}, position, 100);
    expect(queryRadius(grid, { x: 0, y: 0 }, 100, position)).toEqual({});
  });

  it("includes an entity exactly on the radius boundary (inclusive)", () => {
    const grid = buildGrid({ a: { x: 100, y: 0 } }, position, 100);
    expect(Object.keys(queryRadius(grid, { x: 0, y: 0 }, 100, position))).toEqual(["a"]);
  });
});
