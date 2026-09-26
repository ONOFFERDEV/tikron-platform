import type { ShotFeedbackEvent } from "../shot-feedback.js";
import type { WeaponActionState } from "../../src/weapon-action.js";
import { botLabel } from "../../src/bot-roles.js";
import { combatantLabel } from "./copy.js";

/** Bot seats arrive as raw ids ("bot-7"); show the same Korean label as the kill feed. */
const victimLabel = (id: string): string => combatantLabel(botLabel(id) ?? id);

export const COMBAT_HUD_IMPORTANT_TEXT_PX = 14;
const MAX_EVENTS = 4;
const MAX_SHOTS = 256;

type PresentedShotEvent = Extract<ShotFeedbackEvent, {
  readonly kind: "accepted" | "blocked" | "confirmed_hit" | "confirmed_kill";
}>;

export type CombatHudEvent = {
  readonly kind:
    | "shot-accepted"
    | "shot-blocked"
    | "confirmed-hit"
    | "confirmed-kill"
    | "reload-started"
    | "reload-interrupted"
    | "objective";
  readonly text: string;
  readonly shotId?: string;
};

export type ObjectiveOwner = "friendly" | "enemy" | "neutral";
export type ObjectiveStatus = "stable" | "capturing" | "contested";

export type ObjectiveHudState = {
  readonly id: string;
  readonly owner: ObjectiveOwner;
  readonly status: ObjectiveStatus;
};

export type ReloadHudState =
  | { readonly status: "idle" | "interrupted"; readonly phase: null; readonly serial: null }
  | { readonly status: "active"; readonly phase: WeaponActionState["phase"]; readonly serial: number };

export type E32LatencyHudState =
  | { readonly status: "unavailable"; readonly validSamples: 0; readonly clockUncertaintyMs: number }
  | { readonly status: "ready"; readonly validSamples: number; readonly clockUncertaintyMs: number };

export type CombatHudSnapshot = {
  readonly events: readonly CombatHudEvent[];
  readonly objectives: readonly ObjectiveHudState[];
  readonly reload: ReloadHudState;
  readonly latency: E32LatencyHudState;
};

const blockText: Readonly<Record<Extract<PresentedShotEvent, { readonly kind: "blocked" }>["reason"], string>> = {
  readiness: "발사 준비 대기",
  cadence: "사격 간격 대기",
  swap: "무기 교체 중",
  reload: "재장전 중",
  empty: "탄창 비어 있음",
  duplicate: "중복 발사",
};

const objectiveText: Readonly<Record<ObjectiveStatus, string>> = {
  stable: "확보",
  capturing: "점령 중",
  contested: "경합",
};

const assertNever = (value: never): never => {
  throw new Error(`Unhandled combat HUD event: ${String(value)}`);
};

function isReload(action: WeaponActionState): boolean {
  switch (action.kind) {
    case "magazine_reload":
    case "pump_reload":
    case "bolt_reload":
      return true;
    case "cycle":
      return false;
    default:
      return assertNever(action.kind);
  }
}

function sameObjective(left: ObjectiveHudState | undefined, right: ObjectiveHudState): boolean {
  return left?.owner === right.owner && left.status === right.status;
}

export function objectiveHudStates(
  mode: number,
  captureValues: readonly [number, number, number],
  localTeam: number,
): readonly ObjectiveHudState[] {
  if (mode !== 2) return [];
  return captureValues.map((value, index) => {
    const controllingTeam = value === 200 ? 0 : value === 0 ? 1 : null;
    const owner: ObjectiveOwner = controllingTeam === null
      ? value === 100 ? "neutral" : value > 100 === (localTeam === 0) ? "friendly" : "enemy"
      : controllingTeam === localTeam ? "friendly" : "enemy";
    return {
      id: ["A", "B", "C"][index] ?? String(index + 1),
      owner,
      status: value === 0 || value === 100 || value === 200 ? "stable" : "capturing",
    };
  });
}

export class CombatHud {
  private readonly verdicts = new Map<string, "accepted" | "blocked">();
  private readonly verdictOrder: string[] = [];
  private readonly confirmed = new Set<string>();
  private readonly events: CombatHudEvent[] = [];
  private readonly objectives = new Map<string, ObjectiveHudState>();
  private reload: ReloadHudState = { status: "idle", phase: null, serial: null };
  private reloadEndsAt: number | null = null;
  private latency: E32LatencyHudState = { status: "unavailable", validSamples: 0, clockUncertaintyMs: 0 };

