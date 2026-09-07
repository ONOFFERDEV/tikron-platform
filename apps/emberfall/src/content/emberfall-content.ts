/**
 * Emberfall M1 content pack — the field portion of PLAN-EMBERFALL §2.2/§2.3: 3 classes
 * (18 skills, unlock levels 1/3/5/8/11/14 — see `hotbar.ts` for the per-class layout),
 * their weapons, and the 6 Ashen Fields monster species + the field boss. The M3 Ember
 * Depths dungeon adds 6 more NPCs (skeleton warrior/archer, wraith, stone guardian, the
 * mini-boss Ser Valen, and the final boss The Ember Lord) — grouped under the
 * "Dungeon (M3)" blocks below. The Ember Lord's hp-phase enrage/eruption *triggers* live
 * in the room script (ember-rooms.ts); this file only defines the reusable buff/skill data.
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
    // Dungeon (M3) monster weapons. The wraith is weaponless — it attacks with `wraith-bolt`
    // (spell, `useLevelDamage`), so it needs no WeaponDef.
    // M3 balance pass (T3.2): dungeon monster weapon dps trimmed so a solo geared level-15
    // melee can facetank the long boss/golem fights on a realistic potion budget (~30-38 of a
    // 40 stack) without wiping — a melee solo can't kite, so per-second incoming damage is the
    // binding constraint. Values verified against balance-sim.test.ts + dungeon-playthrough.test.ts.
    { id: "skeleton-blade", kind: "melee", dps: 12, speedMs: 1500, maxRange: 3.5 },
    { id: "skeleton-bow", kind: "ranged", dps: 12, speedMs: 1900, minRange: 0, maxRange: 18 },
    { id: "golem-fist", kind: "melee", dps: 12, speedMs: 2200, maxRange: 4 },
    { id: "valen-blade", kind: "melee", dps: 14, speedMs: 1600, maxRange: 5 },
    { id: "ember-greataxe", kind: "melee", dps: 16, speedMs: 1700, maxRange: 5 },
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

    // --- Dungeon (M3) ---
    // Wraith slow: same `moveSpeedMul` percent modifier family as the warrior's Hamstrung,
    // slightly softer (−35%) but longer (4s) — dungeon kiting pressure, not a hard snare.
    {
      id: "wraith-slow",
      name: "Soul Chill",
      kind: "bad",
      // M3 balance: −35%/4s → −22%/2.5s. Two wraith camps re-apply this every bolt, so at −35%
      // a solo melee was near-permanently slowed through the whole wave-2/wave-3 corridor —
      // repositioning collapsed and every fight ran long. Kept as real kiting pressure, not a mire.
      durationMs: 2500,
      tags: ["slow"],
      modifiers: [{ stat: "moveSpeedMul", kind: "percent", value: -22 }],
    },
    // The Ember Lord's fire DoT — same shape as the mage's Ignite but boss-tier tick.
    {
      id: "ember-burn",
      name: "Ember Burn",
      kind: "bad",
      durationMs: 5000,
      tags: ["magic-dot"],
      // M3 balance: tick 25→10 — this DoT is re-applied by every Ember Bolt AND every eruption,
      // so its per-second contribution stacked into the largest hidden chunk of the boss's DPS.
      tick: { intervalMs: 1000, effects: [{ kind: "damage", school: "spell", fixed: { min: 10, max: 10 } }] },
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

    // --- Dungeon monster skills (M3) ---
    {
      id: "skeleton-strike",
      name: "Bone Cleaver",
      school: "melee",
      cooldownMs: 3000,
      targetType: "hostile",
      maxRange: 4,
      // M3 balance: softened (was ×1.3 +6) — wave 1 is a PAIR of these, so the combined
      // facetank pressure on a solo player was the harshest trash spike in the run.
      effects: [{ effect: { kind: "damage", school: "melee", useWeapon: true, multiplier: 1.15, flat: 3 } }],
    },
    {
      id: "skeleton-shot",
      name: "Bone Arrow",
      school: "ranged",
      cooldownMs: 2000,
      targetType: "hostile",
      maxRange: 18,
      projectileSpeed: 20,
      effects: [{ effect: { kind: "damage", school: "ranged", useWeapon: true, multiplier: 1.1 } }],
    },
    // Wraith bolt — spell damage (level-scaled, weaponless) + the slow debuff on hit.
    {
      id: "wraith-bolt",
      name: "Spectral Bolt",
      school: "spell",
      cooldownMs: 2600,
      targetType: "hostile",
      maxRange: 18,
      projectileSpeed: 14,
      effects: [
        // M3 balance: flat 10→6 — this bolt is fired by BOTH the wave-2 wraith pair and Ser
        // Valen, so its flat term was double-counted in the two heaviest gauntlet stages.
        { effect: { kind: "damage", school: "spell", useLevelDamage: true, multiplier: 1, flat: 6 } },
        { effect: { kind: "buff", buffId: "wraith-slow" }, relation: "hostile" },
      ],
    },
    // Stone Guardian's slow, heavy hit — big multiplier + a shove; the "armor wall" is the
    // NPC's own high `armor` stat, not this skill.
    {
      id: "golem-slam",
      name: "Boulder Smash",
      school: "melee",
      cooldownMs: 5000,
      targetType: "hostile",
      maxRange: 5,
      // M3 balance: softened (was ×1.8 +15) — two Stone Guardians co-aggro (wave 3), so this
      // slam landed twice a cycle; it was the single scariest per-second facetank source. The
      // knockback was also cut 4→2: a bigger shove pushed a solo melee out of its own DPS window
      // AND back into the wave-2 respawn line, stalling the run short of the boss.
      effects: [
        { effect: { kind: "damage", school: "melee", useWeapon: true, multiplier: 1.2, flat: 6 } },
        { effect: { kind: "knockback", distance: 2, mode: "directional" } },
      ],
    },
    {
      id: "valen-cleave",
      name: "Sword Sweep",
      school: "melee",
      cooldownMs: 4500,
      targetType: "hostile",
      maxRange: 6,
      aoe: { shape: "cone", radius: 6, angleRad: 1.3, anchor: "caster", relation: "hostile", maxTargets: 5 },
      // M3 balance: cleave ×1.4→×1.0 — trims Ser Valen's sustained DPS over his long solo fight.
      effects: [{ effect: { kind: "damage", school: "melee", useWeapon: true, multiplier: 1.0 } }],
    },
    {
      id: "ember-lord-strike",
      name: "Molten Cleave",
      school: "melee",
      cooldownMs: 3500,
      targetType: "hostile",
      maxRange: 5,
      aoe: { shape: "cone", radius: 6, angleRad: 1.4, anchor: "caster", relation: "hostile", maxTargets: 6 },
      // M3 balance: cleave ×1.5→×1.0 — the end boss's melee overlaps its own summoned adds +
      // eruption, so its sustained melee had to come down for a solo player to survive the phase.
      effects: [{ effect: { kind: "damage", school: "melee", useWeapon: true, multiplier: 1.0 } }],
    },
    {
      id: "ember-lord-flame",
      name: "Ember Bolt",
      school: "spell",
      castTimeMs: 1000,
      cooldownMs: 6000,
      // Boss casts must not self-cancel from the AI repositioning mid-cast.
      cancelOnMove: false,
      targetType: "hostile",
      maxRange: 25,
      projectileSpeed: 16,
      // M3 balance: flat 20→10 — the bolt also applies `ember-burn` (a DoT), so its up-front
      // term was stacking with the tick over the boss's long fight.
      effects: [
        { effect: { kind: "damage", school: "spell", useLevelDamage: true, multiplier: 1.4, flat: 10 } },
        { effect: { kind: "buff", buffId: "ember-burn" }, relation: "hostile" },
      ],
    },
    // Telegraphed point-AoE eruption. DEFINED ONLY — deliberately absent from `ember_lord`'s
    // skill list: the room script (ember-rooms.ts) fires it in The Ember Lord's hp-phase, and
    // the client renders the ground warning (M3 T3.1 client half).
    {
      id: "ember-lord-eruption",
      name: "Eruption",
      school: "spell",
      castTimeMs: 1800,
      cooldownMs: 12000,
      cancelOnMove: false,
      targetType: "point",
      maxRange: 30,
      aoe: { shape: "circle", radius: 7, anchor: "target", relation: "hostile", maxTargets: 10 },
      effects: [
        { effect: { kind: "damage", school: "spell", useLevelDamage: true, multiplier: 2.4, flat: 40 } },
        { effect: { kind: "buff", buffId: "ember-burn" }, relation: "hostile" },
      ],
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

    // === Ember Depths dungeon (M3) ===
    // Derived hp = 100 + sta*10 + level*20 (stats.ts). sta is picked to hit the target hp;
    // `armor` is a direct override on top. exp = ~+20% dungeon premium over the field curve.
    {
      id: "skeleton_warrior",
      name: "Skeleton Warrior",
      level: 9,
      faction: "monsters",
      weapon: "skeleton-blade",
      // M3 balance: hp 440→370. A solo ~64-DPS clear must drop a 2-mob camp inside the zone's
      // 15s respawn, else a respawn tail piles on indefinitely; trimmed so wave 1 clears clean.
      stats: { sta: 9, str: 18, armor: 12 }, // hp 370
      baseSkillId: "monster-bite",
      skills: [{ skillId: "skeleton-strike", maxRange: 4, weight: 2 }],
      expMultiplier: 1.2,
      radius: 0.6,
      ai: { aggroRadius: 10, leashDistance: 50, hardLeashDistance: 180, helpRadius: 6, moveSpeed: 4.5, skillDelayMs: [1100, 1400] },
    },
    {
      id: "skeleton_archer",
      name: "Skeleton Archer",
      level: 10,
      faction: "monsters",
      weapon: "skeleton-bow",
      stats: { sta: 3, dex: 16, armor: 5 }, // hp 330 (squishy; M3 balance 360→330, the ranged tail in waves 1+2)
      baseSkillId: "skeleton-shot",
      skills: [{ skillId: "skeleton-shot", minRange: 0, maxRange: 18, weight: 3 }],
      expMultiplier: 1.2,
      radius: 0.55,
      ai: { aggroRadius: 15, leashDistance: 50, hardLeashDistance: 180, moveSpeed: 4, skillDelayMs: [1300, 1600] },
    },
    {
      id: "wraith",
      name: "Wraith",
      level: 11,
      faction: "monsters",
      // Weaponless: `wraith-bolt` is a level-scaled spell, so no WeaponDef is needed. Low
      // armor (4) keeps it soft to physical hits — the opposite feel of the Stone Guardian.
      stats: { sta: 6, int: 18, armor: 4 }, // hp 380 (M3 balance 420→380, wave-2 pair under respawn)
      baseSkillId: "wraith-bolt",
      skills: [{ skillId: "wraith-bolt", minRange: 0, maxRange: 18, weight: 3 }],
      expMultiplier: 1.4,
      radius: 0.6,
      ai: { aggroRadius: 13, leashDistance: 50, hardLeashDistance: 180, helpRadius: 8, moveSpeed: 4, skillDelayMs: [1400, 1700] },
    },
    {
      id: "golem",
      name: "Stone Guardian",
      level: 12,
      // armor 48 ≈ 4× the skeleton warrior's 12 (flavor only — at the engine's ARMOR_HALF=5300
      // this armor mitigates <1%; see the M3 report's armor finding). hp 480 + slow slam + low
      // moveSpeed is what actually makes it a wall.
      faction: "monsters",
      weapon: "golem-fist",
      stats: { sta: 14, str: 24, armor: 48 }, // hp 480 (M3 balance: 900→480, 2 golems clear under the 15s respawn)
      baseSkillId: "monster-bite",
      skills: [{ skillId: "golem-slam", maxRange: 5, weight: 2 }],
      expMultiplier: 2.5,
      radius: 1.1,
      ai: { aggroRadius: 11, leashDistance: 55, hardLeashDistance: 200, moveSpeed: 3, skillDelayMs: [1800, 2200] },
    },
    {
      id: "wraith_commander",
      name: "Ser Valen",
      level: 12,
      // Mini-boss: melee cleave + the wraith's spell bolt. hp 1020 ≈ 2.1× the golem's 480.
      faction: "monsters",
      weapon: "valen-blade",
      stats: { sta: 68, str: 22, int: 22, armor: 20 }, // hp 1020 (M3 balance: 2250→1020, caps solo fight ~16s)
      baseSkillId: "monster-bite",
      skills: [
        { skillId: "valen-cleave", maxRange: 6, weight: 3 },
        { skillId: "wraith-bolt", minRange: 6, maxRange: 18, weight: 2 },
      ],
      expMultiplier: 4.5,
      radius: 1.2,
      ai: { aggroRadius: 18, leashDistance: 70, hardLeashDistance: 250, moveSpeed: 4.5, skillDelayMs: [1300, 1600] },
    },
    {
      id: "ember_lord",
      name: "The Ember Lord",
      level: 15,
      // Final boss: heavy melee cleave + fire bolt (DoT). hp 900 ≈ 1.4× the field boss's 660.
      // The hp-phase enrage (reuse `boss-chief-enrage-buff`) and `ember-lord-eruption` are
      // triggered by the room script, NOT listed here (see the eruption skill's comment).
      faction: "monsters",
      weapon: "ember-greataxe",
      stats: { sta: 50, str: 30, int: 26, armor: 28 }, // hp 900 (M3 balance: 2640→900, solo-clearable add/eruption phase with margin)
      baseSkillId: "monster-bite",
      skills: [
        { skillId: "ember-lord-strike", maxRange: 5, weight: 3 },
        { skillId: "ember-lord-flame", minRange: 0, maxRange: 25, weight: 2 },
      ],
      expMultiplier: 10,
      radius: 1.5,
      ai: { aggroRadius: 20, leashDistance: 80, hardLeashDistance: 300, moveSpeed: 4.5, skillDelayMs: [1500, 1800] },
    },
  ],
};
