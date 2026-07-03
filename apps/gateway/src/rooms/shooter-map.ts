/**
 * Seed-derived map furniture beyond crates (see shooter-crates.ts): pickup
 * spots. (The circle-vs-crate movement push-out moved to shooter-crates.ts,
 * which delegates to @tikron/sim's generic obstacle geometry.) Same
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