  receiveShot(event: ShotFeedbackEvent): void {
    switch (event.kind) {
      case "accepted":
        if (this.verdicts.has(event.shotId)) return;
        this.retainVerdict(event.shotId, "accepted");
        this.push({ kind: "shot-accepted", text: "발사 확인", shotId: event.shotId });
        return;
      case "blocked":
        if (event.reason === "duplicate" || this.verdicts.has(event.shotId)) return;
        this.retainVerdict(event.shotId, "blocked");
        this.push({ kind: "shot-blocked", text: blockText[event.reason], shotId: event.shotId });
        return;
      case "confirmed_hit":
        this.confirm(event, "confirmed-hit", `명중 확인: ${victimLabel(event.victim)}`);
        return;
      case "confirmed_kill":
        this.confirm(event, "confirmed-kill", `처치 확인: ${victimLabel(event.victim)}`);
        return;
      case "predicted":
      case "remote_shot":
        return;
      default:
        return assertNever(event);
    }
  }

  receiveReload(action: WeaponActionState | null, serverNow?: number): void {
    if (action !== null && isReload(action)) {
      if (this.reload.status !== "active" || this.reload.serial !== action.serial) {
        this.push({ kind: "reload-started", text: "재장전 시작" });
      }
      this.reload = { status: "active", phase: action.phase, serial: action.serial };
      this.reloadEndsAt = action.endsAt;
      return;
    }
    if (this.reload.status !== "active") return;
    const completed = serverNow !== undefined && this.reloadEndsAt !== null && serverNow >= this.reloadEndsAt;
    this.reload = completed
      ? { status: "idle", phase: null, serial: null }
      : { status: "interrupted", phase: null, serial: null };
    this.reloadEndsAt = null;
    if (!completed) this.push({ kind: "reload-interrupted", text: "재장전 중단" });
  }

  receiveObjective(objective: ObjectiveHudState): void {
    const prior = this.objectives.get(objective.id);
    if (sameObjective(prior, objective)) return;
    this.objectives.set(objective.id, { ...objective });
    this.push({ kind: "objective", text: `거점 ${objective.id}: ${objectiveText[objective.status]}` });
  }

  setObjectives(objectives: readonly ObjectiveHudState[]): void {
    const currentIds = new Set(objectives.map(objective => objective.id));
    for (const id of this.objectives.keys()) if (!currentIds.has(id)) this.objectives.delete(id);
    for (const objective of objectives) this.receiveObjective(objective);
  }

  setLatency(value: E32LatencyHudState): void {
    if (!Number.isFinite(value.clockUncertaintyMs) || value.clockUncertaintyMs < 0) return;
    if (value.status === "ready" && (!Number.isSafeInteger(value.validSamples) || value.validSamples < 1)) return;
    this.latency = { ...value };
  }

  reset(): void {
    this.verdicts.clear();
    this.verdictOrder.length = 0;
    this.confirmed.clear();
    this.events.length = 0;
    this.objectives.clear();
    this.reload = { status: "idle", phase: null, serial: null };
    this.reloadEndsAt = null;
    this.latency = { status: "unavailable", validSamples: 0, clockUncertaintyMs: 0 };
  }

  snapshot(): CombatHudSnapshot {
    return {
      events: this.events.slice(),
      objectives: [...this.objectives.values()].map(objective => ({ ...objective })),
      reload: { ...this.reload },
      latency: { ...this.latency },
    };
  }

  private confirm(event: Extract<PresentedShotEvent, { readonly kind: "confirmed_hit" | "confirmed_kill" }>, kind: "confirmed-hit" | "confirmed-kill", text: string): void {
    if (this.verdicts.get(event.shotId) !== "accepted") return;
    const key = `${kind}/${event.shotId}`;
    if (this.confirmed.has(key)) return;
    this.confirmed.add(key);
    this.push({ kind, text, shotId: event.shotId });
  }

  private retainVerdict(shotId: string, verdict: "accepted" | "blocked"): void {
    this.verdicts.set(shotId, verdict);
    this.verdictOrder.push(shotId);
    if (this.verdictOrder.length <= MAX_SHOTS) return;
    const oldest = this.verdictOrder.shift();
    if (oldest === undefined) return;
    this.verdicts.delete(oldest);
    this.confirmed.delete(`confirmed-hit/${oldest}`);
    this.confirmed.delete(`confirmed-kill/${oldest}`);
  }

  private push(event: CombatHudEvent): void {
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) this.events.shift();
  }
}
