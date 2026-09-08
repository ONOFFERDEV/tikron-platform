/** Deterministic spawn-choice audit, NOT match win-rate/contact telemetry.
 * pnpm exec esbuild tools/spawn-audit.ts --bundle --platform=node --format=esm --outfile=.inspect/spawn-audit.mjs
 * node .inspect/spawn-audit.mjs > .inspect/session25-spawn-audit.json
 */
import { performance } from 'node:perf_hooks';
import { ARENA1 } from '../src/map/arena1.js';
import { ARENA2 } from '../src/map/arena2.js';
import { ARENA3 } from '../src/map/arena3.js';
import { chooseSafeSpawn, spawnExposed, type SpawnOccupant } from '../src/map/spawn.js';
import { nearestBox, type Vec3, type Box } from '../src/physics.js';
import { PLAYER } from '../src/config.js';

// Frozen Session24 policy for an apples-to-apples policy comparison. Other maps
// and FFA used rotation only. Both policies are judged with the new body probes.
function previous(points: readonly Vec3[], rotation: number, players: SpawnOccupant[], team: number, boxes: readonly Box[]): Vec3 {
  let best = points[rotation % points.length]!, bestDanger = Infinity;
  for (let offset = 0; offset < points.length; offset++) {
    const point = points[(rotation + offset) % points.length]!;
    let danger = 0;
    for (const p of players) {
      const distance = Math.hypot(p.x - point.x, p.z - point.z);
      if (distance < PLAYER.radius * 2 + 0.3) danger += 10_000;
      if (p.team === team) continue;
      danger += Math.max(0, 14 - distance) ** 2;
      const from = { ...point, y: point.y + PLAYER.standEye };
      const dx = p.x - from.x, dy = p.y + PLAYER.standEye - from.y, dz = p.z - from.z;
      const length = Math.hypot(dx, dy, dz);
      if (length < .001) { danger += 100; continue; }
      if (nearestBox(from, { x: dx / length, y: dy / length, z: dz / length }, boxes, length) >= length)
        danger += 100 * Math.max(0, 1 - distance / 50);
    }
    if (danger < bestDanger) { best = point; bestDanger = danger; }
  }
  return best;
}

let seed = 25;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
const reports = [ARENA1, ARENA2, ARENA3].map(map => {
  const grid: Vec3[] = [];
  for (let x = 2; x < map.bounds.width; x += 2) for (let z = 2; z < map.bounds.depth; z += 2) {
    if (!map.boxes.some(b => x >= b.min.x - PLAYER.radius && x <= b.max.x + PLAYER.radius &&
      z >= b.min.z - PLAYER.radius && z <= b.max.z + PLAYER.radius)) grid.push({ x, y: 0, z });
  }
  return { map: map.presentation, modes: [true, false].map(teamed => {
    let decisions = 0, safeAvailable = 0, beforeAvoidableExposure = 0, afterAvoidableExposure = 0;
    let beforeOccupied = 0, afterOccupied = 0, allExposed = 0;
    let example: unknown = null;
    const durationMs: number[] = [];
    for (const team of teamed ? [0, 1] : [0]) {
      const points = teamed ? team === 0 ? map.spawns.red : map.spawns.blue : [...map.spawns.red, ...map.spawns.blue];
      for (const count of [1, 3, 6, 11]) for (let trial = 0; trial < 128; trial++) {
        const locations = trial % 4 === 0 ? [...grid, ...points, ...points, ...points] : grid;
        const players = Array.from({ length: count }, (_, i) => ({ ...locations[Math.floor(random() * locations.length)]!,
          id: `p${i}`, team: teamed ? (i % 3 === 2 ? team : 1 - team) : 0, alive: true, crouch: i % 4 === 3 }));
        const rotation = trial % points.length;
        const occupied = (point: Vec3) => players.some(p => Math.hypot(p.x - point.x, p.z - point.z) < PLAYER.radius * 2 + .3);
        const exposed = (point: Vec3) => players.some(p => (!teamed || p.team !== team) && spawnExposed(point, p, map.boxes));
        const safe = points.some(p => !occupied(p) && !exposed(p));
        const before = map === ARENA1 && teamed ? previous(points, rotation, players, team, map.boxes) : points[rotation]!;
        const start = performance.now();
        const after = chooseSafeSpawn(points, rotation, players, 'self', team, map.boxes, teamed);
        durationMs.push(performance.now() - start);
        decisions++;
        if (safe) {
          safeAvailable++;
          if (exposed(before)) beforeAvoidableExposure++;
          if (exposed(after)) afterAvoidableExposure++;
          if (exposed(before) && !exposed(after) && !example) example = { team, rotation, players, before, after };
        }
        if (points.every(exposed)) allExposed++;
        if (occupied(before)) beforeOccupied++;
        if (occupied(after)) afterOccupied++;
        if (safe && (exposed(after) || occupied(after))) throw Error(`${map.presentation}: ignored a safe spawn`);
      }
    }
    durationMs.sort((a, b) => a - b);
    return { teamed, decisions, safeAvailable, beforeAvoidableExposure, afterAvoidableExposure,
      beforeOccupied, afterOccupied, allExposed, selectionMs: { median: durationMs[Math.floor(durationMs.length / 2)],
        p95: durationMs[Math.floor(durationMs.length * .95)], max: durationMs.at(-1) }, example };
  }) };
});
console.log(JSON.stringify({ seed: 25, note: 'Static seeded ground-grid occupants (1/3/6/11), 128 trials per side/count. No navigation, fighting, network, recent LOS history, or side win-rate inference. Selection timing is Node CPU on this machine, not Worker/iGPU timing.', reports }, null, 2));
