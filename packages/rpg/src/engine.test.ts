import { describe, expect, it } from "vitest";
import { RpgEngine } from "./engine.js";
import type { CombatEvent } from "./events.js";
import type { ContentPack } from "./content.js";
import { addBuff } from "./buffs.js";
import { sampleContent } from "./sample-content.js";

describe("melee duel to death", () => {
  it("kills the wolf, awards xp, and levels the player up", () => {
    const e = new RpgEngine(sampleContent, { seed: 3, pvpEnabled: false });
    e.spawnPlayer({ id: "hero", pos: { x: 0, y: 0 }, faction: "players", weapon: "sword", stats: { str: 50 } });
    const wolf = e.spawnNpc("wolf", { x: 1, y: 0 });
    e.startAutoAttack("hero", wolf, 0);

    const events: CombatEvent[] = [];
    let dead = false;
    for (let now = 0; now <= 60000 && !dead; now += 200) {
      for (const ev of e.tick(now)) {
        events.push(ev);
        if (ev.t === "death" && ev.unit === wolf) dead = true;
      }
    }

    expect(dead).toBe(true);
    expect(e.getUnit("hero")!.alive).toBe(true);
    expect(events.some((ev) => ev.t === "xpGained" && ev.unit === "hero")).toBe(true);
    expect(events.some((ev) => ev.t === "levelUp" && ev.unit === "hero" && ev.level === 2)).toBe(true);
    expect(e.getUnit("hero")!.level).toBe(2);
    expect(e.unit("hero")!.xp).toBe(180);
  });
});

describe("serialize / restore", () => {
  it("produces identical event streams after a round-trip", () => {
    const build = () => {
      const e = new RpgEngine(sampleContent, { seed: 42, pvpEnabled: false });
      e.spawnPlayer({ id: "hero", pos: { x: 0, y: 0 }, faction: "players", weapon: "sword", stats: { str: 30 } });
      e.spawnNpc("wolf", { x: 1, y: 0 }, { id: "wolf1" });
      e.startAutoAttack("hero", "wolf1", 0);
      for (let now = 0; now <= 2000; now += 200) e.tick(now);
      return e;
    };

    const a = build();
    const snap = JSON.parse(JSON.stringify(a.serialize()));
    const b = RpgEngine.restore(sampleContent, snap, { pvpEnabled: false });

    for (let now = 2200; now <= 5000; now += 200) {
      if (now === 2400) {
        a.useSkill("hero", "warrior-slash", { unitId: "wolf1" }, now);
        b.useSkill("hero", "warrior-slash", { unitId: "wolf1" }, now);
      }
      const ea = a.tick(now);
      const eb = b.tick(now);
      expect(eb).toEqual(ea);
    }
    expect(a.getUnit("hero")!.hp).toBe(b.getUnit("hero")!.hp);
    expect(a.getUnit("wolf1")?.hp ?? -1).toBe(b.getUnit("wolf1")?.hp ?? -1);
  });
});

describe("regeneration", () => {
  it("regenerates slower in combat than idle", () => {
    const e = new RpgEngine(sampleContent, { seed: 1, pvpEnabled: false });
    e.spawnPlayer({ id: "p", pos: { x: 0, y: 0 }, stats: { spi: 10, maxHp: 1000 } });
    e.tick(0); // start clock

    const u = e.unit("p")!;
    u.hp = 500;
    u.inCombat = true;
    u.lastCombatAt = 0;

    e.tick(1000);
    expect(e.getUnit("p")!.hp).toBe(502); // combatHpRegen = 2

    u.inCombat = false;
    e.tick(2000);
    expect(e.getUnit("p")!.hp).toBe(512); // hpRegen = 10
  });
});

