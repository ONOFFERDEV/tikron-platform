import { describe, expect, it } from "vitest";
import { makeRng, pickWeighted, rollChance, rollRange } from "./rng.js";

describe("makeRng", () => {
  it("is deterministic for a seed", () => {
    const a = makeRng(42);
    const b = makeRng(42);
    for (let i = 0; i < 20; i++) expect(a.next()).toBe(b.next());
  });

  it("returns floats in [0, 1)", () => {
    const r = makeRng(3);
    for (let i = 0; i < 100; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("advance replays the exact stream position", () => {
    const a = makeRng(99);
    for (let i = 0; i < 5; i++) a.next();
    const restored = makeRng(99, 5);
    expect(restored.count()).toBe(5);
    for (let i = 0; i < 10; i++) expect(restored.next()).toBe(a.next());
  });

  it("counts draws", () => {
    const r = makeRng(1);
    expect(r.count()).toBe(0);
    r.next();
    r.next();
    expect(r.count()).toBe(2);
  });
});

describe("rollChance", () => {
  it("0 is always false and 100 always true, without drawing", () => {
    const r = makeRng(5);
    expect(rollChance(r.next, 0)).toBe(false);
    expect(rollChance(r.next, 100)).toBe(true);
    expect(r.count()).toBe(0);
  });

  it("mid chance is deterministic", () => {
    const a = makeRng(5);
    const b = makeRng(5);
    for (let i = 0; i < 10; i++) expect(rollChance(a.next, 50)).toBe(rollChance(b.next, 50));
  });
});

describe("rollRange", () => {
  it("stays within bounds", () => {
    const r = makeRng(8);
    for (let i = 0; i < 100; i++) {
      const v = rollRange(r.next, 5, 15);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(15);
    }
  });

  it("min>=max returns min without drawing", () => {
    const r = makeRng(8);
    expect(rollRange(r.next, 7, 7)).toBe(7);
    expect(r.count()).toBe(0);
  });
});

describe("pickWeighted", () => {
  it("only ever picks positive-weight items", () => {
    const r = makeRng(2);
    const items = [
      { id: "a", w: 0 },
      { id: "b", w: 1 },
      { id: "c", w: 0 },
    ];
    for (let i = 0; i < 50; i++) {
      const picked = pickWeighted(r.next, items, (x) => x.w);
      expect(picked?.id).toBe("b");
    }
  });

  it("returns undefined when all weights are zero", () => {
    const r = makeRng(2);
    expect(pickWeighted(r.next, [{ w: 0 }, { w: 0 }], (x) => x.w)).toBeUndefined();
  });

  it("is deterministic under seed", () => {
    const items = [
      { id: "a", w: 1 },
      { id: "b", w: 1 },
      { id: "c", w: 1 },
    ];
    const a = makeRng(11);
    const b = makeRng(11);
    for (let i = 0; i < 20; i++) {
      expect(pickWeighted(a.next, items, (x) => x.w)?.id).toBe(pickWeighted(b.next, items, (x) => x.w)?.id);
    }
  });
});
