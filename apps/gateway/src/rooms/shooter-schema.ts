import { schema, mapOf, quant, type Codec } from "@tikron/schema";

/**
 * Shared schema + constants for the FPS proof-of-concept demo (top-down hitscan
 * shooter). Kept free of any server imports so the browser client and the
 * load-test harness can import the codec without pulling in Durable Object code.
 *
 * The state is deliberately quantized — the F3 FPS lever. Positions ride on a
 * 0.1-unit grid over a 2000-unit map (`u16`, 2 bytes vs `f32`'s 4) and the aim
 * angle on a ~0.06° grid (`u16`); sub-grid jitter drops out of deltas entirely.
 * Projectiles are **not** in the state — the room resolves hits server-side and
 * emits a transient `shot` event, so there is no per-tick projectile sync cost
 * (standard hitscan-FPS practice).
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
}

export const ShooterSchema: Codec<ShooterState> = schema({
  players: mapOf(
    schema({
      x: quant(0, 2000, 0.1),
      y: quant(0, 2000, 0.1),
      aim: quant(0, Math.PI * 2, 0.001),
      hp: "u8",
      score: "u32",
      alive: "bool",
    }),
  ),
});

export const SHOOTER = {
  world: 2000,
  /** AOI view radius — well under the map so interest management actually bites. */
  viewRadius: 600,
  maxSpeed: 500,
  stepMs: 50, // 20 Hz simulation
  maxHp: 100,
  shotDamage: 34, // three hits to down a full-hp player
  shotRange: 550, // < viewRadius (600) so every hit resolves within the shooter's view
  hitRadius: 40, // perpendicular distance to the ray that still counts as a hit
  respawnTicks: 30, // 30 × 50 ms = 1.5 s downed before respawn
} as const;
