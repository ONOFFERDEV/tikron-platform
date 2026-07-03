/**
 * Effect executor — the single dispatch point shared by skill applies, buff ticks, and
 * procs. {@link applyEffect} switches on the effect kind and calls the matching engine
 * primitive (damage/heal/buff/dispel/…); the engine owns the stateful consequences
 * (aggro, combat state, death, scheduling) so this stays a thin, exhaustive registry.
 * `custom` routes to a user-registered handler — the package's main extension point.
 */

import type { Vec2 } from "@tikron/sim";
import type { RpgEngine } from "./engine.js";
import type { EffectDef } from "./content.js";
import type { Unit } from "./unit.js";

/**
 * Provenance carried through an effect application. `source` selects event tags and proc
 * scaling; `skillId` stamps damage/heal events; `depth` bounds proc/subSkill recursion;
 * `buffCaster` is the originating caster id for buff-tick effects.
 */
export interface ApplyCtx {
  now: number;
  source: "skill" | "buffTick" | "proc";
  skillId?: string;
  depth: number;
  buffCaster?: string;
}

/** A resolved effect target: the unit hit (if any) plus the aim position. */
export interface EffectTarget {
  unit?: Unit;
  pos: Vec2;
}

/** A custom effect handler registered via {@link RpgEngine.registerCustomEffect}. */
export type CustomEffectFn = (
  engine: RpgEngine,
  ctx: ApplyCtx,
  caster: Unit,
  target: EffectTarget,
  params: Record<string, number | string> | undefined,
) => void;

/**
 * Apply one effect to one already-resolved target. Effects needing a unit (damage, heal,
 * buff, dispel, taunt, mana ops, knockback) no-op when `target.unit` is absent; blink and
 * spawnNpc use the aim position; subSkill schedules a follow-up cast.
 */
export function applyEffect(
  engine: RpgEngine,
  ctx: ApplyCtx,
  def: EffectDef,
  caster: Unit,
  target: EffectTarget,
): void {
  switch (def.kind) {
    case "damage":
      if (target.unit) engine.dealDamage(ctx, caster, target.unit, def);
      return;
    case "heal":
      if (target.unit) engine.applyHeal(ctx, caster, target.unit, def);
      return;
    case "restoreMana":
      if (target.unit) engine.restoreMana(ctx, caster, target.unit, def);
      return;
    case "manaBurn":
      if (target.unit) engine.manaBurn(ctx, caster, target.unit, def);
      return;
    case "buff":
      if (target.unit) engine.applyBuffEffect(ctx, caster, target.unit, def);
      return;
    case "dispel":
      if (target.unit) engine.applyDispelEffect(ctx, caster, target.unit, def);
      return;
    case "aggro":
      if (target.unit) engine.applyTaunt(ctx, caster, target.unit, def);
      return;
    case "knockback":
      if (target.unit) engine.applyKnockback(ctx, caster, target.unit, def);
      return;
    case "blink":
      engine.applyBlink(ctx, caster, target.pos, def);
      return;
    case "resetCooldown":
      engine.applyResetCooldown(caster, def);
      return;
    case "spawnNpc":
      engine.applySpawnNpc(ctx, caster, target.pos, def);
      return;
    case "subSkill":
      engine.applySubSkill(ctx, caster, target, def);
      return;
    case "custom":
      engine.applyCustom(ctx, caster, target, def);
      return;
  }
}
