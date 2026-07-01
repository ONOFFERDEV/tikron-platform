import { describe, it, expect } from "vitest";
import {
  prim,
  schema,
  mapOf,
  encodeFull,
  encodeDelta,
  decodeFull,
  applyDelta,
  type Codec,
} from "./index.js";

const Player = schema({ x: "f32", y: "f32" });
const World = schema({ players: mapOf(Player), tick: "u32" });

function roundtripFull<T>(codec: Codec<T>, value: T): T {
  return decodeFull(codec, encodeFull(codec, value));
}
function roundtripDelta<T>(codec: Codec<T>, prev: T, next: T): T {
  return applyDelta(codec, prev, encodeDelta(codec, prev, next));
}

describe("primitive codecs", () => {
  it("round-trips integers, floats, bools, strings", () => {
    expect(roundtripFull(prim("u8"), 200)).toBe(200);
    expect(roundtripFull(prim("u16"), 40000)).toBe(40000);
    expect(roundtripFull(prim("u32"), 3_000_000_000)).toBe(3_000_000_000);
    expect(roundtripFull(prim("i32"), -12345)).toBe(-12345);
    expect(roundtripFull(prim("f64"), 3.14159)).toBeCloseTo(3.14159);
    expect(roundtripFull(prim("bool"), true)).toBe(true);
    expect(roundtripFull(prim("str"), "héllo ✧")).toBe("héllo ✧");
  });
});

describe("object schema", () => {
  it("round-trips a full object", () => {
    const p = roundtripFull(Player, { x: 1.5, y: -2.5 });
    expect(p.x).toBeCloseTo(1.5);
    expect(p.y).toBeCloseTo(-2.5);
  });

  it("delta only encodes changed fields", () => {
    const prev = { x: 1, y: 2 };
    const next = { x: 1, y: 9 }; // only y changed
    const delta = encodeDelta(Player, prev, next);
    const full = encodeFull(Player, next);
    // delta = 1 mask byte + 1 f32 (4) = 5; full = 2 f32 (8)
    expect(delta.length).toBeLessThan(full.length);
    const applied = roundtripDelta(Player, prev, next);
    expect(applied.x).toBe(1);
    expect(applied.y).toBe(9);
  });

  it("empty delta (no change) is a single mask byte", () => {
    const v = { x: 3, y: 4 };
    const delta = encodeDelta(Player, v, v);
    expect(delta.length).toBe(1); // mask only, no field payloads
    expect(roundtripDelta(Player, v, v)).toEqual({ x: 3, y: 4 });
  });
});

describe("map schema", () => {
  it("round-trips a full map", () => {
    const value = { a: { x: 1, y: 2 }, b: { x: 3, y: 4 } };
    const out = roundtripFull(mapOf(Player), value);
    expect(Object.keys(out).sort()).toEqual(["a", "b"]);
    expect(out.a).toEqual({ x: 1, y: 2 });
  });

  it("delta encodes adds, changes, and removals", () => {
    const prev = { a: { x: 1, y: 1 }, b: { x: 2, y: 2 } };
    const next = { a: { x: 1, y: 1 }, b: { x: 9, y: 2 }, c: { x: 3, y: 3 } };
    // b changed, c added, a unchanged, nothing removed
    const applied = roundtripDelta(mapOf(Player), prev, next);
    expect(applied).toEqual(next);
  });

  it("delta removes keys", () => {
    const prev = { a: { x: 1, y: 1 }, b: { x: 2, y: 2 } };
    const next = { a: { x: 1, y: 1 } };
    expect(roundtripDelta(mapOf(Player), prev, next)).toEqual({ a: { x: 1, y: 1 } });
  });
});

describe("nested world state + bandwidth", () => {
  it("round-trips nested state and shrinks with delta when little changes", () => {
    const prev = {
      tick: 100,
      players: Object.fromEntries(
        Array.from({ length: 50 }, (_, i) => [`p${i}`, { x: i, y: i }]),
      ),
    };
    // one player moved, tick advanced
    const next = {
      tick: 101,
      players: { ...prev.players, p7: { x: 999, y: 999 } },
    };

    const full = encodeFull(World, next);
    const delta = encodeDelta(World, prev, next);
    const applied = applyDelta(World, prev, delta);

    expect(applied.tick).toBe(101);
    expect(applied.players.p7).toEqual({ x: 999, y: 999 });
    expect(applied.players.p0).toEqual({ x: 0, y: 0 });
    // delta (one changed player + tick) should be far smaller than a full snapshot
    expect(delta.length).toBeLessThan(full.length / 5);
  });

  it("full snapshot beats JSON; a per-tick delta is an order of magnitude smaller", () => {
    const prev = {
      tick: 1,
      players: Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`p${i}`, { x: i, y: i }])),
    };
    const next = { tick: 2, players: { ...prev.players, p7: { x: 99, y: 99 } } };

    const binaryFull = encodeFull(World, next).length;
    const jsonFull = new TextEncoder().encode(JSON.stringify(next)).length;
    const binaryDelta = encodeDelta(World, prev, next).length;

    expect(binaryFull).toBeLessThan(jsonFull); // full snapshot already smaller
    expect(binaryDelta).toBeLessThan(jsonFull / 10); // realtime: 10x+ smaller than re-sending JSON
  });
});
