import { compileTileMap } from './tilemap.js';
import type { MapDef } from './types.js';
import { withStructures } from './structures.js';
import { SWITCHYARD_BUILDINGS, SWITCHYARD_CRATES } from './switchyard-structures.js';
import { excavate } from './terrain.js';
import { SWITCHYARD_RAIL, SWITCHYARD_RAIL_CUT } from './switchyard-rail-cut.js';
import { isReplacedSwitchyardYardBlock, SWITCHYARD_YARD_PARTS, SWITCHYARD_YARD_CRATES } from './switchyard-yard.js';

/** SWITCHYARD: 150 x 100 m, twelve screened deployment bays.
 * Two inner south arrivals relocate to north switchgear courts, away from B's
 * paired-door exits. Each new court has two flank exits and a boundary backstop.
 * North bus: 40 m rifle corridor and two-ended control courts.
 * Switch deck: exposed four-ramp 3 m shortcut between both movement axes.
 * South service: offset switchgear screens into B's paired-door court.
 * DOM distances govern the anchors; the public playlist remains FFA.
 * Tiles own yard cover, spawns and caps. Authored maintenance/dispatch rooms
 * replace the two sealed south housings; dressing never adds playable cover.
 */
export const SWITCHYARD_ROWS: readonly string[] = [
  "...................#.................#.................#...................",
  ".............r.....#........r........#........b........#.....b.............",
  "...................#...................................#...................",
  "..........########....##########...........##########....########..........",
  "...........................................................................",
  ".......#...........................................................#.......",
  ".......#..x.1...x.........................................x...3.x..#.......",
  ".......#..x.....x.........................................x.....x..#.......",
  ".......#..x.....x....xx....xx....xx....xx....xx....xx.....x.....x..#.......",
  ".r.....#...........................................................#.....b.",
  ".......#..#####.............................................#####..#.......",
  ".......#.............#.....#.....#.....#.....#.....#...............#.......",
  ".......#.............#.....#.....#.....#.....#.....#...............#.......",
  ".......#...........................................................#.......",
  ".........................x.......................x.........................",
  "...........................................................................",
  "####.................xx....xx....xx....xx....xx....xx..................####",
  "...........................................................................",
  "....................XXXXXXX.....................XXXXXXX....................",
  "..........xx........XXXXXXX..x..............x...XXXXXXX.......xx...........",
  ".......#............XXXXXXX..........v..........XXXXXXX............#.......",
  ".......#............XXXXXXX......=========......XXXXXXX............#.......",
  ".......#.......#.................=========.................#.......#.......",
  ".......#.......#.................=========.................#.......#.......",
  ".r.....#........................>=========<........................#.....b.",
  ".......#...........x........x....=========....x........x...........#.......",
  ".......#.........................=========.........................#.......",
  ".......#..xx...#.................=========.................#..xx...#.......",
  ".......#.......#.................=========.................#.......#.......",
  ".................XXXXXXXX............^............XXXXXXXX.................",
  ".................XXXXXXXX.........................XXXXXXXX.................",
  ".................XXXXXXXX.........................XXXXXXXX.................",
  "####......xx..............x.....................x.............xx.......####",
  "...........................................................................",
  ".........xx...xx.....xx....xx....xx.....xx....xx....xx.....xx...xx.........",
  ".......#...............#####...................#####...............#.......",
  ".......#...............#####...................#####...............#.......",
  ".......#...........................................................#.......",
  ".......#..#....XXXXX.#.......#...............#.......#.XXXXX....#..#.......",
  ".r.....#..#....XXXXX.#.......#...............#.......#.XXXXX....#..#.....b.",
  ".......#.......XXXXX.......####.............####.......XXXXX.......#.......",
  ".......#...................####.............####...................#.......",
  ".......#.............xx...xx.....#..###..#.....xx...xx.............#.......",
  ".......#.........................#.......#.........................#.......",
  "......................x..........#.......#..........x......................",
  "..........#######........#######.#.......#.#######........#######..........",
  "...................#.#....#.....##...2...##....#....#..#...................",
  "...................#.#....#.....##.......##....#....#..#...................",
  ".............r.....#............##.......##............#.....b.............",
  "...................#............###########............#...................",
];
const compiled = compileTileMap(SWITCHYARD_ROWS);
// The gantry's freight counterweight is full cover at rest. During transfer it
// locks flush with the apron: one replicated gate bit owns cover and crossing.
const freightCounterweight = { min: { x: 124, y: 0, z: 46 }, max: { x: 128, y: 3, z: 52 } };
// Relocate four low transport cases into the loading bed. Clear staging at
// both end ramps and at the southern return keeps A/B/C rotations <=15s.
const railStaging = (b: MapDef['boxes'][number]) => b.max.y === 1.1 && (
  (b.min.z === 68 && (b.min.x === 28 || b.min.x === 118))
  || (b.min.z === 84 && (b.min.x === 52 || b.min.x === 94)));
