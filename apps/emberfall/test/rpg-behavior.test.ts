import { describe, it, expect } from "vitest";
import { RpgEngine, type CombatEvent } from "@tikron/rpg";
import { EMBERFALL_CONTENT } from "../src/content/emberfall-content.js";

/**
 * Direct-engine behavior tests for a handful of Emberfall skills whose mechanics are
 * easy to get wrong (self-anchored friendly AoE, custom-effect resurrection, point-cast
 * range vs. effect distance, knockback). These bypass the room/zone/AOI stack entirely —
 * `test/field-room.test.ts` covers the room integration; this file is a fast, fully
 * deterministic proof that the content pack's skill definitions do what they say.
 */

/** Mirrors `EmberRoomBase.registerCustomEffects` (ember-rooms.ts) for the resurrection test. */
function registerResurrectAlly(engine: RpgEngine): void {
  engine.registerCustomEffect("resurrect-ally", (eng, ctx, _caster, target) => {
    const unit = target.unit;
    if (!unit || unit.alive) return;
    eng.resurrect(unit.id, { hpPct: 50, mpPct: 50 }, ctx.now);
  });
}

function newEngine(seed = 7): RpgEngine {
  const engine = new RpgEngine(EMBERFALL_CONTENT, { seed, pvpEnabled: false });
  registerResurrectAlly(engine);
  return engine;
}

describe("emberfall-content — direct engine behavior", () => {
  it("warrior-warcry toggles a permanent self buff on and off", () => {
    const engine = newEngine();
    engine.spawnPlayer({ id: "w", pos: { x: 0, y: 0 }, weapon: "warrior-sword", stats: { str: 16, sta: 18 } });

    engine.useSkill("w", "warrior-warcry", undefined, 0);
    engine.tick(0);
    expect(engine.getUnit("w")!.buffs.some((b) => b.buffId === "warrior-warcry-buff")).toBe(true);

    engine.useSkill("w", "warrior-warcry", undefined, 4000); // cooldownMs 3000 has elapsed
    engine.tick(4000);
    expect(engine.getUnit("w")!.buffs.some((b) => b.buffId === "warrior-warcry-buff")).toBe(false);
  });

  it("mage-blink moves the caster toward a clicked point, capped at the effect's distance (not the cast range)", () => {
    const engine = newEngine();
    engine.spawnPlayer({ id: "m", pos: { x: 0, y: 0 }, weapon: "mage-focus", stats: { int: 18 } });

    // Clicked 100 units away — well past the 15-unit blink distance but within the
    // skill's generous 200-unit cast range, so the cast itself must not be rejected.
    const result = engine.useSkill("m", "mage-blink", { pos: { x: 100, y: 0 } }, 0);
    expect(result).toBe("ok");
    engine.tick(0);
    const pos = engine.getUnit("m")!.pos;
    expect(pos.x).toBeCloseTo(15, 5);
    expect(pos.y).toBeCloseTo(0, 5);
  });

  it("goblin-shaman-mend heals a wounded packmate within its self-anchored friendly AoE", () => {
    const engine = newEngine();
    engine.spawnNpc("goblin_shaman", { x: 0, y: 0 }, { id: "shaman" });
    engine.spawnNpc("wolf", { x: 3, y: 0 }, { id: "ally" });
    engine.spawnPlayer({ id: "striker", pos: { x: 3, y: 1 }, weapon: "warrior-sword", stats: { str: 20 } });

    const allyMaxHp = engine.getUnit("ally")!.maxHp;
    // A single swing can miss/dodge (seeded RNG); retry with the auto-attack until one lands.
    engine.startAutoAttack("striker", "ally", 0);
    let wounded = allyMaxHp;
    for (let i = 0; i < 20 && wounded >= allyMaxHp; i++) {
      engine.tick(i * 500);
      wounded = engine.getUnit("ally")!.hp;
    }
    expect(wounded).toBeLessThan(allyMaxHp);
    engine.stopAutoAttack("striker"); // freeze the wound so the heal delta below is unambiguous

    // targetType "self" + aoe(anchor: "caster") — the picked target arg is irrelevant;
    // this is what lets the stock AI picker (which always aims at the hostile target)
    // still fire a support heal on nearby allies instead of the enemy.
    const healAt = 20 * 500 + 100;
    engine.useSkill("shaman", "goblin-shaman-mend", { unitId: "striker" }, healAt);
    const events = engine.tick(healAt);
    expect(events.some((e) => e.t === "healed" && e.target === "ally")).toBe(true);
    expect(engine.getUnit("ally")!.hp).toBeGreaterThan(wounded);
  });

  it("boar-charge damages and knocks the target back along the caster-to-target axis", () => {
    const engine = newEngine();
    engine.spawnNpc("boar", { x: 0, y: 0 }, { id: "boar" });
    engine.spawnPlayer({ id: "p", pos: { x: 3, y: 0 }, weapon: "warrior-sword", stats: { sta: 20 } });

    engine.useSkill("boar", "boar-charge", { unitId: "p" }, 0);
    const events = engine.tick(0);
    expect(events.some((e) => e.t === "damaged" && e.target === "p")).toBe(true);
    const kb = events.find((e): e is Extract<CombatEvent, { t: "knockback" }> => e.t === "knockback" && e.unit === "p");
    expect(kb).toBeDefined();
    expect(kb!.to.x).toBeCloseTo(9, 5); // pushed 6 units further along +x from (3,0)
    expect(kb!.to.y).toBeCloseTo(0, 5);
  });

  it("cleric-resurrection revives a dead ally via the resurrect-ally custom effect", () => {
    const engine = newEngine();
    engine.spawnPlayer({ id: "fallen", pos: { x: 0, y: 0 }, weapon: "warrior-sword", stats: { sta: 4 } });
    engine.spawnPlayer({ id: "healer", pos: { x: 1, y: 0 }, weapon: "cleric-mace", stats: { spi: 18, int: 10 } });
    // Directly-driven attacker (bypassing AI/aggro entirely) for a deterministic kill.
    engine.spawnNpc("boss_chief", { x: 0, y: 1 }, { id: "killer" });

    let dead = false;
    for (let i = 0; i < 40 && !dead; i++) {
      engine.useSkill("killer", "monster-bite", { unitId: "fallen" }, i * 1600);
      const events = engine.tick(i * 1600 + 1);
      dead = events.some((e) => e.t === "death" && e.unit === "fallen");
    }
    expect(dead).toBe(true);
    engine.removeUnit("killer"); // clear the threat before the resurrection cast

    const now = 40 * 1600 + 100;
    // "friendly" targetType never checks `alive` — a dead ally is a legal cast target.
    expect(engine.useSkill("healer", "cleric-resurrection", { unitId: "fallen" }, now)).toBe("ok");
    const events = engine.tick(now + 8100); // castTimeMs 8000
    expect(events.some((e) => e.t === "resurrected" && e.unit === "fallen")).toBe(true);
    expect(engine.getUnit("fallen")!.alive).toBe(true);
  });
});
