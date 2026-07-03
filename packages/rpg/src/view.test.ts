import { beforeEach, describe, expect, it } from "vitest";
import { RpgEngine } from "./engine.js";
import type { ContentPack, EffectDef } from "./content.js";
import type { ApplyCtx } from "./effects.js";
import { addBuff } from "./buffs.js";
// Import the CC predicates through the package barrel to prove they are exported.
import { isRooted, isSilenced, isStunned } from "./index.js";

const pack: ContentPack = {
  skills: [],
  npcs: [],
  buffs: [
    { id: "stun", kind: "bad", durationMs: 5000, cc: { stun: true } },
    { id: "root", kind: "bad", durationMs: 5000, cc: { root: true } },
    { id: "silence", kind: "bad", durationMs: 5000, cc: { silence: true } },
    { id: "sleep", kind: "bad", durationMs: 5000, cc: { sleep: true } },
    { id: "dot", kind: "bad", durationMs: 3000, tick: { intervalMs: 1000, effects: [{ kind: "damage", school: "spell", fixed: { min: 10, max: 10 }, canCrit: false }] } },
  ],
};

let engine: RpgEngine;
beforeEach(() => {
  engine = new RpgEngine(pack, { seed: 1, pvpEnabled: false, regenIntervalMs: 1_000_000 });
  engine.spawnPlayer({ id: "p1", pos: { x: 0, y: 0 }, stats: { maxHp: 1000, magicResist: 0 } });
  engine.spawnPlayer({ id: "p2", pos: { x: 1, y: 0 }, stats: { maxHp: 1000 } });
});

const apply = (buffId: string) => addBuff(engine, engine.unit("p1")!, engine.buff(buffId)!, "p2", 1, 0);

describe("UnitView crowd-control visibility", () => {
  it("reports no CC and canMove for a fresh unit", () => {
    const v = engine.getUnit("p1")!;
    expect(v.stunned).toBe(false);
    expect(v.rooted).toBe(false);
    expect(v.silenced).toBe(false);
    expect(v.sleeping).toBe(false);
    expect(v.canMove).toBe(true);
  });

  it("stun sets stunned and clears canMove", () => {
    apply("stun");
    const v = engine.getUnit("p1")!;
    expect(v.stunned).toBe(true);
    expect(v.canMove).toBe(false);
  });

  it("root sets rooted and clears canMove but not silenced", () => {
    apply("root");
    const v = engine.getUnit("p1")!;
    expect(v.rooted).toBe(true);
    expect(v.silenced).toBe(false);
    expect(v.canMove).toBe(false);
  });

  it("silence blocks casting but not movement", () => {
    apply("silence");
    const v = engine.getUnit("p1")!;
    expect(v.silenced).toBe(true);
    expect(v.canMove).toBe(true);
  });

  it("sleep sets sleeping and clears canMove", () => {
    apply("sleep");
    const v = engine.getUnit("p1")!;
    expect(v.sleeping).toBe(true);
    expect(v.canMove).toBe(false);
  });

  it("a dead unit can never move", () => {
    const ctx: ApplyCtx = { now: 0, source: "skill", depth: 0 };
    engine.dealDamage(ctx, engine.unit("p2")!, engine.unit("p1")!, { kind: "damage", school: "spell", fixed: { min: 99999, max: 99999 }, canCrit: false } as Extract<EffectDef, { kind: "damage" }>);
    const v = engine.getUnit("p1")!;
    expect(v.alive).toBe(false);
    expect(v.canMove).toBe(false);
  });

  it("units() view carries the same CC flags", () => {
    apply("root");
    const v = [...engine.units()].find((u) => u.id === "p1")!;
    expect(v.rooted).toBe(true);
  });
});

describe("exported CC predicates", () => {
  it("match the view flags", () => {
    apply("root");
    apply("silence");
    const u = engine.unit("p1")!;
    expect(isRooted(engine, u)).toBe(true);
    expect(isSilenced(engine, u)).toBe(true);
    expect(isStunned(engine, u)).toBe(false);
  });
});

describe("tick clock clamp", () => {
  it("never rewinds internal time on a past now", () => {
    apply("dot"); // ticks at 1000/2000/3000 for 10 each
    engine.tick(1000);
    engine.tick(2000);
    const stale = engine.tick(500); // clamped to 2000 → no rewind, no extra tick
    expect(stale.filter((e) => e.t === "damaged").length).toBe(0);
    engine.tick(3000); // final tick still lands
    expect(engine.getUnit("p1")!.hp).toBe(970); // exactly 3 ticks of 10
    expect(engine.unit("p1")!.buffs.some((b) => b.buffId === "dot")).toBe(false);
  });

  it("intent entry points also cannot rewind the clock", () => {
    engine.tick(3000);
    engine.stopCast("p1", 500); // past now via an intent method
    expect(engine.serialize().nowMs).toBe(3000);
    engine.resurrect("p1", { hpPct: 100 }, 100); // past now via another
    expect(engine.serialize().nowMs).toBe(3000);
  });
});
