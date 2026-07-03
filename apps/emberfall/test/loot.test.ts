import { describe, it, expect } from "vitest";
import { makeRng } from "@tikron/rpg";
import { LOOT_TABLES, rollLoot } from "../src/systems/loot.js";
import { ITEMS } from "../src/content/items.js";

/** `systems/loot.ts` coverage (PLAN-EMBERFALL-M2 §8): seeded determinism, boss
 *  guaranteed-rare/epic-chance behavior, and content integrity of the loot tables. */

describe("loot — rollLoot determinism", () => {
  it("the same seed produces the exact same roll every time", () => {
    const a = rollLoot("wolf", makeRng(1234).next);
    const b = rollLoot("wolf", makeRng(1234).next);
    expect(b).toEqual(a);
  });

  it("different seeds can produce different rolls (sanity: not a constant)", () => {
    const rolls = Array.from({ length: 20 }, (_, i) => rollLoot("goblin_shaman", makeRng(i).next));
    const distinct = new Set(rolls.map((r) => JSON.stringify(r)));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it("gold is always within the table's [min, max] range", () => {
    for (let seed = 0; seed < 30; seed++) {
      const roll = rollLoot("boar", makeRng(seed).next);
      const [min, max] = LOOT_TABLES.boar!.gold;
      expect(roll.gold).toBeGreaterThanOrEqual(min);
      expect(roll.gold).toBeLessThanOrEqual(max);
    }
  });

  it("an npcDefId with no table rolls an empty result, not a throw", () => {
    expect(rollLoot("not-a-real-npc", makeRng(1).next)).toEqual({ gold: 0, items: [] });
  });
});

describe("loot — boss_chief guaranteed rare + epic chance", () => {
  it("always includes exactly one item from the guaranteed-rare pool", () => {
    for (let seed = 0; seed < 15; seed++) {
      const roll = rollLoot("boss_chief", makeRng(seed).next);
      const rareHits = roll.items.filter((it) => LOOT_TABLES.boss_chief!.guaranteedRare!.includes(it.defId));
      expect(rareHits.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("sometimes (not always, not never) includes an epic-pool item across many seeds", () => {
    let epicCount = 0;
    const trials = 60;
    for (let seed = 0; seed < trials; seed++) {
      const roll = rollLoot("boss_chief", makeRng(seed).next);
      if (roll.items.some((it) => LOOT_TABLES.boss_chief!.epicPool!.includes(it.defId))) epicCount++;
    }
    expect(epicCount).toBeGreaterThan(0);
    expect(epicCount).toBeLessThan(trials);
  });
});

describe("loot — content integrity", () => {
  it("every loot table drop/guaranteedRare/epicPool defId resolves in ITEMS", () => {
    for (const [npcId, table] of Object.entries(LOOT_TABLES)) {
      for (const drop of table.drops) {
        expect(ITEMS[drop.defId], `${npcId}: drop ${drop.defId}`).toBeDefined();
      }
      for (const defId of table.guaranteedRare ?? []) {
        expect(ITEMS[defId], `${npcId}: guaranteedRare ${defId}`).toBeDefined();
      }
      for (const defId of table.epicPool ?? []) {
        expect(ITEMS[defId], `${npcId}: epicPool ${defId}`).toBeDefined();
      }
    }
  });
});
