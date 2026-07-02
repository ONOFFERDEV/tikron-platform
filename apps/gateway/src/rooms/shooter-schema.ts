import { schema, mapOf, quant, type Codec } from "@tikron/schema";
import type { MotionProfile } from "@tikron/sim";

/**
 * Shared schema + constants for the FPS proof-of-concept demo (top-down hitscan
 * shooter). Kept free of any server imports so the browser client and the
 * load-test harness can import the codec without pulling in Durable Object code.
 *
 * The state is deliberately quantized — the F3 FPS lever. Positions ride on a
 * 0.1-unit grid over a 3000-unit map (`u16`, 2 bytes vs `f32`'s 4) and the aim
 * angle on a ~0.06° grid (`u16`); sub-grid jitter drops out of deltas entirely.
 * Projectiles are **not** in the state — the room resolves hits server-side and
 * emits a transient `shot` event, so there is no per-tick projectile sync cost
 * (standard hitscan-FPS practice).
 *
 * The quant position range MUST equal the map `world` — a value outside it clamps
 * to the edge, so a mismatch would silently pin players to a wall.
 */
export interface ShooterPlayer {
  x: number;
  y: number;
  /** Facing angle in radians (for rendering other players' aim). */
  aim: number;
  hp: number;
  score: number;
  alive: boolean;
}
export interface ShooterState {
  players: Record<string, ShooterPlayer>;
  /**
   * Per-room PRNG seed (u32), broadcast so clients can deterministically render
   * static cover/obstacles from the same seed. This is a **visual-only** contract:
   * the server runs NO obstacle collision or movement blocking against it, so the
   * seed can ride in state for free (a constant scalar, absent from every delta
   * after the first frame). A client generates its obstacle layout with the same
   * PRNG (see {@link makeRng} in `shooter-spawn.ts`) keyed by this seed.
   */
  seed: number;
}

export const ShooterSchema: Codec<ShooterState> = schema({
  players: mapOf(
    schema({
      x: quant(0, 3000, 0.1),
      y: quant(0, 3000, 0.1),
      aim: quant(0, Math.PI * 2, 0.001),
      hp: "u8",
      score: "u32",
      alive: "bool",
    }),
  ),
  seed: "u32",
});

export const SHOOTER = {
  // A 3000² map (up from 2000²) so 64 players spread out: at the spawn min-
  // separation (300u) a 2000² map is right at its packing limit for 64 points,
  // while 3000² leaves comfortable headroom. Keep the quant position range above
  // in lock-step with this.
  world: 3000,
  /** AOI view radius — well under the map so interest management actually bites. */
  viewRadius: 600,
  maxSpeed: 500,
  stepMs: 50, // 20 Hz simulation
  maxHp: 100,
  shotDamage: 34, // three hits to down a full-hp player
  shotRange: 550, // < viewRadius (600) so every hit resolves within the shooter's view
  hitRadius: 40, // perpendicular distance to the ray that still counts as a hit
  // Server-enforced minimum ms between shots (receipt clock). 100 ms ≈ 10 shots/s —
  // above any human click rate, but it caps a scripted client at 340 dmg/s instead of
  // the ~2000 dmg/s the shared input rate limit alone would allow.
  shotCooldownMs: 100,
  respawnTicks: 30, // 30 × 50 ms = 1.5 s downed before respawn
  // Spread-spawn tuning (see pickSpawn in shooter-spawn.ts).
  spawnMinSep: 300, // a spawn keeps ≥ this from every living player
  spawnRingMin: 400, // ring band around a random survivor a candidate is drawn from
  spawnRingMax: 700,
  spawnCenterJitter: 300, // half-extent of the center box used when nobody is alive
} as const;

/**
 * The single movement contract shared by BOTH sides — the room's `resolveMovement`
 * budget and the client's `RenderPredictor` send clamp. One constant, imported by the
 * server room and the browser bundle alike, so the budgets can never drift apart (the
 * old hand-copied `MOVE_CFG` is exactly the duplication this replaces). `world` must
 * stay in lock-step with the quant position range above (see the codec note).
 */
export const SHOOTER_PROFILE: MotionProfile = {
  maxSpeed: SHOOTER.maxSpeed,
  tolerance: 1.15,
  stepMs: SHOOTER.stepMs,
  world: SHOOTER.world,
  // Send-clamp scale: > 1 so a clamped-send backlog drains during sustained movement,
  // < tolerance so a clamped send always fits the server budget for the same delta.
  sendHeadroom: 1.1,
};
