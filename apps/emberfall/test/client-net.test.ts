import { describe, it, expect } from "vitest";
import {
  diffUnits,
  visualForUnit,
  unitDisplayName,
  toUnitData,
  resolveCastTarget,
  startCooldown,
  cooldownRemainingMs,
  castProgress,
  pushFloatingNumber,
  pruneFloatingNumbers,
  NO_COOLDOWNS,
  type CooldownState,
  type FloatingNumber,
} from "../client/net.js";
import { hotbarView, pct } from "../client/ui.js";
import type { EmberUnit } from "../src/rooms/ember-schema.js";

/**
 * Pure-logic coverage for the net/ui wiring: state-diff mirroring, unit presentation,
 * cast-target resolution, the cooldown tracker, the floating-number queue, and the
 * hotbar view model. None of this touches the DOM or three.js — the DOM/three-owning
 * glue (NetSession, Hud) is exercised by the 2-client WS smoke test instead.
 */

function unit(overrides: Partial<EmberUnit> = {}): EmberUnit {
  return {
    x: 10,
    y: 20,
    facing: 0,
    hp: 80,
    maxHp: 100,
    mp: 30,
    maxMp: 50,
    level: 3,
    class: "warrior",
    kind: "player",
    alive: true,
    cast: "",
    castEnd: 0,
    ...overrides,
  };
}

describe("diffUnits", () => {
  it("reports newly-seen ids as spawn and dropped ids as remove", () => {
    const known = new Set(["a", "b"]);
    const diff = diffUnits(known, { b: unit(), c: unit() });
    expect(diff.spawn).toEqual(["c"]);
    expect(diff.remove).toEqual(["a"]);
  });

  it("reports nothing when the id set is unchanged", () => {
    const known = new Set(["a"]);
    const diff = diffUnits(known, { a: unit() });
    expect(diff.spawn).toEqual([]);
    expect(diff.remove).toEqual([]);
  });

  it("handles an empty next state (everyone removed)", () => {
    const known = new Set(["a", "b"]);
    const diff = diffUnits(known, {});
    expect(diff.spawn).toEqual([]);
    expect(diff.remove.sort()).toEqual(["a", "b"]);
  });
});

describe("visualForUnit", () => {
  it("maps a player to its class's manifest id", () => {
    expect(visualForUnit({ kind: "player", class: "mage" })).toBe("unit.mage");
    expect(visualForUnit({ kind: "player", class: "cleric" })).toBe("unit.cleric");
  });

  it("falls back to warrior art for a player with no class yet", () => {
    expect(visualForUnit({ kind: "player", class: "none" })).toBe("unit.warrior");
  });

  it("maps known NPC species to their manifest id, including the goblin_scout -> unit.goblin alias", () => {
    expect(visualForUnit({ kind: "goblin_scout", class: "none" })).toBe("unit.goblin");
    expect(visualForUnit({ kind: "wolf", class: "none" })).toBe("unit.wolf");
    expect(visualForUnit({ kind: "boss_chief", class: "none" })).toBe("unit.boss_chief");
  });
});

describe("unitDisplayName", () => {
  it("labels the local player \"You\"", () => {
    expect(unitDisplayName("p1", { kind: "player", class: "warrior" }, "p1")).toBe("You");
  });

  it("labels another player by their class", () => {
    expect(unitDisplayName("p2", { kind: "player", class: "cleric" }, "p1")).toBe("Cleric");
  });

  it("labels an unclassed other player generically", () => {
    expect(unitDisplayName("p2", { kind: "player", class: "none" }, "p1")).toBe("Player");
  });

  it("labels an NPC from the content pack's name", () => {
    expect(unitDisplayName("wolf-pack-west#0", { kind: "wolf", class: "none" }, "p1")).toBe("Ashen Wolf");
  });
});

describe("toUnitData", () => {
  it("maps raw state fields 1:1 when no eased position is given", () => {
    const u = unit({ x: 5, y: 6, facing: 1.2, hp: 40, maxHp: 100, alive: true });
    const data = toUnitData("p1", u, "p1");
    expect(data).toEqual({
      id: "p1",
      kind: "player",
      visual: "unit.warrior",
      x: 5,
      y: 6,
      facing: 1.2,
      hp: 40,
      maxHp: 100,
      name: "You",
      dead: false,
    });
  });

  it("overrides position/facing with an eased sample when given", () => {
    const u = unit({ x: 5, y: 6, facing: 0 });
    const data = toUnitData("wolf-a", u, "p1", { x: 5.5, y: 6.2, angle: 0.3 });
    expect(data.x).toBe(5.5);
    expect(data.y).toBe(6.2);
    expect(data.facing).toBe(0.3);
  });

  it("flips dead to true when the unit is not alive", () => {
    const data = toUnitData("p1", unit({ alive: false }), "p1");
    expect(data.dead).toBe(true);
  });
});

describe("resolveCastTarget", () => {
  const units: Record<string, EmberUnit> = {
    me: unit({ x: 1, y: 1 }),
    foe: unit({ x: 8, y: 9, kind: "wolf", class: "none" }),
  };

  it("returns undefined for a self-targeted skill regardless of the current target", () => {
    expect(resolveCastTarget("warrior-warcry", "foe", "me", units)).toBeUndefined();
  });

  it("returns a unitId target for a hostile skill with a target selected", () => {
    expect(resolveCastTarget("warrior-strike", "foe", "me", units)).toEqual({ unitId: "foe" });
  });

  it("returns undefined for a hostile skill with no target selected", () => {
    expect(resolveCastTarget("warrior-strike", null, "me", units)).toBeUndefined();
  });

  it("defaults a friendly skill with no target to self", () => {
    expect(resolveCastTarget("cleric-heal", null, "me", units)).toEqual({ unitId: "me" });
  });

  it("aims a point skill at the selected target's position", () => {
    expect(resolveCastTarget("mage-flame-pillar", "foe", "me", units)).toEqual({ pos: { x: 8, y: 9 } });
  });

  it("aims a point skill at the caster's own feet when nothing is targeted", () => {
    expect(resolveCastTarget("mage-blink", null, "me", units)).toEqual({ pos: { x: 1, y: 1 } });
  });
});

