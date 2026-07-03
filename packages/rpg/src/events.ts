/**
 * Combat event feed — the ordered broadcast stream a Tikron room drains from
 * {@link RpgEngine.tick} and relays to clients. Mirrors AAEmu's SC-packet sequence
 * (skillStarted → skillFired → damaged/healed/buff → unitPoints → skillEnded) but as
 * plain JSON-able records. `unitPoints` is coalesced to at most one per unit per tick.
 */

import type { Vec2 } from "@tikron/sim";
import type { DamageSchool } from "./stats.js";

/** Outcome of two-stage hit resolution (avoidance dice + independent crit re-roll). */
export type HitType = "hit" | "crit" | "miss" | "dodge" | "block" | "parry" | "immune";

/** A skill/effect target: an existing unit, or a ground position (point-cast). */
export type TargetRef = { unitId: string } | { pos: Vec2 };

/** The discriminated union broadcast by the engine, one variant per `t` tag. */
export type CombatEvent =
  | { t: "skillStarted"; caster: string; skillId: string; castMs: number; target?: TargetRef }
  | { t: "skillFired"; caster: string; skillId: string; delayMs: number; target?: TargetRef }
  | { t: "skillEnded"; caster: string; skillId: string }
  | {
      t: "castStopped";
      caster: string;
      skillId: string;
      reason: "moved" | "stunned" | "silenced" | "cancelled" | "dead";
    }
  | {
      t: "damaged";
      source: string;
      target: string;
      skillId?: string;
      amount: number;
      absorbed: number;
      school: DamageSchool;
      hit: HitType;
    }
  | {
      t: "healed";
      source: string;
      target: string;
      skillId?: string;
      amount: number;
      toMana: boolean;
      crit: boolean;
    }
  | { t: "manaBurned"; source: string; target: string; amount: number }
  | {
      t: "buffAdded";
      target: string;
      buffId: string;
      instanceId: number;
      source: string;
      durationMs: number;
      stacks: number;
    }
  | {
      t: "buffRefreshed";
      target: string;
      buffId: string;
      instanceId: number;
      durationMs: number;
      stacks: number;
    }
  | {
      t: "buffRemoved";
      target: string;
      buffId: string;
      instanceId: number;
      reason: "expired" | "dispelled" | "consumed" | "death" | "removed";
    }
  | { t: "unitPoints"; unit: string; hp: number; mp: number }
  | { t: "combatEngaged"; unit: string }
  | { t: "combatCleared"; unit: string }
  | { t: "death"; unit: string; killer?: string }
  | { t: "resurrected"; unit: string; hp: number; mp: number }
  | { t: "xpGained"; unit: string; amount: number }
  | { t: "levelUp"; unit: string; level: number }
  | { t: "knockback"; unit: string; from: Vec2; to: Vec2 }
  | { t: "unitMoved"; unit: string; pos: Vec2; facing: number }
  | { t: "unitSpawned"; unit: string; npcDefId: string; pos: Vec2; byEffect?: boolean }
  | { t: "unitRemoved"; unit: string }
  | { t: "aiTargetChanged"; unit: string; target?: string }
  | {
      t: "custom";
      name: string;
      source: string;
      target?: string;
      params?: Record<string, number | string>;
    };
