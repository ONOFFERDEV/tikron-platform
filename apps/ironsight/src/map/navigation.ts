import { canStand, nearestBox, type Box } from "../physics.js";
import { PLAYER } from "../config.js";
import type { MapDef } from "./types.js";

interface Point { x: number; z: number }
/** Cached ground-only flow fields for Relay bots. Geometry is immutable, so a
 * destination's BFS is shared across bots and ticks; no per-tick path search.
 * Deliberately routes around decks/ramps rather than inventing vertical traversal.
 */
export class GroundNavigator {
  private readonly width: number;
  private readonly depth: number;
  private readonly open: Uint8Array;
  private readonly fields = new Map<number, Int16Array>();
  private readonly expanded: Box[];
  constructor(map: MapDef) {
    this.width = map.bounds.width; this.depth = map.bounds.depth;
    this.open = new Uint8Array(this.width * this.depth);
    const rampBoxes = (map.ramps ?? []).map(r => ({ min: { x: r.minX, y: 0, z: r.minZ }, max: { x: r.maxX, y: r.topY, z: r.maxZ } }));
    const obstacles = [...map.boxes, ...rampBoxes];
    for (let z = 0; z < this.depth; z++) for (let x = 0; x < this.width; x++)
      this.open[z * this.width + x] = Number(canStand(x + 0.5, 0, z + 0.5, PLAYER.radius, PLAYER.standHeight, obstacles, map.bounds));
    this.expanded = obstacles.map(b => ({ min: { x: b.min.x - PLAYER.radius, y: -1, z: b.min.z - PLAYER.radius },
      max: { x: b.max.x + PLAYER.radius, y: 3, z: b.max.z + PLAYER.radius } }));
  }
  private index(p: Point): number {
    return Math.max(0, Math.min(this.depth - 1, Math.floor(p.z))) * this.width
      + Math.max(0, Math.min(this.width - 1, Math.floor(p.x)));
  }
  private point(index: number): Point { return { x: index % this.width + 0.5, z: Math.floor(index / this.width) + 0.5 }; }
  private neighbors(index: number): number[] {
    const x = index % this.width, z = Math.floor(index / this.width);
    const next: number[] = [];
    if (x > 0) next.push(index - 1); if (x < this.width - 1) next.push(index + 1);
    if (z > 0) next.push(index - this.width); if (z < this.depth - 1) next.push(index + this.width);
    return next;
  }
  private clear(from: Point, to: Point): boolean {
    const d = Math.hypot(to.x - from.x, to.z - from.z);
    return d < 0.001 || nearestBox({ ...from, y: 0.5 },
      { x: (to.x - from.x) / d, y: 0, z: (to.z - from.z) / d }, this.expanded, d) === Infinity;
  }
  next(from: Point, target: Point): Point {
    if (this.clear(from, target)) return target;
    const goal = this.index(target), start = this.index(from);
    if (!this.open[goal] || !this.open[start]) return from;
    let distances = this.fields.get(goal);
    if (!distances) {
      distances = new Int16Array(this.open.length).fill(-1); distances[goal] = 0;
      const queue = new Int16Array(this.open.length); queue[0] = goal;
      let head = 0, tail = 1;
      while (head < tail) {
        const cell = queue[head++]!;
        for (const n of this.neighbors(cell)) if (this.open[n] && distances[n] === -1) {
          distances[n] = distances[cell]! + 1; queue[tail++] = n;
        }
      }
      if (this.fields.size >= 32) this.fields.delete(this.fields.keys().next().value!);
      this.fields.set(goal, distances);
    }
    let best = start;
    for (const n of this.neighbors(start)) {
      if (distances[n]! >= 0 && distances[n]! < distances[best]!) best = n;
    }
    if (best === start) return from;
    const next = this.point(best);
    // Recenter before a corner if a diagonal shortcut would scrape the capsule.
    return this.clear(from, next) ? next : this.point(start);
  }
}
