import { describe, it, expect } from "vitest";
import { RateLimiter } from "./rate-limit.js";

describe("RateLimiter", () => {
  it("allows up to the limit within a window, then drops", () => {
    const rl = new RateLimiter();
    const results = Array.from({ length: 5 }, () => rl.allow("a", 1000, 3));
    expect(results).toEqual([true, true, true, false, false]);
  });

  it("resets once the window elapses", () => {
    const rl = new RateLimiter();
    expect(rl.allow("a", 1000, 1)).toBe(true);
    expect(rl.allow("a", 1500, 1)).toBe(false); // same 1s window
    expect(rl.allow("a", 2000, 1)).toBe(true); // new window (>= 1000ms later)
  });

  it("tracks keys independently", () => {
    const rl = new RateLimiter();
    expect(rl.allow("a", 1000, 1)).toBe(true);
    expect(rl.allow("b", 1000, 1)).toBe(true);
    expect(rl.allow("a", 1000, 1)).toBe(false);
  });

  it("forgets a key", () => {
    const rl = new RateLimiter();
    expect(rl.allow("a", 1000, 1)).toBe(true);
    expect(rl.allow("a", 1000, 1)).toBe(false);
    rl.forget("a");
    expect(rl.allow("a", 1000, 1)).toBe(true);
  });
});
