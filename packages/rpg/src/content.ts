/**
 * Content model — the data-driven skill/buff/effect/npc definitions a game authors as
 * plain JSON-able POJOs, plus {@link validateContent} which throws on any dangling
 * reference (a skill pointing at a missing buff, an npc at a missing weapon, …). A pack
 * that validates is safe to feed to {@link RpgEngine}; the engine never re-checks refs.
 */

import type { DamageSchool, Modifier, StatKey } from "./stats.js";

/** AoE membership filter applied when gathering targets around an anchor. */
export type TargetRelation = "any" | "hostile" | "friendly" | "others";

/**
 * One effect binding inside a skill: which effect, who it lands on, and the fine gates
 * (chance, relation, facing, buff-tag requirements, weighted-random group) that decide
 * whether it fires for a given gathered target.
 */
export interface SkillEffectBinding {
  effect: EffectDef;
  /** AAEmu ApplicationMethod; `casterOnce` applies to the caster a single time. */
  applyTo?: "target" | "caster" | "casterOnce";
  /** 0–100 proc chance (default 100). */
  chance?: number;
  /** Fine per-effect relation gate on top of the AoE relation. */
  relation?: "friendly" | "hostile";
  /** Facing gate relative to the target. */
  position?: "front" | "back";
  requireTargetBuffTag?: string;
  forbidTargetBuffTag?: string;
  /** Weighted-random group weight; bindings with `weight` compete and one is picked. */
  weight?: number;
}

/** The 13 built-in effect kinds plus the `custom` escape hatch. */
export type EffectDef =
  | {
      kind: "damage";
      school: DamageSchool;
      multiplier?: number;
      flat?: number;
      useWeapon?: boolean;
      useLevelDamage?: boolean;
      fixed?: { min: number; max: number };
      canCrit?: boolean;
      aggroMul?: number;
    }
  | { kind: "heal"; multiplier?: number; flat?: number; toMana?: boolean }
  | { kind: "restoreMana"; flat?: number; multiplier?: number }
  | { kind: "manaBurn"; flat?: number; perLevel?: number }
  | { kind: "buff"; buffId: string; abLevel?: number }
  | { kind: "dispel"; buffKind: "good" | "bad"; count: number; tag?: string }
  | { kind: "aggro"; flat?: number; perLevel?: number }
  | { kind: "knockback"; distance: number; mode: "radial" | "directional"; radius?: number }
  | { kind: "blink"; distance: number }
  | { kind: "resetCooldown"; skillId?: string; all?: boolean }
  | { kind: "spawnNpc"; npcDefId: string; count?: number; offset?: number; lifetimeMs?: number }
  | { kind: "subSkill"; skillId: string; delayMs?: number }
  | { kind: "custom"; name: string; params?: Record<string, number | string> };

/** Channel phase: repeated ticks over a duration with optional upkeep mana. */
export interface ChannelDef {
  durationMs: number;
  tickMs: number;
  manaPerTick?: number;
  tickEffects: EffectDef[];
  selfBuffId?: string;
  targetBuffId?: string;
}

/** AoE shape descriptor for gathering multiple targets. */
export interface AoeDef {
  shape: "circle" | "cone" | "line";
  radius: number;
  angleRad?: number;
  width?: number;
  anchor: "target" | "caster";
  relation: TargetRelation;
  maxTargets?: number;
  includeAnchor?: boolean;
}

export interface SkillDef {
  id: string;
  name?: string;
  /** Damage school gates silence and selects offense stats; `none` never school-gated. */
  school: DamageSchool | "heal" | "none";
  manaCost?: number;
  /** 0/undefined = instant cast. */
  castTimeMs?: number;
  channel?: ChannelDef;
  cooldownMs?: number;
  /** `default` = 1000 player / 1500 npc; `none` ignores GCD; a number overrides. */
  gcd?: "default" | "none" | number;
  targetType: "self" | "hostile" | "friendly" | "any" | "point";
  minRange?: number;
  /** Default 4 (melee reach). */
  maxRange?: number;
  aoe?: AoeDef;
  effectDelayMs?: number;
  /** units/s → travel time = dist/speed. */
  projectileSpeed?: number;
  effects: SkillEffectBinding[];
  toggleBuffId?: string;
  /** Cancel the cast on movement; defaults true when `castTimeMs > 0`. */
  cancelOnMove?: boolean;
  /** Interruptible by stun/silence per school; default true. */
  interruptible?: boolean;
  requiresWeapon?: "melee" | "ranged" | boolean;
  /** Flat threat added to the aggro fed by this skill's damage. */
  threatBonus?: number;
  /** Basic attack: cadence read from weapon speed each swing. */
  autoAttack?: boolean;
}

