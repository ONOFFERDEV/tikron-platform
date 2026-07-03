/**
 * Unit — the runtime state of one combatant (player or NPC): pools, resolved base
 * stats + live modifier set, cast/channel state, cooldowns, active buff instances, and
 * (for NPCs) the AI/aggro block. Implements {@link StatProvider} so it feeds combat math
 * directly. Plain data plus a couple of getters; the engine owns all mutation so this
 * stays serialization-friendly.
 */

import type { Vec2 } from "@tikron/sim";
import type { TargetRef } from "./events.js";
import type { StatProvider } from "./combat.js";
import type { ModifierSet, Primaries, StatKey } from "./stats.js";
import { computeStat, resolveBaseStats } from "./stats.js";
import { AggroTable } from "./aggro.js";

/** A live buff on a unit. `endsAt`/`nextTickAt` are absolute ms; 0 means none/perm. */
export interface BuffInstance {
  instanceId: number;
  buffId: string;
  caster: string;
  abLevel: number;
  appliedAt: number;
  /** Absolute expiry ms; 0 = permanent-until-removed. */
  endsAt: number;
  /** Absolute ms of the next scheduled tick; 0 = no tick. */
  nextTickAt: number;
  stacks: number;
  /** Remaining charges; -1 = not a charge buff. */
  charges: number;
  /** Remaining absorb pool; 0 = no shield. */
  shieldLeft: number;
}

export type CastPhase = "casting" | "channeling";

/** The in-progress cast/channel context, used for interrupt and view. */
export interface CastState {
  skillId: string;
  /** Per-cast token; stale timers whose token no longer matches are ignored. */
  token: number;
  phase: CastPhase;
  startedAt: number;
  /** Cast-bar end (casting) or channel end (channeling), absolute ms. */
  endsAt: number;
  target?: TargetRef;
}

export type AiFsmState = "idle" | "combat" | "return" | "dead";

/** NPC-only AI + aggro block. */
export interface NpcState {
  home: Vec2;
  moveSpeed: number;
  fsm: AiFsmState;
  targetId?: string;
  /** Last AI skill attempt (min-interval + random-delay gate). */
  lastSkillAt: number;
  /** Earliest next AI skill attempt (random delay between casts). */
  nextSkillAt: number;
  aggro: AggroTable;
}

/** Per-tag diminishing-returns counter kept on the RECEIVER of CC. */
export interface ToleranceCounter {
  step: number;
  windowEndsAt: number;
}

export interface BuffView {
  buffId: string;
  instanceId: number;
  endsAt: number;
  stacks: number;
}

/** Readonly projection the engine hands out via {@link RpgEngine.getUnit}. */
export interface UnitView {
  id: string;
  kind: "player" | "npc";
  npcDefId?: string;
  faction: string;
  pos: Vec2;
  facing: number;
  level: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  alive: boolean;
  inCombat: boolean;
  /** Active crowd-control, resolved from buff templates so integrators need no buff-id knowledge. */
  stunned: boolean;
  rooted: boolean;
  silenced: boolean;
  sleeping: boolean;
  /** Convenience: `alive && !stunned && !rooted && !sleeping` — safe to accept a move. */
  canMove: boolean;
  casting?: { skillId: string; endsAt: number };
  moveSpeedMul: number;
  buffs: BuffView[];
  cooldowns: Map<string, number>;
  /**
   * Live stat accessor — re-evaluates against the unit on each call. Unlike every other
   * field here (captured at `getUnit()` time), a stale view's `stat()` reflects current
   * state; read a fresh view per tick rather than caching one.
   */
  stat(key: StatKey): number;
}

/** Resolved crowd-control booleans supplied to {@link Unit.view} by the engine. */
export interface CcFlags {
  stunned: boolean;
  rooted: boolean;
  silenced: boolean;
  sleeping: boolean;
}

