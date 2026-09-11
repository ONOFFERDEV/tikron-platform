import { MOVE, PLAYER } from '../config.js';
import { canStand, moveAndSlide, rampSurfaceY, type Box, type Vec3 } from '../physics.js';
import type { MapDef, RampDef } from '../map/types.js';
import { routeFloor } from '../map/terrain.js';
import type { BotRoutePoint } from '../bots.js';
import { CoreCollision } from '../core-gate.js';

interface Node { point: Vec3; incoming: number[] }
interface Geometry { boxes: Box[]; ramps: RampDef[] }
const CELL = 1, BUCKET = 4, EPS = .03, MAX_FIELDS = 24;

/** Bot-only walking graph. Multiple supported feet heights can occupy one cell:
 * a room and its roof are different nodes. Every edge is swept with the normal
 * player capsule, step height and ramp solver; no jumps, teleports or new cover.
 * Geometry/edges are built once, destination flow fields are bounded and shared
 * across bots. A query checks only short attachment/steering segments.
 */
export class BotNavigator {
  private readonly width: number;
  private readonly depth: number;
  private readonly cells: number[][];
  private readonly nodes: Node[] = [];
  private readonly buckets = new Map<string, Geometry>();
  private readonly fields = new Map<number, Int32Array>();
  readonly highGround: readonly Vec3[];

  constructor(private readonly map: MapDef) {
    this.width = Math.ceil(map.bounds.width / CELL);
    this.depth = Math.ceil(map.bounds.depth / CELL);
    this.cells = Array.from({ length: this.width * this.depth }, () => []);
    const add = (minX: number, maxX: number, minZ: number, maxZ: number, box?: Box, ramp?: RampDef) => {
      // Include the capsule and a complete adjacent-cell sweep in each bucket.
      const margin = PLAYER.radius + CELL;
      for (let z = Math.floor((minZ - margin) / BUCKET); z <= Math.floor((maxZ + margin) / BUCKET); z++)
        for (let x = Math.floor((minX - margin) / BUCKET); x <= Math.floor((maxX + margin) / BUCKET); x++) {
          const key = `${x},${z}`;
          let geometry = this.buckets.get(key);
          if (!geometry) { geometry = { boxes: [], ramps: [] }; this.buckets.set(key, geometry); }
          if (box) geometry.boxes.push(box);
          if (ramp) geometry.ramps.push(ramp);
        }
    };
    for (const b of map.boxes) add(b.min.x, b.max.x, b.min.z, b.max.z, b);
    for (const r of map.ramps ?? []) add(r.minX, r.maxX, r.minZ, r.maxZ, undefined, r);

    for (let z = 0; z < this.depth; z++) for (let x = 0; x < this.width; x++) {
      const px = (x + .5) * CELL, pz = (z + .5) * CELL;
      const geometry = this.geometry(px, pz);
      const heights = new Set([map.bounds.floor ?? 0]);
      for (const b of geometry.boxes) if (px >= b.min.x - PLAYER.radius && px <= b.max.x + PLAYER.radius
        && pz >= b.min.z - PLAYER.radius && pz <= b.max.z + PLAYER.radius) heights.add(b.max.y);
      for (const r of geometry.ramps) if (px >= r.minX && px <= r.maxX && pz >= r.minZ && pz <= r.maxZ)
        heights.add(rampSurfaceY(r, px, pz));
      for (const y of [...heights].sort((a, b) => a - b)) {
        if (!canStand(px, y, pz, PLAYER.radius, PLAYER.standHeight, geometry.boxes, map.bounds)) continue;
        const p = { x: px, y, z: pz }, settled = this.step(p, 0, 0, geometry);
        if (!settled.grounded || Math.abs(settled.pos.y - y) > .001) continue;
        this.cells[z * this.width + x]!.push(this.nodes.length);
        this.nodes.push({ point: p, incoming: [] });
      }
    }
    for (let z = 0; z < this.depth; z++) for (let x = 0; x < this.width; x++) {
      const cell = this.cells[z * this.width + x]!;
      // Each pair is tested in BOTH directions. A safe descent need not imply
      // an ascent; reverse fields consume the actual directed incoming edges.
      for (const neighbor of [x + 1 < this.width ? z * this.width + x + 1 : -1,
        z + 1 < this.depth ? (z + 1) * this.width + x : -1]) {
        if (neighbor < 0) continue;
        for (const a of cell) for (const b of this.cells[neighbor]!) {
          const pa = this.nodes[a]!.point, pb = this.nodes[b]!.point;
          if (Math.abs(pa.y - pb.y) > 1) continue;
          if (this.walkable(pa, pb)) this.nodes[b]!.incoming.push(a);
          if (this.walkable(pb, pa)) this.nodes[a]!.incoming.push(b);
        }
      }
    }
    const goals: Vec3[] = [];
    for (const r of map.ramps ?? []) {
      if (r.topY < 2 || (r.baseY ?? 0) < 0) continue;
      const p = { x: (r.minX + r.maxX) / 2, y: r.topY, z: (r.minZ + r.maxZ) / 2 };
      p[r.axis] = (r.dir === 1 ? (r.axis === 'x' ? r.maxX : r.maxZ) : (r.axis === 'x' ? r.minX : r.minZ)) + r.dir * 1.2;
      const goal = this.attach(p, false);
      if (goal !== undefined && this.nodes[goal]!.incoming.length &&
        !goals.some(g => Math.hypot(g.x - p.x, g.z - p.z) < 3)) goals.push(this.nodes[goal]!.point);
    }
    this.highGround = goals;
  }

