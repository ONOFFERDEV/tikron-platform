import type { Box, Bounds, Vec3 } from "../physics.js";
import { compileTileMap } from "./tilemap.js";
import type { MapDef } from "./types.js";

/**
 * arena2 — the M3 domination map: a wide, mostly-open 3-lane field (same overall
 * extents as arena1, so the codec's position quant ranges — pinned to `ARENA` —
 * need no wire change) built around three capture points laid out along the
 * central east–west lane. Authored as an ASCII tile grid (see the legend in
 * tilemap.ts) rather than a hand-written box list. Mirror-symmetric about x = 30,
 * so red/blue see an identical map:
 *
 *  - **A** (col 7) and **C** (col 22) are open ground-level yards, each flanked
 *    north/south by a pair of low (1.2 m) cover crates — high enough to hop onto
 *    for a peek, low enough to shoot over;
 *  - **B** (col 15, on open floor south of the platform) is contested from a
 *    raised **platform** (`=`, top 1.2 m) one row north, reached from either lane
 *    by a ramp tile (`v`/`^`) — the M3 "2nd-floor" high ground.
 *
 * Deliberately open: no lane-divider walls and no enclosed pockets (unlike
 * arena1's 3-lane dividers) — `src/bots.ts` has no unstick logic, so a filler bot
 * patrolling this map must never be able to wedge itself in a dead end.
 *
 * Cap B sits on open ground next to (not on top of) the platform, so — unlike the
 * hand-authored original — no `capWaypoints` override is needed here either.
 */
const ROWS_ARENA2: readonly string[] = [
  "..............................",
  "..............................",
  "..............................",
  "..r........................b..",
  "..............................",
  "..............................",
  "..............................",
  "..r...===............===...b..",
  "..............v...............",
  ".......1.....====.....3.......",
  ".............====.............",
  "......===.....^2.....===......",
  "..r........................b..",
  "..............................",
  "..............................",
  "..............................",
  "..............................",
  "..r........................b..",
  "..............................",
  "..............................",
];

const compiled: MapDef = compileTileMap(ROWS_ARENA2);

export const ARENA2_BOUNDS: Bounds = compiled.bounds;
export const ARENA2_BOXES: readonly Box[] = compiled.boxes;
export const ARENA2_SPAWNS: { readonly red: readonly Vec3[]; readonly blue: readonly Vec3[] } = compiled.spawns;
export const ARENA2_CAPS: { readonly a: Vec3; readonly b: Vec3; readonly c: Vec3 } = compiled.caps;

/** arena2 packaged as one {@link MapDef} — see arena1.ts's ARENA1 for the pattern. */
export const ARENA2: MapDef = compiled;
