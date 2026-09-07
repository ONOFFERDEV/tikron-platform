import { describe, it, expect } from "vitest";
import { validateContent } from "@tikron/rpg";
import { EMBERFALL_CONTENT } from "../src/content/emberfall-content.js";
import { CLASS_HOTBAR, CLASS_STATS, CLASS_WEAPON, SKILL_UNLOCKS, isSkillUnlocked } from "../src/content/hotbar.js";
import { ASHEN_FIELDS } from "../src/zones/ashen-fields.js";
import { LOOT_TABLES } from "../src/systems/loot.js";
import { ITEMS } from "../src/content/items.js";

const CLASSES = ["warrior", "mage", "cleric"] as const;
const UNLOCK_LEVELS = [1, 3, 5, 8, 11, 14];
const FIELD_NPC_IDS = ["wolf", "goblin_scout", "goblin_thrower", "boar", "goblin_shaman", "boss_chief"];
// M3 Ember Depths roster — these ids are a cross-agent contract (zone camps + room scripts
// reference them by exactly these strings). Do not rename without updating those callers.
const DUNGEON_NPC_IDS = ["skeleton_warrior", "skeleton_archer", "wraith", "golem", "wraith_commander", "ember_lord"];

describe("emberfall-content — validateContent", () => {
  it("has no dangling skill/buff/npc/weapon references", () => {
    expect(() => validateContent(EMBERFALL_CONTENT)).not.toThrow();
  });

  it("defines the 6 field species + boss and the 6 M3 dungeon mobs (12 total)", () => {
    const ids = EMBERFALL_CONTENT.npcs.map((n) => n.id).sort();
    expect(ids).toEqual([...FIELD_NPC_IDS, ...DUNGEON_NPC_IDS].sort());
  });

  it("gives every class weapon a matching WeaponDef", () => {
    const weaponIds = new Set((EMBERFALL_CONTENT.weapons ?? []).map((w) => w.id));
    for (const cls of CLASSES) expect(weaponIds.has(CLASS_WEAPON[cls])).toBe(true);
  });

  it("defines a 1..15 level curve", () => {
    const curve = EMBERFALL_CONTENT.levelCurve!;
    expect(curve.length).toBeGreaterThanOrEqual(16); // index 0..15
    expect(curve[1]).toBe(0);
    for (let l = 2; l <= 15; l++) expect(curve[l]!).toBeGreaterThan(curve[l - 1]!);
  });
});

describe("emberfall-content — M3 dungeon roster", () => {
  const npcById = new Map(EMBERFALL_CONTENT.npcs.map((n) => [n.id, n]));

  it("every dungeon mob has a positive level/exp and only positive stat overrides", () => {
    for (const id of DUNGEON_NPC_IDS) {
      const npc = npcById.get(id)!;
      expect(npc, id).toBeDefined();
      expect(npc.level, id).toBeGreaterThan(0);
      expect(npc.expMultiplier ?? 1, id).toBeGreaterThan(0);
      for (const [k, v] of Object.entries(npc.stats ?? {})) {
        expect(v, `${id}.${k}`).toBeGreaterThan(0);
      }
    }
  });

  it("every dungeon mob has a loot table whose item ids all resolve in ITEMS", () => {
    for (const id of DUNGEON_NPC_IDS) {
      const table = LOOT_TABLES[id];
      expect(table, `loot table for ${id}`).toBeDefined();
      const ids = [
        ...table!.drops.map((d) => d.defId),
        ...(table!.guaranteedRare ?? []),
        ...(table!.epicPool ?? []),
      ];
      for (const defId of ids) expect(ITEMS[defId], `${id}: ${defId}`).toBeDefined();
    }
  });

  it("the Stone Guardian is a physical wall: its armor is >= 3x a dungeon trash mob's", () => {
    const golemArmor = npcById.get("golem")!.stats!.armor!;
    const trashArmor = npcById.get("skeleton_warrior")!.stats!.armor!;
    expect(golemArmor).toBeGreaterThanOrEqual(trashArmor * 3);
  });

  it("ember-lord-eruption is defined but left OFF ember_lord's skill list (room-script fires it)", () => {
    const skillIds = new Set(EMBERFALL_CONTENT.skills.map((s) => s.id));
    expect(skillIds.has("ember-lord-eruption")).toBe(true);
    const lordSkills = (npcById.get("ember_lord")!.skills ?? []).map((s) => s.skillId);
    expect(lordSkills).not.toContain("ember-lord-eruption");
    // The hp-phase enrage buff must stay reusable by the room script.
    expect(EMBERFALL_CONTENT.buffs.some((b) => b.id === "boss-chief-enrage-buff")).toBe(true);
  });

  it("the wraith carries a move-speed slow debuff", () => {
    const slow = EMBERFALL_CONTENT.buffs.find((b) => b.id === "wraith-slow");
    expect(slow?.kind).toBe("bad");
    expect(slow?.modifiers?.some((m) => m.stat === "moveSpeedMul" && m.value < 0)).toBe(true);
  });
});

