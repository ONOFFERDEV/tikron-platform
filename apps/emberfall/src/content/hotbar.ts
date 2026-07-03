/**
 * Per-class hotbar layout — skill id ↔ slot (1-6) ↔ unlock level, plus the class's
 * starting weapon/stat spread. Pure data, zero imports: the client bundles this file
 * directly (main menu class picker, hotbar UI, unlock toasts) without pulling in any
 * server code. The room (ember-rooms.ts) imports it too, for cast-payload validation
 * and to spawn a class's `RpgEngine` unit — so this is the single source both sides
 * read, matching PLAN-EMBERFALL §3's "Sonnet 에이전트 계약 드리프트" contract-first rule.
 *
 * Skill/buff ids are kebab-case with a class or species prefix (e.g. `warrior-strike`,
 * `goblin-chief-cleave`) so the two never collide across `emberfall-content.ts`.
 */

export type EmberClass = "warrior" | "mage" | "cleric";

export interface HotbarSlot {
  slot: 1 | 2 | 3 | 4 | 5 | 6;
  skillId: string;
  unlockLevel: number;
}

/** Every class skill's unlock level (1/3/5/8/11/14 per PLAN §2.2), keyed by skill id. */
export const SKILL_UNLOCKS: Readonly<Record<string, number>> = {
  "warrior-strike": 1,
  "warrior-charge": 3,
  "warrior-warcry": 5,
  "warrior-taunt": 8,
  "warrior-whirlwind": 11,
  "warrior-shield-wall": 14,

  "mage-fireball": 1,
  "mage-frost-nova": 3,
  "mage-blink": 5,
  "mage-flame-pillar": 8,
  "mage-mana-shield": 11,
  "mage-meteor": 14,

  "cleric-heal": 1,
  "cleric-regeneration": 3,
  "cleric-purify": 5,
  "cleric-holy-strike": 8,
  "cleric-blessing": 11,
  "cleric-resurrection": 14,
};

/** Fixed hotbar slot 1-6 per class, in unlock order. */
export const CLASS_HOTBAR: Readonly<Record<EmberClass, readonly HotbarSlot[]>> = {
  warrior: [
    { slot: 1, skillId: "warrior-strike", unlockLevel: 1 },
    { slot: 2, skillId: "warrior-charge", unlockLevel: 3 },
    { slot: 3, skillId: "warrior-warcry", unlockLevel: 5 },
    { slot: 4, skillId: "warrior-taunt", unlockLevel: 8 },
    { slot: 5, skillId: "warrior-whirlwind", unlockLevel: 11 },
    { slot: 6, skillId: "warrior-shield-wall", unlockLevel: 14 },
  ],
  mage: [
    { slot: 1, skillId: "mage-fireball", unlockLevel: 1 },
    { slot: 2, skillId: "mage-frost-nova", unlockLevel: 3 },
    { slot: 3, skillId: "mage-blink", unlockLevel: 5 },
    { slot: 4, skillId: "mage-flame-pillar", unlockLevel: 8 },
    { slot: 5, skillId: "mage-mana-shield", unlockLevel: 11 },
    { slot: 6, skillId: "mage-meteor", unlockLevel: 14 },
  ],
  cleric: [
    { slot: 1, skillId: "cleric-heal", unlockLevel: 1 },
    { slot: 2, skillId: "cleric-regeneration", unlockLevel: 3 },
    { slot: 3, skillId: "cleric-purify", unlockLevel: 5 },
    { slot: 4, skillId: "cleric-holy-strike", unlockLevel: 8 },
    { slot: 5, skillId: "cleric-blessing", unlockLevel: 11 },
    { slot: 6, skillId: "cleric-resurrection", unlockLevel: 14 },
  ],
};

/** Starting weapon id per class (matches a `WeaponDef` in `emberfall-content.ts`). */
export const CLASS_WEAPON: Readonly<Record<EmberClass, string>> = {
  warrior: "warrior-sword",
  mage: "mage-focus",
  cleric: "cleric-mace",
};

/** Starting primary-stat spread per class (fed to `RpgEngine.spawnPlayer`'s `stats`). */
export const CLASS_STATS: Readonly<Record<EmberClass, Record<string, number>>> = {
  warrior: { str: 16, dex: 10, sta: 18, int: 6, spi: 8 },
  mage: { str: 6, dex: 10, sta: 10, int: 18, spi: 10 },
  cleric: { str: 8, dex: 8, sta: 12, int: 10, spi: 18 },
};

/** Is `skillId` on `cls`'s hotbar and unlocked at `level`? Used to gate the `cast` intent. */
export function isSkillUnlocked(cls: EmberClass, level: number, skillId: string): boolean {
  const unlockLevel = SKILL_UNLOCKS[skillId];
  if (unlockLevel === undefined || level < unlockLevel) return false;
  return CLASS_HOTBAR[cls].some((s) => s.skillId === skillId);
}
