/**
 * Static map geometry, isomorphic — axis-aligned obstacles with the three
 * queries a server-authoritative action game needs, promoted verbatim from the
 * FPS demo's crate system after it shipped there:
 *
 * - {@link rayObstacleHit} — line-of-sight: does a shot ray enter cover first?
 * - {@link pushOutOfObstacles} — movement: keep a circle (player) out of boxes.
 * - {@link obstacleContains} — point membership (exemption rules, pickup spots).
 *
 * The intended contract is **seed-derived geometry**: both sides build the SAME
 * obstacle list from a PRNG keyed by a seed the room broadcasts once (see
 * {@link xorshift32}), so authoritative cover costs ZERO wire bytes — what the
 * client draws IS what the server hit-tests. All functions are pure, take the
 * obstacle list as input, and accept a `skip` callback so destructible cover
 * (server flips an index to "broken" in state) needs no array rebuilds.
 */

import type { Vec2 } from "./index.js";

/** An axis-aligned obstacle: centre + full edge sizes (the AABB spans ±w/2, ±h/2). */
export interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * xorshift32 PRNG — a compact deterministic generator for seed-derived maps.
 * Same-seed streams are identical across the browser and the room, which is the
 * whole trick: broadcast one u32 seed, derive every static layout from it.
 */
export function xorshift32(seed: number): () => number {
  let s = seed >>> 0 || 0x9e3779b9;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s >>> 0;
  };
}

/** Point-in-obstacle test (inclusive edges). */
export function obstacleContains(o: Obstacle, x: number, y: number): boolean {
  const hw = o.w / 2;
  const hh = o.h / 2;
  return x >= o.x - hw && x <= o.x + hw && y >= o.y - hh && y <= o.y + hh;
}

/**
 * Distance along the ray `(ox,oy) + t·(dx,dy)` to the first obstacle face it
 * enters within `maxT`, and WHICH obstacle — or `null`. Obstacles containing
 * the ray origin are ignored (you can always fire out of cover you stand in),
 * as are `skip(index)` obstacles (destroyed cover). Standard slab test;
 * `(dx,dy)` must be unit length for `t` to be in world units.
 */
export function rayObstacleHit(
  obstacles: readonly Obstacle[],
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  maxT: number,
  skip?: (index: number) => boolean,
): { t: number; index: number } | null {
  let best = Infinity;
  let bestIndex = -1;
  for (let i = 0; i < obstacles.length; i++) {
    if (skip?.(i)) continue;
    const o = obstacles[i]!;
    if (obstacleContains(o, ox, oy)) continue;
    const hw = o.w / 2;
    const hh = o.h / 2;
    let tMin = 0;
    let tMax = maxT;
    let ok = true;
    for (const [p, d, lo, hi] of [
      [ox, dx, o.x - hw, o.x + hw],
      [oy, dy, o.y - hh, o.y + hh],
    ] as const) {
      if (d === 0) {
        if (p < lo || p > hi) {
          ok = false;
          break;
        }
        continue;
      }
      let t1 = (lo - p) / d;
      let t2 = (hi - p) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) {
        ok = false;
        break;
      }
    }
    if (ok && tMin < best && tMin > 0) {
      best = tMin;
      bestIndex = i;
    }
  }
  return bestIndex >= 0 ? { t: best, index: bestIndex } : null;
}

/**
 * Is a shot from `(ox,oy)` along unit `(dx,dy)` to a victim at distance
 * `victimT` blocked by cover? Obstacles containing the shooter or the victim
 * never block (fire out of your own cover; if movement does not collide with
 * the geometry, cover must not shield someone standing inside it — an
 * unhittable camping spot otherwise), and `skip(index)` obstacles never block.
 */
export function shotBlockedByObstacles(
  obstacles: readonly Obstacle[],
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  victimT: number,
  victimX: number,
  victimY: number,
  skip?: (index: number) => boolean,
): boolean {
  const skipOrVictim = (i: number) =>
    (skip?.(i) ?? false) || obstacleContains(obstacles[i]!, victimX, victimY);
  return (rayObstacleHit(obstacles, ox, oy, dx, dy, victimT, skipOrVictim)?.t ?? Infinity) < victimT;
}

/**
 * Push a circle of radius `r` at `pos` out of every obstacle it overlaps and
 * return the corrected position (input untouched). Minimum-translation axis
 * per obstacle, two passes so a corner between two boxes settles. Use the SAME
 * call on both sides — the server after `resolveMovement`, the client via
 * `RenderPredictor`'s `constrain` option — or every wall contact becomes a
 * correction fight.
 */
export function pushOutOfObstacles(
  pos: Vec2,
  r: number,
  obstacles: readonly Obstacle[],
  skip?: (index: number) => boolean,
): Vec2 {
  let { x, y } = pos;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < obstacles.length; i++) {
      if (skip?.(i)) continue;
      const o = obstacles[i]!;
      const hw = o.w / 2;
      const hh = o.h / 2;
      const cx = Math.max(o.x - hw, Math.min(o.x + hw, x));
      const cy = Math.max(o.y - hh, Math.min(o.y + hh, y));
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        y = cy + (dy / d) * r;
      } else {
        const left = x - (o.x - hw);
        const right = o.x + hw - x;
        const top = y - (o.y - hh);
        const bottom = o.y + hh - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = o.x - hw - r;
        else if (m === right) x = o.x + hw + r;
        else if (m === top) y = o.y - hh - r;
        else y = o.y + hh + r;
      }
    }
  }
  return { x, y };
}
