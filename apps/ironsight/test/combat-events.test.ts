import { describe, expect, it } from "vitest";
import { BoundedShotDedup, readServerShotResult, scopedShotId } from "../src/combat-events.js";

describe("scoped combat events", () => {
  it("separates connection, life, and fire sequence", () => {
    expect(scopedShotId({ connectionId: "client:a", life: 2 }, 7)).toBe("client%3Aa:2:7");
    expect(scopedShotId({ connectionId: "client:a", life: 3 }, 7)).not.toBe(
      scopedShotId({ connectionId: "client:a", life: 2 }, 7),
    );
    expect(() => scopedShotId({ connectionId: "", life: 0 }, 1)).toThrow(RangeError);
    expect(() => scopedShotId({ connectionId: "a", life: 0 }, 1)).toThrow(RangeError);
    expect(() => scopedShotId({ connectionId: "a", life: 0 }, 0)).toThrow(RangeError);
  });

  it("applies damage once for a duplicate scoped shot id", () => {
    const dedup = new BoundedShotDedup(4);
    const id = scopedShotId({ connectionId: "a", life: 1 }, 1);
    let health = 100;
    for (const received of [id, id]) if (dedup.accept(received)) health -= 28;
    expect(health).toBe(72);
  });

  it("bounds memory and permits an id again only after eviction or reset", () => {
    const dedup = new BoundedShotDedup(2);
    expect(dedup.accept("a:0:1")).toBe(true);
    expect(dedup.accept("a:0:2")).toBe(true);
    expect(dedup.accept("a:0:1")).toBe(false);
    expect(dedup.accept("a:0:3")).toBe(true);
    expect(dedup.accept("a:0:1")).toBe(true);
    dedup.clear();
    expect(dedup.accept("a:0:1")).toBe(true);
  });

  it("rejects an invalid dedup capacity", () => {
    expect(() => new BoundedShotDedup(0)).toThrow(RangeError);
    expect(() => new BoundedShotDedup(Number.NaN)).toThrow(RangeError);
  });

  it("parses accepted and blocked results and rejects malformed authority fields", () => {
    const base = { shotId: "a:1:2", ammo: { mag: 4, reserve: 20 }, recoil: { slot: 1, count: 2, at: 500 } };
    expect(readServerShotResult({ ...base, kind: "accepted", acceptedAt: 500 })).toMatchObject({ kind: "accepted" });
    expect(readServerShotResult({ ...base, kind: "blocked", reason: "cadence", retryMs: 10 })).toMatchObject({ kind: "blocked" });
    expect(readServerShotResult({ ...base, kind: "blocked", reason: "forged", retryMs: 0 })).toBeNull();
    expect(readServerShotResult({ ...base, shotId: "unscoped", kind: "accepted", acceptedAt: 500 })).toBeNull();
    expect(readServerShotResult({ ...base, kind: "blocked", reason: "cadence", retryMs: Number.NaN })).toBeNull();
    expect(readServerShotResult({ ...base, kind: "accepted", acceptedAt: Number.POSITIVE_INFINITY })).toBeNull();
    expect(readServerShotResult({ ...base, ammo: { mag: -1, reserve: 20 }, kind: "accepted", acceptedAt: 500 })).toBeNull();
  });

  it("retains paired server stages and rejects incomplete or reversed timing", () => {
    // Given: one accepted result with two ordered server-clock stages.
    const base = {
      kind: "accepted",
      shotId: "a:1:2",
      acceptedAt: 500,
      ammo: { mag: 4, reserve: 20 },
      recoil: { slot: 1, count: 2, at: 500 },
    } as const;

    // When: the wire reader parses valid, incomplete, and reversed stage pairs.
    const parsed = readServerShotResult({ ...base, serverReceiveAt: 480, serverResolveAt: 500 });
    const missingResolve = readServerShotResult({ ...base, serverReceiveAt: 480 });
    const reversed = readServerShotResult({ ...base, serverReceiveAt: 501, serverResolveAt: 500 });

    // Then: only the ordered pair crosses the boundary and both values survive.
    expect(parsed).toMatchObject({ serverReceiveAt: 480, serverResolveAt: 500 });
    expect(missingResolve).toBeNull();
    expect(reversed).toBeNull();
  });
});
