/**
 * Render-side prediction and smoothing helpers for realtime games (opt-in; pair with
 * a client-authoritative "send my position" movement model such as the shooter
 * demo). Two small state machines plus their pure primitives:
 *
 * - {@link RenderPredictor} — the LOCAL player. Integrates motion *continuously*
 *   every render frame (decoupled from the send tick, so on-screen motion is uniform
 *   at any frame rate), folds server corrections into a decaying offset (the view
 *   eases onto the authoritative path instead of snapping), and clamps every
 *   outgoing position snapshot to the server's speed budget so an honest client is
 *   never rejected — the rubber-band bug is fenced off at the API contract.
 * - {@link EntitySmoother} — REMOTE entities. Eases each entity's buffered
 *   position/facing on top of a {@link SnapshotBuffer} sample so low-rate AOI
 *   priority-tier updates don't pop.
 *
 * This is a different model from {@link InputPredictor} (Gambetta input-replay):
 * InputPredictor replays unacked *inputs* on top of each authoritative state and
 * suits server-integrated movement; RenderPredictor continuously integrates a
 * client-authoritative position and absorbs corrections. The shooter demo uses both
 * (RenderPredictor for the view, InputPredictor for ack bookkeeping). All primitives
 * are pure and deterministic so they unit-test without timers or a DOM.
 */
import {
  clampToBudget,
  integrateMove,
  type MotionProfile,
  type Vec2,
} from "@tikron/sim";

/** A 2D camera position in world units. */
export interface Cam {
  x: number;
  y: number;
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

/**
 * Move `current` toward `target` by a frame-rate-independent exponential step and
 * return the new coordinate. `smoothTimeMs` is the time constant τ (larger = softer,
 * laggier follow); the per-frame blend factor is `1 - exp(-dtMs / τ)`, so the result
 * is identical at any framerate. A gap of at least `snap` units teleports (returns
 * `target`) instead of easing — used for respawns and large reconciliations so the
 * view never glides slowly across the map. Pure: no globals, no timers.
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

/**
 * Exponential angle smoothing along the shortest arc (radians). Same frame-rate-
 * independent factor as {@link smoothAxis}, but the gap is wrapped to (−π, π] so the
 * value always rotates the short way and never spins the long way round the circle
 * (a plain lerp of raw angles would). A gap of at least `snap` radians jumps instead.
 * Used to de-pop remote players' facing when priority tiers deliver it at a low rate.
 */
export function smoothAngle(
  current: number,
  target: number,
  dtMs: number,
  smoothTimeMs: number,
  snap: number,
): number {
  const twoPi = Math.PI * 2;
  let delta = (target - current) % twoPi;
  if (delta > Math.PI) delta -= twoPi;
  else if (delta < -Math.PI) delta += twoPi;
  if (Math.abs(delta) >= snap) return target;
  if (dtMs <= 0 || smoothTimeMs <= 0) return target;
  const alpha = 1 - Math.exp(-dtMs / smoothTimeMs);
  return current + delta * alpha;
}

/**
 * Ease a 2D camera toward `(tx, ty)`, returning the new position (input untouched).
 * NOTE: the LOCAL player's camera should track {@link RenderPredictor.frame}'s output
 * 1:1 with NO extra easing (that only adds a trail and input lag — the render position
 * is already smooth). Use this for cameras that follow something the local player
 * does not control directly (spectator/kill cam, a followed remote entity).
 */
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

export interface RenderPredictorOptions {
  /** Max speed in u/s — MUST equal the server's `MovementConfig.maxSpeed`. */
  maxSpeed: number;
  /**
   * Simulation tick in ms — MUST equal the server's tick. Grounds the send-clamp
   * budget and the {@link RenderPredictorOptions.maxFrameMs} default.
   */
  stepMs: number;
  /** Square world edge (units); positions clamp to `[0, world]` per axis. Omitting skips only the upper bound — positions always clamp at 0 (coordinates are assumed non-negative). */
  world?: number;
  /** Per-frame integration dt clamp in ms (default `stepMs`) — a tab-out / GC hitch can't fling the player. */
  maxFrameMs?: number;
  /** Correction-offset decay time constant τ in ms (default 100): a snapback eases in over ~this long. */
  correctionTauMs?: number;
  /**
   * An authoritative gap this large (units) is a teleport and snaps instead of easing
   * (default 300). Tune it below the game's minimum respawn/teleport displacement and
   * above `maxSpeed × (RTT + stepMs) / 1000` (the largest gap plain latency produces).
   */
  snapDistance?: number;
  /** Send-clamp budget scale (default 1.1) — see {@link MotionProfile.sendHeadroom}. */
  sendHeadroom?: number;
}

/**
 * Local-player render predictor for client-authoritative movement ("the client sends
 * its position, the server validates the speed"). Owns the continuous position, the
 * decaying correction offset, and the last-sent bookkeeping the send clamp budgets
 * from. Drive it from three places:
 *
 * - every render frame: {@link frame} — returns the render position; bind the camera
 *   to it 1:1 (no extra easing);
 * - the send loop: {@link sendPosition} — the ONLY value that may go on the wire;
 * - server feedback: {@link correct} on an explicit correction message,
 *   {@link reconcile} on every state frame's echo of the local player, and the
 *   {@link alive} flag from authoritative liveness.
 *
 * Rubber-banding is fenced off by contract: sends are budget-clamped from the last
 * sent position over the measured elapsed time (never over-speed ⇒ never rejected),
 * and if the server still corrects (e.g. a rate-limit drop left it behind), the
 * correction rebases `lastSent` onto the authoritative position, so the next send is
 * in budget and a rejection can never cascade.
 */
export class RenderPredictor {
  private continuous: Vec2;
  private offset: Vec2 = { x: 0, y: 0 };
  private lastRender: Vec2;
  /** The last snapshot actually sent; `null` forces the next send to pass through
   *  unclamped (first send, or right after a teleport/respawn snap). */
  private lastSent: Vec2 | null = null;
  /** Clock ms of the last send — the elapsed-time reference for the next send's budget. */
  private lastSentAtMs: number | null = null;
  /** False until the first {@link reconcile}: the constructor position is only a
   *  placeholder and the first authoritative frame must be adopted unconditionally. */
  private seeded = false;
  /** Set by the `alive` setter on a dead→alive transition; the next {@link reconcile}
   *  snaps (respawn may land within `snapDistance` of the corpse). */
  private respawnSnapPending = false;
  private aliveFlag = true;
  private readonly maxSpeed: number;
  private readonly stepMs: number;
  private readonly world: number;
  private readonly maxFrameMs: number;
  private readonly correctionTauMs: number;
  private readonly snapDistance: number;
  private readonly sendProfile: MotionProfile;