/** A per-tick DoT/HoT descriptor or other periodic effects on a buff. */
export interface BuffTickDef {
  intervalMs: number;
  effects: EffectDef[];
  manaPerTick?: number;
}

export interface BuffCcDef {
  stun?: boolean;
  root?: boolean;
  silence?: boolean;
  sleep?: boolean;
  disarm?: boolean;
}

export interface BuffImmunityDef {
  schools?: DamageSchool[];
  allDamage?: boolean;
  knockback?: boolean;
  buffTags?: string[];
}

export interface BuffRemoveOnDef {
  move?: boolean;
  startSkill?: boolean;
  damaged?: boolean;
  attack?: boolean;
  /** Strip on death; defaults true when omitted. */
  death?: boolean;
}

/** Proc definition: fire `effect` when `on` occurs, subject to `chance`/`school`. */
export interface BuffTrigger {
  on: "attack" | "damage" | "damaged" | "dispelled" | "timeout" | "started" | "death" | "kill";
  chance?: number;
  effect: EffectDef;
  /** Apply the proc to the proc's source instead of the buff owner. */
  onSource?: boolean;
  /** Restrict damage(d) triggers to a school. */
  school?: DamageSchool;
}

/** Diminishing-returns config applied per-tag on the RECEIVER of a CC buff. */
export interface BuffToleranceDef {
  tag: string;
  windowMs: number;
  steps: { timeReductionPct: number }[];
  immunityBuffId?: string;
}

export interface BuffDef {
  id: string;
  name?: string;
  kind: "good" | "bad" | "hidden";
  durationMs?: number;
  /** dur = max(0, levelDurationMs*abLevel + durationMs); 0/undef + tick = permanent. */
  levelDurationMs?: number;
  tick?: BuffTickDef;
  /** Default `refresh`. */
  stackRule?: "refresh" | "chargeRefresh" | "extend" | "multiple" | "independent";
  maxStack?: number;
  initialCharges?: number;
  tags?: string[];
  cc?: BuffCcDef;
  immunities?: BuffImmunityDef;
  /** Damage-absorb pool. */
  shield?: { amount: number; perLevel?: number };
  /** % of incoming damage paid from MP first. */
  manaShieldRatio?: number;
  reflect?: { percent: number; school?: DamageSchool };
  /** Stat bonuses while active. */
  modifiers?: Modifier[];
  removeOn?: BuffRemoveOnDef;
  triggers?: BuffTrigger[];
  tolerance?: BuffToleranceDef;
}

export interface WeaponDef {
  id: string;
  kind: "melee" | "ranged";
  dps: number;
  speedMs: number;
  /** Damage spread ±%; default 25. */
  damageScalePct?: number;
  minRange?: number;
  maxRange?: number;
  mods?: Modifier[];
}

/** A skill slot on an NPC with the picker's cooldown/range/hp gate metadata. */
export interface NpcSkillSlot {
  skillId: string;
  minRange?: number;
  maxRange?: number;
  /** Only usable while the NPC's own hp% is at or below this. */
  hpBelowPct?: number;
  /** Only usable while the NPC's own hp% is at or above this. */
  hpAbovePct?: number;
  weight?: number;
}

export interface AiProfile {
  aggroRadius?: number;
  /** Distance from home before returning (default 50). */
  leashDistance?: number;
  /** Distance from home that forces a teleport return (default 200). */
  hardLeashDistance?: number;
  /** Random delay window between skill attempts (default [1500, 1550]). */
  skillDelayMs?: [number, number];
  moveSpeed?: number;
  /** Aggro-link radius: allied NPCs within it join on engage. */
  helpRadius?: number;
}

export interface NpcDef {
  id: string;
  name?: string;
  level: number;
  faction: string;
  /** Overrides derived base stats. */
  stats?: Partial<Record<StatKey, number>>;
  weapon?: string;
  skills?: NpcSkillSlot[];
  /** Fallback melee skill when the picker finds nothing usable. */
  baseSkillId?: string;
  ai?: AiProfile;
  expMultiplier?: number;
  radius?: number;
}

export interface ContentPack {
  skills: SkillDef[];
  buffs: BuffDef[];
  npcs: NpcDef[];
  weapons?: WeaponDef[];
  /** Cumulative xp required to reach each level (index = level). */
  levelCurve?: number[];
  factions?: { hostile?: [string, string][] };
}

