import { canStand, nearestBox, type Box } from "../physics.js";
import { PLAYER } from "../config.js";
import type { MapDef } from "./types.js";
import { routeFloor } from './terrain.js';

interface Point { x: number; z: number }
/** Cached yard/below-grade flow fields for Relay bots. Geometry is immutable, so a
 * destination's BFS is shared across bots and ticks; no per-tick path search.
 * Negative ramps connect the yard and trench. Positive decks, building stairs
 * and the upper bridge crossing deliberately remain human routes.
 */
export class GroundNavigator {
  private readonly width: number;
  private readonly depth: number;
  private readonly open: Uint8Array;
  private readonly fields = new Map<number, Int16Array>();
  private readonly expanded: Box[];
  private readonly heights: Float32Array;
  private readonly terrainMap: MapDef | undefined;
  private readonly walkBoxes: readonly Box[];
  constructor(map: MapDef) {
    this.width = map.bounds.width; this.depth = map.bounds.depth;
    this.open = new Uint8Array(this.width * this.depth);
    this.heights = new Float32Array(this.open.length);
    this.terrainMap = map.terrain ? map : undefined;
    this.walkBoxes = map.boxes.filter(b => !map.terrain?.boxes.includes(b));
    const rampBoxes = (map.ramps ?? []).filter(r => (r.baseY ?? 0) >= 0)
      .map(r => ({ min: { x: r.minX, y: r.baseY ?? 0, z: r.minZ }, max: { x: r.maxX, y: r.topY, z: r.maxZ } }));
    const obstacles = [...map.boxes, ...rampBoxes];
    for (let z = 0; z < this.depth; z++) for (let x = 0; x < this.width; x++) {
      const y = routeFloor(map, x + .5, z + .5), index = z * this.width + x;
      this.heights[index] = y;
      this.open[index] = Number(canStand(x + 0.5, y, z + 0.5, PLAYER.radius, PLAYER.standHeight, obstacles, map.bounds));
    }
    // An overhead lintel is not a ground obstruction. Match the standing-capsule
    // occupancy grid so clear() can traverse the open Relay core underneath it.
    this.expanded = obstacles.filter(b => b.min.y < PLAYER.standHeight && b.max.y > 0).map(b => ({ min: { x: b.min.x - PLAYER.radius, y: -1, z: b.min.z - PLAYER.radius },
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
    // Ground and below-grade routes form one heightfield. A retaining edge is
    // never a walkable connection; only the two gentle slopes join the tiers.
    return this.terrainMap ? next.filter(n => Math.abs(this.heights[n]! - this.heights[index]!) <= .45) : next;
  }
  private clear(from: Point, to: Point): boolean {
    const d = Math.hypot(to.x - from.x, to.z - from.z);
    const cut = this.terrainMap?.terrain?.cut;
    if (this.terrainMap && cut && Math.max(from.x, to.x) >= cut.minX && Math.min(from.x, to.x) <= cut.maxX
      && Math.max(from.z, to.z) >= cut.minZ && Math.min(from.z, to.z) <= cut.maxZ) {
      const map = this.terrainMap;
      let previous = routeFloor(map, from.x, from.z);
      const steps = Math.max(1, Math.ceil(d / .2));
      for (let i = 0; i <= steps; i++) {
        const x = from.x + (to.x - from.x) * i / steps, z = from.z + (to.z - from.z) * i / steps;
        const y = routeFloor(map, x, z);
        if (Math.abs(y - previous) > .09 || !this.open[this.index({ x, z })]
          || !canStand(x, y, z, PLAYER.radius - 1e-5, PLAYER.standHeight, this.walkBoxes, map.bounds)) return false;
        previous = y;
      }
      // Positive ramps/roofs deliberately remain outside bot routing.
      return d < .001 || nearestBox({ ...from, y: .5 },
        { x: (to.x - from.x) / d, y: 0, z: (to.z - from.z) / d }, this.expanded, d) === Infinity;
    }
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