  constructor(initial: Vec2, opts: RenderPredictorOptions) {
    this.continuous = { x: initial.x, y: initial.y };
    this.lastRender = { x: initial.x, y: initial.y };
    this.maxSpeed = opts.maxSpeed;
    this.stepMs = opts.stepMs;
    this.world = opts.world ?? Infinity;
    this.maxFrameMs = opts.maxFrameMs ?? opts.stepMs;
    this.correctionTauMs = opts.correctionTauMs ?? 100;
    this.snapDistance = opts.snapDistance ?? 300;
    this.sendProfile = {
      maxSpeed: opts.maxSpeed,
      stepMs: opts.stepMs,
      ...(opts.world !== undefined ? { world: opts.world } : {}),
      ...(opts.sendHeadroom !== undefined ? { sendHeadroom: opts.sendHeadroom } : {}),
    };
  }

  /**
   * Build a predictor from the {@link MotionProfile} the room validates with — the
   * recommended entry point, because it makes "one budget, two sides" structural:
   * pass the SAME shared profile constant to the server's `resolveMovement` and here.
   */
  static fromProfile(
    initial: Vec2,
    profile: MotionProfile,
    opts: Pick<RenderPredictorOptions, "maxFrameMs" | "correctionTauMs" | "snapDistance"> = {},
  ): RenderPredictor {
    return new RenderPredictor(initial, {
      maxSpeed: profile.maxSpeed,
      stepMs: profile.stepMs,
      ...(profile.world !== undefined ? { world: profile.world } : {}),
      ...(profile.sendHeadroom !== undefined ? { sendHeadroom: profile.sendHeadroom } : {}),
      ...opts,
    });
  }

