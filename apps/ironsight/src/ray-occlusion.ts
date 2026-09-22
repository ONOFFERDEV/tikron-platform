import type { RampDef } from "./map/types.js";
import { rayAabb, type Box, type Vec3 } from "./physics.js";

interface HalfSpace {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly limit: number;
}

const EPSILON = 1e-9;

export interface RampSweepHit {
  readonly time: number;
  readonly normal: Vec3;
}

function value(plane: HalfSpace, point: Vec3): number {
  return plane.x * point.x + plane.y * point.y + plane.z * point.z;
}

function rampPlanes(ramp: RampDef): readonly HalfSpace[] {
  const base = ramp.baseY ?? 0;
  const axisMin = ramp.axis === "x" ? ramp.minX : ramp.minZ;
  const axisMax = ramp.axis === "x" ? ramp.maxX : ramp.maxZ;
  const slope = (ramp.topY - base) / (axisMax - axisMin);
  const surface = ramp.axis === "x"
    ? ramp.dir === 1
      ? { x: -slope, y: 1, z: 0, limit: base - slope * axisMin }
      : { x: slope, y: 1, z: 0, limit: base + slope * axisMax }
    : ramp.dir === 1
      ? { x: 0, y: 1, z: -slope, limit: base - slope * axisMin }
      : { x: 0, y: 1, z: slope, limit: base + slope * axisMax };
  return [
    { x: -1, y: 0, z: 0, limit: -ramp.minX },
    { x: 1, y: 0, z: 0, limit: ramp.maxX },
    { x: 0, y: 0, z: -1, limit: -ramp.minZ },
    { x: 0, y: 0, z: 1, limit: ramp.maxZ },
    { x: 0, y: -1, z: 0, limit: -base },
    surface,
  ];
}

type Triangle = readonly [Vec3, Vec3, Vec3];

function rampTriangles(ramp: RampDef): readonly Triangle[] {
  const base = ramp.baseY ?? 0;
  const axisLow = ramp.axis === "x" ? ramp.minX : ramp.minZ;
  const axisHigh = ramp.axis === "x" ? ramp.maxX : ramp.maxZ;
  const crossLow = ramp.axis === "x" ? ramp.minZ : ramp.minX;
  const crossHigh = ramp.axis === "x" ? ramp.maxZ : ramp.maxX;
  const point = (axis: number, cross: number, y: number): Vec3 => ramp.axis === "x"
    ? { x: axis, y, z: cross } : { x: cross, y, z: axis };
  const lowTop = ramp.dir === -1 ? ramp.topY : base;
  const highTop = ramp.dir === 1 ? ramp.topY : base;
  const lb0 = point(axisLow, crossLow, base), lb1 = point(axisLow, crossHigh, base);
  const hb0 = point(axisHigh, crossLow, base), hb1 = point(axisHigh, crossHigh, base);
  const lt0 = point(axisLow, crossLow, lowTop), lt1 = point(axisLow, crossHigh, lowTop);
  const ht0 = point(axisHigh, crossLow, highTop), ht1 = point(axisHigh, crossHigh, highTop);
  const topLow0 = ramp.dir === 1 ? lb0 : lt0, topLow1 = ramp.dir === 1 ? lb1 : lt1;
  const topHigh0 = ramp.dir === 1 ? ht0 : hb0, topHigh1 = ramp.dir === 1 ? ht1 : hb1;
  const wall0 = ramp.dir === 1 ? hb0 : lb0, wall1 = ramp.dir === 1 ? hb1 : lb1;
  const wallTop0 = ramp.dir === 1 ? ht0 : lt0, wallTop1 = ramp.dir === 1 ? ht1 : lt1;
  const endTop0 = ramp.dir === 1 ? ht0 : lt0, endTop1 = ramp.dir === 1 ? ht1 : lt1;
  return [
    [lb0, hb0, hb1], [lb0, hb1, lb1],
    [topLow0, topHigh0, topHigh1], [topLow0, topHigh1, topLow1],
    [wall0, wall1, wallTop1], [wall0, wallTop1, wallTop0],
    [lb0, hb0, endTop0], [lb1, endTop1, hb1],
  ];
}

const subtract = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const addScaled = (a: Vec3, b: Vec3, scale: number): Vec3 =>
  ({ x: a.x + b.x * scale, y: a.y + b.y * scale, z: a.z + b.z * scale });

