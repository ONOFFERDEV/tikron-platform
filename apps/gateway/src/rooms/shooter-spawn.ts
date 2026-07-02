import type { Vec2 } from "@tikron/sim";

/**
 * Spawn placement for the FPS demo — kept free of any server / Durable Object
 * imports so it is a pure, deterministic function the room wires up and the unit
 * tests exercise directly (no WebSocket round-trips).
 *
 * The whole point is *spread spawning*: at 64 players, dropping a fresh (or
 * respawning) player on top of a firefight is a bad experience, so a spawn is
 * placed on a ring away from a random living player and rejected if it lands too
 * close to ANY survivor. All randomness comes from an injected `rng` (see
 * {@link makeRng}), so a given seed + survivor set always yields the same point —
 * that is what makes the placement testable.
 */

/**
 * Deterministic xorshift32 PRNG returning a float in `[0, 1)`. The same generator
 * the arena rooms use (no `Math.random`, so runs are reproducible). Seed 0 is
 * remapped — xorshift is stuck at 0 — so every u32 seed produces a usable stream.
 */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 0x2545f491;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0x100000000;
  };
}

export interface SpawnConfig {
  /** Square map side; candidates are clamped to `[0, world]`. */
  world: number;
  /** A spawn must sit at least this far from EVERY living player. */
  minSeparation: number;
  /** Ring band (distance from a random survivor) ring candidates are drawn from. */
  ringMin: number;
  ringMax: number;
  /** Half-extent of the random box around map center used when nobody is alive. */
  centerJitter: number;
  /** Ring-candidate tries before falling back to whole-map random (default 12). */
  ringAttempts?: number;
  /** Whole-map random tries before accepting the last candidate (default 4). */
  randomAttempts?: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Choose a spawn point given the living players (`survivors`), a PRNG, and the
 * placement config.
 *
 * - No survivors → a random point near map center (`centerJitter` box).
 * - Otherwise → up to `ringAttempts` candidates on the [`ringMin`, `ringMax`] ring
 *   around a randomly picked survivor, accepting the first that is `minSeparation`
 *   from every survivor; then up to `randomAttempts` whole-map random points under
 *   the same check; and if all fail, the last candidate generated (always clamped
 *   in-bounds). The two fallbacks make the function total — it always returns a
 *   point — while keeping the common case (a well-separated spawn) the fast path.
 */
export function pickSpawn(
  survivors: readonly Vec2[],
  rng: () => number,
  cfg: SpawnConfig,
): Vec2 {
  const { world, minSeparation, ringMin, ringMax } = cfg;
  const ringAttempts = cfg.ringAttempts ?? 12;
  const randomAttempts = cfg.randomAttempts ?? 4;
  const clampPt = (p: Vec2): Vec2 => ({ x: clamp(p.x, 0, world), y: clamp(p.y, 0, world) });
  const minSep2 = minSeparation * minSeparation;
  const farEnough = (p: Vec2): boolean =>
    survivors.every((s) => {
      const dx = p.x - s.x;
      const dy = p.y - s.y;
      return dx * dx + dy * dy >= minSep2;
    });

  if (survivors.length === 0) {
    const c = world / 2;
    const j = cfg.centerJitter;
    return clampPt({ x: c + (rng() * 2 - 1) * j, y: c + (rng() * 2 - 1) * j });
  }

  // Seed the fallback with a whole-map point so an all-miss run still returns a
  // clamped, in-bounds spawn rather than undefined.
  let last: Vec2 = clampPt({ x: rng() * world, y: rng() * world });

  for (let i = 0; i < ringAttempts; i++) {
    const anchor = survivors[Math.floor(rng() * survivors.length)] ?? survivors[0]!;
    const angle = rng() * Math.PI * 2;
    const radius = ringMin + rng() * (ringMax - ringMin);
    const cand = clampPt({
      x: anchor.x + Math.cos(angle) * radius,
      y: anchor.y + Math.sin(angle) * radius,
    });
    last = cand;
    if (farEnough(cand)) return cand;
  }
  for (let i = 0; i < randomAttempts; i++) {
    const cand = { x: rng() * world, y: rng() * world };
    last = cand;
    if (farEnough(cand)) return cand;
  }
  return last;
}
