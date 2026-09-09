import type { Box, Vec3 } from "../physics.js";
import type { MapDef, RampDef } from "./types.js";
import { MOVE, PLAYER } from "../config.js";

/**
 * Pure, deterministic map walk-time utility — used by the map-timing gate
 * (test/map-timing.test.ts, always on) and the map-metrics report tool
 * (test/map-metrics.tool.test.ts, on-demand) to measure spawn→capture-point
 * symmetry and to build ETA tables. Not a gameplay navmesh: it rasterizes the
 * map to a 1 m ground-level grid and BFS's walk time across it, entirely
 * decoupled from the analytic AABB/ramp collision `physics.ts` uses at runtime.
 *
 * Known limitation (deliberate, conservative, not a bug): a cell is blocked
 * whenever it sits inside a box footprint taller than `MOVE.stepUp` that
 * overlaps standing height. Overhead lintels permit ground routes; a platform
 * you could climb *onto* still reads as a solid wall at ground level here — this is a
 * ground-walk-only approximation and ignores any path that goes up onto a
 * crate or platform. Only ramp footprints are treated as an always-passable
 * override, since a ramp's sloped surface is the map's intended way up.
 */

const DIRS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function insideBoxXZ(x: number, z: number, b: Box): boolean {
  return x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z;
}

/** Mirrors physics.ts's (unexported) insideRampFootprint — same XZ-rectangle test. */
function insideRampXZ(x: number, z: number, r: RampDef): boolean {
  return x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
}

/** Is the 1 m cell centred at world (x, z) walkable at ground level? */
function walkableCell(x: number, z: number, map: MapDef): boolean {
  for (const r of map.ramps ?? []) {
    if (insideRampXZ(x, z, r)) return true; // sloped surface: always the way up/across
  }
  for (const b of map.boxes) {
    if (b.min.y < PLAYER.standHeight && b.max.y > MOVE.stepUp && insideBoxXZ(x, z, b)) return false;
  }
  return true;
}

function clampIndex(v: number, max: number): number {
  return Math.min(max, Math.max(0, Math.floor(v)));
}

/**
 * BFS walk distance (in whole 1 m cells, 4-directional) from `from` to every
 * cell of the map's rasterized ground grid. Returns a rows×cols grid (row = z
 * cell, col = x cell); an unreachable cell holds `Infinity`.
 */
function bfsCellDistance(map: MapDef, from: Vec3): number[][] {
  const cols = Math.round(map.bounds.width);
  const rows = Math.round(map.bounds.depth);

  const walkable: boolean[][] = [];
  for (let j = 0; j < rows; j++) {
    const row: boolean[] = [];
    for (let i = 0; i < cols; i++) row.push(walkableCell(i + 0.5, j + 0.5, map));
    walkable.push(row);
  }

  const dist: number[][] = walkable.map((row) => row.map(() => Infinity));
  const startI = clampIndex(from.x, cols - 1);
  const startJ = clampIndex(from.z, rows - 1);
  if (!walkable[startJ]![startI]) return dist; // start cell itself blocked: nothing reachable

  dist[startJ]![startI] = 0;
  const queue: [number, number][] = [[startI, startJ]];
  let head = 0;
  while (head < queue.length) {
    const [i, j] = queue[head++]!;
    const d = dist[j]![i]!;
    for (const [di, dj] of DIRS) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || ni >= cols || nj < 0 || nj >= rows) continue;
      if (!walkable[nj]![ni]) continue;
      if (d + 1 >= dist[nj]![ni]!) continue;
      dist[nj]![ni] = d + 1;
      queue.push([ni, nj]);
    }
  }
  return dist;
}

/**
 * Walk time (seconds) from `from` to every 1 m cell of the map, at `speed` m/s
 * (default {@link MOVE.walk}). Returns a rows×cols grid (row = z cell, col = x
 * cell); an unreachable cell holds `Infinity`.
 */
export function walkSecondsFrom(map: MapDef, from: Vec3, speed: number = MOVE.walk): number[][] {
  const dist = bfsCellDistance(map, from);
  return dist.map((row) => row.map((d) => d / speed));
}

/** Walk time (seconds) from `from` to `to`, via {@link walkSecondsFrom}'s BFS. */
export function walkSeconds(map: MapDef, from: Vec3, to: Vec3, speed: number = MOVE.walk): number {
  const cols = Math.round(map.bounds.width);
  const rows = Math.round(map.bounds.depth);
  const dist = bfsCellDistance(map, from);
  const i = clampIndex(to.x, cols - 1);
  const j = clampIndex(to.z, rows - 1);
  return dist[j]![i]! / speed;
}
