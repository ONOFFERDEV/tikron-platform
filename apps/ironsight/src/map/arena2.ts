import type { Bounds, Box } from '../physics.js';
import { compileTileMap } from './tilemap.js';
import type { MapDef } from './types.js';

/** UNDERTOW: 150 x 100 m reclamation works, six deployments per side.
 * Clarifier rifle route (north), paired control-deck shortcuts (middle),
 * tight pump-service flank (south). Two-ended home courts and screened B.
 * Staggered full-height screens at the four deployment exits let arrivals
 * break the home-court firing line before choosing their next lane.
 * Paired northern baffles shield the second exit crossing from the inner
 * lane. Players can round either end to peek or push the home court.
 * B's southern pump housings end in full-height returns: the approach bends
 * around solid machinery before entering the two existing court doors.
 * Tiles own all cover/spawns/caps; the original kit only clads these volumes.
 */
export const UNDERTOW_ROWS: readonly string[] = [
  "...........................................................................",
  "...........................................................................",
  "...........................................................................",
  "...........................................................................",
  "..........#####.............................................#####..........",
  "...........................................................................",
  "........x........x...xx....xx....xx.....xx....xx....xx...x........x........",
  "........x....1...x.......................................x...3....x........",
  "........x........x.......................................x........x........",
  "...........................................................................",
  ".....#....#####......#.....#.....#.......#.....#.....#......#####....#.....",
  ".....#...............#.....#.....#.......#.....#.....#...............#.....",
  ".....#...#xx..#...x.....................................x...#..xx#...#.....",
  ".........#....#.............................................#....#.........",
  "..#####..#.......................................................#..#####..",
  ".......#.#..............xx..xx....xx...xx....xx..xx..............#.#.......",
  ".......#........................x.........x........................#.......",
  ".......#..xx....#.....v.............................v.....#....xx..#.......",
  ".......#........#...======.......................======...#........#.......",
  ".r.....#............======.xx.................xx.======............#.....b.",
  ".......#............======........XXXXXXX........======............#.......",
  ".r.....#............======........XXXXXXX........======............#.....b.",
  ".......#..xx....#.....^...........XXXXXXX...........^.....#....xx..#.......",
  ".r.....#........#............#....XXXXXXX....#............#........#.....b.",
  ".......#....x................#....XXXXXXX....#................x....#.......",
  ".r.....#...............xx.........XXXXXXX.........xx...............#.....b.",
  ".......#..........................XXXXXXX..........................#.......",
  ".r.....#..xx....#.........x.......XXXXXXX.......x.........#....xx..#.....b.",
  ".......#........#.................XXXXXXX.................#........#.......",
  ".r.....#.......XXXXXXXXXXX...xx...XXXXXXX...xx...XXXXXXXXXXX.......#.....b.",
  ".......#.......XXXXXXXXXXX.......................XXXXXXXXXXX.......#.......",
  ".......#.......XXXXXXXXXXX.......................XXXXXXXXXXX.......#.......",
  ".......#..xx...................................................xx..#.......",
  ".......#................#.........................#................#.......",
  ".......#................#...x.................x...#................#.......",
  "..#####.............................................................#####..",
  ".........xx.......xx.....xx.....xx.......xx.....xx.....xx.......xx.........",
  ".....#...............................................................#.....",
  ".....#......XXXXXXXXXXX.............................XXXXXXXXXXX......#.....",
  ".....##.....XXXXXXXXXXX....#####...........#####....XXXXXXXXXXX.....##.....",
  "......#.....XXXXXXXXXXX....#####...........#####....XXXXXXXXXXX.....#......",
  "...........................#####...........#####...........................",
  "...............................#...........#...............................",
  "......xx...xx...........xx....x#...........#x....xx...........xx...xx......",
  "...................x.............#..###..#.............x...................",
  ".................................#.......#.................................",
  ".........#.....#.......#.....#...#.......#...#.....#.......#.....#.........",
  ".........#.....#.......#.....#..x#...2...#x..#.....#.......#.....#.........",
  ".................................#.......#.................................",
  ".................................#########.................................",
];
const compiled = compileTileMap(UNDERTOW_ROWS);
// Pressure Drop releases the two ends of the central maintenance gallery.
// Permanent side walls and the 6m roof retain the original pressure-block shell.
const doors: readonly Box[] = [
  { min: { x: 68, y: 0, z: 48 }, max: { x: 68.5, y: 3, z: 52 } },
  { min: { x: 81.5, y: 0, z: 48 }, max: { x: 82, y: 3, z: 52 } },
];
export const ARENA2: MapDef = {
  ...compiled,
  presentation: 'undertow',
  // B assaults use Pump service behind the southern housings, then the two
  // north-facing court doors. Avoid the exposed z=74.5 cross-map shortcut.
  // Both routes remain clear with the central maintenance gallery shut.
  capApproaches: { b: [
    [{ x: 23, z: 85 }, { x: 49, z: 85 }, { x: 65, z: 87 }, { x: 69, z: 91 }],
    [{ x: 127, z: 85 }, { x: 101, z: 85 }, { x: 85, z: 87 }, { x: 81, z: 91 }],
  ] },
  signalCore: { doors, chamber: { min: { x: 68, y: 0, z: 48 }, max: { x: 82, y: 3, z: 52 } } },
  boxes: [...compiled.boxes.filter(b => !(b.min.x === 68 && b.max.x === 82 && b.min.z === 40 && b.max.z === 60)).map(b => ({ ...b, max: { ...b.max,
    y: b.max.y === 1.1 ? 1.1 : b.max.y === 2.2 ? 6 : 3,
  } })),
    { min: { x: 68, y: 0, z: 40 }, max: { x: 82, y: 6, z: 48 } },
    { min: { x: 68, y: 0, z: 52 }, max: { x: 82, y: 6, z: 60 } },
    { min: { x: 68, y: 3, z: 48 }, max: { x: 82, y: 6, z: 52 } },
    ...doors,
    // Solid central pressure stack, inaccessible above the existing 6m roof.
    { min: { x: 73, y: 6, z: 47 }, max: { x: 77, y: 14, z: 51 } },
  ],
  ramps: compiled.ramps!.map(r => ({ ...r, topY: 3,
    minZ: r.dir === 1 ? r.minZ - 4 : r.minZ,
    maxZ: r.dir === -1 ? r.maxZ + 4 : r.maxZ,
  })),
};
export const ARENA2_BOUNDS: Bounds = ARENA2.bounds;
export const ARENA2_BOXES = ARENA2.boxes;
export const ARENA2_SPAWNS = ARENA2.spawns;
export const ARENA2_CAPS = ARENA2.caps;
