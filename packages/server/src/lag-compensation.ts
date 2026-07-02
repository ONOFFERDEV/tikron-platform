import type { Vec2 } from "@tikron/sim";

/**
 * Server-side lag compensation — a rolling history of entity positions so a hit
 * check can be resolved against the world **as the shooter saw it**, not the
 * newer authoritative world the packet arrived into.
 *
 * The problem: a client shoots at a target it renders ~(RTT/2 + interpolation
 * delay) in the past. By the time that input reaches the server the target has
 * moved, so a naive check against current positions rejects shots that visibly
 * connected on the shooter's screen. Rewinding the world to the shooter's view
 * before the check fixes this (the standard Source-engine / Overwatch approach).
 *
 * Usage — record every tick, rewind inside a hit handler:
 *
 * ```ts
 * const lag = new LagCompensator({ depthMs: 250 });
 * // each tick, after integrating movement:
 * lag.record(this.currentTick, Date.now(), playerPositions);
 *
 * // in a "shoot" handler, rewind to what this shooter saw:
 * const rewound = lag.atTime(Date.now() - client.rttMs - interpolationDelayMs);
 * const target = rewound.get(targetId);
 * if (target && distance(shot, target) < hitRadius) applyHit(targetId);
 * ```
 *
 * The {@link IoArenaRoom} preset wires the record/rewind loop for you when
 * `lagCompensation = true` (see its `rewind(client)` helper).
 */
export interface LagCompensatorOptions {
  /**
   * How far back (ms) snapshots are retained. A rewind further than this is
   * clamped to the oldest snapshot. Default 250 (covers ~1s RTT rooms with a
   * 100ms interpolation delay); raise it for higher-latency games.
   */
  depthMs?: number;
  /** Hard cap on retained snapshots, a guard against a stalled clock. Default 128. */
  maxSnapshots?: number;
}

interface Snapshot {
  tick: number;
  serverTimeMs: number;
  positions: Map<string, Vec2>;
}

export class LagCompensator {
  /** Retention depth in ms (rewinds beyond this clamp to the oldest snapshot). */
  readonly depthMs: number;
  private readonly maxSnapshots: number;
  /** Snapshots in ascending tick / serverTime order (monotonic on record). */
  private readonly buffer: Snapshot[] = [];

  constructor(options: LagCompensatorOptions = {}) {
    this.depthMs = options.depthMs ?? 250;
    this.maxSnapshots = options.maxSnapshots ?? 128;
  }

  /** Number of retained snapshots (mostly for tests/introspection). */
  get size(): number {
    return this.buffer.length;
  }

  /**
   * Record the positions of every tracked entity at a tick. Call once per
   * simulation tick with the tick's server time. Positions are copied, so the
   * caller may mutate its own map afterwards.
   */
  record(tick: number, serverTimeMs: number, positions: Map<string, Vec2>): void {
    const clone = new Map<string, Vec2>();
    for (const [id, p] of positions) clone.set(id, { x: p.x, y: p.y });
    this.buffer.push({ tick, serverTimeMs, positions: clone });

    // Drop snapshots older than the retention depth (keep at least one).
    const cutoff = serverTimeMs - this.depthMs;
    while (this.buffer.length > 1 && this.buffer[0]!.serverTimeMs < cutoff) this.buffer.shift();
    while (this.buffer.length > this.maxSnapshots) this.buffer.shift();
  }

  /**
   * Positions interpolated at a server time (epoch ms). Times between two
   * recorded ticks are linearly interpolated; times outside the buffer clamp to
   * its nearest end (newest = present, oldest = the retention-depth horizon).
   */
  atTime(serverTimeMs: number): Map<string, Vec2> {
    return this.interpolate(serverTimeMs, (s) => s.serverTimeMs);
  }

  /**
   * Positions interpolated at a tick. A fractional/absent tick is linearly
   * interpolated between the bracketing recorded ticks; out-of-range clamps.
   */
  at(tick: number): Map<string, Vec2> {
    return this.interpolate(tick, (s) => s.tick);
  }

  /** Forget all history (e.g. on a full reset). */
  clear(): void {
    this.buffer.length = 0;
  }

  private interpolate(key: number, keyOf: (s: Snapshot) => number): Map<string, Vec2> {
    const buf = this.buffer;
    if (buf.length === 0) return new Map();
    const first = buf[0]!;
    if (key <= keyOf(first)) return this.copy(first.positions); // clamp to the depth horizon
    const last = buf[buf.length - 1]!;
    if (key >= keyOf(last)) return this.copy(last.positions); // clamp to the present

    let lo = first;
    let hi = last;
    for (let i = 1; i < buf.length; i++) {
      if (keyOf(buf[i]!) >= key) {
        hi = buf[i]!;
        lo = buf[i - 1]!;
        break;
      }
    }
    const span = keyOf(hi) - keyOf(lo);
    const alpha = span > 0 ? (key - keyOf(lo)) / span : 0;
    return this.lerp(lo, hi, alpha);
  }

  private lerp(a: Snapshot, b: Snapshot, alpha: number): Map<string, Vec2> {
    const out = new Map<string, Vec2>();
    for (const [id, pa] of a.positions) {
      const pb = b.positions.get(id);
      out.set(
        id,
        pb
          ? { x: pa.x + (pb.x - pa.x) * alpha, y: pa.y + (pb.y - pa.y) * alpha }
          : { x: pa.x, y: pa.y }, // entity gone by `b` — freeze at its last known spot
      );
    }
    // Entities that only exist in the newer snapshot (spawned mid-interval).
    for (const [id, pb] of b.positions) if (!out.has(id)) out.set(id, { x: pb.x, y: pb.y });
    return out;
  }

  private copy(m: Map<string, Vec2>): Map<string, Vec2> {
    const out = new Map<string, Vec2>();
    for (const [id, p] of m) out.set(id, { x: p.x, y: p.y });
    return out;
  }
}
