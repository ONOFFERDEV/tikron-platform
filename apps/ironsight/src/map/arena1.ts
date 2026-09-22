import type { Box, Bounds, Vec3 } from "../physics.js";
import { compileTileMap } from "./tilemap.js";
import type { MapDef } from "./types.js";
import { withSurfaceBindings, type MapSurface, type SurfaceBinding } from './materials.js';
import { withStructures } from './structures.js';
import { RELAY_BUILDINGS } from './relay-structures.js';
import { RELAY_TRENCH, RELAY_TRENCH_CUT } from './relay-trench.js';
import { excavate } from './terrain.js';
import { RELAY_YARD_PARTS, isReplacedRelayYardBlock } from './relay-yard.js';
import { blockingEnvironmentBoxes } from './environment-props.js';

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
  { min: { x: 72, y: 0, z: 51 }, max: { x: 72.4, y: 2.35, z: 55 } },
  { min: { x: 77.6, y: 0, z: 51 }, max: { x: 78, y: 2.35, z: 55 } },
];
const relayBase = withStructures(excavate({
  ...compiled,
  presentation: "relay",
  caps: { ...compiled.caps, b: { x: 75, y: 0, z: 85 } },
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
    [{x:27,z:51},{x:36,z:76},{x:46,z:76},{x:52,z:77.6},{x:55,z:77.6},
      {x:63,z:74.4},{x:67,z:74.4},{x:79,z:77.6},{x:83,z:77.6},
      {x:91,z:74.4},{x:95,z:74.4},{x:104,z:76},{x:114,z:76},{x:123,z:51}],
  ],
  signalCore: { doors, chamber: { min: { x: 72, y: 0, z: 51 }, max: { x: 78, y: 2.72, z: 55 } } },
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
    { min: { x: 72, y: 0, z: 50.6 }, max: { x: 78, y: 2.72, z: 51 } },
    { min: { x: 72, y: 0, z: 55 }, max: { x: 78, y: 2.72, z: 55.4 } },
    { min: { x: 72, y: 2.72, z: 51 }, max: { x: 78, y: 3, z: 55 } },
    ...doors,
    { min: { x: 74.8, y: 3, z: 52.8 }, max: { x: 75.2, y: 8, z: 53.2 } },
    ...RELAY_YARD_PARTS.map(p => p.box),
    ...blockingEnvironmentBoxes('relay'),
  ],
  ramps: compiled.ramps!.map(r => ({ ...r, topY: 3,
    minX: r.dir === 1 ? r.minX - 4 : r.minX,
    maxX: r.dir === -1 ? r.maxX + 4 : r.maxX,
  })),
}, RELAY_TRENCH_CUT, -3), [...RELAY_BUILDINGS, RELAY_TRENCH]);

const structureParts = new Map(relayBase.structures?.flatMap(structure =>
  structure.parts.map(part => [part.box, { structure: structure.id, kind: part.kind }] as const)));
const structureRamps = new Set(relayBase.structures?.flatMap(structure => structure.ramps) ?? []);
const terrainBoxes = new Set(relayBase.terrain?.boxes ?? []);
const doorBoxes = new Set(doors);
const yardFinishes = new Map(RELAY_YARD_PARTS.map(part => [part.box, part.finish] as const));
const environmentBoxes = new Set(blockingEnvironmentBoxes('relay'));
const surfaceFor = (box: Box): MapSurface => {
  if (doorBoxes.has(box)) return 'metal';
  if (terrainBoxes.has(box)) return 'mud';
  if (yardFinishes.get(box) === 'cargo' || yardFinishes.get(box) === 'bench') return 'wood';
  if (environmentBoxes.has(box)) return 'wood';
  const part = structureParts.get(box);
  if (part?.structure === RELAY_TRENCH.id) return part.kind === 'slab' || part.kind === 'cover' ? 'wood' : 'mud';
  if (part?.kind === 'cover') return 'wood';
  return 'concrete';
};
const bindings: SurfaceBinding[] = [
  ...relayBase.boxes.map((box, index) => ({ id: `relay.box.${index}`, kind: 'box' as const, box, surface: surfaceFor(box) })),
  ...(relayBase.ramps ?? []).map((ramp, index) => ({ id: `relay.ramp.${index}`, kind: 'ramp' as const, ramp,
    surface: structureRamps.has(ramp) ? 'wood' as const : 'gravel' as const })),
  ...(relayBase.terrain?.faces ?? []).map((face, index) => ({ id: `relay.terrain.${index}`, kind: 'terrain' as const,
    face, surface: 'mud' as const })),
];

