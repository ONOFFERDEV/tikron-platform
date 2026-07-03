import { describe, expect, it } from "vitest";
import { TimerHeap } from "./scheduler.js";

describe("TimerHeap", () => {
  it("pops in due-time order", () => {
    const h = new TimerHeap<string>();
    h.push(300, "c");
    h.push(100, "a");
    h.push(200, "b");
    expect(h.popMin()).toBe("a");
    expect(h.popMin()).toBe("b");
    expect(h.popMin()).toBe("c");
    expect(h.popMin()).toBeUndefined();
  });

  it("breaks equal-due ties by priority then insertion order", () => {
    const h = new TimerHeap<string>();
    h.push(100, "late", 1);
    h.push(100, "early1", 0);
    h.push(100, "early2", 0);
    expect(h.popMin()).toBe("early1");
    expect(h.popMin()).toBe("early2");
    expect(h.popMin()).toBe("late");
  });

  it("popDue drains only entries due at or before now", () => {
    const h = new TimerHeap<number>();
    for (const t of [50, 150, 100, 250, 200]) h.push(t, t);
    expect(h.popDue(200)).toEqual([50, 100, 150, 200]);
    expect(h.size).toBe(1);
    expect(h.nextDueAt()).toBe(250);
  });

  it("cancel removes matching entries and preserves order", () => {
    const h = new TimerHeap<{ id: string; at: number }>();
    h.push(100, { id: "keep", at: 100 });
    h.push(150, { id: "drop", at: 150 });
    h.push(200, { id: "keep2", at: 200 });
    const removed = h.cancel((v) => v.id === "drop");
    expect(removed).toBe(1);
    expect(h.popMin()?.id).toBe("keep");
    expect(h.popMin()?.id).toBe("keep2");
  });

  it("snapshot/restore reproduces fire order", () => {
    const h = new TimerHeap<string>();
    h.push(100, "x", 1);
    h.push(100, "y", 0);
    h.push(50, "z");
    const snap = h.snapshot();
    const restored = TimerHeap.restore(snap);
    expect(restored.popMin()).toBe("z");
    expect(restored.popMin()).toBe("y");
    expect(restored.popMin()).toBe("x");
  });

  it("continues seq numbering after restore", () => {
    const h = new TimerHeap<string>();
    h.push(10, "a");
    const restored = TimerHeap.restore(h.snapshot());
    restored.push(10, "b"); // must sort after "a" at equal due
    restored.push(10, "a2");
    expect(restored.popMin()).toBe("a");
    expect(restored.popMin()).toBe("b");
    expect(restored.popMin()).toBe("a2");
  });
});