export const ARENA3: MapDef = withStructures(excavate({
  ...compiled, presentation: 'switchyard',
  signalCore: { doors: [freightCounterweight], chamber: freightCounterweight },
  flankRoutes: [
    [{x:27,z:51},{x:27,z:27},{x:55,z:29},{x:95,z:29},{x:123,z:27},{x:123,z:51}],
    [{x:27,z:51},{x:27,z:87},{x:61,z:93},{x:89,z:93},{x:123,z:87},{x:123,z:51}],
  ],
  launchPads: [
    { id: 'WEST / INDUCTION', from: { x: 60, y: 0, z: 55 }, to: { x: 70, y: 3, z: 55 } },
    { id: 'EAST / INDUCTION', from: { x: 90, y: 0, z: 43 }, to: { x: 80, y: 3, z: 43 } },
  ],
  // Look along the protected aisle toward the screen end, instead of into the
  // cabinet face. The player still chooses when to turn into the combat lane.
  spawnViews: [
    { from: { x: 57, z: 3 }, toward: { x: 66, z: 3 } },
    { from: { x: 93, z: 3 }, toward: { x: 84, z: 3 } },
  ],
  patrolWaypoints: [
    { x: 25, z: 13 }, { x: 55, z: 29 }, { x: 95, z: 29 }, { x: 125, z: 13 },
    { x: 123, z: 51 }, { x: 123, z: 87 }, { x: 75, z: 93 },
    { x: 27, z: 87 }, { x: 27, z: 51 },
  ],
  boxes: [...compiled.boxes.filter(b =>
    !railStaging(b)
    && !isReplacedSwitchyardYardBlock(b)
    && !(b.min.x < SWITCHYARD_RAIL_CUT.maxX && b.max.x > SWITCHYARD_RAIL_CUT.minX
      && b.min.z < SWITCHYARD_RAIL_CUT.maxZ && b.max.z > SWITCHYARD_RAIL_CUT.minZ)
    && !SWITCHYARD_BUILDINGS.some(s =>
    b.min.x === s.origin.x && b.max.x === s.origin.x + s.width
    && b.min.z === s.origin.z && b.max.z === s.origin.z + s.depth)).map(b => ({ ...b, max: { ...b.max,
    y: b.max.y === 1.1 ? 1.1 : b.max.y === 2.2 ? 6 : 3,
  } })),
    // Deck switching spine: solid/inaccessible above the 3m route, no fourth floor.
    { min: { x: 79, y: 3, z: 51 }, max: { x: 81, y: 14, z: 53 } },
    freightCounterweight,
    ...SWITCHYARD_CRATES,
    ...SWITCHYARD_YARD_PARTS.map(p => p.box), ...SWITCHYARD_YARD_CRATES,
  ],
  ramps: compiled.ramps!.map(r => ({ ...r, topY: 3,
    minX: r.axis === 'x' && r.dir === 1 ? r.minX - 4 : r.minX,
    maxX: r.axis === 'x' && r.dir === -1 ? r.maxX + 4 : r.maxX,
    minZ: r.axis === 'z' && r.dir === 1 ? r.minZ - 4 : r.minZ,
    maxZ: r.axis === 'z' && r.dir === -1 ? r.maxZ + 4 : r.maxZ,
  })),
}, SWITCHYARD_RAIL_CUT, -3), [...SWITCHYARD_BUILDINGS, SWITCHYARD_RAIL]);
export const ARENA3_BOUNDS = ARENA3.bounds;
export const ARENA3_BOXES = ARENA3.boxes;
export const ARENA3_SPAWNS = ARENA3.spawns;
export const ARENA3_CAPS = ARENA3.caps;
