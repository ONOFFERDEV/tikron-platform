import type { Box, Bounds, Vec3 } from "../physics.js";
import { compileTileMap } from "./tilemap.js";
import type { MapDef } from "./types.js";

/**
 * arena1 — the M0 map: a symmetric 3-lane arena (60×40 m). A pure data module so
 * the server (authority), the client (rendering), and the bots (navigation) all
 * import the SAME geometry — walls cost zero wire bytes because both sides derive
 * them here, not from state.
 *
 * Authored as an ASCII tile grid (see the legend in tilemap.ts) rather than a
 * hand-written box list — the grid below IS the map; `compileTileMap` turns it
 * into boxes, spawns, and caps. Mirror-symmetric about x = 30 so the red and blue
 * halves are identical:
 *  - two **lane divider** walls (rows 6 and 13) split the field into three lanes,
 *    with the crossovers at the north/south edges left open;
 *  - a **central cover stack** (`X`, rows 8–9) in the middle lane, flanked by a
 *    jumpable crate (`x`) on either side;
 *  - a pair of **raised platforms** (`=`) in the side lanes for high ground, each
 *    reachable by a ramp tile (`^`/`v`) on its lane-facing side.
 *
 * Team spawns sit at opposite short ends (red x≈5, blue x≈55), 4 rows each, so
 * the room rotates through them and spawns never stack. All three caps land on
 * open floor, so no `capWaypoints` override is needed (unlike the hand-authored
 * original, whose caps sat under cover).
 */
const ROWS_ARENA1: readonly string[] = [
  "..............................",
  "..............................",
  ".............====.............",
  "..r.........>====<.........b..",
  ".............====.............",
  "..............1...............",
  ".......################.......",
  "..r........................b..",
  "............x.XX.x............",
  "..............XX..............",
  "..............2...............",
  "..............................",
  "..r........................b..",
  ".......################.......",
  "..............3...............",
  "............>====<............",
  ".............====.............",
  "..r..........====..........b..",
  "..............................",
  "..............................",
];

const compiled: MapDef = compileTileMap(ROWS_ARENA1);

export const ARENA1_BOUNDS: Bounds = compiled.bounds;
export const ARENA1_BOXES: readonly Box[] = compiled.boxes;
export const ARENA1_SPAWNS: { readonly red: readonly Vec3[]; readonly blue: readonly Vec3[] } = compiled.spawns;
export const ARENA1_CAPS: { readonly a: Vec3; readonly b: Vec3; readonly c: Vec3 } = compiled.caps;

/** arena1 packaged as one {@link MapDef} — the single value `mapForMode` (modes.ts)
 *  resolves and threads everywhere; the individual named exports above stay as
 *  aliases so existing direct importers don't need to change. */
export const ARENA1: MapDef = compiled;
