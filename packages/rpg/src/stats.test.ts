import { describe, expect, it } from "vitest";
import { computeStat, defaultDerived, resolveBaseStats, type Modifier, type ModifierSet } from "./stats.js";

function mset(entries: [string, Modifier[]][]): ModifierSet {
  return new Map(entries);
}

describe("computeStat", () => {
  it("applies flat before percent", () => {
    const mods = mset([
      ["a", [{ stat: "str", kind: "flat", value: 10 }]],
      ["b", [{ stat: "str", kind: "percent", value: 50 }]],
    ]);
    // (100 + 10) * 1.5 = 165
    expect(computeStat(100, "str", mods)).toBe(165);
  });

  it("sums multiple flats then multiple percents", () => {
    const mods = mset([
      ["a", [{ stat: "armor", kind: "flat", value: 100 }]],
      ["b", [{ stat: "armor", kind: "flat", value: 50 }]],
      ["c", [{ stat: "armor", kind: "percent", value: 10 }]],
      ["d", [{ stat: "armor", kind: "percent", value: 10 }]],
    ]);
    // (0 + 150) * 1.2 = 180
    expect(computeStat(0, "armor", mods)).toBe(180);
  });

  it("ignores modifiers for other stats", () => {
    const mods = mset([["a", [{ stat: "dex", kind: "flat", value: 999 }]]]);
    expect(computeStat(10, "str", mods)).toBe(10);
  });

  it("source removal is scoped and idempotent", () => {
    const mods = mset([
      ["buff:1", [{ stat: "str", kind: "flat", value: 20 }]],
      ["buff:2", [{ stat: "str", kind: "percent", value: 50 }]],
    ]);
    expect(computeStat(100, "str", mods)).toBe(180); // (120)*1.5
    mods.delete("buff:1");
    expect(computeStat(100, "str", mods)).toBe(150);
    mods.delete("buff:1"); // idempotent
    expect(computeStat(100, "str", mods)).toBe(150);
    mods.delete("buff:2");
    expect(computeStat(100, "str", mods)).toBe(100);
  });
});

describe("derived stats", () => {
  it("computes maxHp from sta and level", () => {
    const base = defaultDerived(1, { str: 10, dex: 10, sta: 10, int: 10, spi: 10 });
    expect(base.get("maxHp")).toBe(100 + 10 * 10 + 1 * 20); // 220
  });

  it("multipliers default to neutral 100", () => {
    const base = defaultDerived(1, { str: 10, dex: 10, sta: 10, int: 10, spi: 10 });
    expect(base.get("meleeDamageMul")).toBe(100);
    expect(base.get("incomingDamageMul")).toBe(100);
    expect(base.get("gcdMul")).toBe(100);
  });

  it("combat regen is 1/5 of idle regen", () => {
    const base = defaultDerived(1, { str: 10, dex: 10, sta: 10, int: 10, spi: 10 });
    expect(base.get("combatHpRegen")).toBe(base.get("hpRegen")! / 5);
    expect(base.get("postCastMpRegen")).toBe(base.get("mpRegen")! / 5);
  });
});

describe("resolveBaseStats", () => {
  it("overrides win over derived defaults", () => {
    const base = resolveBaseStats(1, { str: 10, dex: 10, sta: 10, int: 10, spi: 10 }, { maxHp: 500, armor: 200 });
    expect(base.get("maxHp")).toBe(500);
    expect(base.get("armor")).toBe(200);
  });

  it("higher sta primary raises derived maxHp", () => {
    const base = resolveBaseStats(1, { str: 10, dex: 10, sta: 50, int: 10, spi: 10 }, {});
    expect(base.get("maxHp")).toBe(100 + 50 * 10 + 20);
  });
});
