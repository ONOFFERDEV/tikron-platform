import { nearestBox, type Box, type Vec3 } from "../physics.js";
import { PLAYER } from "../config.js";

export interface SpawnOccupant extends Vec3 {
  readonly id: string; readonly team: number; readonly alive: boolean; readonly crouch?: boolean;
}

/** Room-local, bounded sightline memory. No client reports or wall-clock timers.
 * Samples at 2 Hz; a sightline fades out over three seconds. Dead/disconnected
 * threats are removed on observation, so a successful clear frees the spawn. */
export class SpawnSightHistory {
  private readonly sightings = new Map<Vec3, Map<string, number>>();
  private nextSampleMs = 0;
  clear(): void { this.sightings.clear(); this.nextSampleMs = 0; }
  forget(id: string): void { for (const seen of this.sightings.values()) seen.delete(id); }
  due(nowMs: number): boolean { return nowMs >= this.nextSampleMs; }
  observe(points: readonly Vec3[], players: readonly SpawnOccupant[], boxes: readonly Box[], nowMs: number): void {
    if (nowMs < this.nextSampleMs) return;
    this.nextSampleMs = nowMs + 500;
    const living = players.filter(p => p.alive);
    const ids = new Set(living.map(p => p.id));
    for (const point of points) {
      const seen = this.sightings.get(point) ?? new Map<string, number>();
      for (const [id, at] of seen) if (!ids.has(id) || nowMs - at >= 3000) seen.delete(id);
      for (const p of living) if (spawnExposed(point, p, boxes)) seen.set(p.id, nowMs);
      this.sightings.set(point, seen);
    }
  }
  danger(point: Vec3, enemyId: string, nowMs: number): number {
    const at = this.sightings.get(point)?.get(enemyId);
    return at === undefined ? 0 : 60 * Math.max(0, 1 - Math.max(0, nowMs - at) / 3000);
  }
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
  players: readonly SpawnOccupant[], selfId: string, team: number, boxes: readonly Box[], teamed = true,
  history?: SpawnSightHistory, nowMs = 0): Vec3 {
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
      danger += history?.danger(point, p.id, nowMs) ?? 0;
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
