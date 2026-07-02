/**
 * @tikron/sim — isomorphic movement math shared by the server room and the client.
 *
 * Client prediction is only correct when the client integrates motion with the
 * SAME code the server validates against. This package holds that shared math so
 * both sides import one implementation instead of duplicating (and drifting) it.
 *
 * Zero dependencies, no DOM/Workers globals — pure functions, deterministic, and
 * unit-testable without timers. Safe to import in a browser bundle or a Durable
 * Object alike.
 */

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
 * Integrate one step toward `target`, capped at the per-step distance budget
 * (`maxSpeed * dtMs / 1000`). Returns `target` when it is already within budget,
 * otherwise a point exactly on the budget circle in `target`'s direction. This is
 * the motion model the client predicts with; the server accepts its output via
 * {@link validateMovement} at the same budget.
 */
export function stepToward(pos: Vec2, target: Vec2, maxSpeed: number, dtMs: number): Vec2 {
  const maxDist = Math.max(0, (maxSpeed * dtMs) / 1000);
  const dx = target.x - pos.x;
  const dy = target.y - pos.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= maxDist || dist === 0) return { x: target.x, y: target.y };
  const scale = maxDist / dist;
  return { x: pos.x + dx * scale, y: pos.y + dy * scale };
}

/**
 * Server-authoritative movement validation. Given the previous authoritative
 * position and a client-requested position, accept it when it is within the speed
 * budget for the elapsed time (with a jitter `tolerance`), otherwise reject and
 * snap back to `prev`. Defeats teleport and speed hacks for games where the client
 * sends its predicted position. A move produced by {@link stepToward} at the same
 * `maxSpeed`/`dtMs` is always accepted (it lands on or inside the budget circle).
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