function closestTriangle(point: Vec3, [a, b, c]: Triangle): Vec3 {
  const ab = subtract(b, a), ac = subtract(c, a), ap = subtract(point, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return a;
  const bp = subtract(point, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return b;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return addScaled(a, ab, d1 / (d1 - d3));
  const cp = subtract(point, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return c;
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return addScaled(a, ac, d2 / (d2 - d6));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return addScaled(b, subtract(c, b), (d4 - d3) / ((d4 - d3) + (d5 - d6)));
  const inverse = 1 / (va + vb + vc);
  return addScaled(addScaled(a, ab, vb * inverse), ac, vc * inverse);
}

function closestRamp(point: Vec3, ramp: RampDef): { point: Vec3; distanceSquared: number } {
  if (insideNormal(point, ramp)) return { point, distanceSquared: 0 };
  let closest = point, distanceSquared = Infinity;
  for (const triangle of rampTriangles(ramp)) {
    const candidate = closestTriangle(point, triangle), offset = subtract(point, candidate);
    const squared = dot(offset, offset);
    if (squared < distanceSquared) { closest = candidate; distanceSquared = squared; }
  }
  return { point: closest, distanceSquared };
}

function insideNormal(point: Vec3, ramp: RampDef): Vec3 | null {
  let nearest: HalfSpace | null = null, gap = Infinity;
  for (const plane of rampPlanes(ramp)) {
    const length = Math.hypot(plane.x, plane.y, plane.z);
    const current = (plane.limit - value(plane, point)) / length;
    if (current < -EPSILON) return null;
    if (current < gap) { gap = current; nearest = plane; }
  }
  if (!nearest) return null;
  const length = Math.hypot(nearest.x, nearest.y, nearest.z);
  return { x: nearest.x / length, y: nearest.y / length, z: nearest.z / length };
}

export function rayRamp(origin: Vec3, direction: Vec3, ramp: RampDef, maxT: number): number | null {
  if (![origin.x, origin.y, origin.z, direction.x, direction.y, direction.z, maxT].every(Number.isFinite) || maxT <= 0) return null;
  const planes = rampPlanes(ramp);
  if (planes.every(plane => value(plane, origin) <= plane.limit + EPSILON)) return null;
  let enter = 0;
  let leave = maxT;
  for (const plane of planes) {
    const numerator = plane.limit - value(plane, origin);
    const denominator = plane.x * direction.x + plane.y * direction.y + plane.z * direction.z;
    if (Math.abs(denominator) <= EPSILON) {
      if (numerator < -EPSILON) return null;
      continue;
    }
    const time = numerator / denominator;
    if (denominator < 0) enter = Math.max(enter, time);
    else leave = Math.min(leave, time);
    if (enter - leave > EPSILON) return null;
  }
  return enter > EPSILON && enter <= maxT + EPSILON ? enter : null;
}

export function sweepSphereRamp(origin: Vec3, delta: Vec3, radius: number, ramp: RampDef): RampSweepHit | null {
  if (![origin.x, origin.y, origin.z, delta.x, delta.y, delta.z, radius].every(Number.isFinite) || radius < 0) return null;
  const embeddedNormal = insideNormal(origin, ramp);
  if (embeddedNormal) return { time: 0, normal: embeddedNormal };
  const at = (time: number): Vec3 => addScaled(origin, delta, time);
  const sample = (time: number) => closestRamp(at(time), ramp);
  const start = sample(0), radiusSquared = radius * radius;
  if (start.distanceSquared <= radiusSquared + EPSILON) {
    const offset = subtract(origin, start.point), length = Math.sqrt(start.distanceSquared);
    const normal = length > EPSILON ? addScaled({ x: 0, y: 0, z: 0 }, offset, 1 / length) : insideNormal(origin, ramp);
    return normal && dot(delta, normal) < -EPSILON ? { time: 0, normal } : null;
  }
  let low = 0, high = 1;
  for (let iteration = 0; iteration < 64; iteration += 1) {
    const left = (2 * low + high) / 3, right = (low + 2 * high) / 3;
    if (sample(left).distanceSquared <= sample(right).distanceSquared) high = right;
    else low = left;
  }
  const minimumTime = (low + high) / 2;
  if (sample(minimumTime).distanceSquared > radiusSquared + EPSILON) return null;
  low = 0; high = minimumTime;
  for (let iteration = 0; iteration < 64; iteration += 1) {
    const middle = (low + high) / 2;
    if (sample(middle).distanceSquared <= radiusSquared) high = middle;
    else low = middle;
  }
  const contact = sample(high), center = at(high), offset = subtract(center, contact.point);
  const length = Math.sqrt(contact.distanceSquared);
  const normal = length > EPSILON ? addScaled({ x: 0, y: 0, z: 0 }, offset, 1 / length) : insideNormal(center, ramp);
  return normal ? { time: high, normal } : null;
}

export function nearestOccluder(
  origin: Vec3,
  direction: Vec3,
  boxes: readonly Box[],
  ramps: readonly RampDef[],
  maxT: number,
): number {
  let nearest = Infinity;
  for (const box of boxes) {
    const distance = rayAabb(origin, direction, box, maxT);
    if (distance !== null && distance < nearest) nearest = distance;
  }
  for (const ramp of ramps) {
    const distance = rayRamp(origin, direction, ramp, maxT);
    if (distance !== null && distance < nearest) nearest = distance;
  }
  return nearest;
}