export const ARENA1: MapDef = withSurfaceBindings({
  ...relayBase,
  navigation: {
    anchors: [
      ...relayBase.spawns.red.map((point, index) => ({ id: `arena1.spawn.red.${index}`, point, layer: 0 as const, role: 'spawn' as const })),
      ...relayBase.spawns.blue.map((point, index) => ({ id: `arena1.spawn.blue.${index}`, point, layer: 0 as const, role: 'spawn' as const })),
      ...Object.entries(relayBase.caps).map(([id, point]) => ({ id: `arena1.cap.${id}`, point, layer: 0 as const, role: 'capture' as const })),
      { id: 'arena1.route.north.west', point: { x: 27, y: 0, z: 27 }, layer: 0, role: 'route' },
      { id: 'arena1.route.north.east', point: { x: 123, y: 0, z: 27 }, layer: 0, role: 'route' },
      { id: 'arena1.courtyard.west', point: { x: 68, y: 0, z: 53 }, layer: 0, role: 'route' },
      { id: 'arena1.courtyard.east', point: { x: 82, y: 0, z: 53 }, layer: 0, role: 'route' },
      { id: 'arena1.interior.west', point: { x: 41, y: 0, z: 41 }, layer: 0, role: 'interior' },
      { id: 'arena1.interior.east', point: { x: 109, y: 0, z: 41 }, layer: 0, role: 'interior' },
      { id: 'arena1.roof.west', point: { x: 51, y: 3, z: 41.5 }, layer: 3, role: 'roof' },
      { id: 'arena1.roof.east', point: { x: 99, y: 3, z: 41.5 }, layer: 3, role: 'roof' },
      { id: 'arena1.underpass.west', point: { x: 46, y: -3, z: 76 }, layer: -3, role: 'underpass' },
      { id: 'arena1.underpass.east', point: { x: 104, y: -3, z: 76 }, layer: -3, role: 'underpass' },
    ],
    links: [
      { id: 'arena1.link.north', from: 'arena1.route.north.west', to: 'arena1.route.north.east', traversal: 'walk', bidirectional: true, minWidth: 4 },
      { id: 'arena1.link.courtyard', from: 'arena1.courtyard.west', to: 'arena1.courtyard.east', traversal: 'walk', bidirectional: true, minWidth: 4 },
      { id: 'arena1.link.underpass', from: 'arena1.underpass.west', to: 'arena1.underpass.east', traversal: 'walk', bidirectional: true, minWidth: 2.8 },
      { id: 'arena1.link.interior-west', from: 'arena1.interior.west', to: 'arena1.roof.west', traversal: 'ramp', bidirectional: true, minWidth: 2 },
      { id: 'arena1.link.interior-east', from: 'arena1.interior.east', to: 'arena1.roof.east', traversal: 'ramp', bidirectional: true, minWidth: 2 },
    ],
  },
}, bindings);
export const ARENA1_BOUNDS: Bounds = ARENA1.bounds;
export const ARENA1_BOXES: readonly Box[] = ARENA1.boxes;
export const ARENA1_SPAWNS: { readonly red: readonly Vec3[]; readonly blue: readonly Vec3[] } = ARENA1.spawns;
export const ARENA1_CAPS: { readonly a: Vec3; readonly b: Vec3; readonly c: Vec3 } = ARENA1.caps;
