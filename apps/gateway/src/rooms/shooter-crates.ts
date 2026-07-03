/**
 * Deterministic crate cover, shared by the server and the demo client. Both
 * sides derive the SAME layout from the room's broadcast `state.seed`, so the
 * server resolves line-of-sight and movement against exactly the boxes the
 * client draws — authoritative cover with zero wire bytes.
 *
 * The geometry itself lives in `@tikron/sim` ({@link Obstacle} + the ray/LOS/
 * push-out queries) — this module keeps only what is game-specific: the crate
 * shape (`size` squares), the seeded layout, and thin wrappers that adapt the
 * square crates onto the SDK's rectangular obstacles. Blocking rule (see
 * {@link shotBlocked}): a crate blocks a shot when the aim ray enters it before
 * reaching the victim — UNLESS the crate contains the shooter (fire out of the
 * box you stand in) or the victim (movement pushes players OUT of crates, but a
 * mid-box respawn/edge case must never become an unhittable camping spot).
 */

import {
  obstacleContains,
  pushOutOfObstacles,
  rayObstacleHit,
  shotBlockedByObstacles,
  xorshift32,
  type Obstacle,
  type Vec2,
} from "@tikron/sim";

export { xorshift32 };

export interface Crate {
  /** Centre (world units). */
  x: number;
  y: number;
  /** Full edge length; the AABB spans ±size/2 around the centre. */
  size: number;
}

const asObstacle = (c: Crate): Obstacle => ({ x: c.x, y: c.y, w: c.size, h: c.size });

/** Memoized square→rect view so hot paths don't re-map 44 crates per query. */
const obstacleCache = new WeakMap<readonly Crate[], Obstacle[]>();
function obstacles(crates: readonly Crate[]): Obstacle[] {
  let o = obstacleCache.get(crates);
  if (!o) {
    o = crates.map(asObstacle);
    obstacleCache.set(crates, o);
  }
  return o;
}

/**
 * The room's crate layout. MUST stay byte-for-byte deterministic per seed —
 * the client renders this and the server hit-tests it, with no wire exchange.
 */
export function makeCrates(seed: number, world: number): Crate[] {
  const rng = xorshift32(seed);
  const unit = () => rng() / 0xffffffff;
  const margin = 80;
  const span = world - margin * 2;
  const crates: Crate[] = [];
  for (let i = 0; i < 44; i++) {
    crates.push({ x: margin + unit() * span, y: margin + unit() * span, size: 26 + unit() * 28 });
  }
  return crates;
}

/** Point-in-crate test (AABB, inclusive edges). */
export function crateContains(c: Crate, x: number, y: number): boolean {
  return obstacleContains(asObstacle(c), x, y);
}

/** First crate face the ray enters within `maxT` (skipping broken crates). */
export function rayCoverHit(
  crates: readonly Crate[],
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  maxT: number,
  skip?: (index: number) => boolean,
): { t: number; index: number } | null {
  return rayObstacleHit(obstacles(crates), ox, oy, dx, dy, maxT, skip);
}

/** Distance to the first entered crate face, or `Infinity` (tracer clipping). */
export function rayCoverDistance(
  crates: readonly Crate[],
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  maxT: number,
  skip?: (index: number) => boolean,
): number {
  return rayCoverHit(crates, ox, oy, dx, dy, maxT, skip)?.t ?? Infinity;
}

/** Is the shot to a victim at `victimT` blocked by intact cover? (See header.) */
export function shotBlocked(
  crates: readonly Crate[],
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  victimT: number,
  victimX: number,
  victimY: number,
  skip?: (index: number) => boolean,
): boolean {
  return shotBlockedByObstacles(obstacles(crates), ox, oy, dx, dy, victimT, victimX, victimY, skip);
}

/** Circle-vs-crates movement push-out (shared server + RenderPredictor constrain). */
export function pushOutOfCrates(
  pos: Vec2,
  r: number,
  crates: readonly Crate[],
  skip?: (index: number) => boolean,
): Vec2 {
  return pushOutOfObstacles(pos, r, obstacles(crates), skip);
}
