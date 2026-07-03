/**
 * Deterministic crate cover, shared by the server and the demo client. Both
 * sides derive the SAME layout from the room's broadcast `state.seed`, so the
 * server can resolve line-of-sight against exactly the boxes the client draws
 * — crates went from "visual only" to authoritative cover without adding a
 * single byte to the state stream.
 *
 * Blocking rule (see {@link shotBlocked}): a crate blocks a shot when the aim
 * ray enters it before reaching the victim — UNLESS the crate contains the
 * shooter (you can always fire out of a box you are standing in) or the victim
 * (standing inside a box gives no protection; movement does not collide with
 * crates, so a contained victim would otherwise be unhittable — a degenerate
 * camping spot).
 */

export interface Crate {
  /** Centre (world units). */
  x: number;
  y: number;
  /** Full edge length; the AABB spans ±size/2 around the centre. */
  size: number;
}

/** xorshift32 PRNG — a compact deterministic generator seeded from the room. */
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

/**
 * The room's crate layout. MUST stay byte-for-byte deterministic per seed —
 * the client renders this and the server hit-tests it, with no wire exchange.
 * `world` is passed in (rather than importing the schema) to keep this module
 * dependency-free for both bundles.
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
  const h = c.size / 2;
  return x >= c.x - h && x <= c.x + h && y >= c.y - h && y <= c.y + h;
}

/**
 * Distance along the ray `(ox,oy) + t·(dx,dy)` to the first crate face it
 * enters, or `Infinity` when no crate is entered within `maxT`. Crates
 * containing the origin are ignored (see the blocking rule above), as are
 * crates for which `skip(index)` is true (destroyed cover). Standard slab
 * test; `(dx,dy)` must be unit length for `t` to be in world units.
 */
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

/** Like {@link rayCoverDistance} but identifies the crate that was hit —
 *  destructible cover needs to know WHICH box absorbed the shot. */
export function rayCoverHit(
  crates: readonly Crate[],
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  maxT: number,
  skip?: (index: number) => boolean,
): { t: number; index: number } | null {
  let best = Infinity;
  let bestIndex = -1;
  for (let i = 0; i < crates.length; i++) {
    if (skip?.(i)) continue;
    const c = crates[i]!;
    if (crateContains(c, ox, oy)) continue;
    const h = c.size / 2;
    // Slab intersection per axis; a zero direction component means the ray is
    // parallel to that slab — it intersects only if the origin is inside it.
    let tMin = 0;
    let tMax = maxT;
    let ok = true;
    for (const [o, d, lo, hi] of [
      [ox, dx, c.x - h, c.x + h],
      [oy, dy, c.y - h, c.y + h],
    ] as const) {
      if (d === 0) {
        if (o < lo || o > hi) {
          ok = false;
          break;
        }
        continue;
      }
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
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
 * `victimT` blocked by cover? Crates containing the shooter or the victim are
 * exempt (fire out of your box; boxes never shield someone standing in them),
 * and `skip(index)` crates (destroyed) never block.
 */
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
  const skipOrVictim = (i: number) =>
    (skip?.(i) ?? false) || crateContains(crates[i]!, victimX, victimY);
  return rayCoverDistance(crates, ox, oy, dx, dy, victimT, skipOrVictim) < victimT;
}
