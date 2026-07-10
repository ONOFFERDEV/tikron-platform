import type { Box, Bounds, Vec3 } from "../physics.js";
import { ARENA } from "../config.js";
import type { MapDef } from "./types.js";

/**
 * arena2 — the M3 domination map: a wide, mostly-open 3-lane field (same overall
 * extents as arena1, so the codec's position quant ranges — pinned to `ARENA` —
 * need no wire change) built around three capture points laid out along the
 * central east–west lane (mirror-symmetric about x = 30, so red/blue see an
 * identical map):
 *
 *  - **A** (x=15) and **C** (x=45) are open ground-level yards, each flanked by
 *    a pair of low (1.2 m) cover crates north/south of the point — high enough
 *    to hop onto for a peek, low enough to shoot over;
 *  - **B** (x=30, centre) sits on a raised **platform** (top 1.2 m — the same
 *    jump-reachable height arena1's own raised platforms already prove out),
 *    approached by a direct jump from open ground on every side — the M3
 *    "2nd-floor" high ground, contested from both flanks.
 *
 * Deliberately open: no lane-divider walls and no enclosed pockets (unlike
 * arena1's 3-lane dividers) — `src/bots.ts` has no unstick logic, so a filler
 * bot patrolling this map must never be able to wedge itself in a dead end.
 * Every box sits clear of both team's spawn columns (x ∈ [13,17] / [43,47] /
 * [27,33], spawns at x = 4 / 56).
 *
 * Cap B's own (x,z) sits inside the platform's footprint (solid at ground
 * level), so its `capWaypoints` override gives patrolling bots two points just
 * outside the platform's north/south faces instead — see ARENA2_CAPS below.
 */

export const ARENA2_BOUNDS: Bounds = {
  width: ARENA.width,
  depth: ARENA.depth,
  ceiling: ARENA.ceiling,
};

const box = (minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): Box => ({
  min: { x: minX, y: minY, z: minZ },
  max: { x: maxX, y: maxY, z: maxZ },
});

export const ARENA2_BOXES: readonly Box[] = [
  // Central raised platform — cap B's high ground (6 m × 4 m, top 1.2 m). Sized
  // so the closest ground-level approach (hugging a face) still lands inside
  // MODES.dom.captureRadius (4 m): 2 m half-depth + 0.4 m player radius = 2.4 m
  // from the north/south faces, 3 m half-width + 0.4 m = 3.4 m from the east/west
  // faces — both under 4 m, so the point is capturable from the ground without
  // needing the jump onto the platform (which stays the high-ground option).
  box(27, 0, 18, 33, 1.2, 22),
  // Cap A cover: two low crates north/south of the point (open gap between them).
  box(13, 0, 10, 17, 1.2, 13),
  box(13, 0, 27, 17, 1.2, 30),
  // Cap C cover — mirror of A's about x = 30.
  box(43, 0, 10, 47, 1.2, 13),
  box(43, 0, 27, 47, 1.2, 30),
];

export const ARENA2_SPAWNS: { readonly red: readonly Vec3[]; readonly blue: readonly Vec3[] } = {
  red: [
    { x: 4, y: 0, z: 6 },
    { x: 4, y: 0, z: 15 },
    { x: 4, y: 0, z: 25 },
    { x: 4, y: 0, z: 34 },
  ],
  blue: [
    { x: 56, y: 0, z: 6 },
    { x: 56, y: 0, z: 15 },
    { x: 56, y: 0, z: 25 },
    { x: 56, y: 0, z: 34 },
  ],
};

/** Domination capture points: A/C are open ground yards flanking the centre,
 *  B sits on top of the raised platform (y = 1.2, matching its surface). */
export const ARENA2_CAPS: { readonly a: Vec3; readonly b: Vec3; readonly c: Vec3 } = {
  a: { x: 15, y: 0, z: 20 },
  b: { x: 30, y: 1.2, z: 20 },
  c: { x: 45, y: 0, z: 20 },
};

/** arena2 packaged as one {@link MapDef} — see arena1.ts's ARENA1 for the pattern. */
export const ARENA2: MapDef = {
  bounds: ARENA2_BOUNDS,
  boxes: ARENA2_BOXES,
  spawns: ARENA2_SPAWNS,
  caps: ARENA2_CAPS,
  capWaypoints: {
    // Just outside the platform's north/south faces (z 18/22) and within
    // captureRadius (4 m) of cap B's centre (30,20): |20−17| = |23−20| = 3 m.
    b: [
      { x: 30, y: 0, z: 17 },
      { x: 30, y: 0, z: 23 },
    ],
  },
};