describe("engine options survive restore", () => {
  it("replays snapshot options and honors explicit overrides", () => {
    const e = new RpgEngine(sampleContent, { seed: 7, pvpEnabled: false, maxUnits: 5, combatTimeoutMs: 9000 });
    const snap = JSON.parse(JSON.stringify(e.serialize()));
    expect(snap.opts.pvpEnabled).toBe(false);
    expect(snap.opts.maxUnits).toBe(5);
    expect(snap.opts.combatTimeoutMs).toBe(9000);

    // No explicit opts → the snapshot's rules are replayed, not the constructor defaults.
    const s1 = RpgEngine.restore(sampleContent, snap).serialize();
    expect(s1.opts.pvpEnabled).toBe(false);
    expect(s1.opts.maxUnits).toBe(5);
    expect(s1.opts.combatTimeoutMs).toBe(9000);

    // Explicit opts override field-by-field; untouched fields keep the snapshot value.
    const s2 = RpgEngine.restore(sampleContent, snap, { pvpEnabled: true }).serialize();
    expect(s2.opts.pvpEnabled).toBe(true);
    expect(s2.opts.maxUnits).toBe(5);
  });

  it("round-trips an unbounded maxUnits through JSON as null", () => {
    const snap = JSON.parse(JSON.stringify(new RpgEngine(sampleContent, { seed: 1 }).serialize()));
    expect(snap.opts.maxUnits).toBeNull(); // Infinity is not JSON-representable
    expect(RpgEngine.restore(sampleContent, snap).serialize().opts.maxUnits).toBeNull();
  });
});

describe("maxUnits cap", () => {
  it("stops spawning players and npcs past the cap", () => {
    const e = new RpgEngine(sampleContent, { seed: 1, maxUnits: 2 });
    expect(e.spawnNpc("wolf", { x: 0, y: 0 })).not.toBeNull();
    expect(e.spawnPlayer({ id: "p", pos: { x: 0, y: 0 } })).toBe(true);
    // Cap of 2 reached: further spawns are no-ops.
    expect(e.spawnPlayer({ id: "p2", pos: { x: 0, y: 0 } })).toBe(false);
    expect(e.spawnNpc("wolf", { x: 0, y: 0 })).toBeNull();
    expect(e.getUnit("p2")).toBeUndefined();
    expect([...e.units()].length).toBe(2);
  });

  it("caps effect-driven summons too", () => {
    const e = new RpgEngine(sampleContent, { seed: 1, pvpEnabled: false, maxUnits: 2 });
    const boss = e.spawnNpc("boss", { x: 0, y: 0 })!;
    e.spawnPlayer({ id: "p", pos: { x: 0, y: 0 } }); // at cap 2
    e.useSkill(boss, "boss-summon", undefined, 0); // would add 2 wolves
    expect([...e.units()].length).toBe(2);
  });
});

describe("faction relations honor content", () => {
  it("defaults all cross-faction pairings hostile when none are declared", () => {
    const e = new RpgEngine(sampleContent, { seed: 1 }); // sampleContent declares no factions
    e.spawnPlayer({ id: "a", pos: { x: 0, y: 0 }, faction: "players" });
    const wolf = e.spawnNpc("wolf", { x: 1, y: 0 })!; // faction "monsters"
    expect(e.relation(e.unit("a")!, e.unit(wolf)!)).toBe("hostile");
  });

  it("treats only declared pairs as hostile once any are declared", () => {
    const pack: ContentPack = {
      skills: [],
      buffs: [],
      npcs: [],
      factions: { hostile: [["red", "blue"]] },
    };
    const e = new RpgEngine(pack, { seed: 1 });
    e.spawnPlayer({ id: "r", pos: { x: 0, y: 0 }, faction: "red" });
    e.spawnPlayer({ id: "b", pos: { x: 0, y: 0 }, faction: "blue" });
    e.spawnPlayer({ id: "g", pos: { x: 0, y: 0 }, faction: "green" });
    expect(e.relation(e.unit("r")!, e.unit("b")!)).toBe("hostile"); // declared pair
    expect(e.relation(e.unit("r")!, e.unit("g")!)).toBe("friendly"); // undeclared cross-faction
    expect(e.relation(e.unit("r")!, e.unit("r")!)).toBe("friendly"); // same faction
  });
});

