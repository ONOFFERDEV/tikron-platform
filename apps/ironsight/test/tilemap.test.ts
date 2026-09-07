// Unit tests for the ASCII tilemap compiler (src/map/tilemap.ts): rectangle
// merging, height-class assignment, ramp step geometry, marker extraction,
// input validation, and a representative-map invariant check (spawn/cap/bounds
// only — pairwise cap separation and bot-waypoint reachability are already
// covered for the hand-authored arenas by map-invariants.test.ts).
import { describe, it, expect } from "vitest";
import { compileTileMap, rampOccluderBoxes, TILE } from "../src/map/tilemap.js";
import { ARENA1 } from "../src/map/arena1.js";
import { ARENA, PLAYER } from "../src/config.js";
import { canStand, type Box, type Bounds, type Vec3 } from "../src/physics.js";

const COLS = ARENA.width / TILE; // 30
const ROWS = ARENA.depth / TILE; // 20

interface Patch {
  readonly row: number;
  readonly col: number;
  /** Painted left-to-right starting at `col`, one character per cell. */
  readonly text: string;
}

/** A red/blue spawn and all 3 caps, tucked in the map's bottom-right corner —
 *  far from anything a given test paints — so most tests can ignore the
 *  compiler's "must have every marker" requirement entirely. */
const DEFAULT_MARKERS: readonly Patch[] = [
  { row: ROWS - 1, col: COLS - 5, text: "r" },
  { row: ROWS - 1, col: COLS - 4, text: "b" },
  { row: ROWS - 1, col: COLS - 3, text: "1" },
  { row: ROWS - 1, col: COLS - 2, text: "2" },
  { row: ROWS - 1, col: COLS - 1, text: "3" },
];

function paintGrid(patches: readonly Patch[]): string[] {
  const grid: string[][] = Array.from({ length: ROWS }, () => new Array<string>(COLS).fill("."));
  for (const { row, col, text } of patches) {
    for (let k = 0; k < text.length; k++) {
      grid[row]![col + k] = text[k]!;
    }
  }
  return grid.map((r) => r.join(""));
}

/** A ROWS x COLS floor grid with the default corner markers plus `patches`. */
function makeGrid(patches: readonly Patch[]): string[] {
  return paintGrid([...DEFAULT_MARKERS, ...patches]);
}

/** A ROWS x COLS floor grid with only `patches` — no default markers — for
 *  tests that need to control every marker themselves. */
function makeGridRaw(patches: readonly Patch[]): string[] {
  return paintGrid(patches);
}

describe("compileTileMap - merging", () => {
  it("merges 3 consecutive same-class tiles in a row into one box", () => {
    const rows = makeGrid([{ row: 2, col: 5, text: "###" }]);
    const map = compileTileMap(rows);
    const wallBoxes = map.boxes.filter((b) => b.max.y === 2.5);
    expect(wallBoxes.length).toBe(1);
    expect(wallBoxes[0]!.min.x).toBe(5 * TILE);
    expect(wallBoxes[0]!.max.x).toBe(8 * TILE);
    expect(wallBoxes[0]!.min.z).toBe(2 * TILE);
    expect(wallBoxes[0]!.max.z).toBe(3 * TILE);
  });

  it("merges a 3x2 rectangular block into one box", () => {
    const rows = makeGrid([
      { row: 2, col: 5, text: "###" },
      { row: 3, col: 5, text: "###" },
    ]);
    const map = compileTileMap(rows);
    const wallBoxes = map.boxes.filter((b) => b.max.y === 2.5);
    expect(wallBoxes.length).toBe(1);
    expect(wallBoxes[0]!.min.x).toBe(5 * TILE);
    expect(wallBoxes[0]!.max.x).toBe(8 * TILE);
    expect(wallBoxes[0]!.min.z).toBe(2 * TILE);
    expect(wallBoxes[0]!.max.z).toBe(4 * TILE);
  });

  it("merges an L-shaped run (3 horizontal + 2 vertical, overlapping) into 2 boxes", () => {
    const rows = makeGrid([
      { row: 2, col: 5, text: "###" },
      { row: 3, col: 5, text: "#" },
    ]);
    const map = compileTileMap(rows);
    const wallBoxes = map.boxes.filter((b) => b.max.y === 2.5);
    expect(wallBoxes.length).toBe(2);

    const topRun = wallBoxes.find((b) => b.min.z === 2 * TILE);
    expect(topRun).toBeDefined();
    expect(topRun!.min.x).toBe(5 * TILE);
    expect(topRun!.max.x).toBe(8 * TILE);
    expect(topRun!.max.z).toBe(3 * TILE);

    const stem = wallBoxes.find((b) => b.min.z === 3 * TILE);
    expect(stem).toBeDefined();
    expect(stem!.min.x).toBe(5 * TILE);
    expect(stem!.max.x).toBe(6 * TILE);
    expect(stem!.max.z).toBe(4 * TILE);
  });

  it("does not merge adjacent tiles of different height classes", () => {
    const rows = makeGrid([{ row: 2, col: 5, text: "#x" }]);
    const map = compileTileMap(rows);
    const wall = map.boxes.find((b) => b.max.y === 2.5);
    const crate = map.boxes.find((b) => b.max.y === 1.1);
    expect(wall).toBeDefined();
    expect(crate).toBeDefined();
    expect(wall!.min.x).toBe(5 * TILE);
    expect(wall!.max.x).toBe(6 * TILE);
    expect(crate!.min.x).toBe(6 * TILE);
    expect(crate!.max.x).toBe(7 * TILE);
  });
});

