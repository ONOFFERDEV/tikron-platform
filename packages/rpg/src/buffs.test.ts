import { beforeEach, describe, expect, it } from "vitest";
import { RpgEngine } from "./engine.js";
import type { ContentPack, EffectDef } from "./content.js";
import type { ApplyCtx } from "./effects.js";
import { addBuff } from "./buffs.js";
import type { Unit } from "./unit.js";

const pack: ContentPack = {
  skills: [],
  npcs: [],
  buffs: [
    { id: "refreshbuff", kind: "good", durationMs: 1000, stackRule: "refresh" },
    { id: "extendbuff", kind: "good", durationMs: 1000, stackRule: "extend" },
    { id: "multibuff", kind: "good", durationMs: 1000, stackRule: "multiple", maxStack: 3 },
    { id: "dot", kind: "bad", durationMs: 3000, tick: { intervalMs: 1000, effects: [{ kind: "damage", school: "spell", fixed: { min: 10, max: 10 }, canCrit: false }] } },
    { id: "hot", kind: "good", durationMs: 4000, tick: { intervalMs: 2000, effects: [{ kind: "heal", flat: 20, multiplier: 0 }] } },
    { id: "shieldA", kind: "good", durationMs: 10000, shield: { amount: 50 } },
    { id: "shieldB", kind: "good", durationMs: 10000, shield: { amount: 50 } },
    { id: "movebuff", kind: "good", durationMs: 5000, removeOn: { move: true } },
    { id: "dmgbuff", kind: "bad", durationMs: 5000, removeOn: { damaged: true } },
    { id: "goodtag", kind: "good", durationMs: 5000, tags: ["magic"] },
    { id: "goodplain", kind: "good", durationMs: 5000 },
    { id: "badtag", kind: "bad", durationMs: 5000, tags: ["poison"] },
    { id: "badplain", kind: "bad", durationMs: 5000 },
    { id: "hiddenbad", kind: "hidden", durationMs: 5000 },
    {
      id: "stun",
      kind: "bad",
      durationMs: 2000,
      cc: { stun: true },
      tags: ["stun"],
      tolerance: { tag: "stun", windowMs: 15000, steps: [{ timeReductionPct: 0 }, { timeReductionPct: 50 }, { timeReductionPct: 75 }], immunityBuffId: "stunimm" },
    },
    { id: "stunimm", kind: "hidden", durationMs: 10000, immunities: { buffTags: ["stun"] } },
    { id: "procheal", kind: "good", durationMs: 10000, triggers: [{ on: "damaged", chance: 100, effect: { kind: "heal", flat: 5, multiplier: 0 } }] },
    { id: "procnone", kind: "good", durationMs: 10000, triggers: [{ on: "damaged", chance: 0, effect: { kind: "heal", flat: 5, multiplier: 0 } }] },
  ],
};

let engine: RpgEngine;

beforeEach(() => {
  engine = new RpgEngine(pack, { seed: 1, pvpEnabled: true, regenIntervalMs: 1_000_000 });
  engine.spawnPlayer({ id: "p1", pos: { x: 0, y: 0 }, stats: { maxHp: 1000, maxMp: 500, armor: 0, magicResist: 0 } });
  engine.spawnPlayer({ id: "p2", pos: { x: 1, y: 0 }, stats: { maxHp: 1000, maxMp: 500 } });
});

const U = (id: string): Unit => engine.unit(id)!;
const add = (buffId: string, target = "p1", caster = "p2", now = 0, ab = 1) =>
  addBuff(engine, U(target), engine.buff(buffId)!, caster, ab, now);
const countBuffs = (id: string, unit = "p1") => U(unit).buffs.filter((b) => b.buffId === id).length;

function spellHit(amount: number, now: number): EffectDef {
  return { kind: "damage", school: "spell", fixed: { min: amount, max: amount }, canCrit: false };
}
function damage(from: string, to: string, amount: number, now: number): number {
  const ctx: ApplyCtx = { now, source: "skill", depth: 0 };
  return engine.dealDamage(ctx, U(from), U(to), spellHit(amount, now) as Extract<EffectDef, { kind: "damage" }>);
}

describe("stack rules", () => {
  it("refresh keeps one instance and extends to the newer end", () => {
    const first = add("refreshbuff", "p1", "p2", 0);
    add("refreshbuff", "p1", "p2", 500);
    expect(countBuffs("refreshbuff")).toBe(1);
    expect(first!.endsAt).toBe(1500);
  });

  it("refresh drops a strictly shorter reapply", () => {
    const first = add("refreshbuff", "p1", "p2", 0); // ends 1000
    const dropped = addBuff(engine, U("p1"), { id: "refreshbuff", kind: "good", durationMs: 400, stackRule: "refresh" }, "p2", 1, 500); // would end 900
    expect(dropped).toBeUndefined();
    expect(first!.endsAt).toBe(1000);
  });

  it("extend adds duration onto the remaining time", () => {
    const inst = add("extendbuff", "p1", "p2", 0); // ends 1000
    add("extendbuff", "p1", "p2", 500); // remaining 500 + 1000 = ends 2000
    expect(inst!.endsAt).toBe(2000);
  });

  it("multiple stacks up to maxStack then overwrites the shortest", () => {
    add("multibuff", "p1", "p2", 0);
    add("multibuff", "p1", "p2", 0);
    add("multibuff", "p1", "p2", 0);
    expect(countBuffs("multibuff")).toBe(3);
    add("multibuff", "p1", "p2", 500); // at cap → overwrite one, still 3
    expect(countBuffs("multibuff")).toBe(3);
    const maxEnd = Math.max(...U("p1").buffs.filter((b) => b.buffId === "multibuff").map((b) => b.endsAt));
    expect(maxEnd).toBe(1500);
  });
});

