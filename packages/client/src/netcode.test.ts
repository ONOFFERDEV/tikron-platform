import { describe, it, expect } from "vitest";
import { InputPredictor, SnapshotBuffer } from "./netcode.js";

interface P {
  x: number;
}
const apply = (s: P, i: { dx: number }): P => ({ x: s.x + i.dx });

describe("InputPredictor (prediction + reconciliation)", () => {
  it("predicts locally then reconciles by replaying unacked inputs", () => {
    const p = new InputPredictor<P, { dx: number }>({ x: 0 }, { apply });
    p.predict(1, { dx: 1 });
    p.predict(2, { dx: 1 });
    p.predict(3, { dx: 1 });
    expect(p.predicted).toEqual({ x: 3 });

    // Server processed up to seq 2 (authoritative x = 2); input 3 still pending.
    const r = p.reconcile({ x: 2 }, 2);
    expect(r).toEqual({ x: 3 });
    expect(p.pendingCount).toBe(1);
  });

  it("clears the buffer when fully acked", () => {
    const p = new InputPredictor<P, { dx: number }>({ x: 0 }, { apply });
    p.predict(1, { dx: 5 });
    expect(p.reconcile({ x: 5 }, 1)).toEqual({ x: 5 });
    expect(p.pendingCount).toBe(0);
  });

  it("snaps to authoritative state on a mispredict (e.g. server clamp)", () => {
    const p = new InputPredictor<P, { dx: number }>({ x: 0 }, { apply });
    p.predict(1, { dx: 10 }); // client optimistically predicts x = 10
    // Server clamped the move: authoritative x = 5, acked seq 1.
    expect(p.reconcile({ x: 5 }, 1)).toEqual({ x: 5 });
  });
});

describe("SnapshotBuffer (entity interpolation)", () => {
  const lerp = (a: P, b: P, t: number): P => ({ x: a.x + (b.x - a.x) * t });

  it("interpolates between bracketing snapshots at now - delay", () => {
    const sb = new SnapshotBuffer<P>({ delayMs: 100, lerp });
    sb.push(1000, { x: 0 });
    sb.push(1100, { x: 100 });
    // now = 1150 -> target = 1050 -> halfway between 1000 and 1100 -> x = 50
    expect(sb.sample(1150)).toEqual({ x: 50 });
  });

  it("clamps to the earliest/latest snapshot outside the buffered range", () => {
    const sb = new SnapshotBuffer<P>({ delayMs: 100, lerp });
    sb.push(1000, { x: 0 });
    sb.push(1100, { x: 100 });
    expect(sb.sample(1000)).toEqual({ x: 0 }); // target 900 < first
    expect(sb.sample(2000)).toEqual({ x: 100 }); // target 1900 > last
  });

  it("returns undefined when empty", () => {
    const sb = new SnapshotBuffer<P>({ lerp });
    expect(sb.sample(1000)).toBeUndefined();
  });
});

describe("SnapshotBuffer extrapolation", () => {
  type P = { x: number };
  const lerp = (a: P, b: P, t: number): P => ({ x: a.x + (b.x - a.x) * t });

  it("extrapolates past the newest snapshot along the last segment (t > 1)", () => {
    const sb = new SnapshotBuffer<P>({ delayMs: 100, lerp, maxExtrapolationMs: 50 });
    sb.push(1000, { x: 0 });
    sb.push(1100, { x: 100 }); // velocity: 1 u/ms
    // target = 1130 -> 30 ms past newest -> x = 130
    expect(sb.sample(1230)).toEqual({ x: 130 });
  });

  it("caps extrapolation at maxExtrapolationMs", () => {
    const sb = new SnapshotBuffer<P>({ delayMs: 100, lerp, maxExtrapolationMs: 50 });
    sb.push(1000, { x: 0 });
    sb.push(1100, { x: 100 });
    // target = 1300 -> 200 ms past newest, capped at 50 -> x = 150
    expect(sb.sample(1400)).toEqual({ x: 150 });
  });

  it("holds the newest state without opting in (back-compat)", () => {
    const sb = new SnapshotBuffer<P>({ delayMs: 100, lerp });
    sb.push(1000, { x: 0 });
    sb.push(1100, { x: 100 });
    expect(sb.sample(1400)).toEqual({ x: 100 });
  });

  it("holds the newest state with a single snapshot (no segment to extrapolate)", () => {
    const sb = new SnapshotBuffer<P>({ delayMs: 100, lerp, maxExtrapolationMs: 50 });
    sb.push(1000, { x: 7 });
    expect(sb.sample(1400)).toEqual({ x: 7 });
  });
});

