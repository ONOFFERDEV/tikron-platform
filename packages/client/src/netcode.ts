/**
 * Client-side netcode helpers for realtime games (opt-in; turn-based games ignore
 * them). These are pure and deterministic so they unit-test without timers, and
 * they make no assumptions about a specific game — the developer supplies the
 * state-transition (`apply`) and interpolation (`lerp`) functions.
 */

export interface Predictable<S, I> {
  /** Pure state transition: apply one input to a state, returning the next state. */
  apply(state: S, input: I): S;
  /** Deep-clone a state (defaults to structuredClone). */
  clone?(state: S): S;
}

/**
 * Client-side prediction + server reconciliation for the local player (Gambetta's
 * model). Predict inputs locally for zero-latency feedback, then, when the
 * authoritative state arrives with the last-acked seq, drop acknowledged inputs
 * and replay the rest on top of the server state.
 */
export class InputPredictor<S, I> {
  predicted: S;
  private pending: Array<{ seq: number; input: I }> = [];
  private readonly applyFn: (state: S, input: I) => S;
  private readonly cloneFn: (state: S) => S;

  constructor(initial: S, opts: Predictable<S, I>) {
    this.predicted = initial;
    this.applyFn = opts.apply;
    this.cloneFn = opts.clone ?? ((s) => structuredClone(s));
  }

  /** Apply an input locally for immediate feedback and buffer it until acked. */
  predict(seq: number, input: I): S {
    this.pending.push({ seq, input });
    this.predicted = this.applyFn(this.predicted, input);
    return this.predicted;
  }

  /** Reconcile against authoritative state: drop acked inputs, replay the rest. */
  reconcile(authoritative: S, ackSeq: number): S {
    this.pending = this.pending.filter((p) => p.seq > ackSeq);
    let s = this.cloneFn(authoritative);
    for (const p of this.pending) s = this.applyFn(s, p.input);
    this.predicted = s;
    return s;
  }

  get pendingCount(): number {
    return this.pending.length;
  }
}

export interface Snapshot<S> {
  time: number;
  state: S;
}

/**
 * Adaptive interpolation-delay controller. The render delay must cover one
 * snapshot interval plus arrival jitter; anything beyond that is pure added
 * latency. Fixed delays either waste latency on clean networks or starve on
 * jittery ones, so this raises the delay FAST on a starvation (the render time
 * outran the newest snapshot — a visible stall just happened) and lowers it
 * SLOWLY when a whole observation window kept a comfortable margin. The classic
 * asymmetric jitter-buffer rule (raise fast / decay slow).
 */
export interface AdaptiveDelayOptions {
  /** Floor for the delay in ms — never render closer to the live edge than this. */
  minMs: number;
  /** Ceiling for the delay in ms — bounds worst-case added latency. */
  maxMs: number;
  /**
   * Extra margin (ms) the buffer must keep beyond one snapshot interval before
   * the delay is allowed to shrink (default 10).
   */
  headroomMs?: number;
  /** How fast the delay decays when the network is calm, ms per second (default 10). */
  slewDownMsPerSec?: number;
  /** Margin observation window in ms (default 3000) — one shrink step per window. */
  windowMs?: number;
}

export interface SnapshotBufferOptions<S> {
  /** Interpolation delay in ms (default 100); the starting point when adaptive. */
  delayMs?: number;
  lerp: (a: S, b: S, t: number) => S;
  maxSnapshots?: number;
  /**
   * When the render time passes the newest snapshot (a late/lost frame),
   * extrapolate along the last two snapshots for at most this many ms
   * (`lerp` is called with `t > 1`, so positions continue on their velocity)
   * instead of freezing on the newest state. 0 (default) disables — the
   * pre-extrapolation behavior. Keep it short (~50 ms / half an RTT):
   * long extrapolations overshoot and snap back on the next real snapshot.
   */
  maxExtrapolationMs?: number;
  /** Enable adaptive delay (see {@link AdaptiveDelayOptions}); omit for a fixed delay. */
  adaptiveDelay?: AdaptiveDelayOptions;
}

/**
 * Entity interpolation buffer. Render other entities in the past (at
 * `now - delayMs`) by interpolating between the two bracketing snapshots — this
 * hides jitter and produces smooth motion at any client framerate. Opt-in
 * extras: short velocity extrapolation across a late/lost snapshot
 * ({@link SnapshotBufferOptions.maxExtrapolationMs}) and an adaptive delay that
 * tracks measured jitter instead of hard-coding the worst case
 * ({@link SnapshotBufferOptions.adaptiveDelay}).
 */
export class SnapshotBuffer<S> {
  private readonly buf: Snapshot<S>[] = [];
  private delayMs: number;
  private readonly lerp: (a: S, b: S, t: number) => S;
  private readonly maxSnapshots: number;
  private readonly maxExtrapolationMs: number;
  private readonly adaptive: Required<AdaptiveDelayOptions> | null;
  /** EMA of the interval between pushed snapshot times (the send cadence). */
  private emaIntervalMs: number | null = null;
  private lastPushTime: number | null = null;
  /** Smallest `newest.time − target` seen this observation window. */
  private windowMinMargin = Infinity;
  private windowStartedAt: number | null = null;

