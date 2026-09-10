import type { Box, Bounds, Vec3 } from "../physics.js";
import { compileTileMap } from "./tilemap.js";
import type { MapDef } from "./types.js";
import { withStructures } from './structures.js';
import { RELAY_BUILDINGS } from './relay-structures.js';
import { RELAY_TRENCH, RELAY_TRENCH_CUT } from './relay-trench.js';
import { excavate } from './terrain.js';
import { RELAY_YARD_PARTS, isReplacedRelayYardBlock } from './relay-yard.js';

/** RELAY: mirrored deployment screens, three routes and a split central core.
 * Each tile is 2 m. The same geometry drives rendering, movement, shots and bots.
 * Session44: cooling screens, split-core service bays and freight cover beats.
 * A/C courts keep north/south entries; B has paired rear shoulders.
 * See AAA-PLAN.md for encounter goals. Legacy arena1 dressing MUST NOT load here.
 */
export const RELAY_ROWS: readonly string[] = [
  "...........................................................................",
  "...........................................................................",
  "...........................................................................",
  "..................##....##....##...........##....##....##..................",
  "..........#####.............................................#####..........",
  "...........xxx...............................................xxx...........",
  ".........#.....#...........................................#.....#.........",
  ".........#..1..#.............=====.......=====.............#..3..#.........",
  ".........#.....#............>=====<.....>=====<............#.....#.........",
  "...........xxx...............................................xxx...........",
  "...xx.....#####...xx...xx.........................xx...xx...#####.....xx...",
  ".........................x.......................x.........................",
  "...........................................................................",
  "...........................................................................",
  "...........................................................................",
  "...#####..##....##....##....##....#######....##....##....##....##..#####...",
  "...........................................................................",
  ".......#.........###########...................###########.........#.......",
  ".......#...xx....###########...................###########....xx...#.......",
  ".r.....#.........###########...................###########.........#.....b.",
  ".......#.......................#...........#.......................#.......",
  ".r.....#............#..........#...........#..........#............#.....b.",
  ".......#.......x....#..........#...XXXXX...#..........#....x.......#.......",
  ".r.....#............#.....xx.......XXXXX.......xx.....#............#.....b.",
  ".......#...xx............x.........XXXXX.........x............xx...#.......",
  ".r.....#...........................XXXXX...........................#.....b.",
  ".......#............#..............XXXXX..............#............#.......",
  ".r.....#.......x....#..............XXXXX..............#....x.......#.....b.",
  ".......#............#.....xx...................xx.....#............#.......",
  ".r.....#...........................................................#.....b.",
  ".......#...xx....###########...................###########....xx...#.......",
  ".......#.........###########...................###########.........#.......",
  ".......#.........###########...#...........#...###########.........#.......",
  "...............................#...........#...............................",
  "...#####.......................#...........#.......................#####...",
  "..............##....##....##....##.......##....##....##....##..............",
  "...........xx.................x.............x.................xx...........",
  ".........x...........x...............................x...........x.........",
  "...........................................................................",
  "....xx....xx....xx....xx....xx...............xx....xx....xx....xx....xx....",
  "...........#########...................................#########...........",
  "...........#########...................................#########...........",
  "...........#########......#####.............#####......#########...........",
  "..........................#####.............#####..........................",
  "..........................#####....#####....#####..........................",
  "...........................................................................",
  "...........................................................................",
  "..................................#..2..#..................................",
  "..................................#.....#..................................",
  "...................................#####...................................",
];
const compiled = compileTileMap(RELAY_ROWS);
const doors: readonly Box[] = [
  { min: { x: 70, y: 0, z: 48 }, max: { x: 70.5, y: 3, z: 52 } },
  { min: { x: 79.5, y: 0, z: 48 }, max: { x: 80, y: 3, z: 52 } },
];
export const ARENA1: MapDef = withStructures(excavate({
  ...compiled,
  presentation: "relay",
  // Patrol destinations keep quiet-time traffic in the working site rather
  // than repeatedly touring the deployment bays. Opposite room/power anchors
  // are paired; normal perception can interrupt any patrol for a visible fight.
  patrolWaypoints: [
    {x:41,z:41},{x:109,z:41},{x:49,z:41},{x:101,z:41},
    {x:61,z:27},{x:89,z:27},{x:61,z:75},{x:89,z:75},
    {x:27,z:51},{x:123,z:51},{x:61,z:51},{x:89,z:51},
  ],
  flankRoutes: [
    // Fixed map knowledge: breach both rooms, then return to service.
    [{x:27,z:51},{x:41,z:46},{x:41,z:41},{x:49,z:41},{x:49,z:46},
      {x:61,z:38},{x:89,z:38},{x:101,z:46},{x:101,z:41},{x:109,z:41},{x:109,z:46},{x:123,z:51}],
    [{x:27,z:51},{x:27,z:76},{x:48,z:76},{x:57,z:77.6},{x:63,z:77.6},
      {x:87,z:74.4},{x:94,z:74.4},{x:102,z:76},{x:123,z:76},{x:123,z:51}],
  ],
  signalCore: { doors, chamber: { min: { x: 70, y: 0, z: 48 }, max: { x: 80, y: 3, z: 52 } } },
  boxes: [...compiled.boxes.filter(b =>
    !isReplacedRelayYardBlock(b) &&
    // Excavation replaces the old small freight-yard crates within its cut.
    !(b.min.x < 112 && b.max.x > 38 && b.min.z < 79 && b.max.z > 73)
    &&
    !(b.min.x === 70 && b.max.x === 80 && b.min.z === 44 && b.max.z === 56)
    && !((b.min.x === 34 || b.min.x === 94) && b.max.x - b.min.x === 22 && b.min.z === 34 && b.max.z === 40)
    // Former free-standing returns occupy the enlarged rooms/door aprons.
    && !((b.min.x === 40 || b.min.x === 108) && b.min.z === 42 && b.max.z === 48)).map(b => ({ ...b, max: { ...b.max,
    y: b.max.y === 1.2 ? 3 : b.max.y === 2.2 ? 6
      : b.max.y === 2.5 ? (b.max.x - b.min.x > 2 && b.max.z - b.min.z > 2 ? 6 : 3) : b.max.y,
  } })),
    // Two co-visible ends, a 4m passage, and the unchanged 6m roof. Dynamic
    // shutters never remove the roof/spine or either permanent side wall.
    { min: { x: 70, y: 0, z: 44 }, max: { x: 80, y: 6, z: 48 } },
    { min: { x: 70, y: 0, z: 52 }, max: { x: 80, y: 6, z: 56 } },
    { min: { x: 70, y: 3, z: 48 }, max: { x: 80, y: 6, z: 52 } },
    ...doors,
    // Inaccessible signal spine on the 6m core roof, not another floor tier.
    // Its visible silhouette is authoritative cover even for elevated shots.
    { min: { x: 74, y: 6, z: 48 }, max: { x: 76, y: 14, z: 54 } },
    ...RELAY_YARD_PARTS.map(p => p.box),
  ],
  ramps: compiled.ramps!.map(r => ({ ...r, topY: 3,
    minX: r.dir === 1 ? r.minX - 4 : r.minX,
    maxX: r.dir === -1 ? r.maxX + 4 : r.maxX,
  })),
}, RELAY_TRENCH_CUT, -3), [...RELAY_BUILDINGS, RELAY_TRENCH]);
export const ARENA1_BOUNDS: Bounds = ARENA1.bounds;
export const ARENA1_BOXES: readonly Box[] = ARENA1.boxes;
export const ARENA1_SPAWNS: { readonly red: readonly Vec3[]; readonly blue: readonly Vec3[] } = ARENA1.spawns;
export const ARENA1_CAPS: { readonly a: Vec3; readonly b: Vec3; readonly c: Vec3 } = ARENA1.caps;