describe("hotbar — SKILL_UNLOCKS / CLASS_HOTBAR consistency", () => {
  it("gives every class exactly 6 skills at unlock levels 1/3/5/8/11/14", () => {
    for (const cls of CLASSES) {
      const slots = CLASS_HOTBAR[cls];
      expect(slots).toHaveLength(6);
      expect(slots.map((s) => s.slot)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(slots.map((s) => s.unlockLevel)).toEqual(UNLOCK_LEVELS);
    }
  });

  it("every hotbar skill id exists in the content pack and carries a class prefix", () => {
    const skillIds = new Set(EMBERFALL_CONTENT.skills.map((s) => s.id));
    for (const cls of CLASSES) {
      for (const slot of CLASS_HOTBAR[cls]) {
        expect(skillIds.has(slot.skillId)).toBe(true);
        expect(slot.skillId.startsWith(`${cls}-`)).toBe(true);
      }
    }
  });

  it("SKILL_UNLOCKS has exactly the 18 hotbar skill ids, each level matching its slot", () => {
    const fromHotbar = new Map<string, number>();
    for (const cls of CLASSES) for (const s of CLASS_HOTBAR[cls]) fromHotbar.set(s.skillId, s.unlockLevel);
    expect(Object.keys(SKILL_UNLOCKS).sort()).toEqual([...fromHotbar.keys()].sort());
    for (const [id, level] of fromHotbar) expect(SKILL_UNLOCKS[id]).toBe(level);
  });

  it("isSkillUnlocked gates by class ownership and level", () => {
    expect(isSkillUnlocked("warrior", 1, "warrior-strike")).toBe(true);
    expect(isSkillUnlocked("warrior", 2, "warrior-charge")).toBe(false); // unlocks at 3
    expect(isSkillUnlocked("warrior", 3, "warrior-charge")).toBe(true);
    expect(isSkillUnlocked("mage", 20, "warrior-strike")).toBe(false); // wrong class
    expect(isSkillUnlocked("cleric", 14, "cleric-resurrection")).toBe(true);
  });

  it("every class has a starting primary-stat spread", () => {
    for (const cls of CLASSES) {
      const stats = CLASS_STATS[cls];
      for (const key of ["str", "dex", "sta", "int", "spi"]) expect(stats[key]).toBeGreaterThan(0);
    }
  });
});

describe("zones/ashen-fields — data sanity", () => {
  it("is 200x200 with 6 mob camps referencing valid field NpcDef ids", () => {
    expect(ASHEN_FIELDS.width).toBe(200);
    expect(ASHEN_FIELDS.height).toBe(200);
    expect(ASHEN_FIELDS.mobCamps).toHaveLength(6);
    const npcIds = new Set(EMBERFALL_CONTENT.npcs.map((n) => n.id));
    for (const camp of ASHEN_FIELDS.mobCamps) {
      expect(npcIds.has(camp.npcDefId)).toBe(true);
      expect(camp.count).toBeGreaterThan(0);
    }
  });

  it("has a field boss spawn referencing a valid NpcDef with a multi-minute respawn", () => {
    expect(ASHEN_FIELDS.fieldBoss).toBeDefined();
    const boss = ASHEN_FIELDS.fieldBoss!;
    expect(EMBERFALL_CONTENT.npcs.some((n) => n.id === boss.npcDefId)).toBe(true);
    expect(boss.respawnMs).toBeGreaterThanOrEqual(120000);
  });

  it("keeps every obstacle and spawn point within the zone bounds", () => {
    for (const o of ASHEN_FIELDS.obstacles) {
      expect(o.x).toBeGreaterThanOrEqual(0);
      expect(o.x).toBeLessThanOrEqual(ASHEN_FIELDS.width);
      expect(o.y).toBeGreaterThanOrEqual(0);
      expect(o.y).toBeLessThanOrEqual(ASHEN_FIELDS.height);
    }
    expect(ASHEN_FIELDS.playerSpawn.x).toBeGreaterThanOrEqual(0);
    expect(ASHEN_FIELDS.playerSpawn.x).toBeLessThanOrEqual(ASHEN_FIELDS.width);
  });
});