  constructor(opts: SnapshotBufferOptions<S>) {
    this.delayMs = opts.delayMs ?? 100;
    this.lerp = opts.lerp;
    this.maxSnapshots = opts.maxSnapshots ?? 64;
    this.maxExtrapolationMs = opts.maxExtrapolationMs ?? 0;
    this.adaptive = opts.adaptiveDelay
      ? {
          minMs: opts.adaptiveDelay.minMs,
          maxMs: opts.adaptiveDelay.maxMs,
          headroomMs: opts.adaptiveDelay.headroomMs ?? 10,
          slewDownMsPerSec: opts.adaptiveDelay.slewDownMsPerSec ?? 10,
          windowMs: opts.adaptiveDelay.windowMs ?? 3000,
        }
      : null;
    if (this.adaptive) {
      this.delayMs = Math.min(this.adaptive.maxMs, Math.max(this.adaptive.minMs, this.delayMs));
    }
  }

  /** The delay currently applied by {@link sample} (changes only when adaptive). */
  get currentDelayMs(): number {
    return this.delayMs;
  }

  push(time: number, state: S): void {
    if (this.lastPushTime !== null) {
      const interval = time - this.lastPushTime;
      // Ignore reorders/dups and idle gaps (a change-guarded room may simply have
      // had nothing to send) — those are not the send cadence.
      if (interval > 0 && interval <= 1000) {
        this.emaIntervalMs =
          this.emaIntervalMs === null ? interval : this.emaIntervalMs * 0.9 + interval * 0.1;
      }
    }
    this.lastPushTime = Math.max(this.lastPushTime ?? time, time);
    this.buf.push({ time, state });
    this.buf.sort((a, b) => a.time - b.time);
    while (this.buf.length > this.maxSnapshots) this.buf.shift();
  }

  /** Sample the interpolated state for render time `now` (accounting for delay). */
  sample(now: number): S | undefined {
    if (this.buf.length === 0) return undefined;
    const target = now - this.delayMs;
    const first = this.buf[0]!;
    const last = this.buf[this.buf.length - 1]!;
    if (this.adaptive) this.adapt(now, last.time - target);
    if (target <= first.time) return first.state;
    if (target >= last.time) {
      // Starved: the render time caught up with the newest snapshot. Optionally
      // extrapolate a short way along the last segment's velocity (t > 1) so
      // motion continues through a late/lost frame instead of freezing.
      if (this.maxExtrapolationMs > 0 && this.buf.length >= 2) {
        const a = this.buf[this.buf.length - 2]!;
        const span = last.time - a.time;
        if (span > 0) {
          const over = Math.min(target - last.time, this.maxExtrapolationMs);
          return this.lerp(a.state, last.state, 1 + over / span);
        }
      }
      return last.state;
    }
    for (let i = 0; i < this.buf.length - 1; i++) {
      const a = this.buf[i]!;
      const b = this.buf[i + 1]!;
      if (target >= a.time && target <= b.time) {
        const span = b.time - a.time;
        const t = span === 0 ? 0 : (target - a.time) / span;
        return this.lerp(a.state, b.state, t);
      }
    }
    return last.state;
  }

  /**
   * Feedback controller for the adaptive delay. `margin` is how far the newest
   * snapshot leads the render target: negative = starved (raise the delay
   * immediately by the shortfall plus a nudge), comfortably positive across a
   * whole window = shrink one slow step. Uses the same `now` timeline as
   * {@link sample}, so it needs no extra clock.
   */
  private adapt(now: number, margin: number): void {
    const a = this.adaptive!;
    if (margin < 0) {
      this.delayMs = Math.min(a.maxMs, this.delayMs + -margin + 10);
      this.windowMinMargin = Infinity;
      this.windowStartedAt = now;
      return;
    }
    this.windowMinMargin = Math.min(this.windowMinMargin, margin);
    if (this.windowStartedAt === null) {
      this.windowStartedAt = now;
      return;
    }
    if (now - this.windowStartedAt < a.windowMs) return;
    // A full window passed without starvation — shrink only if even the worst
    // moment kept one snapshot interval + headroom in hand.
    const safeMargin = (this.emaIntervalMs ?? this.delayMs) + a.headroomMs;
    if (this.windowMinMargin > safeMargin) {
      const step = Math.min(
        a.slewDownMsPerSec * (a.windowMs / 1000),
        this.windowMinMargin - safeMargin,
      );
      this.delayMs = Math.max(a.minMs, this.delayMs - step);
    }
    this.windowMinMargin = Infinity;
    this.windowStartedAt = now;
  }
}