  private geometry(x: number, z: number): Geometry {
    return this.buckets.get(`${Math.floor(x / BUCKET)},${Math.floor(z / BUCKET)}`) ?? EMPTY;
  }
  private step(pos: Vec3, dx: number, dz: number, geometry = this.geometry(pos.x, pos.z)) {
    return moveAndSlide(pos, PLAYER.radius, PLAYER.standHeight, { x: dx, y: -.025, z: dz }, -.5,
      geometry.boxes, this.map.bounds, MOVE.stepUp, geometry.ramps);
  }
  /** Short, swept steering, including starts exactly touching a wall. Hitscan's
   * intentionally ignored inside/on-face origins are never used for movement. */
  walkable(from: Vec3, to: Vec3): boolean {
    const d = Math.hypot(to.x - from.x, to.z - from.z);
    const steps = Math.max(1, Math.ceil(d / .2)), dx = (to.x - from.x) / steps, dz = (to.z - from.z) / steps;
    let p = from;
    for (let i = 0; i < steps; i++) {
      const result = this.step(p, dx, dz);
      if (Math.hypot(result.pos.x - p.x - dx, result.pos.z - p.z - dz) > EPS ||
        Math.abs(result.pos.y - p.y) > MOVE.stepUp + .01 || !result.grounded) return false;
      p = result.pos;
    }
    return Math.abs(p.y - to.y) < EPS;
  }
  private attach(p: Vec3, sweep: boolean): number | undefined {
    const cx = Math.floor(p.x / CELL), cz = Math.floor(p.z / CELL);
    const candidates: { id: number; distance: number }[] = [];
    for (let z = Math.max(0, cz - 1); z <= Math.min(this.depth - 1, cz + 1); z++)
      for (let x = Math.max(0, cx - 1); x <= Math.min(this.width - 1, cx + 1); x++)
        for (const id of this.cells[z * this.width + x]!) {
          const n = this.nodes[id]!.point;
          if (Math.abs(n.y - p.y) <= .65) candidates.push({ id, distance: Math.hypot(n.x - p.x, n.y - p.y, n.z - p.z) });
        }
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates.find(c => !sweep || this.walkable(p, this.nodes[c.id]!.point))?.id;
  }
  private field(goal: number): Int32Array {
    let field = this.fields.get(goal);
    if (field) return field;
    field = new Int32Array(this.nodes.length).fill(-1); field[goal] = goal;
    const queue = new Int32Array(this.nodes.length); queue[0] = goal;
    let head = 0, tail = 1;
    while (head < tail) {
      const current = queue[head++]!;
      for (const from of this.nodes[current]!.incoming) if (field[from] === -1) {
        field[from] = current; queue[tail++] = from;
      }
    }
    if (this.fields.size >= MAX_FIELDS) this.fields.delete(this.fields.keys().next().value!);
    this.fields.set(goal, field);
    return field;
  }
  next(from: Vec3, target: BotRoutePoint): Vec3 {
    const to = { ...target, y: target.y ?? routeFloor(this.map, target.x, target.z) };
    if (Math.hypot(to.x - from.x, to.z - from.z) <= 6 && this.walkable(from, to)) return to;
    const start = this.attach(from, true), goal = this.attach(to, false);
    if (start === undefined || goal === undefined) return from;
    const field = this.field(goal);
    if (field[start] === -1) return from;
    let best = this.nodes[start]!.point, cursor = start;
    // Bounded look-ahead removes grid zigzags, but every shortcut still sweeps
    // the real capsule. Stop before a corner or floor transition we cannot walk.
    for (let i = 0; i < 5; i++) {
      const next = field[cursor];
      if (next === undefined || next < 0 || next === cursor) break;
      const point = this.nodes[next]!.point;
      if (!this.walkable(from, point)) break;
      best = point; cursor = next;
    }
    return best;
  }
  /** Static tactical choice, based only on the bot's own spawn and map geometry. */
  nearestHighGround(from: Vec3): Vec3 | undefined {
    const start = this.attach(from, true);
    if (start === undefined) return;
    return [...this.highGround].sort((a, b) => Math.hypot(a.x - from.x, a.z - from.z) - Math.hypot(b.x - from.x, b.z - from.z))
      .find(p => { const goal = this.attach(p, false); return goal !== undefined && this.field(goal)[start] !== -1; });
  }
  get stats() { return { nodes: this.nodes.length, edges: this.nodes.reduce((n, p) => n + p.incoming.length, 0),
    fields: this.fields.size, fieldBytes: this.fields.size * this.nodes.length * 4 }; }
}
const EMPTY: Geometry = { boxes: [], ramps: [] };

// Every room in an isolate uses the same immutable map definitions. Cache both
// shutter variants during room creation, never rebuild a graph on an event tick.
// A cold isolate naturally rebuilds these derived, non-persisted indexes.
const navigators = new WeakMap<MapDef, { closed: BotNavigator; open: BotNavigator }>();
export function botNavigators(map: MapDef) {
  let pair = navigators.get(map);
  if (!pair) {
    const closed = new BotNavigator(map);
    pair = { closed, open: map.signalCore ? new BotNavigator({ ...map, boxes: new CoreCollision(map).open }) : closed };
    navigators.set(map, pair);
  }
  return pair;
}
