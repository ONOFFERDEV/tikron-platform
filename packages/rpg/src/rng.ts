/**
 * Deterministic RNG — a thin 0..1 wrapper over `xorshift32` from @tikron/sim plus the
 * three roll helpers combat/buffs/AI draw from. The wrapper counts draws so the whole
 * stream round-trips through serialize/restore: re-seed with the same seed and replay
 * `count` draws and the next value is identical. No `Math.random` anywhere.
 */

import { xorshift32 } from "@tikron/sim";

/** A seeded generator returning a float in [0, 1). Injected into every stochastic path. */
export type Rng = () => number;

/** A generator with an observable draw counter for deterministic snapshotting. */
export interface SeededRng {
  /** Draw the next float in [0, 1). */
  next: Rng;
  /** Total draws taken so far (survives {@link makeRng} re-seeding via `advance`). */
  count(): number;
}

const UINT32 = 0x1_0000_0000;

/**
 * Build a seeded RNG. `advance` fast-forwards the stream by that many draws (used by
 * restore: `makeRng(seed, snapshot.advance)` reproduces the exact live position). The
 * raw xorshift32 yields uint32; we divide by 2^32 for [0, 1).
 */
export function makeRng(seed: number, advance = 0): SeededRng {
  const raw = xorshift32(seed);
  let n = 0;
  while (n < advance) {
    raw();
    n++;
  }
  const next: Rng = () => {
    n++;
    return raw() / UINT32;
  };
  return { next, count: () => n };
}

/**
 * Roll a percentage chance in [0, 100]. `pct <= 0` is always false and `pct >= 100`
 * always true WITHOUT consuming a draw — so guaranteed/impossible procs never perturb
 * the stream, which is what makes the "chance 0/100" determinism tests stable.
 */
export function rollChance(rng: Rng, pct: number): boolean {
  if (pct <= 0) return false;
  if (pct >= 100) return true;
  return rng() * 100 < pct;
}

/** Uniform float in [min, max]. `min >= max` returns `min` without a draw. */
export function rollRange(rng: Rng, min: number, max: number): number {
  if (min >= max) return min;
  return min + rng() * (max - min);
}

/**
 * Weighted pick over `items` using `weightFn` (non-positive weights are skipped).
 * Consumes exactly one draw when any positive weight exists; returns `undefined` for
 * an empty list or all-zero weights.
 */
export function pickWeighted<T>(rng: Rng, items: readonly T[], weightFn: (item: T) => number): T | undefined {
  let total = 0;
  for (const it of items) {
    const w = weightFn(it);
    if (w > 0) total += w;
  }
  if (total <= 0) return undefined;
  let roll = rng() * total;
  for (const it of items) {
    const w = weightFn(it);
    if (w <= 0) continue;
    roll -= w;
    if (roll < 0) return it;
  }
  // Floating-point tail: return the last positive-weight item.
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i]!;
    if (weightFn(it) > 0) return it;
  }
  return undefined;
}
