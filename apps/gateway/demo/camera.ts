/**
 * Camera follow smoothing for the shooter demo — a pure, DOM-free helper so the
 * easing math can be unit tested without a canvas.
 *
 * The local player is client-predicted and server-reconciled every state frame:
 * `InputPredictor.reconcile` re-snaps the predicted position to the server's
 * (0.1-unit quantized) location and replays a *fluctuating* count of unacked
 * inputs (input batching makes acks arrive bursty), so predicted gets nudged by a
 * few units frame-to-frame. Binding the camera straight to that position — as the
 * renderer originally did (`camX = predicted.x - width/2`) — translates the entire
 * world by every nudge, which reads as the map shaking while you move. Easing the
 * camera toward the predicted point with a frame-rate-independent exponential
 * filter absorbs those nudges into smooth motion; a large gap still teleports so
 * respawns and big corrections don't leave the view trailing behind.
 */
export interface Cam {
  x: number;
  y: number;
}

/**
 * Move `current` toward `target` by a frame-rate-independent exponential step and
 * return the new coordinate. `smoothTimeMs` is the time constant τ (larger = softer,
 * laggier follow); the per-frame blend factor is `1 - exp(-dtMs / τ)`, so the result
 * is identical at any framerate. A gap of at least `snap` units teleports (returns
 * `target`) instead of easing — used for respawns and large reconciliations so the
 * camera never glides slowly across the map. Pure: no globals, no timers.
 */
export function smoothAxis(
  current: number,
  target: number,
  dtMs: number,
  smoothTimeMs: number,
  snap: number,
): number {
  const gap = target - current;
  if (Math.abs(gap) >= snap) return target;
  if (dtMs <= 0 || smoothTimeMs <= 0) return target;
  const alpha = 1 - Math.exp(-dtMs / smoothTimeMs);
  return current + gap * alpha;
}

/** Ease a 2D camera toward `(tx, ty)`, returning the new position (input untouched). */
export function followCamera(
  cam: Cam,
  tx: number,
  ty: number,
  dtMs: number,
  smoothTimeMs: number,
  snap: number,
): Cam {
  return {
    x: smoothAxis(cam.x, tx, dtMs, smoothTimeMs, snap),
    y: smoothAxis(cam.y, ty, dtMs, smoothTimeMs, snap),
  };
}
