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