/** Resolved lookup maps built once from a {@link ContentPack}. */
export interface ContentIndex {
  skills: Map<string, SkillDef>;
  buffs: Map<string, BuffDef>;
  npcs: Map<string, NpcDef>;
  weapons: Map<string, WeaponDef>;
  levelCurve: number[];
  /** Explicit hostile faction pairs (order-insensitive). */
  hostilePairs: Set<string>;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a} ${b}` : `${b} ${a}`;
}

/** Collect the effect ids each EffectDef references, for dangling-ref validation. */
function refsOfEffect(e: EffectDef): { buffs?: string[]; skills?: string[]; npcs?: string[] } {
  switch (e.kind) {
    case "buff":
      return { buffs: [e.buffId] };
    case "subSkill":
      return { skills: [e.skillId] };
    case "spawnNpc":
      return { npcs: [e.npcDefId] };
    default:
      return {};
  }
}

/**
 * Validate that every id reference in a pack resolves. Throws an `Error` naming the
 * first dangling ref. Checks: skill/buff effect bindings, channel/tick effects, buff
 * tolerance immunity buffs, buff trigger effects, npc weapon/skill/baseSkill refs.
 */
export function validateContent(pack: ContentPack): void {
  const skillIds = new Set(pack.skills.map((s) => s.id));
  const buffIds = new Set(pack.buffs.map((b) => b.id));
  const npcIds = new Set(pack.npcs.map((n) => n.id));
  const weaponIds = new Set((pack.weapons ?? []).map((w) => w.id));

  const need = (set: Set<string>, id: string, what: string, owner: string): void => {
    if (!set.has(id)) throw new Error(`content: ${owner} references missing ${what} "${id}"`);
  };

  const checkEffect = (e: EffectDef, owner: string): void => {
    const r = refsOfEffect(e);
    for (const id of r.buffs ?? []) need(buffIds, id, "buff", owner);
    for (const id of r.skills ?? []) need(skillIds, id, "skill", owner);
    for (const id of r.npcs ?? []) need(npcIds, id, "npc", owner);
  };

  for (const s of pack.skills) {
    const owner = `skill "${s.id}"`;
    for (const b of s.effects) checkEffect(b.effect, owner);
    if (s.toggleBuffId) need(buffIds, s.toggleBuffId, "buff", owner);
    if (s.channel) {
      for (const e of s.channel.tickEffects) checkEffect(e, owner);
      if (s.channel.selfBuffId) need(buffIds, s.channel.selfBuffId, "buff", owner);
      if (s.channel.targetBuffId) need(buffIds, s.channel.targetBuffId, "buff", owner);
    }
  }

  for (const b of pack.buffs) {
    const owner = `buff "${b.id}"`;
    for (const e of b.tick?.effects ?? []) checkEffect(e, owner);
    for (const tr of b.triggers ?? []) checkEffect(tr.effect, owner);
    if (b.tolerance?.immunityBuffId) need(buffIds, b.tolerance.immunityBuffId, "buff", owner);
  }

  for (const n of pack.npcs) {
    const owner = `npc "${n.id}"`;
    if (n.weapon) need(weaponIds, n.weapon, "weapon", owner);
    if (n.baseSkillId) need(skillIds, n.baseSkillId, "skill", owner);
    for (const sk of n.skills ?? []) need(skillIds, sk.skillId, "skill", owner);
  }
}

/** Build the resolved lookup maps for the engine (validates first). */
export function indexContent(pack: ContentPack): ContentIndex {
  validateContent(pack);
  const hostilePairs = new Set<string>();
  for (const [a, b] of pack.factions?.hostile ?? []) hostilePairs.add(pairKey(a, b));
  return {
    skills: new Map(pack.skills.map((s) => [s.id, s])),
    buffs: new Map(pack.buffs.map((b) => [b.id, b])),
    npcs: new Map(pack.npcs.map((n) => [n.id, n])),
    weapons: new Map((pack.weapons ?? []).map((w) => [w.id, w])),
    levelCurve: pack.levelCurve ?? [],
    hostilePairs,
  };
}

/** Explicit-pair hostility test used by relation checks; key order is insensitive. */
export function factionsHostile(index: ContentIndex, a: string, b: string): boolean | undefined {
  if (index.hostilePairs.has(pairKey(a, b))) return true;
  return undefined;
}
