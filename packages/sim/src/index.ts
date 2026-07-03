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
 * The movement contract shared by the server's validation and the client's render
 * prediction — one budget, two sides. A structural subtype of {@link MovementConfig},
 * so a profile passes straight into {@link validateMovement} /
 * {@link resolveMovement} as `(prev, req, profile, deltaMs)`.
 *
 * Define it ONCE in a module imported by both the room and the client bundle; a
 * hand-copied duplicate is exactly the drift this type exists to prevent.
 */
export interface MotionProfile extends MovementConfig {
  /**
   * Simulation tick in ms — the server's per-move default budget window, the
   * client's send interval, and the recommended render-frame dt clamp.
   */
  stepMs: number;
  /**
   * Square world edge length (units). MUST equal the state codec's `quant` position
   * range — a value outside the quant range clamps to the edge, so a mismatch would
   * silently pin players to a wall. Omit for an unbounded plane.
   */
  world?: number;
  /**
   * Client-side send-clamp budget scale relative to `maxSpeed` (default 1.1). Keep it
   * strictly between 1 and `tolerance`: below the server's tolerance so a clamped
   * send fits the budget the server measures for the same inter-move delta, and above
   * 1 so a backlog left by an earlier clamp drains during sustained movement (at
   * exactly 1 the wire could only match — never recover — the render position). The
   * gap up to `tolerance` stays a pure server margin the client never consumes.
   */
  sendHeadroom?: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Integrate one render frame of local movement and return the new position. Moves
 * `pos` along the signed input direction `(dirX, dirY)` at `maxSpeed` u/s for `dtMs`,
 * clamped to `[0, world]` on each axis (pass `Infinity` for an unbounded plane).
 * `dtMs` is clamped to `[0, maxDtMs]` so a tab-out or GC hitch can't fling the player
 * across the map. Diagonal input is normalized so speed is identical in every
 * direction.
 *
 * Frame-rate-uniform by construction: with a fixed `dtMs` and a held direction, each
 * frame advances by exactly `maxSpeed · dtMs/1000` until a wall. Any composition of
 * frame steps whose dts sum to one `stepMs` covers at most the one-step budget, so a
 * position integrated this way and sent through {@link clampToBudget} is always
 * accepted by {@link validateMovement} at the same profile.
 */
export function integrateMove(
  pos: Vec2,
  dirX: number,
  dirY: number,
  dtMs: number,
  maxSpeed: number,
  world: number,
  maxDtMs: number,
): Vec2 {
  const dt = Math.min(Math.max(dtMs, 0), maxDtMs) / 1000;
  const len = Math.hypot(dirX, dirY);
  if (len === 0 || dt === 0) return { x: pos.x, y: pos.y };
  const step = maxSpeed * dt;
  return {
    x: clamp(pos.x + (dirX / len) * step, 0, world),
    y: clamp(pos.y + (dirY / len) * step, 0, world),
  };
}

/**
 * Clamp an outgoing move snapshot to the server's per-move speed budget, measured
 * from the last position actually *sent* (not the continuously-integrated render
 * position) — the single choke point that makes a rejection structurally impossible
 * for an honest client.
 *
 * The budget covers the **measured elapsed time** since the previous send
 * (`elapsedMs`, clamped to `[0, 2·stepMs]` — mirroring a server that budgets each
 * move by the measured inter-move delta capped at two ticks). It must NOT be a fixed
 * one-tick budget: the continuous integrator advances by real elapsed time, so under
 * sustained full-speed movement a fixed budget below the real per-send displacement
 * would leak distance on every send and the wire position would fall behind the
 * render position without bound. The speed scale is `maxSpeed · sendHeadroom` (see
 * {@link MotionProfile.sendHeadroom}); `tolerance` is never consumed — it stays the
 * server's margin for float error and dropped moves. Residual distance from a
 * genuinely clamped send simply rides along on the next send. On the first send
 * (`lastSent === null`) the target passes through unchanged. Pure.
 */
export function clampToBudget(
  lastSent: Vec2 | null,
  next: Vec2,
  profile: MotionProfile,
  elapsedMs: number,
): Vec2 {
  if (!lastSent) return { x: next.x, y: next.y };
  const dt = clamp(elapsedMs, 0, profile.stepMs * 2);
  // The headroom must stay below the server's tolerance, or a drained backlog would
  // overshoot the budget the server measures (one spurious reject per drain).
  const headroom = Math.min(profile.sendHeadroom ?? 1.1, profile.tolerance ?? 1.15);
  return stepToward(lastSent, next, profile.maxSpeed * headroom, dt);
}

/**
 * The non-freezing counterpart of {@link validateMovement}. Within budget it returns
 * the identical acceptance; over budget it advances `prev` toward `requested` by the
 * full un-toleranced budget (`stepToward` at `maxSpeed`) instead of snapping back,
 * and reports `rejected: true`.
 *
 * Use this in a room's move handler. A frozen authoritative position turns one
 * rejection into an RTT-long cascade — every in-flight move gets measured against the
 * stale position and rejected too, and each correction yanks the client's render back
 * again (the rubber-band burst). Partial advance removes that amplifier while a speed
 * hack still cannot exceed `maxSpeed` (no tolerance on the clamped path); it is
 * merely capped, the standard treatment. {@link validateMovement} keeps its exact
 * freeze-on-reject semantics for backward compatibility.
 */
export function resolveMovement(
  prev: Vec2,
  requested: Vec2,
  config: MovementConfig,
  deltaMs: number,
): MovementResult {
  const res = validateMovement(prev, requested, config, deltaMs);
  if (!res.rejected) return res;
  return { position: stepToward(prev, requested, config.maxSpeed, deltaMs), rejected: true };
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

/**
 * Per-client movement-time token bucket — the server-side aggregate speed budget
 * (isomorphic and pure so it unit-tests without timers).
 *
 * The per-move elapsed-time budget has a burst hole: each move's delta is clamped
 * to a floor (e.g. ½ tick, so a same-instant burst can't claim zero time and
 * stall), which means N moves fired in one instant are granted N × floor of
 * movement time — at a 60 msg/s rate limit and a 25 ms floor that is 1.5 s of
 * movement per real second, a ~1.5× speed hack surface (PLAN-FPS backlog #1).
 *
 * The bucket closes it by accounting in *milliseconds of movement time*: balance
 * accrues at wall-clock rate (1 ms per elapsed ms) up to `burstMs`, and every
 * move spends its measured delta from the balance. An honest client's spend rate
 * equals its accrual rate by construction, so it never runs dry; a burst drains
 * the bucket and further same-instant moves are granted 0 (the room resolves
 * them as a zero-budget move — position holds, no cascade). `burstMs` should
 * match the per-move delta ceiling (2 ticks) so one late timer fire or a
 * rate-limit drop still gets its full catch-up grant.
 */
export class MoveBudget {
  private available: number;
  private lastNow: number | null = null;
  private readonly burstMs: number;
  private readonly stepMs: number;

  constructor(opts: { stepMs: number; burstMs?: number }) {
    this.stepMs = opts.stepMs;
    this.burstMs = opts.burstMs ?? opts.stepMs * 2;
    // First move gets exactly one tick — the same seed budget the per-move
    // measurement uses when it has no reference yet.
    this.available = opts.stepMs;
  }

  /**
   * Spend up to `requestedMs` of movement time at timeline instant `nowMs`
   * (server receipt or core-clamped subtick ts — the same monotonic reference
   * the per-move delta is measured on). Returns the granted ms (0 when the
   * bucket is dry). `nowMs` regressions accrue nothing (never negative).
   */
  grant(nowMs: number, requestedMs: number): number {
    if (this.lastNow !== null) {
      this.available = Math.min(this.burstMs, this.available + Math.max(0, nowMs - this.lastNow));
    }
    this.lastNow = this.lastNow === null ? nowMs : Math.max(this.lastNow, nowMs);
    const granted = Math.max(0, Math.min(requestedMs, this.available));
    this.available -= granted;
    return granted;
  }

  /** Reset to the first-move state (respawn/teleport: drop stale accrual). */
  reset(): void {
    this.available = this.stepMs;
    this.lastNow = null;
  }
}