describe("compileTileMap - height classes", () => {
  it("assigns the fixed height to each height-class character", () => {
    const rows = makeGrid([
      { row: 2, col: 5, text: "x" },
      { row: 2, col: 7, text: "X" },
      { row: 2, col: 9, text: "=" },
      { row: 2, col: 11, text: "#" },
    ]);
    const map = compileTileMap(rows);
    const heightAt = (col: number) =>
      map.boxes.find((b) => b.min.x === col * TILE && b.min.z === 2 * TILE)?.max.y;
    expect(heightAt(5)).toBe(1.1);
    expect(heightAt(7)).toBe(2.2);
    expect(heightAt(9)).toBe(1.2);
    expect(heightAt(11)).toBe(2.5);
  });
});

describe("compileTileMap - ramps", () => {
  it("'>' ramp climbs +x: a single whole-tile RampDef, axis x, dir 1, topY 1.2", () => {
    const rows = makeGrid([{ row: 2, col: 5, text: ">" }]);
    const map = compileTileMap(rows);
    expect(map.ramps!.length).toBe(1);
    const r = map.ramps![0]!;
    const x0 = 5 * TILE;
    const z0 = 2 * TILE;
    expect(r.minX).toBe(x0);
    expect(r.maxX).toBe(x0 + TILE);
    expect(r.minZ).toBe(z0);
    expect(r.maxZ).toBe(z0 + TILE);
    expect(r.axis).toBe("x");
    expect(r.dir).toBe(1);
    expect(r.topY).toBe(1.2);
  });

  it("'<' ramp climbs -x: axis x, dir -1", () => {
    const rows = makeGrid([{ row: 2, col: 5, text: "<" }]);
    const map = compileTileMap(rows);
    expect(map.ramps![0]!.axis).toBe("x");
    expect(map.ramps![0]!.dir).toBe(-1);
    expect(map.ramps![0]!.topY).toBe(1.2);
  });

  it("'v' ramp climbs +z: axis z, dir 1", () => {
    const rows = makeGrid([{ row: 2, col: 5, text: "v" }]);
    const map = compileTileMap(rows);
    expect(map.ramps![0]!.axis).toBe("z");
    expect(map.ramps![0]!.dir).toBe(1);
  });

  it("'^' ramp climbs -z: axis z, dir -1", () => {
    const rows = makeGrid([{ row: 2, col: 5, text: "^" }]);
    const map = compileTileMap(rows);
    expect(map.ramps![0]!.axis).toBe("z");
    expect(map.ramps![0]!.dir).toBe(-1);
  });

  it("a ramp tile emits no boxes at all — only merged height-class tiles do", () => {
    const rows = makeGrid([{ row: 2, col: 5, text: ">" }]);
    const map = compileTileMap(rows);
    const x0 = 5 * TILE;
    const z0 = 2 * TILE;
    const overlapsRampTile = map.boxes.some(
      (b) => b.min.x < x0 + TILE && b.max.x > x0 && b.min.z < z0 + TILE && b.max.z > z0,
    );
    expect(overlapsRampTile).toBe(false);
  });

  it("rampOccluderBoxes reproduces the old 3-step hit-scan geometry (heights 0.4/0.8/1.2, TILE/3-exact boundaries)", () => {
    const rows = makeGrid([{ row: 2, col: 5, text: ">" }]);
    const map = compileTileMap(rows);
    const steps = rampOccluderBoxes(map.ramps![0]!);
    expect(steps.length).toBe(3);

    const x0 = 5 * TILE;
    const z0 = 2 * TILE;
    const along = (k: number) => x0 + (k * TILE) / 3;
    const sorted = [...steps].sort((a, b) => a.min.x - b.min.x);
    const heights = [0.4, 0.8, 1.2] as const;
    for (let s = 0; s < 3; s++) {
      expect(sorted[s]!.min.x).toBe(along(s));
      expect(sorted[s]!.max.x).toBe(along(s + 1));
      expect(sorted[s]!.min.z).toBe(z0);
      expect(sorted[s]!.max.z).toBe(z0 + TILE);
      expect(sorted[s]!.max.y).toBe(heights[s]);
    }
  });

  it("rampOccluderBoxes puts the lowest step at the entry (low) end for '<', '^', 'v'", () => {
    // '<' climbs -x (dir -1): entry is the +x end, so the lowest (0.4) step sits there.
    const lt = compileTileMap(makeGrid([{ row: 2, col: 5, text: "<" }]));
    const ltLow = rampOccluderBoxes(lt.ramps![0]!).find((b) => b.max.y === 0.4);
    expect(ltLow?.max.x).toBe(5 * TILE + TILE);

    // '^' climbs -z (dir -1): entry is the +z end.
    const up = compileTileMap(makeGrid([{ row: 2, col: 5, text: "^" }]));
    const upLow = rampOccluderBoxes(up.ramps![0]!).find((b) => b.max.y === 0.4);
    expect(upLow?.max.z).toBe(2 * TILE + TILE);

    // 'v' climbs +z (dir 1): entry is the -z end.
    const down = compileTileMap(makeGrid([{ row: 2, col: 5, text: "v" }]));
    const downLow = rampOccluderBoxes(down.ramps![0]!).find((b) => b.max.y === 0.4);
    expect(downLow?.min.z).toBe(2 * TILE);
  });
});

