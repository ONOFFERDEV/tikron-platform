import type { Bounds, Box, Vec3 } from '../physics.js';
import { compileTileMap } from './tilemap.js';
import type { MapDef, MapNavigationDef, SurfaceBinding } from './types.js';
import { withStructures } from './structures.js';
import { UNDERTOW_BUILDINGS, UNDERTOW_CRATES } from './undertow-structures.js';
import { UNDERTOW_CHANNEL, UNDERTOW_CHANNEL_CUT } from './undertow-channel.js';
import { excavate } from './terrain.js';
import { withSurfaceBindings, type MapSurface } from './materials.js';
import { isReplacedUndertowSluiceBlock, isReplacedUndertowYardBlock, UNDERTOW_B_APPROACHES,
  UNDERTOW_SLUICE_PARTS, UNDERTOW_YARD_PARTS, UNDERTOW_YARD_CRATES } from './undertow-yard.js';
import { blockingEnvironmentBoxes } from './environment-props.js';

/** UNDERTOW: 150 x 100 m canal bridgehead for six infantry per side.
 * B occupies the single-layer sluice square at 75,0,55. Each team has a
 * protected north and south ground approach. The drained lower channel stays
 * outside the capture radius and retains two end ramps and three upper bridges. */
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
// Pressure Drop releases both sides of the field office north of B.
const doors: readonly Box[] = [
  { min: { x: 70, y: 0, z: 44 }, max: { x: 70.5, y: 3, z: 48 } },
  { min: { x: 79.5, y: 0, z: 44 }, max: { x: 80, y: 3, z: 48 } },
];
const capB = { x: 75, y: 0, z: 55 } as const;
const routes = [...UNDERTOW_B_APPROACHES.west, ...UNDERTOW_B_APPROACHES.east];

function undertowNavigation(map: MapDef): MapNavigationDef {
  return { anchors: [
    ...map.spawns.red.map((point, index) => ({ id: `arena2.spawn.red.${index}`, point, layer: 0, role: 'spawn' } as const)),
    ...map.spawns.blue.map((point, index) => ({ id: `arena2.spawn.blue.${index}`, point, layer: 0, role: 'spawn' } as const)),
    { id: 'arena2.cap.a', point: map.caps.a, layer: 0, role: 'capture' },
    { id: 'arena2.cap.b', point: map.caps.b, layer: 0, role: 'capture' },
    { id: 'arena2.cap.c', point: map.caps.c, layer: 0, role: 'capture' },
    { id: 'arena2.route.b.west.north', point: { ...UNDERTOW_B_APPROACHES.west[0][2]!, y: 0 }, layer: 0, role: 'route' },
    { id: 'arena2.route.b.west.south', point: { ...UNDERTOW_B_APPROACHES.west[1][2]!, y: 0 }, layer: 0, role: 'route' },
    { id: 'arena2.route.b.east.north', point: { ...UNDERTOW_B_APPROACHES.east[0][2]!, y: 0 }, layer: 0, role: 'route' },
    { id: 'arena2.route.b.east.south', point: { ...UNDERTOW_B_APPROACHES.east[1][2]!, y: 0 }, layer: 0, role: 'route' },
    { id: 'arena2.route.drain.west', point: { x: 42, y: -3, z: 71 }, layer: -3, role: 'underpass' },
    { id: 'arena2.route.drain.center', point: { x: 75, y: -3, z: 71 }, layer: -3, role: 'underpass' },
    { id: 'arena2.route.drain.east', point: { x: 108, y: -3, z: 71 }, layer: -3, role: 'underpass' },
  ], links: [
    { id: 'arena2.link.b.west.north', from: 'arena2.route.b.west.north', to: 'arena2.cap.b', traversal: 'walk', bidirectional: true, minWidth: 3 },
    { id: 'arena2.link.b.west.south', from: 'arena2.route.b.west.south', to: 'arena2.cap.b', traversal: 'walk', bidirectional: true, minWidth: 3 },
    { id: 'arena2.link.b.east.north', from: 'arena2.route.b.east.north', to: 'arena2.cap.b', traversal: 'walk', bidirectional: true, minWidth: 3 },
    { id: 'arena2.link.b.east.south', from: 'arena2.route.b.east.south', to: 'arena2.cap.b', traversal: 'walk', bidirectional: true, minWidth: 3 },
    { id: 'arena2.link.drain.west-center', from: 'arena2.route.drain.west', to: 'arena2.route.drain.center', traversal: 'walk', bidirectional: true, minWidth: 2 },
    { id: 'arena2.link.drain.center-east', from: 'arena2.route.drain.center', to: 'arena2.route.drain.east', traversal: 'walk', bidirectional: true, minWidth: 2 },
  ] };
}

