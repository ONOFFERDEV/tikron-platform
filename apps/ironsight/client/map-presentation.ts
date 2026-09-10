import { ARENA1 } from '../src/map/arena1.js';
import { ARENA2 } from '../src/map/arena2.js';
import { ARENA3 } from '../src/map/arena3.js';
import type { MapDef } from '../src/map/types.js';

export const SITES = {
  arena1: { name: 'RELAY', number: '01', subtitle: 'COMMUNICATIONS TRANSFER YARD',
    routes: 'Cooling / Relay core / Freight', description: 'Split the core. Control three connected lanes.',
    image: '/assets/relay-vista.webp', map: ARENA1, legacy: false },
  arena2: { name: 'UNDERTOW', number: '02', subtitle: 'WATER RECLAMATION PLANT',
    routes: 'Clarifier route / Control decks / Maintenance', description: 'Cross the pump hall. Hold the three control points.',
    image: '/assets/undertow-vista.webp', map: ARENA2, legacy: false },
  arena3: { name: 'SWITCHYARD', number: '03', subtitle: 'POWER DISTRIBUTION DEPOT',
    routes: 'North bus / Switch deck / South service', description: 'Cross the switch deck. Watch every approach in free-for-all.',
    image: '/assets/switchyard-vista.webp', map: ARENA3, legacy: false },
} as const;
export type SiteId = keyof typeof SITES;

/** The same route names are used in deployment, world signs and the HUD. */
export function mapCallout(map: MapDef, x: number, z: number): string {
  if (map.presentation === 'relay') {
    const room = map.structures?.find(s => x >= s.footprint.minX && x <= s.footprint.maxX
      && z >= s.footprint.minZ && z <= s.footprint.maxZ);
    if (room) return room.id === 'cooling-control' ? 'CONTROL / EAST' : 'COMMS / WEST';
    if (x < map.bounds.width * .12) return 'WEST SERVICE'; if (x > map.bounds.width * .88) return 'EAST SERVICE';
    return z < map.bounds.depth * .34 ? '01 / COOLING' : z > map.bounds.depth * .66 ? '03 / FREIGHT' : '02 / RELAY';
  }
  if (map.presentation === 'undertow') {
    if (x < map.bounds.width * .12) return 'WEST SERVICE';
    if (x > map.bounds.width * .88) return 'EAST SERVICE';
    if (z > map.bounds.depth * .86) return 'B / PUMP HALL';
    if (z > map.bounds.depth * .65) return 'MAINTENANCE';
    if (z < map.bounds.depth * .23) return x < map.bounds.width * .3 ? 'A / WEST CONTROL'
      : x > map.bounds.width * .7 ? 'C / EAST CONTROL' : 'CLARIFIER ROUTE';
    return z < map.bounds.depth * .33 ? 'CLARIFIER ROUTE'
      : x < map.bounds.width / 2 ? 'WEST DECK' : 'EAST DECK';
  }
  if (map.presentation === 'switchyard') {
    if (x < map.bounds.width * .12 || x > map.bounds.width * .88) return 'PERIMETER SERVICE';
    return z < map.bounds.depth * .34 ? '01 / NORTH BUS' : z > map.bounds.depth * .66 ? '03 / SOUTH SERVICE' : '02 / SWITCH DECK';
  }
  return 'TRAINING GROUND';
}

/** Original collision-derived plan; used as a site card, never enemy intel. */
export function siteBlueprint(map: MapDef): string {
  const solids = map.boxes.filter(b => b.min.y < 1.8).map(b => `<rect x="${b.min.x}" y="${b.min.z}" width="${b.max.x - b.min.x}" height="${b.max.z - b.min.z}" fill="${b.max.y > 2 ? '#759799' : '#3e6068'}"/>`).join('');
  const ramps = (map.ramps ?? []).map(r => `<rect x="${r.minX}" y="${r.minZ}" width="${r.maxX - r.minX}" height="${r.maxZ - r.minZ}" fill="#bd9b64"/>`).join('');
  return `<svg viewBox="-3 -3 ${map.bounds.width + 6} ${map.bounds.depth + 6}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="${map.bounds.width}" height="${map.bounds.depth}" fill="#152e36" stroke="#7da5a5" stroke-width=".3"/>${solids}${ramps}</svg>`;
}