  /**
   * Authoritative liveness gate. While `false`, {@link frame} skips integration so a
   * dead player holding a key doesn't dead-reckon away from the server's position.
   * Setting it back to `true` (a respawn) arms the next {@link reconcile} to snap to
   * the spawn point unconditionally — a respawn may land within `snapDistance` of the
   * corpse, and without the snap the send loop would keep transmitting the corpse
   * position and drag the fresh spawn back toward the firefight.
   */
  get alive(): boolean {
    return this.aliveFlag;
  }

  set alive(v: boolean) {
    if (v && !this.aliveFlag) this.respawnSnapPending = true;
    this.aliveFlag = v;
  }

  /**
   * Advance one render frame: integrate the held direction (when {@link alive}) and
   * decay the correction offset, then return the render position
   * (`continuous + offset`). Call once per frame with the real frame dt; the dt is
   * clamped to `maxFrameMs` internally. Bind the camera to the returned position 1:1
   * — extra camera easing on top only adds a trail and input lag (the position is
   * already smooth by construction).
   */
  frame(dirX: number, dirY: number, dtMs: number): Vec2 {
    if (this.aliveFlag) {
      this.continuous = integrateMove(
        this.continuous,
        dirX,
        dirY,
        dtMs,
        this.maxSpeed,
        this.world,
        this.maxFrameMs,
      );
    }
    this.offset = decayOffset(this.offset, dtMs, this.correctionTauMs);
    this.lastRender = {
      x: this.continuous.x + this.offset.x,
      y: this.continuous.y + this.offset.y,
    };
    return { x: this.lastRender.x, y: this.lastRender.y };
  }

  /**
   * Fold an explicit server correction (e.g. a `rejected` reply) into the view: the
   * error is absorbed by the decaying offset so the render eases onto the
   * authoritative path (a gap ≥ `snapDistance` cuts straight instead), AND `lastSent`
   * is rebased onto the authoritative position — the server's truth is now the
   * reference the next send is budgeted from, so one correction can never cascade
   * into a rejection storm.
   */
  correct(authoritative: Vec2): void {
    const applied = applyCorrection(this.continuous, this.offset, authoritative, this.snapDistance);
    this.continuous = applied.continuous;
    this.offset = applied.offset;
    this.lastSent = { x: authoritative.x, y: authoritative.y };
  }

  /**
   * Observe the local player's echo in an authoritative state frame. Movement is
   * client-authoritative here (the server echoes the clamped sent position), so a
   * small gap is just send/RTT lag and is deliberately ignored. It snaps — adopting
   * the position, clearing the offset, and resetting the send reference so the next
   * send passes through — only when `continuous` is known-stale: the first frame ever
   * (the constructor position is a placeholder), a respawn (armed by the
   * {@link alive} setter), or a gap ≥ `snapDistance` (a genuine teleport).
   */
  reconcile(authoritative: Vec2): void {
    const gap = Math.hypot(
      authoritative.x - this.continuous.x,
      authoritative.y - this.continuous.y,
    );
    if (!this.seeded || this.respawnSnapPending || gap >= this.snapDistance) {
      this.seeded = true;
      this.respawnSnapPending = false;
      this.continuous = { x: authoritative.x, y: authoritative.y };
      this.offset = { x: 0, y: 0 };
      // Budgeting the next send from a stale `lastSent` would clamp it back near the
      // old position and get it rejected — let it pass through instead.
      this.lastSent = null;
      this.lastRender = { x: this.continuous.x, y: this.continuous.y };
    }
  }

  /**
   * Produce the position snapshot for the send loop — the SINGLE point every outgoing
   * position must pass through. Clamps `continuous` to the server's speed budget
   * measured from the last sent position over the real elapsed time since the last
   * send (`nowMs − lastSendNowMs`, capped at two ticks), then records the result as
   * the new reference. Send exactly this value (and feed it to any
   * {@link InputPredictor}) — sending anything else reopens the rubber-band path.
   *
   * `nowMs` must be a consistent clock across calls; use `room.clock.serverNow()`,
   * the same clock the SDK stamps into the input `ts`, so the client's budget and the
   * server's measured inter-move delta agree.
   */
  sendPosition(nowMs: number): Vec2 {
    const elapsedMs = this.lastSentAtMs === null ? this.stepMs : nowMs - this.lastSentAtMs;
    const sent = clampToBudget(
      this.lastSent,
      { x: this.continuous.x, y: this.continuous.y },
      this.sendProfile,
      elapsedMs,
    );
    this.lastSent = sent;
    this.lastSentAtMs = nowMs;
    return { x: sent.x, y: sent.y };
  }

