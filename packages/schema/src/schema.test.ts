import { describe, it, expect } from "vitest";
import {
  prim,
  quant,
  schema,
  mapOf,
  listOf,
  optionalOf,
  enumOf,
  str,
  encodeFull,
  encodeDelta,
  encodeDeltaOrNull,
  decodeFull,
  applyDelta,
  type Codec,
} from "./index.js";

/** Deterministic PRNG (mulberry32) so property loops are reproducible on failure. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

describe("listOf codec", () => {
  const Point = schema({ x: "f32", y: "f32" });

  it("round-trips a full list of prims", () => {
    expect(roundtripFull(listOf(prim("u16")), [1, 2, 3, 40000])).toEqual([1, 2, 3, 40000]);
    expect(roundtripFull(listOf(prim("str")), [])).toEqual([]);
  });

  it("round-trips a full list of structs", () => {
    const v = [
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ];
    expect(roundtripFull(listOf(Point), v)).toEqual(v);
  });

  it("delta encodes only changed indices", () => {
    const prev = [10, 20, 30, 40];
    const next = [10, 99, 30, 40]; // index 1 changed
    expect(roundtripDelta(listOf(prim("u16")), prev, next)).toEqual(next);
  });

  it("delta handles growth (appended elements)", () => {
    const prev = [1, 2];
    const next = [1, 2, 3, 4];
    expect(roundtripDelta(listOf(prim("u16")), prev, next)).toEqual(next);
  });

  it("delta handles shrink (truncation)", () => {
    const prev = [1, 2, 3, 4];
    const next = [1, 2];
    expect(roundtripDelta(listOf(prim("u16")), prev, next)).toEqual(next);
  });

  it("delta from undefined prev sends everything", () => {
    const codec = listOf(prim("u16"));
    const next = [5, 6, 7];
    expect(applyDelta(codec, undefined, encodeDelta(codec, undefined, next))).toEqual(next);
  });

  it("unchanged list delta is a tiny constant, not a re-encode", () => {
    const codec = listOf(prim("f64"));
    const v = Array.from({ length: 100 }, (_, i) => i * 1.5);
    const delta = encodeDelta(codec, v, v);
    const full = encodeFull(codec, v);
    // varint(length) + varint(0 changed) => ~2 bytes regardless of list size
    expect(delta.length).toBeLessThanOrEqual(3);
    expect(delta.length).toBeLessThan(full.length / 50);
    expect(roundtripDelta(codec, v, v)).toEqual(v);
  });

  it("nests inside a struct (listOf(schema)) and diffs per element", () => {
    const Board = schema({ round: "u32", players: listOf(Point) });
    const prev = { round: 1, players: [{ x: 0, y: 0 }, { x: 1, y: 1 }] };
    const next = { round: 2, players: [{ x: 0, y: 0 }, { x: 9, y: 9 }] };
    expect(roundtripDelta(Board, prev, next)).toEqual(next);
  });

  it("composes as mapOf(listOf(...))", () => {
    const codec = mapOf(listOf(prim("u8")));
    const prev = { a: [1, 2], b: [3] };
    const next = { a: [1, 2], b: [3, 4], c: [5] };
    expect(roundtripDelta(codec, prev, next)).toEqual(next);
  });
});

describe("optionalOf codec", () => {
  const Point = schema({ x: "f32", y: "f32" });

  it("round-trips present and null values", () => {
    expect(roundtripFull(optionalOf(prim("u16")), 42)).toBe(42);
    expect(roundtripFull(optionalOf(prim("u16")), null)).toBe(null);
    expect(roundtripFull(optionalOf(Point), { x: 1, y: 2 })).toEqual({ x: 1, y: 2 });
    expect(roundtripFull(optionalOf(Point), null)).toBe(null);
  });

  it("delta covers null->value transition", () => {
    expect(roundtripDelta(optionalOf(prim("u16")), null, 7)).toBe(7);
  });

  it("delta covers value->null transition", () => {
    expect(roundtripDelta(optionalOf(prim("u16")), 7, null)).toBe(null);
    const delta = encodeDelta(optionalOf(prim("u16")), 7, null);
    expect(delta.length).toBe(1); // only the presence byte
  });

  it("delta covers value->value transition with nested struct diff", () => {
    expect(roundtripDelta(optionalOf(Point), { x: 1, y: 2 }, { x: 1, y: 9 })).toEqual({ x: 1, y: 9 });
  });

  it("delta covers null->null (stays null)", () => {
    expect(roundtripDelta(optionalOf(Point), null, null)).toBe(null);
  });

  it("delta from undefined prev to value", () => {
    const codec = optionalOf(prim("u16"));
    expect(applyDelta(codec, undefined, encodeDelta(codec, undefined, 3))).toBe(3);
  });

  it("nests inside a struct", () => {
    const S = schema({ id: "u32", rank: optionalOf(prim("u16")) });
    const prev = { id: 1, rank: null };
    const next = { id: 1, rank: 5 };
    expect(roundtripDelta(S, prev, next)).toEqual(next);
    expect(roundtripDelta(S, next, prev)).toEqual(prev);
  });
});

describe("enumOf codec", () => {
  const Mode = enumOf("ffa", "duo", "squad");

  it("round-trips each member", () => {
    expect(roundtripFull(Mode, "ffa")).toBe("ffa");
    expect(roundtripFull(Mode, "duo")).toBe("duo");
    expect(roundtripFull(Mode, "squad")).toBe("squad");
  });

  it("encodes as a single byte", () => {
    expect(encodeFull(Mode, "squad").length).toBe(1);
  });

  it("delta is atomic (replaces on change)", () => {
    expect(roundtripDelta(Mode, "ffa", "duo")).toBe("duo");
  });

  it("throws with allowed values when encoding an unknown member", () => {
    expect(() => encodeFull(Mode, "battle-royale" as "ffa")).toThrowError(/ffa, duo, squad/);
  });

  it("throws at construction with more than 256 members", () => {
    const many = Array.from({ length: 257 }, (_, i) => `v${i}`);
    expect(() => enumOf(...many)).toThrowError(/256/);
  });

  it("accepts exactly 256 members", () => {
    const many = Array.from({ length: 256 }, (_, i) => `v${i}`);
    const codec = enumOf(...many);
    expect(roundtripFull(codec, "v255")).toBe("v255");
  });

  it("nests inside a struct", () => {
    const S = schema({ mode: enumOf("ffa", "duo"), tick: "u32" });
    expect(roundtripDelta(S, { mode: "ffa", tick: 1 }, { mode: "duo", tick: 2 })).toEqual({
      mode: "duo",
      tick: 2,
    });
  });
});

describe("bounded str codec", () => {
  it("round-trips within the limit (same wire format as prim str)", () => {
    expect(roundtripFull(str(16), "player-one")).toBe("player-one");
    expect(encodeFull(str(16), "abc")).toEqual(encodeFull(prim("str"), "abc"));
  });

  it("throws with length, limit, and fix when over the limit", () => {
    expect(() => encodeFull(str(4), "toolong")).toThrowError(/7 characters.*4-character limit.*slice/s);
  });

  it("validates on delta writes too", () => {
    expect(() => encodeDelta(str(4), "ok", "toolong")).toThrow();
  });

  it("nests inside a struct", () => {
    const Player = schema({ name: str(8), score: "u32" });
    expect(roundtripDelta(Player, { name: "ann", score: 1 }, { name: "bob", score: 2 })).toEqual({
      name: "bob",
      score: 2,
    });
    expect(() => encodeFull(Player, { name: "way-too-long", score: 0 })).toThrow();
  });
});

describe("codec.clone (structural deep copy)", () => {
  it("deep-copies nested map+struct so mutating the source never touches the copy", () => {
    const World = schema({ players: mapOf(schema({ x: "f32", y: "f32" })), tick: "u32" });
    const src = { players: { a: { x: 1, y: 2 }, b: { x: 3, y: 4 } }, tick: 5 };
    const copy = World.clone(src);
    expect(copy).toEqual(src);
    // Mutate the source's live entity in place — the copy must not follow it.
    src.players.a.x = 999;
    delete (src.players as Record<string, unknown>).b;
    src.tick = 6;
    expect(copy.players.a.x).toBe(1);
    expect(copy.players.b).toEqual({ x: 3, y: 4 });
    expect(copy.tick).toBe(5);
  });

  it("shares no object references with the source (map entries are fresh)", () => {
    const codec = mapOf(schema({ x: "f32", y: "f32" }));
    const src = { a: { x: 1, y: 1 } };
    const copy = codec.clone(src);
    expect(copy.a).not.toBe(src.a); // distinct object, equal value
    expect(copy.a).toEqual(src.a);
  });

  it("covers list, optional, enum, and bounded-str children", () => {
    const codec = schema({
      pts: listOf(schema({ x: "f32", y: "f32" })),
      target: optionalOf(schema({ x: "f32", y: "f32" })),
      mode: enumOf("a", "b"),
      name: str(8),
    });
    const src = { pts: [{ x: 1, y: 2 }], target: { x: 3, y: 4 }, mode: "b" as const, name: "hi" };
    const copy = codec.clone(src);
    expect(copy).toEqual(src);
    src.pts[0]!.x = 99;
    (src.target as { x: number }).x = 88;
    expect(copy.pts[0]!.x).toBe(1); // list element was copied, not aliased
    expect((copy.target as { x: number }).x).toBe(3);
  });
});

describe("encodeDeltaOrNull", () => {
  const World = schema({ players: mapOf(schema({ x: "f32", y: "f32" })), tick: "u32" });

  it("returns null when next is unchanged from a defined prev", () => {
    const v = { players: { a: { x: 1, y: 2 } }, tick: 3 };
    expect(encodeDeltaOrNull(World, v, { players: { a: { x: 1, y: 2 } }, tick: 3 })).toBeNull();
  });

  it("returns encodeDelta bytes when something changed", () => {
    const prev = { players: { a: { x: 1, y: 2 } }, tick: 3 };
    const next = { players: { a: { x: 9, y: 2 } }, tick: 4 };
    const orNull = encodeDeltaOrNull(World, prev, next);
    expect(orNull).not.toBeNull();
    expect([...orNull!]).toEqual([...encodeDelta(World, prev, next)]); // identical bytes
    expect(applyDelta(World, prev, orNull!)).toEqual(next);
  });

  it("always encodes when prev is undefined (no baseline yet)", () => {
    const next = { players: { a: { x: 1, y: 2 } }, tick: 1 };
    const bytes = encodeDeltaOrNull(World, undefined, next);
    expect(bytes).not.toBeNull();
    expect(applyDelta(World, undefined, bytes!)).toEqual(next);
  });
});

describe("quant codec", () => {
  it("validates construction (step > 0, max > min, step <= range)", () => {
    expect(() => quant(0, 1, 0)).toThrowError(/step must be > 0/);
    expect(() => quant(0, 1, -0.1)).toThrowError(/step must be > 0/);
    expect(() => quant(5, 5, 0.1)).toThrowError(/greater than min/);
    expect(() => quant(10, 0, 0.1)).toThrowError(/greater than min/);
    // step larger than the range collapses every value to min -> reject.
    expect(() => quant(0, 1, 2)).toThrowError(/larger than the range/);
    expect(() => quant(0, 10, 20)).toThrowError(/larger than the range/);
    // step exactly equal to the range is allowed (N = 1, a 2-level field).
    expect(() => quant(0, 10, 10)).not.toThrow();
  });

  it("picks the smallest wire width from the level count", () => {
    // N = 250 -> u8 (1 byte)
    expect(encodeFull(quant(0, 1, 0.004), 0.5).length).toBe(1);
    // N = 10000 -> u16 (2 bytes)
    expect(encodeFull(quant(0, 100, 0.01), 42).length).toBe(2);
    // N = 409600 -> u32 (4 bytes)
    expect(encodeFull(quant(0, 4096, 0.01), 1234.56).length).toBe(4);
    // boundary: N = 255 -> u8, N = 256 -> u16
    expect(encodeFull(quant(0, 255, 1), 100).length).toBe(1);
    expect(encodeFull(quant(0, 256, 1), 100).length).toBe(2);
    // boundary: N = 65535 -> u16, N = 65536 -> u32
    expect(encodeFull(quant(0, 65535, 1), 1).length).toBe(2);
    expect(encodeFull(quant(0, 65536, 1), 1).length).toBe(4);
  });

  it("clamps out-of-range inputs to the endpoints", () => {
    const c = quant(0, 10, 0.5);
    expect(roundtripFull(c, -5)).toBeCloseTo(0, 6); // below min -> min
    expect(roundtripFull(c, 999)).toBeCloseTo(10, 6); // above max -> max
  });

  it("property: round-trip error never exceeds step/2", () => {
    const r = rng(0xc0ffee);
    const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
    for (let i = 0; i < 3000; i++) {
      const min = (r() - 0.5) * 2000; // -1000..1000
      const span = r() * 4096 + 0.5; // 0.5..~4096.5
      const max = min + span;
      const step = span / (r() * 500000 + 1); // keep the level count bounded
      const c = quant(min, max, step);
      const v = min - span * 0.2 + r() * span * 1.4; // sometimes outside [min,max]
      const decoded = roundtripFull(c, v);
      const target = clamp(v, min, max);
      expect(Math.abs(decoded - target)).toBeLessThanOrEqual(step / 2 + 1e-6);
    }
  });

  it("property: values in the same bucket are equal and suppressed from deltas", () => {
    const r = rng(0x5eed);
    for (let i = 0; i < 2000; i++) {
      const step = r() * 0.5 + 0.01;
      const c = quant(0, 1000, step);
      const base = r() * 1000;
      // jitter strictly under half a step -> same bucket after rounding around a grid point
      const grid = Math.round(base / step) * step;
      const a = grid + (r() - 0.5) * step * 0.49;
      const b = grid + (r() - 0.5) * step * 0.49;
      expect(c.equals(a, b)).toBe(true);
      // same bucket => encodeDeltaOrNull suppresses the send entirely
      expect(encodeDeltaOrNull(c, a, b)).toBeNull();
    }
  });

  it("delta is atomic and shrinks a struct's continuous fields", () => {
    // A tiny mob state: position + health as quant vs. the same in f32.
    const Mob = schema({ x: quant(0, 4096, 0.1), y: quant(0, 4096, 0.1), hp: quant(0, 1, 0.01) });
    const MobF32 = schema({ x: "f32", y: "f32", hp: "f32" });
    const prev = { x: 100, y: 200, hp: 1 };
    const next = { x: 100.02, y: 260, hp: 0.5 }; // x jitters within a bucket, y & hp move
    // x is same-bucket (step 0.1) -> only y & hp ride in the delta.
    const applied = applyDelta(Mob, prev, encodeDelta(Mob, prev, next));
    expect(applied.x).toBeCloseTo(100, 2);
    expect(applied.y).toBeCloseTo(260, 2);
    expect(applied.hp).toBeCloseTo(0.5, 3);
    // Full quant snapshot: x,y in u16 (2B each) + hp u8 (1B) = 5 bytes vs f32's 12.
    expect(encodeFull(Mob, next).length).toBe(5);
    expect(encodeFull(Mob, next).length).toBeLessThan(encodeFull(MobF32, next).length);
  });

  it("nests inside a struct and diffs field-by-field", () => {
    const S = schema({ tick: "u32", angle: quant(0, Math.PI * 2, 0.0001) });
    const prev = { tick: 1, angle: 0 };
    const next = { tick: 2, angle: Math.PI };
    const applied = roundtripDelta(S, prev, next);
    expect(applied.tick).toBe(2);
    expect(applied.angle).toBeCloseTo(Math.PI, 3);
  });
});

describe("schema dirty-bit delta (per-field bitmask)", () => {
  // 12 fields -> a 2-byte changed-field mask, exercising multi-byte masking.
  const Wide = schema({
    a: "u8",
    b: "u16",
    c: "u32",
    d: "i32",
    e: "f32",
    f: "f64",
    g: "bool",
    h: enumOf("x", "y", "z"),
    i: str(8),
    j: quant(0, 1, 0.01),
    k: quant(0, 4096, 0.01),
    l: optionalOf(prim("u16")),
  });
  type WideT = ReturnType<typeof Wide.readFull>;

  function randomWide(r: () => number): WideT {
    const names = ["ann", "bob", "cara", "dan", "eve"];
    return {
      a: Math.floor(r() * 256),
      b: Math.floor(r() * 65536),
      c: Math.floor(r() * 4_000_000_000),
      d: Math.floor((r() - 0.5) * 2_000_000_000),
      e: (r() - 0.5) * 1000,
      f: (r() - 0.5) * 1e6,
      g: r() < 0.5,
      h: (["x", "y", "z"] as const)[Math.floor(r() * 3)]!,
      i: names[Math.floor(r() * names.length)]!,
      j: r(),
      k: r() * 4096,
      l: r() < 0.5 ? null : Math.floor(r() * 65536),
    };
  }

  it("property: an arbitrary subset of field changes round-trips exactly", () => {
    const r = rng(0xd147b17);
    const canon = (v: WideT): WideT => decodeFull(Wide, encodeFull(Wide, v));
    for (let iter = 0; iter < 2000; iter++) {
      const prev = canon(randomWide(r));
      // Mutate a random subset by regenerating those fields from a fresh draw.
      const fresh = randomWide(r);
      const next = { ...prev } as WideT;
      const keys = Object.keys(prev) as (keyof WideT)[];
      for (const key of keys) {
        if (r() < 0.5) (next as Record<string, unknown>)[key] = fresh[key];
      }
      const nextCanon = canon(next);
      const delta = encodeDelta(Wide, prev, next);
      const applied = applyDelta(Wide, prev, delta);
      expect(applied).toEqual(nextCanon);
      // Delta never larger than a full snapshot + the 2 mask bytes.
      expect(delta.length).toBeLessThanOrEqual(encodeFull(Wide, next).length + 2);
    }
  });

  it("a single changed field is far smaller than a full snapshot", () => {
    const base = decodeFull(Wide, encodeFull(Wide, {
      a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: true, h: "x", i: "ann", j: 0.5, k: 100, l: 7,
    }));
    const changed = { ...base, c: 999 };
    const delta = encodeDelta(Wide, base, changed);
    const full = encodeFull(Wide, changed);
    // 2 mask bytes + 1 u32 (4) = 6, vs a full snapshot of every field.
    expect(delta.length).toBe(6);
    expect(delta.length).toBeLessThan(full.length);
    expect(applyDelta(Wide, base, delta)).toEqual(decodeFull(Wide, full));
  });

  it("an unchanged wide struct is exactly the mask bytes", () => {
    const v = decodeFull(Wide, encodeFull(Wide, {
      a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: false, h: "y", i: "bob", j: 0.25, k: 50, l: null,
    }));
    const delta = encodeDelta(Wide, v, v);
    expect(delta.length).toBe(2); // 12 fields -> 2 mask bytes, no payload
    expect(applyDelta(Wide, v, delta)).toEqual(v);
  });
});

describe("mapOf per-entry field delta", () => {
  const Player = schema({ x: "f32", y: "f32", score: "u32" });
  const Players = mapOf(Player);

  it("a one-field entry change ships a child delta, smaller than a full entry", () => {
    const prev = { p1: { x: 10, y: 20, score: 3 }, p2: { x: 30, y: 40, score: 7 } };
    const next = { p1: { x: 10, y: 20, score: 3 }, p2: { x: 99, y: 40, score: 7 } }; // p2.x only
    const delta = encodeDelta(Players, prev, next);
    expect(applyDelta(Players, prev, delta)).toEqual(next);
    // Old format re-sent the whole p2 entry (3 fields full = 12 bytes of payload).
    // New format sends p2's child delta: 1 mask byte + 1 f32 (4) = 5 bytes of payload.
    const wholeEntry = encodeFull(Player, next.p2).length; // 12
    const childDelta = encodeDelta(Player, prev.p2, next.p2).length; // 5
    expect(childDelta).toBeLessThan(wholeEntry);
    // The saving (7 bytes here) shows up directly in the map delta size.
    expect(delta.length).toBe(
      encodeDelta(Players, prev, { ...prev }).length + // removed(0)+changed(0) framing
        new TextEncoder().encode("p2").length + 1 + // key varint-len + "p2"
        childDelta,
    );
  });

  it("a new key is sent in full; an existing changed key is sent as a delta", () => {
    const prev = { a: { x: 1, y: 1, score: 1 } };
    const next = {
      a: { x: 1, y: 2, score: 1 }, // a: y changed -> child delta
      b: { x: 5, y: 6, score: 7 }, // b: new key -> child full
    };
    expect(roundtripDelta(Players, prev, next)).toEqual(next);
  });

  it("atomic children stay the same size as a whole-entry encode", () => {
    // For prim/quant/str/enum children writeDelta === writeFull, so an updated
    // entry costs exactly what the old whole-entry format cost.
    const Scores = mapOf(prim("u32"));
    const prev = { a: 1, b: 2, c: 3 };
    const next = { a: 1, b: 999, d: 4 }; // b changed, c removed, d added
    const delta = encodeDelta(Scores, prev, next);
    expect(applyDelta(Scores, prev, delta)).toEqual(next);
    // b (updated, u32=4) + d (new, u32=4) each cost 4 payload bytes, same as full.
    expect(encodeDelta(prim("u32"), prev.b, next.b)).toEqual(encodeFull(prim("u32"), next.b));
  });

  it("nested mapOf(mapOf(schema)) diffs the innermost entry field-by-field", () => {
    const Rooms = mapOf(mapOf(Player));
    const prev = {
      r1: { p1: { x: 1, y: 2, score: 3 }, p2: { x: 4, y: 5, score: 6 } },
      r2: { q1: { x: 7, y: 8, score: 9 } },
    };
    const next = {
      r1: { p1: { x: 1, y: 2, score: 3 }, p2: { x: 4, y: 999, score: 6 } }, // r1.p2.y only
      r2: { q1: { x: 7, y: 8, score: 9 } },
    };
    const delta = encodeDelta(Rooms, prev, next);
    expect(applyDelta(Rooms, prev, delta)).toEqual(next);
    // Only r1 rides in the outer delta, only p2 in r1's inner delta, only y in p2.
    const full = encodeFull(Rooms, next);
    expect(delta.length).toBeLessThan(full.length / 2);
  });

  it("property: random mutate sequences match a full resync and shrink with delta", () => {
    const r = rng(0x9a2b3c);
    const canonEntry = (v: { x: number; y: number; score: number }) =>
      decodeFull(Player, encodeFull(Player, v));
    const randomEntry = () => ({
      x: (r() - 0.5) * 1000,
      y: (r() - 0.5) * 1000,
      score: Math.floor(r() * 4_000_000_000),
    });

    for (let iter = 0; iter < 500; iter++) {
      // Start from a random baseline map.
      let live: Record<string, { x: number; y: number; score: number }> = {};
      const n = 1 + Math.floor(r() * 8);
      for (let i = 0; i < n; i++) live[`p${Math.floor(r() * 12)}`] = canonEntry(randomEntry());
      // A shadow copy the "server" would keep and diff against each tick.
      let baseline = Players.clone(live);

      for (let tick = 0; tick < 6; tick++) {
        const next: typeof live = {};
        // Carry keys forward, sometimes mutating one field, sometimes dropping.
        for (const k of Object.keys(baseline)) {
          if (r() < 0.15) continue; // remove
          const e = { ...baseline[k]! };
          if (r() < 0.6) {
            const field = (["x", "y", "score"] as const)[Math.floor(r() * 3)]!;
            (e as Record<string, number>)[field] = field === "score"
              ? Math.floor(r() * 4_000_000_000)
              : (r() - 0.5) * 1000;
          }
          next[k] = canonEntry(e);
        }
        // Occasionally add a fresh key.
        if (r() < 0.5) next[`p${Math.floor(r() * 12)}`] = canonEntry(randomEntry());

        const delta = encodeDelta(Players, baseline, next);
        const applied = applyDelta(Players, baseline, delta);
        // Delta application must match the authoritative next map exactly...
        expect(applied).toEqual(next);
        // ...and match a from-scratch full resync of the same map.
        expect(applied).toEqual(decodeFull(Players, encodeFull(Players, next)));

        baseline = Players.clone(next);
        live = next;
      }
    }
  });
});

describe("combined composition + type inference", () => {
  it("infers and round-trips the flagship example shape", () => {
    const Lobby = schema({
      tags: listOf(prim("str")),
      rank: optionalOf(prim("u16")),
      mode: enumOf("ffa", "duo"),
    });
    const prev = { tags: ["ranked"], rank: null as number | null, mode: "ffa" as "ffa" | "duo" };
    const next = { tags: ["ranked", "eu"], rank: 1200, mode: "duo" as "ffa" | "duo" };
    const applied = roundtripDelta(Lobby, prev, next);
    // Type assertions: these lines only compile if Infer flows correctly.
    const tags: string[] = applied.tags;
    const rank: number | null = applied.rank;
    const mode: "ffa" | "duo" = applied.mode;
    expect(tags).toEqual(["ranked", "eu"]);
    expect(rank).toBe(1200);
    expect(mode).toBe("duo");
  });
});