describe("compileTileMap - markers", () => {
  it("collects every spawn as its tile center, extracts each cap by number, and marker tiles emit no boxes", () => {
    const rows = makeGridRaw([
      { row: 1, col: 2, text: "r" },
      { row: 3, col: 4, text: "r" },
      { row: 5, col: 6, text: "b" },
      { row: 0, col: 0, text: "1" },
      { row: 0, col: 1, text: "2" },
      { row: 0, col: 2, text: "3" },
    ]);
    const map = compileTileMap(rows);

    expect(map.spawns.red.length).toBe(2);
    expect(map.spawns.red.some((p) => p.x === 2 * TILE + TILE / 2 && p.z === 1 * TILE + TILE / 2)).toBe(true);
    expect(map.spawns.red.some((p) => p.x === 4 * TILE + TILE / 2 && p.z === 3 * TILE + TILE / 2)).toBe(true);

    expect(map.spawns.blue.length).toBe(1);
    expect(map.spawns.blue[0]!.x).toBe(6 * TILE + TILE / 2);
    expect(map.spawns.blue[0]!.z).toBe(5 * TILE + TILE / 2);

    expect(map.caps.a.x).toBe(0 * TILE + TILE / 2);
    expect(map.caps.a.z).toBe(0 * TILE + TILE / 2);
    expect(map.caps.b.x).toBe(1 * TILE + TILE / 2);
    expect(map.caps.b.z).toBe(0 * TILE + TILE / 2);
    expect(map.caps.c.x).toBe(2 * TILE + TILE / 2);
    expect(map.caps.c.z).toBe(0 * TILE + TILE / 2);

    expect(map.boxes.length).toBe(0);
  });
});

