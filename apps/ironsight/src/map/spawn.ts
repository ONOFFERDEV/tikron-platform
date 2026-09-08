import { nearestBox, type Box, type Vec3 } from "../physics.js";
import { PLAYER } from "../config.js";

export interface SpawnOccupant extends Vec3 {
  readonly id: string; readonly team: number; readonly alive: boolean; readonly crouch?: boolean;
}

/** Conservative current LOS: an enemy need not be aiming at the spawn yet.
 * Check head, chest and both shoulders, so a narrow screen cannot hide only
 * the centre ray while leaving the arriving player shootable. */
export function spawnExposed(point: Vec3, enemy: SpawnOccupant, boxes: readonly Box[]): boolean {
  const from = { x: enemy.x, y: enemy.y + (enemy.crouch ? PLAYER.crouchEye : PLAYER.standEye), z: enemy.z };
  const distance = Math.hypot(point.x - enemy.x, point.z - enemy.z);
  const sideX = distance > 0 ? -(point.z - enemy.z) / distance * PLAYER.radius : 0;
  const sideZ = distance > 0 ? (point.x - enemy.x) / distance * PLAYER.radius : 0;
  const samples: readonly (readonly [number, number, number])[] =
    [[0, PLAYER.standEye, 0], [0, 1, 0], [sideX, 1.3, sideZ], [-sideX, 1.3, -sideZ]];
  return samples.some(([x, y, z]) => {
    const dx = point.x + x - from.x, dy = point.y + y - from.y, dz = point.z + z - from.z;
    const length = Math.hypot(dx, dy, dz);
    return length < 0.001 || nearestBox(from, { x: dx / length, y: dy / length, z: dz / length }, boxes, length) >= length;
  });
}

/** Server-only spawn choice. Rotation breaks ties; live occupants and enemy
 * exposure outweigh route variety. No client position or preference is accepted.
 */
export function chooseSafeSpawn(points: readonly Vec3[], rotation: number,
  players: readonly SpawnOccupant[], selfId: string, team: number, boxes: readonly Box[], teamed = true): Vec3 {
  if (!points.length) throw new Error("Map has no team spawn points");
  let best = points[rotation % points.length]!;
  let bestDanger = Infinity;
  let bestOccupied = Infinity, bestExposed = Infinity, bestSupport = -Infinity;
  for (let offset = 0; offset < points.length; offset++) {
    const point = points[(rotation + offset) % points.length]!;
    let danger = 0;
    let occupied = 0, exposed = 0, support = 0;
    for (const p of players) {
      if (!p.alive || p.id === selfId) continue;
      const distance = Math.hypot(p.x - point.x, p.z - point.z);
      if (distance < PLAYER.radius * 2 + 0.3 && Math.abs(p.y - point.y) < PLAYER.standHeight) occupied++;
      if (teamed && p.team === team) {
        // Prefer nearby support only after safety; never reward stacking bodies.
        if (distance >= 2 && distance < 12) support += (12 - distance) / 10;
        continue;
      }
      danger += Math.max(0, 14 - distance) ** 2;
      if (spawnExposed(point, p, boxes)) {
        exposed = 1;
        danger += 100 * Math.max(0.1, 1 - distance / 50);
      }
    }
    // Lexicographic safety: an unoccupied hidden candidate always wins over
    // an exposed one, even if a nearby enemy is behind its wall. If the whole
    // pool is exposed, choose least danger and keep the existing shield/timer.
    if (occupied < bestOccupied || occupied === bestOccupied &&
      (exposed < bestExposed || exposed === bestExposed &&
        (danger < bestDanger || danger === bestDanger && support > bestSupport))) {
      best = point; bestOccupied = occupied; bestExposed = exposed;
      bestDanger = danger; bestSupport = support;
    }
  }
  return best;
}
