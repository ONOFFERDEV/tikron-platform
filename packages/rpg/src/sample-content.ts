/**
 * sample-content — a small but coherent demo pack that validates and exercises the whole
 * v1 feature surface: instant melee, a cast-time travelling projectile, circle and cone
 * AoE, DoT/HoT ticks, a stun with diminishing-returns tolerance, root, silence, offensive
 * dispel and friendly cleanse, taunt, an absorb shield, a channel, a toggle stance,
 * auto-attack, plus a basic-AI wolf and a multi-skill boss with an hp-gated enrage/summon.
 *
 * It is intended as a reference for content authors and as fixture data for demos; every
 * id reference resolves, so `validateContent(sampleContent)` passes.
 */

import type { ContentPack } from "./content.js";

export const sampleContent: ContentPack = {
  weapons: [
    { id: "sword", kind: "melee", dps: 20, speedMs: 1500, damageScalePct: 25, maxRange: 4 },
    { id: "bow", kind: "ranged", dps: 18, speedMs: 1800, damageScalePct: 25, minRange: 3, maxRange: 25 },
    { id: "staff", kind: "melee", dps: 12, speedMs: 2000, maxRange: 4 },
    { id: "wolf-fang", kind: "melee", dps: 10, speedMs: 1400, maxRange: 3 },
    { id: "boss-claw", kind: "melee", dps: 30, speedMs: 1600, maxRange: 5 },
  ],

  buffs: [
    // Toggle stance — permanent while on, flat melee damage bonus.
    {
      id: "battle-stance",
      name: "Battle Stance",
      kind: "good",
      modifiers: [{ stat: "meleeDamageMul", kind: "percent", value: 20 }],
    },
    // Stun with tolerance → shorter each reapply, then immunity.
    {
      id: "stun",
      name: "Stun",
      kind: "bad",
      durationMs: 2000,
      cc: { stun: true },
      tags: ["stun"],
      tolerance: {
        tag: "stun",
        windowMs: 15000,
        steps: [{ timeReductionPct: 0 }, { timeReductionPct: 50 }, { timeReductionPct: 75 }],
        immunityBuffId: "stun-immune",
      },
    },
    { id: "stun-immune", name: "Stun Immunity", kind: "hidden", durationMs: 10000, immunities: { buffTags: ["stun"] } },
    // Root — cannot move, can still act.
    { id: "frost-root", name: "Frozen", kind: "bad", durationMs: 3000, cc: { root: true }, tags: ["root"] },
    // Silence — blocks spell/heal casts.
    { id: "silence", name: "Silenced", kind: "bad", durationMs: 3000, cc: { silence: true }, tags: ["silence"] },
    // DoT.
    {
      id: "ignite",
      name: "Ignite",
      kind: "bad",
      durationMs: 4000,
      tags: ["magic-dot"],
      tick: { intervalMs: 1000, effects: [{ kind: "damage", school: "spell", fixed: { min: 12, max: 12 } }] },
    },
    // Heavier DoT.
    {
      id: "pyro-dot",
      name: "Pyroblast Burn",
      kind: "bad",
      durationMs: 6000,
      tags: ["magic-dot"],
      tick: { intervalMs: 2000, effects: [{ kind: "damage", school: "spell", fixed: { min: 20, max: 20 } }] },
    },
    // HoT.
    {
      id: "renew",
      name: "Renew",
      kind: "good",
      durationMs: 6000,
      tick: { intervalMs: 2000, effects: [{ kind: "heal", flat: 30 }] },
    },
    // Absorb shield.
    { id: "absorb-shield", name: "Barrier", kind: "good", durationMs: 10000, shield: { amount: 200 } },
    // Boss enrage — big damage bonus, survives nothing special.
    {
      id: "boss-enrage",
      name: "Enrage",
      kind: "good",
      modifiers: [{ stat: "meleeDamageMul", kind: "percent", value: 100 }],
    },
  ],

  skills: [
    // Auto-attacks (weapon-cadence, no GCD).
    {
      id: "melee-auto",
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
      id: "ranged-auto",
      name: "Ranged Attack",
      school: "ranged",
      autoAttack: true,
      requiresWeapon: "ranged",
      gcd: "none",
      projectileSpeed: 30,
      targetType: "hostile",
      maxRange: 25,
      effects: [{ effect: { kind: "damage", school: "ranged", useWeapon: true } }],
    },
    // NPC fallback bite.
    {
      id: "npc-bite",
      name: "Bite",
      school: "melee",
      targetType: "hostile",
      gcd: "none",
      maxRange: 4,
      effects: [{ effect: { kind: "damage", school: "melee", useWeapon: true, multiplier: 1 } }],
    },

    // Warrior.
    {
      id: "warrior-slash",
      name: "Slash",
      school: "melee",
      cooldownMs: 3000,
      targetType: "hostile",
      maxRange: 4,
      threatBonus: 40,
      effects: [{ effect: { kind: "damage", school: "melee", useWeapon: true, multiplier: 1.5, flat: 10 } }],
    },
    {
      id: "warrior-charge",
      name: "Charge",
      school: "melee",
      cooldownMs: 8000,
      targetType: "hostile",
      minRange: 5,
      maxRange: 25,
      effects: [
        { effect: { kind: "blink", distance: 25 } },
        { effect: { kind: "damage", school: "melee", useWeapon: true, flat: 20 } },
        { effect: { kind: "buff", buffId: "frost-root" }, chance: 100, relation: "hostile" },
      ],
    },
    {
      id: "warrior-cleave",
      name: "Cleave",
      school: "melee",
      cooldownMs: 4000,
      targetType: "hostile",
      maxRange: 6,
      aoe: { shape: "cone", radius: 6, angleRad: Math.PI / 2, anchor: "caster", relation: "hostile", maxTargets: 5 },
      effects: [{ effect: { kind: "damage", school: "melee", useWeapon: true, multiplier: 1.2 } }],
    },
    {
      id: "warrior-bash",
      name: "Shield Bash",
      school: "melee",
      cooldownMs: 6000,
      targetType: "hostile",
      maxRange: 4,
      effects: [
        { effect: { kind: "damage", school: "melee", useWeapon: true, multiplier: 0.5 } },
        { effect: { kind: "buff", buffId: "stun" }, relation: "hostile" },
      ],
    },
    {
      id: "warrior-taunt",
      name: "Taunt",
      school: "none",
      gcd: "none",
      cooldownMs: 8000,
      targetType: "hostile",
      maxRange: 20,
      effects: [{ effect: { kind: "aggro", flat: 5000 } }],
    },
    {
      id: "warrior-warcry",
      name: "War Cry",
      school: "none",
      gcd: "none",
      targetType: "self",
      toggleBuffId: "battle-stance",
      effects: [],
    },

    // Mage.
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
        { effect: { kind: "buff", buffId: "ignite" }, relation: "hostile" },
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
        { effect: { kind: "buff", buffId: "frost-root" }, relation: "hostile" },
      ],
    },
    {
      id: "mage-pyroblast",
      name: "Pyroblast",
      school: "spell",
      manaCost: 30,
      castTimeMs: 2500,
      cooldownMs: 12000,
      targetType: "hostile",
      maxRange: 25,
      effects: [
        { effect: { kind: "damage", school: "spell", useLevelDamage: true, multiplier: 1.5 } },
        { effect: { kind: "buff", buffId: "pyro-dot" }, relation: "hostile" },
      ],
    },
    {
      id: "mage-silence",
      name: "Counterspell",
      school: "spell",
      manaCost: 10,
      cooldownMs: 15000,
      targetType: "hostile",
      maxRange: 25,
      effects: [{ effect: { kind: "buff", buffId: "silence" }, relation: "hostile" }],
    },
    {
      id: "mage-spellsteal",
      name: "Spellsteal",
      school: "spell",
      manaCost: 15,
      targetType: "hostile",
      maxRange: 25,
      effects: [{ effect: { kind: "dispel", buffKind: "good", count: 1 } }],
    },
    {
      id: "mage-barrier",
      name: "Barrier",
      school: "spell",
      manaCost: 20,
      cooldownMs: 12000,
      targetType: "friendly",
      maxRange: 25,
      effects: [{ effect: { kind: "buff", buffId: "absorb-shield" } }],
    },
    {
      id: "mage-arcane-channel",
      name: "Arcane Channel",
      school: "spell",
      manaCost: 10,
      cooldownMs: 8000,
      targetType: "hostile",
      maxRange: 25,
      channel: {
        durationMs: 3000,
        tickMs: 1000,
        manaPerTick: 10,
        tickEffects: [{ kind: "damage", school: "spell", flat: 25 }],
      },
      effects: [],
    },

    // Healer.
    {
      id: "healer-heal",
      name: "Heal",
      school: "heal",
      manaCost: 25,
      castTimeMs: 2000,
      targetType: "friendly",
      maxRange: 25,
      effects: [{ effect: { kind: "heal", multiplier: 1, flat: 50 } }],
    },
    {
      id: "healer-renew",
      name: "Renew",
      school: "heal",
      manaCost: 15,
      targetType: "friendly",
      maxRange: 25,
      effects: [{ effect: { kind: "buff", buffId: "renew" } }],
    },
    {
      id: "healer-cleanse",
      name: "Cleanse",
      school: "heal",
      manaCost: 10,
      cooldownMs: 6000,
      targetType: "friendly",
      maxRange: 25,
      effects: [{ effect: { kind: "dispel", buffKind: "bad", count: 2 } }],
    },

    // Boss abilities.
    {
      id: "boss-cleave",
      name: "Boss Cleave",
      school: "melee",
      cooldownMs: 5000,
      targetType: "hostile",
      maxRange: 8,
      aoe: { shape: "cone", radius: 8, angleRad: 1.2, anchor: "caster", relation: "hostile", maxTargets: 6 },
      effects: [{ effect: { kind: "damage", school: "melee", useWeapon: true, multiplier: 1.2 } }],
    },
    {
      id: "boss-enrage-cast",
      name: "Enrage",
      school: "none",
      gcd: "none",
      cooldownMs: 999999,
      targetType: "self",
      effects: [{ effect: { kind: "buff", buffId: "boss-enrage" }, applyTo: "caster" }],
    },
    {
      id: "boss-summon",
      name: "Summon Pack",
      school: "none",
      cooldownMs: 30000,
      targetType: "self",
      // lifetimeMs caps the adds so repeated summons can't grow the pack without bound.
      effects: [{ effect: { kind: "spawnNpc", npcDefId: "wolf", count: 2, offset: 3, lifetimeMs: 20000 }, applyTo: "caster" }],
    },
  ],

  npcs: [
    {
      id: "wolf",
      name: "Gray Wolf",
      level: 3,
      faction: "monsters",
      weapon: "wolf-fang",
      baseSkillId: "npc-bite",
      skills: [{ skillId: "npc-bite" }],
      expMultiplier: 1,
      radius: 0.6,
      ai: { aggroRadius: 12, leashDistance: 50, hardLeashDistance: 200, moveSpeed: 5, skillDelayMs: [1200, 1400] },
    },
    {
      id: "boss",
      name: "Dire Alpha",
      level: 10,
      faction: "monsters",
      weapon: "boss-claw",
      baseSkillId: "npc-bite",
      stats: { sta: 60, armor: 1000 },
      skills: [
        { skillId: "boss-cleave", maxRange: 8, weight: 3 },
        { skillId: "boss-enrage-cast", hpBelowPct: 30, weight: 1 },
        { skillId: "boss-summon", hpBelowPct: 50, weight: 1 },
      ],
      expMultiplier: 5,
      radius: 1.2,
      ai: {
        aggroRadius: 16,
        leashDistance: 60,
        hardLeashDistance: 200,
        helpRadius: 20,
        moveSpeed: 4,
        skillDelayMs: [1500, 1550],
      },
    },
  ],
};