  /**
   * Force-place the predictor (an explicit, client-initiated teleport/respawn):
   * adopts `pos`, clears the correction offset, and resets the send reference so the
   * next send passes through unclamped.
   */
  reset(pos: Vec2): void {
    this.continuous = { x: pos.x, y: pos.y };
    this.offset = { x: 0, y: 0 };
    this.lastRender = { x: pos.x, y: pos.y };
    this.lastSent = null;
    this.lastSentAtMs = null;
    this.seeded = true;
    this.respawnSnapPending = false;
  }

  /** The render position computed by the most recent {@link frame} (or snap). */
  get renderPosition(): Vec2 {
    return { x: this.lastRender.x, y: this.lastRender.y };
  }
}

export interface EntitySmootherOptions {
  /** Easing time constant τ in ms (default 100) — a touch softer than a camera's,
   *  since far AOI tiers update least often. */
  smoothTimeMs?: number;
  /** A positional jump this large (units) snaps — respawn/warp — instead of gliding
   *  across the map (default 300). */
  snapDistance?: number;
  /** An angular jump this large (radians) snaps instead of easing (default π). */
  angleSnap?: number;
}

/**
 * Per-remote-entity render smoothing (position + facing), applied on top of a
 * {@link SnapshotBuffer} sample each frame. AOI priority tiers refresh far players at
 * a fraction of the tick rate, so their buffered position/aim arrive in coarse steps
 * that pop; this extra frame-rate-independent exponential pass rounds those corners.
 * The first observation of an id snaps (no glide-in from nowhere); call
 * {@link prune} with the ids seen this frame so an entity that leaves the AOI view
 * snaps in fresh on re-entry rather than gliding from its stale last position.
 */
export class EntitySmoother {
  private readonly entities = new Map<string, { x: number; y: number; angle: number }>();
  private readonly smoothTimeMs: number;
  private readonly snapDistance: number;
  private readonly angleSnap: number;

  constructor(opts: EntitySmootherOptions = {}) {
    this.smoothTimeMs = opts.smoothTimeMs ?? 100;
    this.snapDistance = opts.snapDistance ?? 300;
    this.angleSnap = opts.angleSnap ?? Math.PI;
  }

  /**
   * Ease entity `id` toward its buffered `target` for this frame and return the
   * smoothed render pose. Call once per entity per frame with the frame dt. A
   * first-seen id adopts the target exactly; a missing `target.angle` holds the last
   * smoothed angle (0 when never seen).
   */
  update(
    id: string,
    target: { x: number; y: number; angle?: number },
    dtMs: number,
  ): { x: number; y: number; angle: number } {
    const prev = this.entities.get(id);
    const targetAngle = target.angle ?? prev?.angle ?? 0;
    const next = prev
      ? {
          x: smoothAxis(prev.x, target.x, dtMs, this.smoothTimeMs, this.snapDistance),
          y: smoothAxis(prev.y, target.y, dtMs, this.smoothTimeMs, this.snapDistance),
          angle: smoothAngle(prev.angle, targetAngle, dtMs, this.smoothTimeMs, this.angleSnap),
        }
      : { x: target.x, y: target.y, angle: targetAngle };
    this.entities.set(id, next);
    return { x: next.x, y: next.y, angle: next.angle };
  }

  /** Forget every entity NOT in `seen` (the ids updated this frame) — so an AOI
   *  re-entry snaps in fresh instead of gliding from a stale position. */
  prune(seen: ReadonlySet<string>): void {
    for (const id of [...this.entities.keys()]) {
      if (!seen.has(id)) this.entities.delete(id);
    }
  }

  /** Forget one entity (it will snap on its next update). */
  delete(id: string): void {
    this.entities.delete(id);
  }

  /** Forget everything (e.g. on leaving a room). */
  clear(): void {
    this.entities.clear();
  }
}
