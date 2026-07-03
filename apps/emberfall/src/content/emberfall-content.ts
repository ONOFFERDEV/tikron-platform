/**
 * Emberfall M1 content pack — the field portion of PLAN-EMBERFALL §2.2/§2.3: 3 classes
 * (18 skills, unlock levels 1/3/5/8/11/14 — see `hotbar.ts` for the per-class layout),
 * their weapons, and the 6 Ashen Fields monster species + the field boss. Dungeon mobs
 * and the final boss (잉걸불 군주) are M3 — omitted here by design.
 *
 * Every skill/buff id is kebab-case with a class or species prefix so the two families
 * never collide. `validateContent(EMBERFALL_CONTENT)` must pass (asserted in
 * `test/content.test.ts`) — every buff/skill/npc/weapon reference below must resolve.
 */

import { defaultLevelCurve, type ContentPack } from "@tikron/rpg";

export const EMBERFALL_CONTENT: ContentPack = {
  levelCurve: defaultLevelCurve(15),

  weapons: [
    // Player weapons.
    { id: "warrior-sword", kind: "melee", dps: 22, speedMs: 1500, damageScalePct: 25, maxRange: 4 },
    { id: "mage-focus", kind: "melee", dps: 10, speedMs: 1800, damageScalePct: 25, maxRange: 4 },
    { id: "cleric-mace", kind: "melee", dps: 14, speedMs: 1700, damageScalePct: 25, maxRange: 4 },
    // Monster weapons.
    { id: "wolf-fang", kind: "melee", dps: 10, speedMs: 1400, maxRange: 3 },
    { id: "goblin-shiv", kind: "melee", dps: 12, speedMs: 1200, maxRange: 3 },
    { id: "goblin-javelin", kind: "ranged", dps: 14, speedMs: 1900, minRange: 0, maxRange: 16 },
    { id: "boar-tusk", kind: "melee", dps: 16, speedMs: 1600, maxRange: 3.5 },
    { id: "shaman-staff", kind: "melee", dps: 6, speedMs: 2000, maxRange: 4 },
    { id: "chief-axe", kind: "melee", dps: 26, speedMs: 1500, maxRange: 5 },
  ],

  buffs: [
    // --- Warrior ---
    {
      id: "warrior-slow",
      name: "Hamstrung",
      kind: "bad",
      durationMs: 3000,
      tags: ["slow"],
      modifiers: [{ stat: "moveSpeedMul", kind: "percent", value: -40 }],
    },
    {
      id: "warrior-warcry-buff",
      name: "Battle Shout",
      kind: "good",
      modifiers: [
        { stat: "meleeDamageMul", kind: "percent", value: 20 },
        { stat: "moveSpeedMul", kind: "percent", value: 10 },
      ],
    },
    {
      id: "warrior-shield-wall-buff",
      name: "Shield Wall",
      kind: "good",
      durationMs: 10000,
      shield: { amount: 150 },
      modifiers: [{ stat: "incomingDamageMul", kind: "percent", value: -30 }],
    },

    // --- Mage ---
    {
      id: "mage-ignite",
      name: "Ignite",
      kind: "bad",
      durationMs: 4000,
      tags: ["magic-dot"],
      tick: { intervalMs: 1000, effects: [{ kind: "damage", school: "spell", fixed: { min: 10, max: 10 } }] },
    },
    {
      id: "mage-frost-root",
      name: "Frozen",
      kind: "bad",
      durationMs: 2500,
      cc: { root: true },
      tags: ["root"],
    },
    {
      id: "mage-mana-shield-buff",
      name: "Mana Shield",
      kind: "good",
      manaShieldRatio: 50,
    },

    // --- Cleric ---
    {
      id: "cleric-regen-buff",
      name: "Regeneration",
      kind: "good",
      durationMs: 8000,
      tick: { intervalMs: 2000, effects: [{ kind: "heal", flat: 18 }] },
    },
    {
      id: "cleric-blessing-buff",
      name: "Blessing",
      kind: "good",
      durationMs: 20000,
      modifiers: [
        { stat: "meleeDamageMul", kind: "percent", value: 10 },
        { stat: "spellDamageMul", kind: "percent", value: 10 },
        { stat: "maxHp", kind: "flat", value: 60 },
      ],
    },

    // --- Monsters ---
    {
      id: "boss-chief-enrage-buff",
      name: "Enrage",
      kind: "good",
      modifiers: [{ stat: "meleeDamageMul", kind: "percent", value: 60 }],
    },
  ],

  skills: [
    // --- Shared auto-attacks / NPC fallback ---
    {
      id: "melee-basic",
      name: "Melee Attack",
      school: "melee",
      autoAttack: true,
      requiresWeapon: "melee",
      gcd: "none",
      targetType: "hostile",
      maxRange: 4,
      effects: [{ effect: { kind: "damage", school: "melee", useWeapon: true } }],
    },
    {
      id: "monster-bite",
      name: "Bite",
      school: "melee",
      targetType: "hostile",
      gcd: "none",
      maxRange: 4,
      effects: [{ effect: { kind: "damage", school: "melee", useWeapon: true, multiplier: 1 } }],
    },

    // --- Warrior (unlock 1/3/5/8/11/14) ---
    {
      id: "warrior-strike",
      name: "Strike",
      school: "melee",
      cooldownMs: 2500,
      targetType: "hostile",
      maxRange: 4,
      threatBonus: 30,
      effects: [{ effect: { kind: "damage", school: "melee", useWeapon: true, multiplier: 1.4, flat: 8 } }],
    },
    {
      id: "warrior-charge",
      name: "Charge",
      school: "melee",
      cooldownMs: 9000,
      targetType: "hostile",
      minRange: 5,
      maxRange: 20,
      effects: [
        { effect: { kind: "blink", distance: 20 } },
        { effect: { kind: "damage", school: "melee", useWeapon: true, flat: 15 } },
        { effect: { kind: "buff", buffId: "warrior-slow" }, relation: "hostile" },
      ],
    },
    {
      id: "warrior-warcry",
      name: "War Cry",
      school: "none",
      gcd: "none",
      cooldownMs: 3000,
      targetType: "self",
      toggleBuffId: "warrior-warcry-buff",
      effects: [],
    },
    {
      id: "warrior-taunt",
      name: "Taunt",
      school: "none",
      gcd: "none",
      cooldownMs: 7000,
      targetType: "hostile",
      maxRange: 20,
      effects: [{ effect: { kind: "aggro", flat: 4000 } }],
    },
    {
      id: "warrior-whirlwind",
      name: "Whirlwind",
      school: "melee",
      cooldownMs: 6000,
      targetType: "self",
      aoe: { shape: "circle", radius: 6, anchor: "caster", relation: "hostile", maxTargets: 6 },
      effects: [{ effect: { kind: "damage", school: "melee", useWeapon: true, multiplier: 1.1 } }],
    },
    {
      id: "warrior-shield-wall",
      name: "Shield Wall",
      school: "none",
      gcd: "none",
      cooldownMs: 20000,
      targetType: "self",
      effects: [{ effect: { kind: "buff", buffId: "warrior-shield-wall-buff" }, applyTo: "caster" }],
    },

    // --- Mage (unlock 1/3/5/8/11/14) ---
    {
      id: "mage-fireball",
      name: "Fireball",
      school: "spell",
      manaCost: 20,
      castTimeMs: 1500,
      projectileSpeed: 15,
      targetType: "hostile",
      maxRange: 25,
      effects: [
        { effect: { kind: "damage", school: "spell", useLevelDamage: true, multiplier: 1, flat: 30 } },
        { effect: { kind: "buff", buffId: "mage-ignite" }, relation: "hostile" },
      ],
    },
    {
      id: "mage-frost-nova",
      name: "Frost Nova",
      school: "spell",
      manaCost: 15,
      cooldownMs: 10000,
      targetType: "self",
      aoe: { shape: "circle", radius: 6, anchor: "caster", relation: "hostile", maxTargets: 8 },
      effects: [
        { effect: { kind: "damage", school: "spell", flat: 20 } },
        { effect: { kind: "buff", buffId: "mage-frost-root" }, relation: "hostile" },
      ],
    },
    {
      id: "mage-blink",
      name: "Blink",
      school: "none",
      gcd: "none",
      cooldownMs: 12000,
      // targetType "point" lets the player click anywhere on screen; the cast's own
      // maxRange is deliberately generous (a click isn't a "cast range" in the usual
      // sense) — the blink EFFECT's `distance` below is what actually caps travel.
      targetType: "point",
      maxRange: 200,
      effects: [{ effect: { kind: "blink", distance: 15 } }],
    },
    {
      id: "mage-flame-pillar",
      name: "Flame Pillar",
      school: "spell",
      manaCost: 25,
      castTimeMs: 1200,
      cooldownMs: 8000,
      targetType: "point",
      maxRange: 25,
      aoe: { shape: "circle", radius: 5, anchor: "target", relation: "hostile", maxTargets: 8 },
      effects: [{ effect: { kind: "damage", school: "spell", useLevelDamage: true, multiplier: 1.2 } }],
    },
    {
      id: "mage-mana-shield",
      name: "Mana Shield",
      school: "none",
      gcd: "none",
      cooldownMs: 15000,
      targetType: "self",
      toggleBuffId: "mage-mana-shield-buff",
      effects: [],
    },
    {
      id: "mage-meteor",
      name: "Meteor",
      school: "spell",
      manaCost: 35,
      castTimeMs: 3000,
      cooldownMs: 15000,
      targetType: "hostile",
      maxRange: 25,
      effects: [{ effect: { kind: "damage", school: "spell", useLevelDamage: true, multiplier: 2.2 } }],
    },

    // --- Cleric (unlock 1/3/5/8/11/14) ---
    {
      id: "cleric-heal",
      name: "Heal",
      school: "heal",
      manaCost: 20,
      castTimeMs: 1800,
      targetType: "friendly",
      maxRange: 20,
      effects: [{ effect: { kind: "heal", multiplier: 1, flat: 40 } }],
    },
    {
      id: "cleric-regeneration",
      name: "Regeneration",
      school: "heal",
      manaCost: 12,
      cooldownMs: 4000,
      targetType: "friendly",
      maxRange: 20,
      effects: [{ effect: { kind: "buff", buffId: "cleric-regen-buff" } }],
    },
    {
      id: "cleric-purify",
      name: "Purify",
      school: "heal",
      manaCost: 8,
      cooldownMs: 8000,
      targetType: "friendly",
      maxRange: 20,
      effects: [{ effect: { kind: "dispel", buffKind: "bad", count: 2 } }],
    },
    {
      id: "cleric-holy-strike",
      name: "Holy Strike",
      school: "melee",
      cooldownMs: 5000,
      targetType: "hostile",
      maxRange: 4,
      effects: [
        { effect: { kind: "damage", school: "melee", useWeapon: true, multiplier: 1.2 } },
        { effect: { kind: "manaBurn", flat: 15 } },
      ],
    },
    {
      id: "cleric-blessing",
      name: "Blessing",
      school: "heal",
      manaCost: 15,
      cooldownMs: 10000,
      targetType: "friendly",
      maxRange: 20,
      effects: [{ effect: { kind: "buff", buffId: "cleric-blessing-buff" } }],
    },
    {
      id: "cleric-resurrection",
      name: "Resurrection",
      school: "heal",
      manaCost: 40,
      castTimeMs: 8000,
      targetType: "friendly",
      maxRange: 15,
      // Engine has no built-in "revive" effect kind — routed through the `custom` extension
      // point (see ember-rooms.ts's `registerCustomEffect("resurrect-ally", ...)`). Targeting
      // a dead ally is legal: `resolveInitialTarget`'s "friendly" branch never checks `alive`.
      effects: [{ effect: { kind: "custom", name: "resurrect-ally" } }],
    },

    // --- Monster skills ---
    {
      id: "goblin-throw",
      name: "Javelin Throw",
      school: "ranged",
      cooldownMs: 2200,
      targetType: "hostile",
      maxRange: 16,
      projectileSpeed: 18,
      effects: [{ effect: { kind: "damage", school: "ranged", useWeapon: true, multiplier: 1.1 } }],
    },
    {
      id: "boar-charge",
      name: "Boar Charge",
      school: "melee",
      cooldownMs: 8000,
      targetType: "hostile",
      minRange: 3,
      maxRange: 10,
      effects: [
        { effect: { kind: "damage", school: "melee", useWeapon: true } },
        { effect: { kind: "knockback", distance: 6, mode: "radial" } },
      ],
    },
    {
      id: "goblin-shaman-mend",
      name: "Mend",
      school: "heal",
      manaCost: 10,
      cooldownMs: 6000,
      targetType: "self",
      aoe: { shape: "circle", radius: 12, anchor: "caster", relation: "friendly", maxTargets: 4, includeAnchor: true },
      effects: [{ effect: { kind: "heal", multiplier: 1, flat: 25 } }],
    },
    {
      id: "goblin-chief-cleave",
      name: "Chieftain's Cleave",
      school: "melee",
      cooldownMs: 4500,
      targetType: "hostile",
      maxRange: 6,
      aoe: { shape: "cone", radius: 6, angleRad: 1.3, anchor: "caster", relation: "hostile", maxTargets: 5 },
      effects: [{ effect: { kind: "damage", school: "melee", useWeapon: true, multiplier: 1.3 } }],
    },
    {
      id: "goblin-chief-enrage",
      name: "Enrage",
      school: "none",
      gcd: "none",
      cooldownMs: 999999,
      targetType: "self",
      effects: [{ effect: { kind: "buff", buffId: "boss-chief-enrage-buff" }, applyTo: "caster" }],
    },
  ],

  npcs: [
    {
      id: "wolf",
      name: "Ashen Wolf",
      level: 2,
      faction: "monsters",
      weapon: "wolf-fang",
      baseSkillId: "monster-bite",
      skills: [{ skillId: "monster-bite" }],
      expMultiplier: 1,
      radius: 0.6,
      // Pack aggro-link: any wolf within helpRadius joins when one is pulled.
      ai: { aggroRadius: 10, leashDistance: 40, hardLeashDistance: 150, helpRadius: 8, moveSpeed: 5, skillDelayMs: [1000, 1300] },
    },
    {
      id: "goblin_scout",
      name: "Goblin Scout",
      level: 3,
      faction: "monsters",
      weapon: "goblin-shiv",
      stats: { sta: 6 },
      baseSkillId: "monster-bite",
      skills: [{ skillId: "monster-bite" }],
      expMultiplier: 1,
      radius: 0.55,
      ai: { aggroRadius: 9, leashDistance: 40, hardLeashDistance: 150, moveSpeed: 7, skillDelayMs: [900, 1100] },
    },
    {
      id: "goblin_thrower",
      name: "Goblin Thrower",
      level: 4,
      faction: "monsters",
      weapon: "goblin-javelin",
      stats: { sta: 8, dex: 14 },
      baseSkillId: "goblin-throw",
      skills: [{ skillId: "goblin-throw" }],
      expMultiplier: 1,
      radius: 0.6,
      ai: { aggroRadius: 14, leashDistance: 45, hardLeashDistance: 160, moveSpeed: 4, skillDelayMs: [1400, 1700] },
    },
    {
      id: "boar",
      name: "Ashen Boar",
      level: 5,
      faction: "monsters",
      weapon: "boar-tusk",
      stats: { sta: 16, str: 14 },
      baseSkillId: "monster-bite",
      skills: [{ skillId: "boar-charge", minRange: 3, maxRange: 10, weight: 2 }],
      expMultiplier: 1,
      radius: 0.7,
      ai: { aggroRadius: 10, leashDistance: 40, hardLeashDistance: 150, moveSpeed: 6, skillDelayMs: [1300, 1600] },
    },
    {
      id: "goblin_shaman",
      name: "Goblin Shaman",
      level: 6,
      faction: "monsters",
      weapon: "shaman-staff",
      stats: { spi: 16, int: 12, sta: 8 },
      baseSkillId: "monster-bite",
      // Heal-threat validation species: `goblin-shaman-mend` is self-anchored + friendly-AoE
      // so the stock AI picker (which always aims at the current hostile target) still fires
      // it — see the extended comment on `applySkill`'s targetType "self" short-circuit.
      skills: [{ skillId: "goblin-shaman-mend", weight: 3 }],
      expMultiplier: 1,
      radius: 0.55,
      ai: { aggroRadius: 8, leashDistance: 40, hardLeashDistance: 150, helpRadius: 10, moveSpeed: 3, skillDelayMs: [1500, 1800] },
    },
    {
      id: "boss_chief",
      name: "Goblin Chieftain",
      level: 8,
      faction: "monsters",
      weapon: "chief-axe",
      stats: { sta: 40, str: 20, armor: 15 },
      baseSkillId: "monster-bite",
      skills: [
        { skillId: "goblin-chief-cleave", maxRange: 6, weight: 3 },
        { skillId: "goblin-chief-enrage", hpBelowPct: 50, weight: 1 },
      ],
      expMultiplier: 6,
      radius: 1.3,
      ai: { aggroRadius: 18, leashDistance: 70, hardLeashDistance: 250, moveSpeed: 4.5, skillDelayMs: [1400, 1600] },
    },
  ],
};