describe("SnapshotBuffer adaptive delay", () => {
  type P = { x: number };
  const lerp = (a: P, b: P, t: number): P => ({ x: a.x + (b.x - a.x) * t });

  it("clamps the starting delay into [minMs, maxMs]", () => {
    const sb = new SnapshotBuffer<P>({ delayMs: 300, lerp, adaptiveDelay: { minMs: 60, maxMs: 200 } });
    expect(sb.currentDelayMs).toBe(200);
  });

  it("raises the delay immediately on starvation (target beyond newest)", () => {
    const sb = new SnapshotBuffer<P>({ delayMs: 60, lerp, adaptiveDelay: { minMs: 60, maxMs: 200 } });
    sb.push(1000, { x: 0 });
    // sample(1100): target = 1100 − 60 = 1040 > newest 1000 -> margin −40
    sb.sample(1100);
    // delay += 40 (shortfall) + 10 (nudge) = 110
    expect(sb.currentDelayMs).toBe(110);
  });

  it("never raises past maxMs", () => {
    const sb = new SnapshotBuffer<P>({ delayMs: 60, lerp, adaptiveDelay: { minMs: 60, maxMs: 100 } });
    sb.push(1000, { x: 0 });
    sb.sample(2000); // huge starvation
    expect(sb.currentDelayMs).toBe(100);
  });

  it("shrinks slowly after a calm observation window with comfortable margin", () => {
    const sb = new SnapshotBuffer<P>({
      delayMs: 200,
      lerp,
      adaptiveDelay: { minMs: 60, maxMs: 200, windowMs: 1000, slewDownMsPerSec: 20, headroomMs: 10 },
    });
    // Steady 50 ms cadence, sampling right after each push: newest = now, so the
    // margin is a constant, comfortable 200 ms (≫ interval 50 + headroom 10).
    const before = sb.currentDelayMs;
    for (let t = 1000; t <= 4100; t += 50) {
      sb.push(t, { x: t });
      sb.sample(t);
    }
    const after = sb.currentDelayMs;
    expect(after).toBeLessThan(before);
    // ~3 windows elapsed -> at most slewDownMsPerSec × windowSec = 20 ms per window
    expect(before - after).toBeLessThanOrEqual(3 * 20);
    expect(after).toBeGreaterThanOrEqual(60);
  });

  it("does not shrink when the margin is tight", () => {
    const sb = new SnapshotBuffer<P>({
      delayMs: 60,
      lerp,
      adaptiveDelay: { minMs: 40, maxMs: 200, windowMs: 500, headroomMs: 10 },
    });
    // 50 ms cadence with delay 60: margin hovers ~10 < interval(50)+headroom(10).
    for (let t = 1000; t <= 3000; t += 50) {
      sb.push(t, { x: t });
      sb.sample(t + 50);
    }
    expect(sb.currentDelayMs).toBeGreaterThanOrEqual(60);
  });

  it("keeps a fixed delay when adaptive is not configured", () => {
    const sb = new SnapshotBuffer<P>({ delayMs: 100, lerp });
    sb.push(1000, { x: 0 });
    sb.sample(5000);
    expect(sb.currentDelayMs).toBe(100);
  });
});
