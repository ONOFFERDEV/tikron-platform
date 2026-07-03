import { describe, expect, it } from "vitest";
import { RpgEngine } from "./engine.js";
import type { ContentPack, EffectDef } from "./content.js";
import type { ApplyCtx } from "./effects.js";
import { sampleContent } from "./sample-content.js";
import { addBuff } from "./buffs.js";
import type { Unit } from "./unit.js";

const ctx = (now: number): ApplyCtx => ({ now, source: "skill", depth: 0 });
const spell = (amount: number): Extract<EffectDef, { kind: "damage" }> => ({ kind: "damage", school: "spell", fixed: { min: amount, max: amount }, canCrit: false });

function setup(): RpgEngine {
  const engine = new RpgEngine(sampleContent, { seed: 5, pvpEnabled: false });
  return engine;
}

const npc = (e: RpgEngine, id: string): Unit => e.unit(id)!;
const alive = (e: RpgEngine) => (id: string) => e.unit(id)?.alive ?? false;

describe("aggro table", () => {
  it("weights heal threat at 0.6 and damage at 1.0", () => {
    const e = setup();
    const boss = e.spawnNpc("boss", { x: 0, y: 0 });
    e.spawnPlayer({ id: "dps", pos: { x: 2, y: 0 }, stats: { maxHp: 1000 } });
    e.spawnPlayer({ id: "heal", pos: { x: 2, y: 0 }, stats: { maxHp: 1000 } });

    e.dealDamage(ctx(0), e.unit("dps")!, e.unit(boss)!, spell(100));
    e.unit("dps")!.hp = 500;
    e.applyHeal(ctx(0), e.unit("heal")!, e.unit("dps")!, { kind: "heal", flat: 100, multiplier: 0 });

    const table = npc(e, boss).npc!.aggro;
    expect(table.total("dps")).toBe(100);
    expect(table.total("heal")).toBeCloseTo(60, 5);
    expect(table.top(alive(e))).toBe("dps");
  });

  it("switches target to the higher-threat attacker", () => {
    const e = setup();
    const boss = e.spawnNpc("boss", { x: 0, y: 0 });
    e.spawnPlayer({ id: "a", pos: { x: 2, y: 0 }, stats: { maxHp: 1000 } });
    e.spawnPlayer({ id: "b", pos: { x: 2, y: 0 }, stats: { maxHp: 1000 } });
    e.dealDamage(ctx(0), e.unit("a")!, e.unit(boss)!, spell(100));
    e.dealDamage(ctx(0), e.unit("b")!, e.unit(boss)!, spell(200));
    expect(npc(e, boss).npc!.aggro.top(alive(e))).toBe("b");
  });

  it("taunt jumps the taunter to the top", () => {
    const e = setup();
    const boss = e.spawnNpc("boss", { x: 0, y: 0 });
    e.spawnPlayer({ id: "dps", pos: { x: 2, y: 0 }, stats: { maxHp: 1000 } });
    e.spawnPlayer({ id: "tank", pos: { x: 3, y: 0 }, stats: { maxHp: 1000 } });
    e.dealDamage(ctx(0), e.unit("dps")!, e.unit(boss)!, spell(500));
    expect(npc(e, boss).npc!.aggro.top(alive(e))).toBe("dps");
    e.useSkill("tank", "warrior-taunt", { unitId: boss }, 0);
    expect(npc(e, boss).npc!.aggro.top(alive(e))).toBe("tank");
  });
});

describe("aggro-link", () => {
  it("pulls allied NPCs within helpRadius into combat", () => {
    const e = setup();
    const boss = e.spawnNpc("boss", { x: 0, y: 0 });
    const wolf = e.spawnNpc("wolf", { x: 5, y: 0 });
    e.spawnPlayer({ id: "p", pos: { x: 2, y: 0 }, stats: { maxHp: 1000 } });
    e.dealDamage(ctx(0), e.unit("p")!, e.unit(boss)!, spell(50));
    expect(npc(e, wolf).npc!.aggro.has("p")).toBe(true);
    expect(npc(e, wolf).npc!.fsm).toBe("combat");
  });
});

