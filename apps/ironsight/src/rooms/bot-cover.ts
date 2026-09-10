import { MOVE, PLAYER } from '../config.js';
import { canStand, moveAndSlide, nearestBox, type Vec3 } from '../physics.js';
import type { MapDef } from '../map/types.js';
import { routeFloor } from '../map/terrain.js';
import type { BotCover, BotPlayerView } from '../bots.js';

/** Static cover candidates, rebuilt with each immutable collision variant.
 * Queries use only a perceived threat snapshot and the bot's own position.
 * No target lookup, navigation mutation, or changes to map collision.
 */
export class BotCoverIndex {
  private readonly points: Vec3[] = [];
  constructor(private readonly map: MapDef) {
    const seen = new Set<string>(), margin = PLAYER.radius + .18;
    for (const box of map.boxes) {
      const xs = [box.min.x - margin, (box.min.x + box.max.x) / 2, box.max.x + margin];
      const zs = [box.min.z - margin, (box.min.z + box.max.z) / 2, box.max.z + margin];
      for (let i = 0; i < xs.length; i++) for (let j = 0; j < zs.length; j++) {
        if (i === 1 && j === 1) continue;
        const x = xs[i]!, z = zs[j]!;
        // Ground plus the level on which this wall stands. A roof candidate
        // must have physical support and a walkable approach, checked below.
        for (const y of [routeFloor(map, x, z), box.min.y]) {
          const key = `${x},${y},${z}`;
          if (seen.has(key) || x < PLAYER.radius || z < PLAYER.radius ||
            x > map.bounds.width - PLAYER.radius || z > map.bounds.depth - PLAYER.radius ||
            box.max.y < y + PLAYER.crouchHeight) continue;
          seen.add(key);
          if (canStand(x, y, z, PLAYER.radius, PLAYER.standHeight, map.boxes, map.bounds))
            this.points.push({ x, y, z });
        }
      }
    }
  }

  /** Only a short, physically walkable retreat is accepted. Sweeping the same
   * capsule in <=20 cm increments handles door gaps, ramp entry and overhead
   * slabs without granting a bot a jump, teleport or high-side ramp climb.
   * Called at most once per recovery decision, never per movement frame.
   */
  reachable(from: Vec3, target: Vec3): boolean {
    const distance = Math.hypot(target.x - from.x, target.z - from.z);
    const count = Math.max(1, Math.ceil(distance / .2));
    const dx = (target.x - from.x) / count, dz = (target.z - from.z) / count;
    let pos = { ...from };
    for (let i = 0; i < count; i++) {
      const next = moveAndSlide(pos, PLAYER.radius, PLAYER.standHeight,
        { x: dx, y: -.025, z: dz }, -.5, this.map.boxes, this.map.bounds, MOVE.stepUp, this.map.ramps);
      if (Math.hypot(next.pos.x - (pos.x + dx), next.pos.z - (pos.z + dz)) > .04 ||
        Math.abs(next.pos.y - pos.y) > MOVE.stepUp + .01) return false;
      pos = next.pos;
    }
    return Math.hypot(pos.x - target.x, pos.z - target.z) < .1 && Math.abs(pos.y - target.y) < .1;
  }

  find(self: BotPlayerView, threat: Vec3, depth: number, preferCrouch = false): BotCover | undefined {
    // Cheap distance filtering first; the expensive swept-capsule check has a
    // fixed difficulty budget (4/8/12 candidates), independent of map size.
    const candidates = this.points.map(point => ({ point, distance: Math.hypot(point.x - self.x, point.z - self.z) }))
      .filter(c => c.distance <= 8 && Math.abs(c.point.y - self.y) <= 3.5)
      .sort((a, b) => a.distance - b.distance);
    let checked = 0, best: BotCover | undefined, bestScore = Infinity;
    for (const { point, distance } of candidates) {
      const standing = this.hidden(point, threat, PLAYER.standHeight);
      const crouching = standing || this.hidden(point, threat, PLAYER.crouchHeight);
      if (!crouching) continue;
      if (++checked > depth * 4) break;
      if (!this.reachable(self, point)) continue;
      const crouch = !standing;
      const score = distance + (crouch === preferCrouch ? 0 : 1.5);
      if (score < bestScore) { best = { point, crouch }; bestScore = score; }
    }
    return best;
  }

  private hidden(point: Vec3, threat: Vec3, height: number): boolean {
    // Cover the shoulders AND head, not just the bot's foot point.
    return [.6, height - .05].every(y => {
      const dx = point.x - threat.x, dy = point.y + y - threat.y, dz = point.z - threat.z;
      const distance = Math.hypot(dx, dy, dz);
      return distance > .01 && nearestBox(threat, { x: dx / distance, y: dy / distance, z: dz / distance },
        this.map.boxes, distance) < distance - .05;
    });
  }
}
