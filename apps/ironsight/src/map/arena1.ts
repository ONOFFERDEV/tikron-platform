import type { Box, Bounds, Vec3 } from "../physics.js";
import { ARENA } from "../config.js";

/**
 * arena1 — the M0 map: a symmetric 3-lane arena (~60×40). A pure data module so
 * the server (authority), the client (rendering), and the bots (navigation) all
 * import the SAME geometry — walls cost zero wire bytes because both sides derive
 * them here, not from state.
 *
 * Layout (x = width 0→60, z = depth 0→40, y up; mirror-symmetric about x = 30 so
 * the red and blue halves are identical):
 *  - two long **lane dividers** at z≈13.5 / z≈26.5 (over x ∈ [14,46]) split the
 *    field into three lanes, with open cross-over gaps near each spawn;
 *  - a **central cover** stack at (30, 20) with two flanking jumpable crates;
 *  - a pair of **raised platforms** (top ≈1.2 m, reached by jump) in the side
 *    lanes for high ground — the M0 stand-in for the planned 2-storey ramps
 *    (true sloped ramps need slope collision, deferred past the AABB-only slice).
 *
 * Team spawns sit at opposite short ends (red x≈4, blue x≈56), 4 points each, so
 * the room rotates through them and spawns never stack.
 */

export const ARENA1_BOUNDS: Bounds = {
  width: ARENA.width,
  depth: ARENA.depth,
  ceiling: ARENA.ceiling,
};

const box = (minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): Box => ({
  min: { x: minX, y: minY, z: minZ },
  max: { x: maxX, y: maxY, z: maxZ },
});

export const ARENA1_BOXES: readonly Box[] = [
  // Lane dividers (2.5 m tall walls; central cross-over left open at spawns).
  box(14, 0, 13, 46, 2.5, 14),
  box(14, 0, 26, 46, 2.5, 27),
  // Central cover stack + two flanking jumpable crates (middle lane).
  box(28.5, 0, 18.5, 31.5, 2.2, 21.5),
  box(23, 0, 19, 25, 1.2, 21),
  box(35, 0, 19, 37, 1.2, 21),
  // Raised platforms — high ground in the side lanes (top ≈1.2 m, jump-up).
  box(27, 0, 4, 33, 1.2, 9),
  box(27, 0, 31, 33, 1.2, 36),
];

export const ARENA1_SPAWNS: { readonly red: readonly Vec3[]; readonly blue: readonly Vec3[] } = {
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
