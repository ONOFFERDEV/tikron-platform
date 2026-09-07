import { nearestBox, type Box, type Vec3 } from "../physics.js";
import { PLAYER } from "../config.js";

interface Occupant extends Vec3 { readonly id: string; readonly team: number; readonly alive: boolean }

/** Server-only spawn choice. Rotation breaks ties; live occupants and enemy
 * exposure outweigh route variety. No client position or preference is accepted.
 */
export function chooseSafeSpawn(points: readonly Vec3[], rotation: number,
  players: readonly Occupant[], selfId: string, team: number, boxes: readonly Box[]): Vec3 {
  if (!points.length) throw new Error("Map has no team spawn points");
  let best = points[rotation % points.length]!;
  let bestDanger = Infinity;
  for (let offset = 0; offset < points.length; offset++) {
    const point = points[(rotation + offset) % points.length]!;
    let danger = 0;
    for (const p of players) {
      if (!p.alive || p.id === selfId) continue;
      const distance = Math.hypot(p.x - point.x, p.z - point.z);
      if (distance < PLAYER.radius * 2 + 0.3) danger += 10_000;
      if (p.team === team) continue;
      danger += Math.max(0, 14 - distance) ** 2;
      const from = { ...point, y: point.y + PLAYER.standEye };
      const dx = p.x - from.x, dy = p.y + PLAYER.standEye - from.y, dz = p.z - from.z;
      const length = Math.hypot(dx, dy, dz);
      if (length < 0.001) { danger += 100; continue; }
      const blocked = nearestBox(from, { x: dx / length, y: dy / length, z: dz / length }, boxes, length) < length;
      if (!blocked) danger += 100 * Math.max(0, 1 - distance / 50);
    }
    if (danger < bestDanger) { best = point; bestDanger = danger; }
  }
  return best;
}
