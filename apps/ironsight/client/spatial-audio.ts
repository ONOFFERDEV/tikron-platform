import { rayAabb, rampSurfaceY, type Box } from "../src/physics.js";
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
/** One segment query per audible event, never per render frame. No render meshes. */
export function coverMix(source: SoundPoint, listener: SoundPoint, boxes: readonly Box[]) {
  const dir = { x: source.x-listener.x, y: source.y-listener.y, z: source.z-listener.z };
  const blocked = boxes.some(box => {
    const t = rayAabb(listener, dir, box, 1);
    return t !== null && t > 0.001 && t < 0.999;
  });
  return { blocked, gain: blocked ? 0.32 : 1, cutoff: blocked ? 1100 : 22000 };
}
export function footSurface(pos: SoundPoint, map?: MapDef): 'concrete' | 'metal' {
  if (map?.boxes.some(b => pos.x >= b.min.x && pos.x <= b.max.x && pos.z >= b.min.z && pos.z <= b.max.z && Math.abs(pos.y-b.max.y) < 0.16)) return 'metal';
  if (map?.ramps?.some(r => pos.x >= r.minX && pos.x <= r.maxX && pos.z >= r.minZ && pos.z <= r.maxZ && Math.abs(pos.y - rampSurfaceY(r, pos.x, pos.z)) < 0.16)) return 'metal';
  return 'concrete';
}
export function hostileFoley(sourceTeam: number, listenerTeam: number, teamless: boolean): number {
  return teamless || sourceTeam !== listenerTeam ? ENEMY_FOLEY_GAIN : 1;
}

export function footGrounded(pos: SoundPoint, map: MapDef): boolean {
  return Math.abs(pos.y) < 0.08 || footSurface(pos, map) === 'metal';
}
