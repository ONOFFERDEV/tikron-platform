/**
 * Local-player movement helpers for the shooter demo — pure, DOM-free, and timer-free
 * so the integration and reconciliation math can be unit tested in isolation.
 *
 * The demo decouples the simulation tick from the frame rate. The local player is
 * integrated *continuously* every render frame ({@link integrateMove}) rather than in
 * the 20 Hz input/send loop, so on-screen motion is uniform at 60 fps instead of
 * stepping ~25 u every 50 ms (the step is what the camera used to chase, producing the
 * "shakes while moving" pulsing). Server corrections — a rejected over-speed move, or a
 * respawn/teleport — are folded into a decaying offset ({@link applyCorrection},
 * {@link decayOffset}) so the view eases onto the authoritative path instead of
 * snapping, except when the error is large enough to be a genuine teleport.
 */
export interface Vec2 {
  x: number;
  y: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Integrate one render frame of local movement and return the new position. Moves
 * `pos` along the signed WASD direction `(dirX, dirY)` at `maxSpeed` u/s for `dtMs`,
 * clamped to `[0, world]` on each axis. `dtMs` is clamped to `[0, maxDtMs]` so a
 * tab-out or GC hitch can't fling the player across the map. Diagonal input is
 * normalized so speed is identical in every direction.
 *
 * Frame-rate-uniform by construction: with a fixed `dtMs` and a held direction, each
 * frame advances by exactly `maxSpeed · dtMs/1000` until a wall — which is what the
 * "even per-frame motion" test checks.
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
 * Shrink a correction offset toward zero by the frame-rate-independent factor
 * `exp(-dtMs / tauMs)` and return it. Render position = `continuous + offset`, so as
 * the offset melts the visible position eases onto the authoritative path. τ ≈ 100 ms
 * gives a soft catch-up; a non-positive dt or τ collapses the offset to zero.
 */
export function decayOffset(offset: Vec2, dtMs: number, tauMs: number): Vec2 {
  if (tauMs <= 0 || dtMs <= 0) return { x: 0, y: 0 };
  const k = Math.exp(-dtMs / tauMs);
  return { x: offset.x * k, y: offset.y * k };
}

/**
 * Fold a server correction into the render without a visible jump. `continuous` adopts
 * `authoritative`, and the returned `offset` absorbs the difference so that
 * `continuous + offset` is unchanged from before — the view then eases in as the offset
 * decays. When the error `|authoritative − continuous|` reaches `snap` units it is
 * treated as a teleport (respawn / hard rejection): `continuous` jumps and the offset
 * clears so the view cuts straight to the authoritative position. Pure.
 */
export function applyCorrection(
  continuous: Vec2,
  offset: Vec2,
  authoritative: Vec2,
  snap: number,
): { continuous: Vec2; offset: Vec2 } {
  const ex = authoritative.x - continuous.x;
  const ey = authoritative.y - continuous.y;
  if (Math.hypot(ex, ey) >= snap) {
    return { continuous: { x: authoritative.x, y: authoritative.y }, offset: { x: 0, y: 0 } };
  }
  return {
    continuous: { x: authoritative.x, y: authoritative.y },
    offset: {
      x: continuous.x + offset.x - authoritative.x,
      y: continuous.y + offset.y - authoritative.y,
    },
  };
}
