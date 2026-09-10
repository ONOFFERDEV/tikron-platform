import type { Box, Vec3 } from '../physics.js';
import type { MapDef, RampDef } from './types.js';

export interface Rect {
  readonly minX: number; readonly maxX: number;
  readonly minZ: number; readonly maxZ: number;
}
export interface WallOpening {
  /** Coordinates along the wall's axis, relative to the structure origin. */
  readonly from: number; readonly to: number;
  readonly bottom: number; readonly top: number;
}
export interface StructureWall {
  readonly axis: 'x' | 'z'; readonly at: number;
  readonly from: number; readonly to: number; readonly thickness: number;
  readonly bottom: number; readonly top: number;
  readonly openings?: readonly WallOpening[];
}
export interface StructureSlab extends Rect {
  readonly bottom: number; readonly top: number;
  /** Stair/atrium openings are empty all the way through the slab. */
  readonly openings?: readonly Rect[];
}
export interface StructureDef {
  readonly id: string;
  readonly origin: Vec3;
  readonly width: number; readonly depth: number;
  readonly walls: readonly StructureWall[];
  readonly slabs: readonly StructureSlab[];
  readonly cover?: readonly Box[];
  /** Existing ground-to-tier slopes; zero is the GLOBAL ground datum. */
  readonly stairs?: readonly RampDef[];
}
export interface StructurePart {
  readonly kind: 'wall' | 'slab' | 'cover';
  readonly box: Box;
}
export interface CompiledStructure {
  readonly id: string;
  readonly footprint: Rect;
  readonly parts: readonly StructurePart[];
  readonly ramps: readonly RampDef[];
}

function requireAuthoring(ok: boolean, detail: string): asserts ok {
  if (!ok) throw Error(`Structure: ${detail}`);
}
function interval(a: number, b: number): boolean {
  return Number.isFinite(a) && Number.isFinite(b) && b > a;
}
function rectangle(r: Rect): boolean {
  return interval(r.minX, r.maxX) && interval(r.minZ, r.maxZ);
}
const cuts = (values: number[]) => [...new Set(values)].sort((a, b) => a - b);

/** Authoring only: cut real openings into axis-aligned solids, then emit the
 * SAME boxes and ramps consumed by movement, shots, navigation and rendering.
 * No second collision representation, runtime CSG, or visual-only doorway.
 * Arbitrarily rotated walls cannot be represented exactly by AABBs; use offset
 * axis-aligned segments instead of enclosing an angled visual in a solid box.
 */
