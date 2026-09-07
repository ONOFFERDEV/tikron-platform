import type { Box, Bounds, Vec3 } from "../physics.js";
import { compileTileMap } from "./tilemap.js";
import type { MapDef } from "./types.js";

/** RELAY: mirrored deployment screens, three routes and a split central core.
 * Each tile is 2 m. The same geometry drives rendering, movement, shots and bots.
 * See AAA-PLAN.md for encounter goals. Legacy arena1 dressing MUST NOT load here.
 */
export const RELAY_ROWS: readonly string[] = [
  "..............................",
  "........#....====....#........",
  "..r.....#...>====<...#.....b..",
  "........#............#........",
  "..........x...1....x..........",
  "..............................",
  "........#.###....###.#........",
  "..r.....#.###....###.#.....b..",
  "..............XX..............",
  "...........x..XX..x...........",
  "..............................",
  "..............2...............",
  "..r.....#.###....###.#.....b..",
  "........#.###....###.#........",
  "..............................",
  "..........x...3....x..........",
  "........#............#........",
  "..r.....#...>====<...#.....b..",
  "........#....====....#........",
  "..............................",
];
const compiled = compileTileMap(RELAY_ROWS);
export const ARENA1: MapDef = {
  ...compiled,
  presentation: "relay",
  boxes: compiled.boxes.map(b => ({ ...b, max: { ...b.max,
    // Screen walls are human scale; service houses and the core make the skyline.
    y: b.max.y === 2.5 ? (b.max.x - b.min.x > 2 ? 4.8 : 3.4)
      : b.max.y === 2.2 ? 6.4 : b.max.y,
  } })),
};
export const ARENA1_BOUNDS: Bounds = ARENA1.bounds;
export const ARENA1_BOXES: readonly Box[] = ARENA1.boxes;
export const ARENA1_SPAWNS: { readonly red: readonly Vec3[]; readonly blue: readonly Vec3[] } = ARENA1.spawns;
export const ARENA1_CAPS: { readonly a: Vec3; readonly b: Vec3; readonly c: Vec3 } = ARENA1.caps;
