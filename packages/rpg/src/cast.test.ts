import { beforeEach, describe, expect, it } from "vitest";
import { RpgEngine } from "./engine.js";
import type { ContentPack } from "./content.js";
import { addBuff } from "./buffs.js";

const pack: ContentPack = {
  npcs: [],
  weapons: [{ id: "wep", kind: "melee", dps: 100, speedMs: 1000, damageScalePct: 0, maxRange: 5 }],
  buffs: [
    { id: "silence", kind: "bad", durationMs: 5000, cc: { silence: true } },
    { id: "stun", kind: "bad", durationMs: 5000, cc: { stun: true } },
    { id: "sleep", kind: "bad", durationMs: 5000, cc: { sleep: true } },
    { id: "stance", kind: "good", modifiers: [{ stat: "meleeDamageMul", kind: "percent", value: 20 }] },
  ],
  skills: [
    { id: "melee", school: "melee", gcd: "none", targetType: "hostile", maxRange: 5, effects: [{ effect: { kind: "damage", school: "melee", useWeapon: true, canCrit: false } }] },
    { id: "spell", school: "spell", gcd: "none", targetType: "hostile", maxRange: 30, effects: [{ effect: { kind: "damage", school: "spell", fixed: { min: 10, max: 10 }, canCrit: false } }] },
    { id: "cast1s", school: "spell", castTimeMs: 1000, manaCost: 10, targetType: "hostile", maxRange: 30, effects: [{ effect: { kind: "damage", school: "spell", fixed: { min: 50, max: 50 }, canCrit: false } }] },
    { id: "gA", school: "none", gcd: "default", cooldownMs: 5000, targetType: "self", effects: [] },
    { id: "gB", school: "none", gcd: "default", targetType: "self", effects: [] },
    {
      id: "chan",
      school: "spell",
      targetType: "hostile",
      maxRange: 30,
      channel: { durationMs: 3000, tickMs: 1000, manaPerTick: 10, tickEffects: [{ kind: "damage", school: "spell", fixed: { min: 5, max: 5 }, canCrit: false }] },
      effects: [],
    },
    { id: "proj", school: "spell", targetType: "hostile", maxRange: 100, projectileSpeed: 10, effects: [{ effect: { kind: "damage", school: "spell", fixed: { min: 20, max: 20 }, canCrit: false } }] },
    { id: "toggle", school: "none", gcd: "none", targetType: "self", toggleBuffId: "stance", effects: [] },
  ],
};

let engine: RpgEngine;
beforeEach(() => {
  engine = new RpgEngine(pack, { seed: 1, pvpEnabled: false, regenIntervalMs: 1_000_000 });
  engine.spawnPlayer({ id: "p", pos: { x: 0, y: 0 }, faction: "players", weapon: "wep", stats: { maxHp: 1000, maxMp: 500 } });
  engine.spawnPlayer({ id: "e", pos: { x: 1, y: 0 }, faction: "enemy", stats: { maxHp: 1000, armor: 0, magicResist: 0 } });
});

describe("CC gate order", () => {
  it("silence blocks spell but not melee", () => {
    addBuff(engine, engine.unit("p")!, engine.buff("silence")!, "p", 1, 0);
    expect(engine.useSkill("p", "spell", { unitId: "e" }, 1000)).toBe("silenced");
    expect(engine.useSkill("p", "melee", { unitId: "e" }, 1000)).toBe("ok");
  });

  it("stun blocks everything", () => {
    addBuff(engine, engine.unit("p")!, engine.buff("stun")!, "p", 1, 0);
    expect(engine.useSkill("p", "melee", { unitId: "e" }, 1000)).toBe("stunned");
    expect(engine.useSkill("p", "spell", { unitId: "e" }, 1000)).toBe("stunned");
  });

  it("sleep blocks skill use like stun", () => {
    addBuff(engine, engine.unit("p")!, engine.buff("sleep")!, "p", 1, 0);
    expect(engine.useSkill("p", "melee", { unitId: "e" }, 1000)).toBe("stunned");
  });
});

