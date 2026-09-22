import type { WeaponSpec } from "./config.js";

export type WeaponActionKind = "cycle" | "magazine_reload" | "pump_reload" | "bolt_reload";
export type WeaponActionPhase = "cycle" | "reload_start" | "reload_insert" | "reload_end" | "reload";

export type WeaponActionState = {
  readonly weaponIndex: number;
  readonly kind: WeaponActionKind;
  readonly phase: WeaponActionPhase;
  readonly startedAt: number;
  readonly phaseStartedAt: number;
  readonly endsAt: number;
  readonly serial: number;
  readonly committed: number;
  readonly fireBuffered: boolean;
};

export type WeaponActionEvent =
  | { readonly type: "state"; readonly state: WeaponActionState }
  | { readonly type: "ammo"; readonly weaponIndex: number; readonly mag: number; readonly reserve: number; readonly serial: number }
  | { readonly type: "finished"; readonly weaponIndex: number; readonly serial: number };

type MutableAction = {
  weaponIndex: number;
  kind: WeaponActionKind;
  phase: WeaponActionPhase;
  startedAt: number;
  phaseStartedAt: number;
  endsAt: number;
  serial: number;
  committed: number;
  fireBuffered: boolean;
};

const snapshot = (action: MutableAction): WeaponActionState => ({ ...action });

export class WeaponActions {
  private nextSerial = 1;
  private reload: MutableAction | null = null;
  private readonly cycles = new Map<number, MutableAction>();

  startReload(weaponIndex: number, spec: WeaponSpec, now: number, mags: number[], reserves: number[]): WeaponActionState | null {
    if (this.reload !== null || !Number.isFinite(now) || mags[weaponIndex] === undefined || reserves[weaponIndex] === undefined) return null;
    if (mags[weaponIndex] >= spec.mag || reserves[weaponIndex] <= 0 || !this.canFire(weaponIndex, now)) return null;
    const kind = spec.reloadKind === "pump" ? "pump_reload" : spec.reloadKind === "stripper_clip" ? "bolt_reload" : "magazine_reload";
    const firstDuration = spec.reloadKind === "pump" ? spec.reloadStartMs : spec.reloadMs;
    this.reload = {
      weaponIndex, kind, phase: spec.reloadKind === "pump" ? "reload_start" : "reload",
      startedAt: now, phaseStartedAt: now, endsAt: now + firstDuration, serial: this.nextSerial++, committed: 0, fireBuffered: false,
    };
    return snapshot(this.reload);
  }

  beginCycle(weaponIndex: number, spec: WeaponSpec, now: number): WeaponActionState | null {
    if (spec.reloadKind === "magazine" || !Number.isFinite(now)) return null;
    const action: MutableAction = {
      weaponIndex, kind: "cycle", phase: "cycle", startedAt: now, phaseStartedAt: now, endsAt: now + spec.cycleMs,
      serial: this.nextSerial++, committed: 0, fireBuffered: false,
    };
    this.cycles.set(weaponIndex, action);
    return snapshot(action);
  }

  advance(now: number, weapons: readonly WeaponSpec[], mags: number[], reserves: number[]): readonly WeaponActionEvent[] {
    const events: WeaponActionEvent[] = [];
    for (const [index, cycle] of this.cycles) if (now >= cycle.endsAt) this.cycles.delete(index);
    while (this.reload !== null && now >= this.reload.endsAt) {
      const action = this.reload;
      const spec = weapons[action.weaponIndex];
      if (spec === undefined) { this.reload = null; break; }
      if (action.kind !== "pump_reload") {
        this.commit(action, spec, mags, reserves, Math.min(spec.mag - mags[action.weaponIndex]!, reserves[action.weaponIndex]!), events);
        events.push({ type: "finished", weaponIndex: action.weaponIndex, serial: action.serial });
        this.reload = null;
        break;
      }
      if (spec.reloadKind !== "pump") { this.reload = null; break; }
      if (action.phase === "reload_start") {
        action.phaseStartedAt = action.endsAt;
        action.phase = "reload_insert";
        action.endsAt += spec.reloadInsertMs;
        events.push({ type: "state", state: snapshot(action) });
        continue;
      }
      if (action.phase === "reload_insert") {
        action.phaseStartedAt = action.endsAt;
        this.commit(action, spec, mags, reserves, 1, events);
        if (action.fireBuffered || mags[action.weaponIndex]! >= spec.mag || reserves[action.weaponIndex]! <= 0) {
          action.phase = "reload_end";
          action.endsAt += spec.reloadEndMs;
        } else {
          action.endsAt += spec.reloadInsertMs;
        }
        events.push({ type: "state", state: snapshot(action) });
        continue;
      }
      events.push({ type: "finished", weaponIndex: action.weaponIndex, serial: action.serial });
      this.reload = null;
    }
    return events;
  }

  requestFire(weaponIndex: number, spec: WeaponSpec, now: number, mags: number[]): "ready" | "blocked" | "buffered" | "closing" {
    if (this.reload?.weaponIndex === weaponIndex) {
      if (this.reload.kind !== "pump_reload" || this.reload.phase === "reload_end") return "blocked";
      if (spec.reloadKind !== "pump") return "blocked";
      if (mags[weaponIndex]! <= 0) { this.reload.fireBuffered = true; return "buffered"; }
      this.reload.phase = "reload_end";
      this.reload.phaseStartedAt = now;
      this.reload.endsAt = now + spec.reloadEndMs;
      return "closing";
    }
    return this.canFire(weaponIndex, now) ? "ready" : "blocked";
  }

  switchWeapon(_weaponIndex: number, _now: number): readonly WeaponActionEvent[] {
    if (this.reload === null) return [];
    const finished: WeaponActionEvent = { type: "finished", weaponIndex: this.reload.weaponIndex, serial: this.reload.serial };
    this.reload = null;
    return [finished];
  }

  clear(): void { this.reload = null; this.cycles.clear(); }
  observeAnimationMarker(_marker: string): void {}

  view(weaponIndex: number, now: number): WeaponActionState | null {
    if (this.reload?.weaponIndex === weaponIndex && this.reload.endsAt > now) return snapshot(this.reload);
    const cycle = this.cycles.get(weaponIndex);
    return cycle !== undefined && cycle.endsAt > now ? snapshot(cycle) : null;
  }

  views(now: number): readonly WeaponActionState[] {
    const active: WeaponActionState[] = [];
    if (this.reload !== null && this.reload.endsAt > now) active.push(snapshot(this.reload));
    for (const cycle of this.cycles.values()) if (cycle.endsAt > now) active.push(snapshot(cycle));
    return active;
  }

  canFire(weaponIndex: number, now: number): boolean {
    if (this.reload?.weaponIndex === weaponIndex) return false;
    const cycle = this.cycles.get(weaponIndex);
    return cycle === undefined || cycle.endsAt <= now;
  }

  private commit(action: MutableAction, spec: WeaponSpec, mags: number[], reserves: number[], requested: number, events: WeaponActionEvent[]): void {
    const index = action.weaponIndex;
    const count = Math.max(0, Math.min(requested, spec.mag - mags[index]!, reserves[index]!));
    if (count === 0) return;
    mags[index]! += count;
    reserves[index]! -= count;
    action.committed += count;
    events.push({ type: "ammo", weaponIndex: index, mag: mags[index]!, reserve: reserves[index]!, serial: action.serial });
  }
}
