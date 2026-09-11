import { rampSurfaceY, type Box } from "../src/physics.js";
import { PLAYER } from "../src/config.js";
import { rampOccluderBoxes } from "../src/map/tilemap.js";
import type { MapDef } from "../src/map/types.js";
export interface SoundPoint { x: number; y: number; z: number }
/** Camera yaw zero faces +Z; screen-right is -X in this game's view. */
export function spatialMix(source: SoundPoint, listener: SoundPoint, yaw: number, range = 55) {
  const dx = source.x - listener.x, dz = source.z - listener.z;
  const distance = Math.hypot(dx, source.y - listener.y, dz);
  const horizontal = Math.hypot(dx, dz);
  return {
    pan: horizontal > 0.001 ? Math.max(-1, Math.min(1, (-dx * Math.cos(yaw) + dz * Math.sin(yaw)) / horizontal)) : 0,
    gain: distance >= range ? 0 : Math.min(1, 5 / Math.max(5, distance)) * (1 - distance / range),
    cutoff: 900 + 6500 * Math.max(0, 1 - distance / range),
  };
}

export const ENEMY_FOLEY_GAIN = 1.4;
const axes = ['x', 'y', 'z'] as const;
const acousticMaps = new WeakMap<MapDef, {
  occluders: readonly Box[]; concrete: ReadonlySet<Box>;
}>();

function acousticData(map: MapDef) {
  let data = acousticMaps.get(map);
  if (!data) {
    // The same ramp occluders as authoritative shots, prepared once for each
    // immutable open/closed map. No mesh queries or event-time geometry bakes.
    const ramps = (map.ramps ?? []).flatMap(rampOccluderBoxes);
    const concrete = new Set(map.terrain?.boxes ?? []);
    for (const s of map.structures ?? []) for (const p of s.parts) {
      if (p.kind !== 'cover') concrete.add(p.box);
    }
    data = { occluders: ramps.length ? [...map.boxes, ...ramps] : map.boxes, concrete };
    acousticMaps.set(map, data);
  }
  return data;
}

export function acousticOccluders(map: MapDef): readonly Box[] {
  return acousticData(map).occluders;
}

/** Open segment through solid volume. Unlike hitscan, a sound anchored on or
 * slightly inside a wall still crosses that wall. Mere surface grazing is clear. */
function crossesSolid(start: SoundPoint, dir: SoundPoint, box: Box, epsilon: number): boolean {
  let enter = 0, leave = 1;
  for (const axis of axes) {
    const origin = start[axis], delta = dir[axis];
    if (Math.abs(delta) < 1e-12) {
      if (origin <= box.min[axis] || origin >= box.max[axis]) return false;
      continue;
    }
    const a = (box.min[axis] - origin) / delta, b = (box.max[axis] - origin) / delta;
    enter = Math.max(enter, Math.min(a, b));
    leave = Math.min(leave, Math.max(a, b));
    if (leave - enter <= epsilon) return false;
  }
  return leave - enter > epsilon;
}

/** One segment query per audible event, never per render frame. No render meshes. */
export function coverMix(source: SoundPoint, listener: SoundPoint, boxes: readonly Box[]) {
  const dir = { x: source.x-listener.x, y: source.y-listener.y, z: source.z-listener.z };
  const length = Math.hypot(dir.x, dir.y, dir.z);
  // A world-space tolerance cannot grow into centimetres of missing thin wall
  // just because the far end of the audible ray is fifty metres away.
  const blocked = length > 1e-5 && boxes.some(box => crossesSolid(listener, dir, box, 1e-5 / length));
  return { blocked, gain: blocked ? 0.32 : 1, cutoff: blocked ? 1100 : 22000 };
}

function supportingBox(pos: SoundPoint, map: MapDef): Box | undefined {
  return map.boxes.find(b => pos.x + PLAYER.radius > b.min.x && pos.x - PLAYER.radius < b.max.x
    && pos.z + PLAYER.radius > b.min.z && pos.z - PLAYER.radius < b.max.z && Math.abs(pos.y - b.max.y) < .16);
}

function supportingRamp(pos: SoundPoint, map: MapDef) {
  return map.ramps?.find(r => pos.x >= r.minX && pos.x <= r.maxX && pos.z >= r.minZ && pos.z <= r.maxZ
    && Math.abs(pos.y - rampSurfaceY(r, pos.x, pos.z)) < .16);
}

export function footSurface(pos: SoundPoint, map?: MapDef): 'concrete' | 'metal' {
  if (!map) return 'concrete';
  const box = supportingBox(pos, map);
  if (box) return acousticData(map).concrete.has(box) ? 'concrete' : 'metal';
  const ramp = supportingRamp(pos, map);
  if (ramp) return map.structures?.some(s => s.ramps.includes(ramp)) ? 'concrete' : 'metal';
  return 'concrete';
}
export function hostileFoley(sourceTeam: number, listenerTeam: number, teamless: boolean): number {
  return teamless || sourceTeam !== listenerTeam ? ENEMY_FOLEY_GAIN : 1;
}

export function footGrounded(pos: SoundPoint, map: MapDef): boolean {
  // Material is independent of support. The old zero-height shortcut emitted
  // steps in mid-air over excavations and muted capsule-supported deck edges.
  return Math.abs(pos.y - (map.bounds.floor ?? 0)) < .08
    || supportingBox(pos, map) !== undefined || supportingRamp(pos, map) !== undefined;
}