describe("GCD vs cooldown independence", () => {
  it("GCD and per-skill cooldown gate separately", () => {
    expect(engine.useSkill("p", "gA", undefined, 0)).toBe("ok"); // GCD→1000, cd gA→5000
    expect(engine.useSkill("p", "gB", undefined, 500)).toBe("onGcd");
    expect(engine.useSkill("p", "gB", undefined, 1000)).toBe("ok"); // GCD→2000
    expect(engine.useSkill("p", "gA", undefined, 2500)).toBe("onCooldown"); // GCD clear, cd not
    expect(engine.useSkill("p", "gA", undefined, 5000)).toBe("ok");
  });

  it("rejects re-use inside the 150ms anti-spam window", () => {
    expect(engine.useSkill("p", "melee", { unitId: "e" }, 1000)).toBe("ok");
    expect(engine.useSkill("p", "melee", { unitId: "e" }, 1100)).toBe("tooSoon");
    expect(engine.useSkill("p", "melee", { unitId: "e" }, 1200)).toBe("ok");
  });
});

describe("range gate", () => {
  it("rejects a target beyond max range", () => {
    engine.moveUnit("e", { x: 200, y: 0 });
    expect(engine.useSkill("p", "melee", { unitId: "e" }, 0)).toBe("tooFar");
  });
});

describe("cast timer", () => {
  it("applies effects only once the cast bar completes", () => {
    expect(engine.useSkill("p", "cast1s", { unitId: "e" }, 0)).toBe("ok");
    engine.tick(999);
    expect(engine.getUnit("e")!.hp).toBe(1000);
    engine.tick(1000);
    expect(engine.getUnit("e")!.hp).toBe(950);
    expect(engine.getUnit("p")!.casting).toBeUndefined();
  });

  it("cancelOnMove interrupts an in-progress cast", () => {
    engine.useSkill("p", "cast1s", { unitId: "e" }, 0);
    engine.moveUnit("p", { x: 1, y: 0 });
    expect(engine.getUnit("p")!.casting).toBeUndefined();
    engine.tick(1000);
    expect(engine.getUnit("e")!.hp).toBe(1000); // never landed
  });
});

describe("channel", () => {
  it("ticks duration/interval times with upkeep", () => {
    engine.useSkill("p", "chan", { unitId: "e" }, 0);
    engine.tick(1000);
    engine.tick(2000);
    engine.tick(3000);
    expect(engine.getUnit("e")!.hp).toBe(985); // 3 * 5
    expect(engine.getUnit("p")!.mp).toBe(470); // 500 - 3*10
    expect(engine.getUnit("p")!.casting).toBeUndefined();
  });

  it("cancels when upkeep mana runs out", () => {
    engine.unit("p")!.mp = 25;
    engine.useSkill("p", "chan", { unitId: "e" }, 0);
    engine.tick(1000); // pay 10 → 15, dmg
    engine.tick(2000); // pay 10 → 5, dmg
    const late = engine.tick(3000); // 5 < 10 → cancel, no dmg
    expect(engine.getUnit("e")!.hp).toBe(990); // 2 * 5
    expect(late.some((ev) => ev.t === "castStopped")).toBe(true);
    expect(engine.getUnit("p")!.casting).toBeUndefined();
  });
});

describe("projectile travel", () => {
  it("delays the hit by distance/speed", () => {
    engine.moveUnit("e", { x: 50, y: 0 });
    engine.useSkill("p", "proj", { unitId: "e" }, 0); // 50 / 10 * 1000 = 5000ms
    engine.tick(4999);
    expect(engine.getUnit("e")!.hp).toBe(1000);
    engine.tick(5000);
    expect(engine.getUnit("e")!.hp).toBe(980);
  });
});

describe("toggle", () => {
  it("adds then removes the toggle buff", () => {
    engine.useSkill("p", "toggle", undefined, 0);
    expect(engine.getUnit("p")!.buffs.some((b) => b.buffId === "stance")).toBe(true);
    engine.useSkill("p", "toggle", undefined, 200);
    expect(engine.getUnit("p")!.buffs.some((b) => b.buffId === "stance")).toBe(false);
  });
});
