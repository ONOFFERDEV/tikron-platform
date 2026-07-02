import { describe, it, expect } from "vitest";
import {
  prim,
  schema,
  mapOf,
  listOf,
  optionalOf,
  enumOf,
  str,
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
