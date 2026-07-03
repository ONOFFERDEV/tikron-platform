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
 * Projectiles are **not** in the state — the room resolves hits server-side
 * and emits a transient `shot` event, so there is no per-tick projectile sync
 * cost (standard hitscan-FPS practice).
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
  /** Equipped weapon — an index into {@link WEAPONS}. */
  w: number;
  /** Spawn-protected (brief invulnerability; cleared early by firing). */
  sp: boolean;
  /** Damage-boost pickup active (double damage). */
  db: boolean;
}
export interface ShooterState {
  players: Record<string, ShooterPlayer>;
  /**
   * Per-room PRNG seed (u32). Clients AND the server derive the same crate
   * layout and pickup spots from it (see `shooter-crates.ts` / `shooter-map.ts`)
   * — static geometry rides in state for free (a constant scalar, absent from
   * every delta after the first frame). Since the cover pass, crates are
   * authoritative: the server hit-tests and movement-collides against them.
   */
  seed: number;
  /** Pickup spots (positions seed-derived): key = spot index, `on` = grabbable now. */
  pickups: Record<string, { on: boolean }>;
  /** Crates destroyed this round: key = crate index. Absent = intact. */
  broken: Record<string, { b: boolean }>;
  /** Shrink-zone centre + radius (world units); outside it players tick damage. */
  zx: number;
  zy: number;
  zr: number;
  /** Server-clock epoch ms when the current round ends (constant per round). */
  roundEndMs: number;
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
      w: "u8",
      sp: "bool",
      db: "bool",
    }),
  ),
  seed: "u32",
  pickups: mapOf(schema({ on: "bool" })),
  broken: mapOf(schema({ b: "bool" })),
  zx: quant(0, 3000, 0.5),
  zy: quant(0, 3000, 0.5),
  zr: quant(0, 4500, 0.5),
  roundEndMs: "f64",
});

/** Weapon table, shared verbatim by the room (authoritative numbers) and the
 *  client (HUD + tracer styling). `rays`/`spread` implement the shotgun fan. */
export interface WeaponSpec {
  name: string;
  damage: number;
  range: number;
  cooldownMs: number;
  rays: number;
  /** Total fan angle in radians across `rays` (0 for a single ray). */
  spread: number;
  /** Magazine size — rounds before a reload is forced. `0` = unlimited (no reload). */
  mag: number;
  /** Reload duration in ms (ignored when `mag === 0`). */
  reloadMs: number;
}
export const WEAPONS: readonly WeaponSpec[] = [
  // RIFLE: 20-round mag, ~1.5 s reload. SHOTGUN: 4× damage (16→64/ray), 5-shell
  // mag, ~2 s reload. SMG: 40-round mag, faster fire (55→40 ms cooldown), ~2 s reload.
  { name: "RIFLE", damage: 34, range: 850, cooldownMs: 100, rays: 1, spread: 0, mag: 20, reloadMs: 1500 },
  { name: "SHOTGUN", damage: 64, range: 300, cooldownMs: 600, rays: 3, spread: 0.24, mag: 5, reloadMs: 2000 },
  { name: "SMG", damage: 14, range: 650, cooldownMs: 40, rays: 1, spread: 0, mag: 40, reloadMs: 2000 },
] as const;

export const SHOOTER = {
  // A 3000² map (up from 2000²) so 64 players spread out: at the spawn min-
  // separation (300u) a 2000² map is right at its packing limit for 64 points,
  // while 3000² leaves comfortable headroom. Keep the quant position range above
  // in lock-step with this.
  world: 3000,
  /** AOI view radius — well under the map so interest management actually bites.
   *  Every weapon range MUST stay below it (you can never hit what you can't
   *  see); raised with the range buff, at a bandwidth cost the tiers absorb. */
  viewRadius: 900,
  maxSpeed: 500,
  stepMs: 33, // 30 Hz client send cadence + movement-budget unit (LAT-2 C3)
  maxHp: 100,
  shotDamage: 34, // legacy alias — the rifle's damage (see WEAPONS[0])
  shotRange: 850, // legacy alias — the rifle's range; also the max tracer length
  hitRadius: 40, // perpendicular distance to the ray that still counts as a hit
  // Per-weapon cooldowns live in WEAPONS; this remains the floor any client-side
  // mirror can rely on (the rifle's).
  shotCooldownMs: 100,
  respawnMs: 1500, // downed time before respawn (was respawnTicks × stepMs — now
  // explicit ms so retuning the send cadence can never silently change it)
  // Spread-spawn tuning (see pickSpawn in shooter-spawn.ts).
  spawnMinSep: 300, // a spawn keeps ≥ this from every living player
  spawnRingMin: 400, // ring band around a random survivor a candidate is drawn from
  spawnRingMax: 700,
  spawnCenterJitter: 300, // half-extent of the center box used when nobody is alive

  // --- round / zone / pickups / grenades / cover (the "fun" pass) ---
  playerRadius: 14, // circle used for crate movement collision + pickup grabs
  spawnProtectMs: 2000, // invulnerable after spawning; firing ends it early
  roundMs: 300_000, // 5-minute rounds
  intermissionMs: 6000, // winner banner + reset window between rounds
  zoneEndRadius: 500, // the zone shrinks to this by round end
  zoneDamage: 8, // hp per zone-damage application
  zoneDamageEveryMs: 1000, // application cadence (hp is integer — no fractional ticks)
  pickupCount: 10,
  pickupRadius: 34, // grab distance (centre to centre)
  pickupRespawnMs: 15_000,
  hpPackHeal: 50,
  dmgBoostMs: 10_000,
  dmgBoostMult: 2,
  crateHp: 3, // rifle-equivalent hits to break a crate
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
