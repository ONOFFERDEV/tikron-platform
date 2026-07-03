/**
 * Seed-derived map furniture beyond crates (see shooter-crates.ts): pickup
 * spots, plus the circle-vs-crate movement pushout both sides share. Same
 * contract as the crates: client rendering and server authority derive the
 * SAME layout from `state.seed`, so nothing here costs wire bytes.
 */
import { xorshift32, crateContains, type Crate } from "./shooter-crates.js";

export type PickupKind = "hp" | "dmg";

export interface PickupSpot {
  x: number;
  y: number;
  kind: PickupKind;
}

/**
 * Deterministic pickup spots. Decorrelated from the crate stream (seed is
 * remixed) and nudged off any crate so a pickup never renders inside a box.
 * Alternates health packs and damage boosts.
 */
export function makePickups(
  seed: number,
  world: number,
  crates: readonly Crate[],
  count: number,
): PickupSpot[] {
  const rng = xorshift32((seed ^ 0x9e3779b9) >>> 0);
  const unit = () => rng() / 0xffffffff;
  const margin = 140;
  const span = world - margin * 2;
  const spots: PickupSpot[] = [];
  while (spots.length < count) {
    const x = margin + unit() * span;
    const y = margin + unit() * span;
    if (crates.some((c) => crateContains(c, x, y))) continue; // re-roll: inside a box
    spots.push({ x, y, kind: spots.length % 2 === 0 ? "hp" : "dmg" });
  }
  return spots;
}

/**
 * Push a circle of radius `r` at `pos` out of every crate it overlaps and
 * return the corrected position (input untouched). Minimum-translation axis
 * per crate, two passes so a corner between two boxes settles. Skip-list via
 * `isBroken` lets destroyed crates stop colliding without rebuilding arrays.
 */
export function pushOutOfCrates(
  pos: { x: number; y: number },
  r: number,
  crates: readonly Crate[],
  isBroken?: (index: number) => boolean,
): { x: number; y: number } {
  let { x, y } = pos;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < crates.length; i++) {
      if (isBroken?.(i)) continue;
      const c = crates[i]!;
      const h = c.size / 2;
      // Closest point on the AABB to the circle centre.
      const cx = Math.max(c.x - h, Math.min(c.x + h, x));
      const cy = Math.max(c.y - h, Math.min(c.y + h, y));
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 > 1e-9) {
        // Centre outside the box: push along the contact normal.
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        y = cy + (dy / d) * r;
      } else {
        // Centre inside the box: exit through the nearest face.
        const left = x - (c.x - h);
        const right = c.x + h - x;
        const top = y - (c.y - h);
        const bottom = c.y + h - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = c.x - h - r;
        else if (m === right) x = c.x + h + r;
        else if (m === top) y = c.y - h - r;
        else y = c.y + h + r;
      }
    }
  }
  return { x, y };
}