export function compileStructure(def: StructureDef): CompiledStructure {
  const { origin: o, width, depth } = def;
  requireAuthoring(!!def.id && [o.x, o.y, o.z].every(Number.isFinite)
    && interval(0, width) && interval(0, depth), 'invalid identity/origin/footprint');
  const parts: StructurePart[] = [];
  const add = (kind: StructurePart['kind'], x0: number, y0: number, z0: number,
    x1: number, y1: number, z1: number) => {
    requireAuthoring(interval(x0, x1) && interval(y0, y1) && interval(z0, z1)
      && x0 >= 0 && x1 <= width && z0 >= 0 && z1 <= depth, `${def.id}: solid outside footprint`);
    parts.push({ kind, box: { min: { x: o.x + x0, y: o.y + y0, z: o.z + z0 },
      max: { x: o.x + x1, y: o.y + y1, z: o.z + z1 } } });
  };
  for (const w of def.walls) {
    requireAuthoring((w.axis === 'x' || w.axis === 'z') && Number.isFinite(w.at)
      && interval(w.from, w.to) && interval(w.bottom, w.top) && interval(0, w.thickness)
      && w.from >= 0 && w.to <= (w.axis === 'x' ? width : depth)
      && w.at >= 0 && w.at + w.thickness <= (w.axis === 'x' ? depth : width), `${def.id}: invalid wall`);
    const holes = w.openings ?? [];
    for (const h of holes) requireAuthoring(interval(h.from, h.to) && interval(h.bottom, h.top)
      && h.from >= w.from && h.to <= w.to && h.bottom >= w.bottom && h.top <= w.top, `${def.id}: invalid wall opening`);
    const u = cuts([w.from, w.to, ...holes.flatMap(h => [h.from, h.to])]);
    for (let i = 1; i < u.length; i++) {
      const a = u[i - 1]!, b = u[i]!;
      const apertures = holes.filter(h => h.from < b && h.to > a).sort((h, k) => h.bottom - k.bottom);
      let bottom = w.bottom;
      const emit = (top: number) => {
        if (top <= bottom) return;
        if (w.axis === 'x') add('wall', a, bottom, w.at, b, top, w.at + w.thickness);
        else add('wall', w.at, bottom, a, w.at + w.thickness, top, b);
      };
      for (const h of apertures) { emit(h.bottom); bottom = Math.max(bottom, h.top); }
      emit(w.top);
    }
  }
  for (const slab of def.slabs) {
    requireAuthoring(rectangle(slab) && interval(slab.bottom, slab.top)
      && slab.minX >= 0 && slab.maxX <= width && slab.minZ >= 0 && slab.maxZ <= depth, `${def.id}: invalid slab`);
    const holes = slab.openings ?? [];
    for (const h of holes) requireAuthoring(rectangle(h) && h.minX >= slab.minX && h.maxX <= slab.maxX
      && h.minZ >= slab.minZ && h.maxZ <= slab.maxZ, `${def.id}: invalid slab opening`);
    const xs = cuts([slab.minX, slab.maxX, ...holes.flatMap(h => [h.minX, h.maxX])]);
    const zs = cuts([slab.minZ, slab.maxZ, ...holes.flatMap(h => [h.minZ, h.maxZ])]);
    for (let x = 1; x < xs.length; x++) for (let z = 1; z < zs.length; z++) {
      const x0 = xs[x - 1]!, x1 = xs[x]!, z0 = zs[z - 1]!, z1 = zs[z]!;
      if (!holes.some(h => x0 >= h.minX && x1 <= h.maxX && z0 >= h.minZ && z1 <= h.maxZ))
        add('slab', x0, slab.bottom, z0, x1, slab.top, z1);
    }
  }
  for (const b of def.cover ?? []) add('cover', b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z);
  const ramps = (def.stairs ?? []).map(r => {
    // RampDef currently starts at world y=0. Reject an elevated origin rather
    // than silently emitting a stair that the existing physics cannot follow.
    requireAuthoring(o.y === 0 && rectangle(r) && r.minX >= 0 && r.maxX <= width
      && r.minZ >= 0 && r.maxZ <= depth && interval(0, r.topY)
      && (r.axis === 'x' || r.axis === 'z') && (r.dir === 1 || r.dir === -1), `${def.id}: invalid ground stair`);
    return { ...r, minX: o.x + r.minX, maxX: o.x + r.maxX, minZ: o.z + r.minZ, maxZ: o.z + r.maxZ };
  });
  return { id: def.id, footprint: { minX: o.x, maxX: o.x + width, minZ: o.z, maxZ: o.z + depth }, parts, ramps };
}

/** Compose the open-yard tile layer with authored structures. */
export function withStructures(map: MapDef, definitions: readonly StructureDef[]): MapDef {
  const structures = [...(map.structures ?? []), ...definitions.map(compileStructure)];
  requireAuthoring(new Set(structures.map(s => s.id)).size === structures.length, 'duplicate structure id');
  const added = structures.slice(map.structures?.length ?? 0);
  for (const s of added) {
    requireAuthoring(s.footprint.minX >= 0 && s.footprint.maxX <= map.bounds.width
      && s.footprint.minZ >= 0 && s.footprint.maxZ <= map.bounds.depth
      && s.parts.every(p => p.box.max.y <= map.bounds.ceiling)
      && s.ramps.every(r => r.topY <= map.bounds.ceiling), `${s.id}: outside map bounds`);
  }
  return { ...map, structures, boxes: [...map.boxes, ...added.flatMap(s => s.parts.map(p => p.box))],
    ramps: [...(map.ramps ?? []), ...added.flatMap(s => s.ramps)] };
}