describe("immune hit engages combat", () => {
  it("a real immune hit still pulls both into combat and aggros the npc", () => {
    const pack: ContentPack = {
      skills: [
        { id: "zap", school: "spell", gcd: "none", targetType: "hostile", maxRange: 30, effects: [{ effect: { kind: "damage", school: "spell", fixed: { min: 50, max: 50 }, canCrit: false } }] },
      ],
      buffs: [{ id: "warded", kind: "good", durationMs: 10000, immunities: { schools: ["spell"] } }],
      npcs: [{ id: "dummy", level: 1, faction: "monsters" }],
    };
    const e = new RpgEngine(pack, { seed: 1, pvpEnabled: false });
    e.spawnPlayer({ id: "p", pos: { x: 0, y: 0 }, faction: "players" });
    const dummy = e.spawnNpc("dummy", { x: 1, y: 0 })!;
    addBuff(e, e.unit(dummy)!, e.buff("warded")!, dummy, 1, 0);

    e.useSkill("p", "zap", { unitId: dummy }, 0);
    const d = e.unit(dummy)!;
    expect(d.hp).toBe(d.maxHp); // immune: no damage
    expect(d.inCombat).toBe(true); // but combat still engaged
    expect(d.npc!.aggro.has("p")).toBe(true); // and the attacker is on threat
    expect(e.unit("p")!.inCombat).toBe(true);
  });
});

describe("buff ticks skip avoidance", () => {
  it("a melee DoT lands every tick despite maxed dodge/block/parry", () => {
    const pack: ContentPack = {
      skills: [],
      buffs: [{ id: "rend", kind: "bad", durationMs: 4000, tick: { intervalMs: 1000, effects: [{ kind: "damage", school: "melee", fixed: { min: 25, max: 25 }, canCrit: false }] } }],
      npcs: [],
    };
    const e = new RpgEngine(pack, { seed: 1, pvpEnabled: false, regenIntervalMs: 1_000_000 });
    e.spawnPlayer({ id: "atk", pos: { x: 0, y: 0 } });
    e.spawnPlayer({ id: "vic", pos: { x: 1, y: 0 }, stats: { maxHp: 1000, dodge: 100, block: 100, parry: 100, armor: 0 } });
    addBuff(e, e.unit("vic")!, e.buff("rend")!, "atk", 1, 0);
    e.tick(1000);
    e.tick(2000);
    expect(e.unit("vic")!.hp).toBe(950); // two ticks of 25 both landed
  });
});

describe("summon during AI iteration", () => {
  it("a mid-sweep summon inserts cleanly without disrupting the AI pass", () => {
    const pack: ContentPack = {
      weapons: [{ id: "fang", kind: "melee", dps: 5, speedMs: 1000, maxRange: 3 }],
      buffs: [],
      skills: [
        { id: "call", school: "none", gcd: "none", cooldownMs: 10000, targetType: "self", effects: [{ effect: { kind: "spawnNpc", npcDefId: "pup", count: 1, offset: 1, lifetimeMs: 60000 }, applyTo: "caster" }] },
      ],
      npcs: [
        { id: "mother", level: 5, faction: "monsters", weapon: "fang", baseSkillId: "call", skills: [{ skillId: "call" }], ai: { aggroRadius: 20, moveSpeed: 4, skillDelayMs: [0, 0] } },
        { id: "pup", level: 1, faction: "monsters", weapon: "fang", ai: { aggroRadius: 20, moveSpeed: 4 } },
      ],
    };
    const e = new RpgEngine(pack, { seed: 1, pvpEnabled: false });
    const mother = e.spawnNpc("mother", { x: 0, y: 0 }, { home: { x: 0, y: 0 } })!;
    e.spawnPlayer({ id: "p", pos: { x: 2, y: 0 }, stats: { maxHp: 5000 } });
    e.tick(0);
    e.addAggro(e.unit(mother)!, "p", "damage", 100);
    const before = [...e.units()].length; // mother + p
    e.tick(200); // AI sweep: mother summons a pup mid-iteration
    expect([...e.units()].length).toBe(before + 1);
    expect(e.getUnit(mother)!.alive).toBe(true);
  });
});