describe("compileTileMap - validation errors", () => {
  it("throws when a row's length doesn't match row 0's length", () => {
    const rows = makeGrid([]);
    rows[5] = rows[5]!.slice(1);
    expect(() => compileTileMap(rows)).toThrow(/row 5 has length 29, expected 30/);
  });

  it("throws when the grid's compiled size doesn't match ARENA bounds", () => {
    const rows = makeGrid([]).slice(0, ROWS - 1);
    expect(() => compileTileMap(rows)).toThrow(/ARENA bounds are 60x40m/);
  });

  it("throws on an unrecognized character, naming its row and column", () => {
    const rows = makeGrid([{ row: 3, col: 7, text: "?" }]);
    expect(() => compileTileMap(rows)).toThrow(/unrecognized character '\?' at row 3, col 7/);
  });

  it("throws when cap 'a' (1) appears twice", () => {
    const rows = makeGrid([{ row: 2, col: 2, text: "1" }]);
    expect(() => compileTileMap(rows)).toThrow(/duplicate cap 'a' \(1\)/);
  });

  it("throws when a required cap is missing", () => {
    const rows = makeGridRaw([
      { row: ROWS - 1, col: 0, text: "r" },
      { row: ROWS - 1, col: 1, text: "b" },
      { row: ROWS - 1, col: 2, text: "1" },
      { row: ROWS - 1, col: 3, text: "3" },
    ]);
    expect(() => compileTileMap(rows)).toThrow(/missing cap 'b' \(2\)/);
  });

  it("throws when there are zero red spawns", () => {
    const rows = makeGridRaw([
      { row: ROWS - 1, col: 1, text: "b" },
      { row: ROWS - 1, col: 2, text: "1" },
      { row: ROWS - 1, col: 3, text: "2" },
      { row: ROWS - 1, col: 4, text: "3" },
    ]);
    expect(() => compileTileMap(rows)).toThrow(/team red has zero spawns/);
  });
});

describe("compileTileMap - invariants (representative map)", () => {
  function inBounds(x: number, z: number, bounds: Bounds): boolean {
    return x >= 0 && x <= bounds.width && z >= 0 && z <= bounds.depth;
  }

  /** True if `p` sits at ground level, or exactly on the top face of a box
   *  beneath it — mirrors map-invariants.test.ts's check of the same name. */
  function onGroundOrBoxTop(p: Vec3, boxes: readonly Box[]): boolean {
    if (p.y === 0) return true;
    return boxes.some(
      (b) => p.y === b.max.y && p.x >= b.min.x && p.x <= b.max.x && p.z >= b.min.z && p.z <= b.max.z,
    );
  }

  it("a border-walled map with a crate, ramp, platform, 4/4 spawns, and 3 caps satisfies spawn/cap/bounds invariants", () => {
    const borderPatches: Patch[] = [
      { row: 0, col: 0, text: "#".repeat(COLS) },
      { row: ROWS - 1, col: 0, text: "#".repeat(COLS) },
    ];
    for (let r = 1; r < ROWS - 1; r++) {
      borderPatches.push({ row: r, col: 0, text: "#" });
      borderPatches.push({ row: r, col: COLS - 1, text: "#" });
    }

    const rows = makeGridRaw([
      ...borderPatches,
      { row: 5, col: 5, text: "x" },
      { row: 8, col: 11, text: ">" },
      { row: 8, col: 12, text: "=" },
      { row: 3, col: 3, text: "r" },
      { row: 3, col: 25, text: "r" },
      { row: 15, col: 3, text: "r" },
      { row: 15, col: 25, text: "r" },
      { row: 5, col: 15, text: "b" },
      { row: 5, col: 20, text: "b" },
      { row: 12, col: 15, text: "b" },
      { row: 12, col: 20, text: "b" },
      { row: 2, col: 2, text: "1" },
      { row: 2, col: 27, text: "2" },
      { row: 17, col: 15, text: "3" },
    ]);

    const map = compileTileMap(rows);

    expect(map.bounds.width).toBe(ARENA.width);
    expect(map.bounds.depth).toBe(ARENA.depth);
    expect(map.bounds.ceiling).toBe(ARENA.ceiling);

    expect(map.spawns.red.length).toBe(4);
    expect(map.spawns.blue.length).toBe(4);

    for (const p of [...map.spawns.red, ...map.spawns.blue]) {
      expect(inBounds(p.x, p.z, map.bounds)).toBe(true);
      expect(onGroundOrBoxTop(p, map.boxes)).toBe(true);
      expect(canStand(p.x, p.y, p.z, PLAYER.radius, PLAYER.standHeight, map.boxes, map.bounds)).toBe(true);
    }

    for (const p of Object.values(map.caps)) {
      expect(inBounds(p.x, p.z, map.bounds)).toBe(true);
      expect(onGroundOrBoxTop(p, map.boxes)).toBe(true);
    }
  });
});