const geometry = withStructures(excavate({
  ...compiled,
  caps: { ...compiled.caps, b: capB },
  presentation: 'undertow',
  // Static traverses protect four B routes in both field-office gate states.
  capApproaches: { b: routes },
  signalCore: { doors, chamber: { min: { x: 70, y: 0, z: 44 }, max: { x: 80, y: 3, z: 48 } } },
  boxes: [...compiled.boxes.filter(b =>
    !isReplacedUndertowYardBlock(b)
    && !isReplacedUndertowSluiceBlock(b)
    && !(b.min.x < UNDERTOW_CHANNEL_CUT.maxX && b.max.x > UNDERTOW_CHANNEL_CUT.minX
      && b.min.z < UNDERTOW_CHANNEL_CUT.maxZ && b.max.z > UNDERTOW_CHANNEL_CUT.minZ)
    && !(b.min.x === 68 && b.max.x === 82 && b.min.z === 40 && b.max.z === 60)
    && !UNDERTOW_BUILDINGS.some(s => b.min.x === s.origin.x && b.max.x === s.origin.x + s.width
      && b.min.z === s.origin.z && b.max.z === s.origin.z + s.depth)).map(b => ({ ...b, max: { ...b.max,
    y: b.max.y === 1.1 ? 1.1 : b.max.y === 2.2 ? 6 : 3,
  } })),
    { min: { x: 70, y: 0, z: 40 }, max: { x: 80, y: 6, z: 44 } },
    { min: { x: 70, y: 3, z: 44 }, max: { x: 80, y: 6, z: 48 } },
    ...doors,
    // The field-office chimney is silhouette only and has no playable roof.
    { min: { x: 73, y: 6, z: 40 }, max: { x: 77, y: 14, z: 44 } },
    ...UNDERTOW_CRATES,
    ...UNDERTOW_YARD_PARTS.map(p => p.box),
    ...UNDERTOW_SLUICE_PARTS.map(p => p.box),
    ...UNDERTOW_YARD_CRATES,
    ...blockingEnvironmentBoxes('undertow'),
  ],
  ramps: compiled.ramps!.map(r => ({ ...r, topY: 3,
    minZ: r.dir === 1 ? r.minZ - 4 : r.minZ,
    maxZ: r.dir === -1 ? r.maxZ + 4 : r.maxZ,
  })),
}, UNDERTOW_CHANNEL_CUT, -3), [...UNDERTOW_BUILDINGS, UNDERTOW_CHANNEL]);
const mapped: MapDef = { ...geometry, navigation: undertowNavigation(geometry) };
const channelParts = new Map(mapped.structures?.find((structure) => structure.id === 'pump-channel')
  ?.parts.map((part) => [part.box, part.kind] as const));
const terrainBoxes = new Set(mapped.terrain?.boxes);
const environmentBoxes = new Set(blockingEnvironmentBoxes('undertow'));
const yardParts = new Map([...UNDERTOW_YARD_PARTS, ...UNDERTOW_SLUICE_PARTS].map((part) => [part.box, part] as const));
const structureParts = new Map((mapped.structures ?? []).flatMap((structure) => structure.parts.map((part) => [part.box, part.kind] as const)));
const crateBoxes = new Set([...UNDERTOW_CRATES, ...UNDERTOW_YARD_CRATES]);
/** Presentation surface per solid, following the visual finish in undertow-environment. */
function undertowFinish(box: Box): MapSurface {
  if (environmentBoxes.has(box) || crateBoxes.has(box)) return 'wood';
  const yard = yardParts.get(box);
  if (yard) return yard.kind === 'bench' ? 'sandbag' : yard.west ? 'brick' : 'metal'; // east yard walls: corrugated steel
  const structure = structureParts.get(box);
  if (structure) return structure === 'cover' ? 'wood' : 'brick';
  const h = box.max.y - box.min.y;
  if (box.min.y > 0) return 'brick'; // gallery lintel, office chimney
  if (h < 1.5) return 'sandbag'; // sandbagged low cover
  if (h > 4) return 'brick'; // field office masonry
  return 'wood'; // timber-revetted redoubts and fire-trench screens
}
const surfaceBindings: SurfaceBinding[] = [
  ...mapped.boxes.map((box, index): SurfaceBinding => {
    const channelKind = channelParts.get(box);
    const surface = terrainBoxes.has(box) ? (box.max.y < 0 ? 'gravel' : 'mud')
      : channelKind === 'slab' ? 'wood'
        : channelKind === 'cover' || doors.includes(box) ? 'metal'
          : undertowFinish(box);
    return { id: `arena2.surface.box.${index}`, surface, kind: 'box', box };
  }),
  ...(mapped.ramps ?? []).map((ramp, index): SurfaceBinding => ({
    id: `arena2.surface.ramp.${index}`, surface: (ramp.baseY ?? 0) < 0 ? 'gravel' : 'wood', kind: 'ramp', ramp,
  })),
  ...(mapped.terrain?.faces ?? []).map((face, index): SurfaceBinding => ({
    id: `arena2.surface.terrain.${index}`, surface: face.y < 0 ? 'gravel' : 'mud', kind: 'terrain', face,
  })),
];
export const ARENA2: MapDef = withSurfaceBindings(mapped, surfaceBindings);
export const ARENA2_BOUNDS: Bounds = ARENA2.bounds;
export const ARENA2_BOXES: readonly Box[] = ARENA2.boxes;
export const ARENA2_SPAWNS: { readonly red: readonly Vec3[]; readonly blue: readonly Vec3[] } = ARENA2.spawns;
export const ARENA2_CAPS: { readonly a: Vec3; readonly b: Vec3; readonly c: Vec3 } = ARENA2.caps;