describe("tolerance / diminishing returns", () => {
  it("shortens each reapply then grants immunity", () => {
    const a = add("stun", "p1", "p2", 0);
    expect(a!.endsAt).toBe(2000); // step 0, full
    engine.tick(2000); // expire first stun

    const b = add("stun", "p1", "p2", 2000);
    expect(b!.endsAt).toBe(3000); // step 1, 50% → 1000
    engine.tick(3000);

    const c = add("stun", "p1", "p2", 3000);
    expect(c!.endsAt).toBe(3500); // step 2, 75% → 500
    engine.tick(3500);

    const d = add("stun", "p1", "p2", 3500);
    expect(d).toBeUndefined(); // step maxed → immune, blocked
    expect(U("p1").buffs.some((x) => x.buffId === "stunimm")).toBe(true);

    const e = add("stun", "p1", "p2", 3500);
    expect(e).toBeUndefined(); // now blocked by immunity buff
  });
});

describe("periodic ticks", () => {
  it("DoT ticks exactly duration/interval times", () => {
    add("dot", "p1", "p2", 0);
    const events = [...engine.tick(1000), ...engine.tick(2000), ...engine.tick(3000)];
    const hits = events.filter((e) => e.t === "damaged");
    expect(hits.length).toBe(3);
    expect(U("p1").hp).toBe(970);
    expect(countBuffs("dot")).toBe(0); // expired
  });

  it("HoT heals each tick without exceeding max", () => {
    U("p1").hp = 100;
    add("hot", "p1", "p2", 0);
    engine.tick(2000);
    engine.tick(4000);
    expect(U("p1").hp).toBe(140);
  });
});

describe("shields", () => {
  it("absorb pools drain oldest-first", () => {
    add("shieldA", "p1", "p2", 0);
    add("shieldB", "p1", "p2", 1);
    const raw = damage("p2", "p1", 70, 10);
    expect(raw).toBe(70);
    expect(U("p1").hp).toBe(1000); // fully absorbed
    expect(countBuffs("shieldA")).toBe(0); // A consumed
    const b = U("p1").buffs.find((x) => x.buffId === "shieldB");
    expect(b?.shieldLeft).toBe(30);

    damage("p2", "p1", 40, 20); // 30 from B then 10 to hp
    expect(U("p1").hp).toBe(990);
    expect(countBuffs("shieldB")).toBe(0);
  });
});

describe("removeOn", () => {
  it("drops on move", () => {
    add("movebuff", "p1", "p2", 0);
    engine.moveUnit("p1", { x: 5, y: 0 });
    expect(countBuffs("movebuff")).toBe(0);
  });

  it("drops on damaged", () => {
    add("dmgbuff", "p1", "p2", 0);
    damage("p2", "p1", 10, 0);
    expect(countBuffs("dmgbuff")).toBe(0);
  });
});

describe("dispel", () => {
  it("removes N good buffs by tag, leaving others", () => {
    add("goodtag", "p1", "p2", 0);
    add("goodplain", "p1", "p2", 0);
    const ctx: ApplyCtx = { now: 0, source: "skill", depth: 0 };
    engine.applyDispelEffect(ctx, U("p2"), U("p1"), { kind: "dispel", buffKind: "good", count: 1, tag: "magic" });
    expect(countBuffs("goodtag")).toBe(0);
    expect(countBuffs("goodplain")).toBe(1);
  });

  it("cleanses bad buffs and never touches hidden", () => {
    add("badtag", "p1", "p2", 0);
    add("badplain", "p1", "p2", 0);
    add("hiddenbad", "p1", "p2", 0);
    const ctx: ApplyCtx = { now: 0, source: "skill", depth: 0 };
    engine.applyDispelEffect(ctx, U("p2"), U("p1"), { kind: "dispel", buffKind: "bad", count: 2 });
    expect(countBuffs("badtag")).toBe(0);
    expect(countBuffs("badplain")).toBe(0);
    expect(countBuffs("hiddenbad")).toBe(1);
  });
});

describe("procs", () => {
  it("chance 100 fires, chance 0 never", () => {
    add("procheal", "p1", "p2", 0);
    damage("p2", "p1", 10, 0); // -10 then +5 proc
    expect(U("p1").hp).toBe(995);

    engine.spawnPlayer({ id: "p3", pos: { x: 0, y: 0 }, stats: { maxHp: 1000 } });
    addBuff(engine, U("p3"), engine.buff("procnone")!, "p2", 1, 0);
    damage("p2", "p3", 10, 0);
    expect(U("p3").hp).toBe(990);
  });

  it("anti-loop guard suppresses procs within 100ms", () => {
    add("procheal", "p1", "p2", 0);
    U("p1").hp = 500;
    damage("p2", "p1", 10, 0); // heals +5
    damage("p2", "p1", 10, 50); // guarded, no heal
    damage("p2", "p1", 10, 200); // heals +5
    // three -10 hits = -30; two +5 heals = +10 → 480
    expect(U("p1").hp).toBe(480);
  });
});