describe("compileTileMap - ramp entry lint (2026-07-17 through-wall incident)", () => {
  // A ramp compiled flush against a solid tile on its LOW (entry) side leaves a
  // 0.667m band between the 0.8-step's face and the neighbor — narrower than the
  // 0.8m player capsule, i.e. an unfittable wedge slot that drove the live
  // "rubbing pushes you through the wall" bug. The compiler now refuses it.
  it("throws when a ramp's entry side is flush with a wall", () => {
    // '>' climbs +x, so its entry is the west neighbor — put a '#' there.
    const rows = makeGrid([{ row: 9, col: 5, text: "#>" }]);
    expect(() => compileTileMap(rows)).toThrow(/ramp '>' at row 9, col 6 has a solid entry \(west side, '#' at row 9, col 5\)/);
  });

  it("throws for every solid height class on the entry side, not just walls", () => {
    for (const solid of ["x", "X", "="] as const) {
      const rows = makeGrid([{ row: 9, col: 5, text: `${solid}>` }]);
      expect(() => compileTileMap(rows)).toThrow(/has a solid entry/);
    }
  });

  it("throws when a ramp's entry side falls off the grid", () => {
    // '<' climbs -x, so its entry is the EAST neighbor — at the last column
    // there is none.
    const rows = makeGrid([{ row: 9, col: COLS - 1, text: "<" }]);
    expect(() => compileTileMap(rows)).toThrow(/off-grid entry \(east side\)/);
  });

  it("accepts a ramp whose entry side is open floor or a marker tile", () => {
    // Entry on floor (the ordinary case) and entry on a cap marker (markers
    // compile as floor) must both pass.
    const rows = makeGrid([{ row: 9, col: 5, text: ">" }]);
    expect(() => compileTileMap(rows)).not.toThrow();
    const rows2 = paintGrid([
      { row: ROWS - 1, col: COLS - 5, text: "r" },
      { row: ROWS - 1, col: COLS - 4, text: "b" },
      { row: 9, col: 5, text: "1>" }, // cap 'a' directly on the entry side
      { row: ROWS - 1, col: COLS - 3, text: "2" },
      { row: ROWS - 1, col: COLS - 2, text: "3" },
    ]);
    expect(() => compileTileMap(rows2)).not.toThrow();
  });

  it("Relay retains four true ramps and grid-aligned solid footprints", () => {
    expect(ARENA1.presentation).toBe("relay"); // legacy index-based dressing must not load
    expect(ARENA1.ramps).toHaveLength(4);
    for (const b of ARENA1.boxes) {
      expect(Number.isInteger(b.min.x) && Number.isInteger(b.max.x)).toBe(true);
      expect(Number.isInteger(b.min.z) && Number.isInteger(b.max.z)).toBe(true);
    }
  });
});