describe("leash and return", () => {
  it("teleports home past the hard leash and resets", () => {
    const e = setup();
    const wolf = e.spawnNpc("wolf", { x: 0, y: 0 }, { home: { x: 0, y: 0 } });
    e.spawnPlayer({ id: "p", pos: { x: 1000, y: 0 }, stats: { maxHp: 1000 } });
    e.tick(0); // start the clock

    e.addAggro(e.unit(wolf)!, "p", "damage", 100);
    e.unit(wolf)!.hp = 10;
    e.unit(wolf)!.pos = { x: 1000, y: 0 };

    e.tick(200); // combat step: beyond leash → return
    expect(npc(e, wolf).npc!.fsm).toBe("return");
    e.tick(400); // return step: beyond hard leash → teleport + reset
    expect(npc(e, wolf).npc!.fsm).toBe("idle");
    expect(e.unit(wolf)!.hp).toBe(e.unit(wolf)!.maxHp);
    expect(npc(e, wolf).npc!.aggro.size).toBe(0);
    expect(e.unit(wolf)!.pos).toEqual({ x: 0, y: 0 });
  });
});

describe("skill picker hp gate", () => {
  const pickerPack: ContentPack = {
    weapons: [{ id: "claw", kind: "melee", dps: 10, speedMs: 1000, maxRange: 4 }],
    buffs: [{ id: "mark", kind: "good" }],
    skills: [
      { id: "basic", school: "melee", gcd: "none", targetType: "hostile", maxRange: 4, effects: [{ effect: { kind: "damage", school: "melee", useWeapon: true } }] },
      { id: "gated", school: "none", gcd: "none", targetType: "self", maxRange: 4, effects: [{ effect: { kind: "buff", buffId: "mark" }, applyTo: "caster" }] },
    ],
    npcs: [
      {
        id: "picker",
        level: 5,
        faction: "monsters",
        weapon: "claw",
        baseSkillId: "basic",
        skills: [{ skillId: "gated", hpBelowPct: 50 }],
        ai: { aggroRadius: 10, moveSpeed: 4, skillDelayMs: [0, 0] },
      },
    ],
  };

  it("only uses the hp-gated skill below the threshold", () => {
    const e = new RpgEngine(pickerPack, { seed: 1, pvpEnabled: false });
    const id = e.spawnNpc("picker", { x: 0, y: 0 });
    e.spawnPlayer({ id: "p", pos: { x: 1, y: 0 }, stats: { maxHp: 5000 } });
    e.tick(0);
    e.addAggro(e.unit(id)!, "p", "damage", 100);

    for (let t = 200; t <= 1000; t += 200) e.tick(t);
    expect(e.unit(id)!.buffs.some((b) => b.buffId === "mark")).toBe(false);

    e.unit(id)!.hp = e.unit(id)!.maxHp * 0.4;
    e.tick(1200);
    expect(e.unit(id)!.buffs.some((b) => b.buffId === "mark")).toBe(true);
  });
});

describe("crowd control blocks NPC movement", () => {
  it("a stunned NPC in combat does not chase its target", () => {
    const e = setup();
    const wolf = e.spawnNpc("wolf", { x: 0, y: 0 }, { home: { x: 0, y: 0 } });
    e.spawnPlayer({ id: "p", pos: { x: 30, y: 0 }, stats: { maxHp: 1000 } });
    e.tick(0); // start clock
    e.addAggro(e.unit(wolf)!, "p", "damage", 100); // engage → would chase toward (30,0)
    addBuff(e, e.unit(wolf)!, e.buff("stun")!, "p", 1, 0);
    const before = { x: e.unit(wolf)!.pos.x, y: e.unit(wolf)!.pos.y };
    const events = e.tick(200); // AI interval
    expect(e.unit(wolf)!.pos).toEqual(before);
    expect(events.some((ev) => ev.t === "unitMoved" && ev.unit === wolf)).toBe(false);
  });
});