describe("cooldown tracker (startCooldown / cooldownRemainingMs)", () => {
  it("starts with nothing on cooldown", () => {
    expect(cooldownRemainingMs(NO_COOLDOWNS, "warrior-strike", 0)).toBe(0);
  });

  it("tracks a full cooldown window from the start time", () => {
    const s = startCooldown(NO_COOLDOWNS, "warrior-strike", 1000, 2500);
    expect(cooldownRemainingMs(s, "warrior-strike", 1000)).toBe(2500);
    expect(cooldownRemainingMs(s, "warrior-strike", 2000)).toBe(1500);
  });

  it("floors remaining time at 0 once the window elapses", () => {
    const s = startCooldown(NO_COOLDOWNS, "warrior-strike", 1000, 2500);
    expect(cooldownRemainingMs(s, "warrior-strike", 10000)).toBe(0);
  });

  it("is a no-op for a non-positive cooldown", () => {
    expect(startCooldown(NO_COOLDOWNS, "melee-basic", 0, 0)).toBe(NO_COOLDOWNS);
  });

  it("does not restart an already-ticking cooldown (skillStarted then skillFired for the same cast)", () => {
    const started: CooldownState = startCooldown(NO_COOLDOWNS, "mage-fireball", 1000, 20000);
    const fired = startCooldown(started, "mage-fireball", 2500, 20000); // castTimeMs later, same skill
    expect(cooldownRemainingMs(fired, "mage-fireball", 2500)).toBe(cooldownRemainingMs(started, "mage-fireball", 2500));
  });

  it("starts fresh once a prior cooldown has fully expired", () => {
    const s1 = startCooldown(NO_COOLDOWNS, "warrior-strike", 0, 1000);
    const s2 = startCooldown(s1, "warrior-strike", 5000, 1000);
    expect(cooldownRemainingMs(s2, "warrior-strike", 5000)).toBe(1000);
  });
});

describe("castProgress", () => {
  it("reports full progress for an instant (no castTimeMs) skill", () => {
    expect(castProgress("warrior-strike", 0, 0)).toBe(1);
  });

  it("interpolates 0..1 across a skill's castTimeMs (mage-fireball: 1500ms)", () => {
    expect(castProgress("mage-fireball", 1000, 1000)).toBe(0);
    expect(castProgress("mage-fireball", 1000, 1750)).toBeCloseTo(0.5, 5);
    expect(castProgress("mage-fireball", 1000, 3000)).toBe(1);
  });

  it("clamps beyond the cast window instead of overshooting", () => {
    expect(castProgress("mage-fireball", 1000, 999999)).toBe(1);
  });
});

describe("floating-number queue (pushFloatingNumber / pruneFloatingNumbers)", () => {
  it("assigns sequential ids and grows the queue immutably", () => {
    const r1 = pushFloatingNumber([], 1, { unitId: "foe", text: "-12", kind: "damage", bornMs: 0 });
    expect(r1.queue).toHaveLength(1);
    expect(r1.queue[0]).toEqual({ id: 1, unitId: "foe", text: "-12", kind: "damage", bornMs: 0 });
    expect(r1.nextId).toBe(2);

    const r2 = pushFloatingNumber(r1.queue, r1.nextId, { unitId: "me", text: "+40", kind: "heal", bornMs: 10 });
    expect(r2.queue).toHaveLength(2);
    expect(r1.queue).toHaveLength(1); // original untouched
  });

  it("prunes entries older than maxAgeMs and keeps the rest", () => {
    const queue: FloatingNumber[] = [
      { id: 1, unitId: "foe", text: "-1", kind: "damage", bornMs: 0 },
      { id: 2, unitId: "foe", text: "-2", kind: "damage", bornMs: 900 },
    ];
    const pruned = pruneFloatingNumbers(queue, 1000, 500);
    expect(pruned.map((f) => f.id)).toEqual([2]);
  });
});

describe("pct", () => {
  it("clamps to [0,1] and treats a non-positive max as 0", () => {
    expect(pct(50, 100)).toBe(0.5);
    expect(pct(150, 100)).toBe(1);
    expect(pct(-10, 100)).toBe(0);
    expect(pct(10, 0)).toBe(0);
  });
});

describe("hotbarView", () => {
  it("marks only level-appropriate skills unlocked, in fixed slot order", () => {
    const view = hotbarView("warrior", 5, NO_COOLDOWNS, 0);
    expect(view.map((s) => s.slot)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(view.map((s) => s.unlocked)).toEqual([true, true, true, false, false, false]);
  });

  it("reports 0 cooldownPct when nothing is on cooldown", () => {
    const view = hotbarView("mage", 14, NO_COOLDOWNS, 0);
    expect(view.every((s) => s.cooldownPct === 0)).toBe(true);
  });

  it("reports a fractional cooldownPct mid-sweep", () => {
    // mage-fireball has no cooldownMs (it's cast-time gated), so use a skill that has one.
    const cooldowns = startCooldown(NO_COOLDOWNS, "mage-frost-nova", 0, 10000); // 10s cooldown
    const view = hotbarView("mage", 14, cooldowns, 5000); // halfway through
    const slot = view.find((s) => s.skillId === "mage-frost-nova")!;
    expect(slot.cooldownPct).toBeCloseTo(0.5, 5);
  });
});
