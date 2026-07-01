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
 * Entity interpolation buffer. Render other entities in the past (at
 * `now - delayMs`) by interpolating between the two bracketing snapshots — this
 * hides jitter and produces smooth motion at any client framerate.
 */
export class SnapshotBuffer<S> {
  private readonly buf: Snapshot<S>[] = [];
  private readonly delayMs: number;
  private readonly lerp: (a: S, b: S, t: number) => S;
  private readonly maxSnapshots: number;

  constructor(opts: { delayMs?: number; lerp: (a: S, b: S, t: number) => S; maxSnapshots?: number }) {
    this.delayMs = opts.delayMs ?? 100;
    this.lerp = opts.lerp;
    this.maxSnapshots = opts.maxSnapshots ?? 64;
  }

  push(time: number, state: S): void {
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
    if (target <= first.time) return first.state;
    if (target >= last.time) return last.state;
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
}