/** Constructor spec for a fresh unit. */
export interface UnitInit {
  id: string;
  kind: "player" | "npc";
  npcDefId?: string;
  faction: string;
  level: number;
  primaries: Primaries;
  overrides?: Partial<Record<StatKey, number>>;
  pos: Vec2;
  facing?: number;
  radius?: number;
  weaponId?: string;
  xp?: number;
}

export class Unit implements StatProvider {
  id: string;
  kind: "player" | "npc";
  npcDefId?: string;
  faction: string;
  level: number;
  xp: number;

  pos: Vec2;
  facing: number;
  radius: number;

  primaries: Primaries;
  overrides: Partial<Record<StatKey, number>>;
  baseStats: Map<StatKey, number>;
  mods: ModifierSet = new Map();

  hp: number;
  mp: number;
  alive = true;

  inCombat = false;
  lastCombatAt = 0;
  postCastUntil = 0;

  cast?: CastState;
  cooldowns: Map<string, number> = new Map();
  // Sentinel "never used" so the 150ms anti-spam window never blocks a fresh unit's
  // first skill at now=0. Finite so it survives JSON serialize/restore.
  lastSkillUseAt = -1e9;
  gcdUntil = 0;

  buffs: BuffInstance[] = [];
  weaponId?: string;
  autoAttack?: { targetId: string };

  npc?: NpcState;

  tolerance: Map<string, ToleranceCounter> = new Map();
  procGuard: Map<string, number> = new Map();

  constructor(init: UnitInit) {
    this.id = init.id;
    this.kind = init.kind;
    this.npcDefId = init.npcDefId;
    this.faction = init.faction;
    this.level = init.level;
    this.xp = init.xp ?? 0;
    this.pos = { x: init.pos.x, y: init.pos.y };
    this.facing = init.facing ?? 0;
    this.radius = init.radius ?? 0.5;
    this.primaries = { ...init.primaries };
    this.overrides = { ...(init.overrides ?? {}) };
    this.weaponId = init.weaponId;
    this.baseStats = resolveBaseStats(this.level, this.primaries, this.overrides);
    this.hp = this.stat("maxHp");
    this.mp = this.stat("maxMp");
  }

  /** Effective stat: base (derived + overrides) folded with all active modifiers. */
  stat(key: StatKey): number {
    return computeStat(this.baseStats.get(key) ?? 0, key, this.mods);
  }

  get maxHp(): number {
    return this.stat("maxHp");
  }

  get maxMp(): number {
    return this.stat("maxMp");
  }

  /** Recompute the base stat map for a new level (primaries/overrides unchanged). */
  recomputeBase(level: number): void {
    this.level = level;
    this.baseStats = resolveBaseStats(level, this.primaries, this.overrides);
  }

  /** Top hp/mp to their current maxima (spawn, level-up, leash-reset). */
  fillToMax(): void {
    this.hp = this.maxHp;
    this.mp = this.maxMp;
  }

  view(cc: CcFlags): UnitView {
    const cast = this.cast;
    return {
      id: this.id,
      kind: this.kind,
      npcDefId: this.npcDefId,
      faction: this.faction,
      pos: { x: this.pos.x, y: this.pos.y },
      facing: this.facing,
      level: this.level,
      hp: this.hp,
      maxHp: this.maxHp,
      mp: this.mp,
      maxMp: this.maxMp,
      alive: this.alive,
      inCombat: this.inCombat,
      stunned: cc.stunned,
      rooted: cc.rooted,
      silenced: cc.silenced,
      sleeping: cc.sleeping,
      canMove: this.alive && !cc.stunned && !cc.rooted && !cc.sleeping,
      casting: cast ? { skillId: cast.skillId, endsAt: cast.endsAt } : undefined,
      moveSpeedMul: this.stat("moveSpeedMul"),
      buffs: this.buffs.map((b) => ({
        buffId: b.buffId,
        instanceId: b.instanceId,
        endsAt: b.endsAt,
        stacks: b.stacks,
      })),
      cooldowns: new Map(this.cooldowns),
      stat: (k: StatKey) => this.stat(k),
    };
  }
}
