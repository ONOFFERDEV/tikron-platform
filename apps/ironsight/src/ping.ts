import { nearestBox, type Box, type Vec3 } from './physics.js';
import { resolveHitscan, type HitTarget } from './hitscan.js';
import { HIT } from './config.js';
import type { MapDef } from './map/types.js';

export const PING = { cooldownMs: 2000, lifetimeMs: 5000, range: 80 } as const;
export interface TeamPing { from: string; kind: 'enemy' | 'go' | 'backup'; x: number; z: number; expiresAt: number }

/** Snapshot of an aimed location, never a tracking tag or a client position claim. */
export function resolvePing(origin: Vec3, dir: Vec3, team: number, targets: readonly HitTarget[],
  boxes: readonly Box[], bounds: MapDef['bounds']): Pick<TeamPing, 'kind' | 'x' | 'z'> {
  let range: number = PING.range;
  if (dir.y < 0) range = Math.min(range, -origin.y / dir.y);
  for (const [position, direction, limit] of [[origin.x, dir.x, bounds.width], [origin.z, dir.z, bounds.depth]] as const) {
    if (direction > 0) range = Math.min(range, (limit - position) / direction);
    if (direction < 0) range = Math.min(range, -position / direction);
  }
  range = Math.max(0, range);
  const hit = resolveHitscan(origin, dir, range, team, targets, boxes, HIT);
  const distance = hit?.t ?? Math.min(range, nearestBox(origin, dir, boxes, range));
  return { kind: hit ? 'enemy' : 'go', x: origin.x + dir.x * distance, z: origin.z + dir.z * distance };
}
