import { ARENA1 } from '../src/map/arena1.js';
import { ARENA2 } from '../src/map/arena2.js';
import { ARENA3 } from '../src/map/arena3.js';
import type { MapDef } from '../src/map/types.js';
import { COPY } from './ui/copy.js';

export const SITES = {
  arena1: { name: COPY.maps.arena1.name, number: '01', subtitle: COPY.maps.arena1.subtitle,
    routes: COPY.maps.arena1.routes.join(' / '), description: COPY.maps.arena1.description,
    image: '/assets/relay-vista.webp', map: ARENA1, legacy: false },
  arena2: { name: COPY.maps.arena2.name, number: '02', subtitle: COPY.maps.arena2.subtitle,
    routes: COPY.maps.arena2.routes.join(' / '), description: COPY.maps.arena2.description,
    image: '/assets/undertow-vista.webp', map: ARENA2, legacy: false },
  arena3: { name: COPY.maps.arena3.name, number: '03', subtitle: COPY.maps.arena3.subtitle,
    routes: COPY.maps.arena3.routes.join(' / '), description: COPY.maps.arena3.description,
    image: '/assets/switchyard-vista.webp', map: ARENA3, legacy: false },
} as const;
export type SiteId = keyof typeof SITES;

/** The same route names are used in deployment, world signs and the HUD. */
export function mapCallout(map: MapDef, x: number, z: number): string {
  if (map.presentation === 'relay') {
    const cut = map.terrain?.cut;
    if (cut && x >= cut.minX && x <= cut.maxX && z >= cut.minZ && z <= cut.maxZ) return COPY.maps.arena1.routes[1];
    const room = map.structures?.find(s => x >= s.footprint.minX && x <= s.footprint.maxX
      && z >= s.footprint.minZ && z <= s.footprint.maxZ);
    if (room) return room.id === 'cooling-control' ? COPY.maps.arena1.routes[0] : COPY.maps.arena1.routes[1];
    return z < map.bounds.depth * .34 ? COPY.maps.arena1.routes[0] : z > map.bounds.depth * .66 ? COPY.maps.arena1.routes[2] : COPY.maps.arena1.routes[1];
  }
  if (map.presentation === 'undertow') {
    if (z < map.bounds.depth * .33) return COPY.maps.arena2.routes[0];
    if (z > map.bounds.depth * .65) return COPY.maps.arena2.routes[2];
    return COPY.maps.arena2.routes[1];
  }
  if (map.presentation === 'switchyard') {
    return z < map.bounds.depth * .34 ? COPY.maps.arena3.routes[0] : z > map.bounds.depth * .66 ? COPY.maps.arena3.routes[2] : COPY.maps.arena3.routes[1];
  }
  return COPY.missingRegion;
}

/** Original collision-derived plan; used as a site card, never enemy intel. */
export function siteBlueprint(map: MapDef): string {
  const solids = map.boxes.filter(b => b.min.y < 1.8 && !map.terrain?.boxes.includes(b)).map(b => `<rect x="${b.min.x}" y="${b.min.z}" width="${b.max.x - b.min.x}" height="${b.max.z - b.min.z}" fill="${b.max.y > 2 ? '#759799' : '#3e6068'}"/>`).join('');
  const ramps = (map.ramps ?? []).map(r => `<rect x="${r.minX}" y="${r.minZ}" width="${r.maxX - r.minX}" height="${r.maxZ - r.minZ}" fill="#bd9b64"/>`).join('');
  return `<svg viewBox="-3 -3 ${map.bounds.width + 6} ${map.bounds.depth + 6}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="${map.bounds.width}" height="${map.bounds.depth}" fill="#152e36" stroke="#7da5a5" stroke-width=".3"/>${solids}${ramps}</svg>`;
}
