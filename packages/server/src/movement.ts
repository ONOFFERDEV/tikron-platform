export interface Vec2 {
  x: number;
  y: number;
}

export interface MovementConfig {
  /** Maximum units per second the entity may travel. */
  maxSpeed: number;
  /** Allowance multiplier for network jitter (default 1.15). */
  tolerance?: number;
}

export interface MovementResult {
  /** The accepted authoritative position. */
  position: Vec2;
  /** True if the requested position exceeded the speed budget and was rejected. */
  rejected: boolean;
}

/**
 * Opt-in server-authoritative movement validation (a MovementValidation module,
 * not part of the genre-agnostic core). Given the previous authoritative
 * position and a client-requested position, accept it if it is within the speed
 * budget for the elapsed time, otherwise reject and snap back to `prev`.
 *
 * This defeats teleport and speed hacks for games where the client sends its
 * predicted position. Games that send only direction intents don't need it —
 * the server integrates position and cheating is structurally impossible.
 */
export function validateMovement(
  prev: Vec2,
  requested: Vec2,
  config: MovementConfig,
  deltaMs: number,
): MovementResult {
  const tolerance = config.tolerance ?? 1.15;
  const maxDist = Math.max(0, (config.maxSpeed * deltaMs) / 1000) * tolerance;
  const dist = Math.hypot(requested.x - prev.x, requested.y - prev.y);

  if (dist <= maxDist) {
    return { position: { x: requested.x, y: requested.y }, rejected: false };
  }
  return { position: { x: prev.x, y: prev.y }, rejected: true };
}
