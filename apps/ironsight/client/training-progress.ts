import { MODES } from "../src/config.js";
import type { WeaponActionState } from "../src/weapon-action.js";

export interface TrainingObjective { readonly x: number; readonly z: number }
export interface TrainingCheckpoint extends TrainingObjective {
  readonly id: "rail-embankment" | "loading-yard" | "rail-cut";
  readonly radius: number;
}

export type TrainingRouteSpec =
  | { readonly route: "relay" }
  | { readonly route: "undertow"; readonly objective: TrainingObjective }
  | { readonly route: "switchyard"; readonly checkpoints: readonly [TrainingCheckpoint, TrainingCheckpoint, TrainingCheckpoint] };

export type TrainingStepId =
  | "move" | "aim" | "hit" | "reload" | "ping"
  | "reach-objective" | "hold-objective"
  | "reach-rail-embankment" | "reach-loading-yard" | "reach-rail-cut"
  | "complete";

export interface AuthoritativeAmmo {
  readonly weaponIndex: number;
  readonly mag: number;
  readonly reserve: number;
}

export interface TrainingWeaponAction {
  readonly id: string;
  readonly state: WeaponActionState | null;
  readonly weaponIndex?: number;
  readonly serial?: number;
}

interface ActiveReload {
  readonly weaponIndex: number;
  readonly serial: number;
  readonly baseline: AuthoritativeAmmo | null;
  readonly state: WeaponActionState;
}

export class TrainingProgress {
  readonly objectiveHoldMs = 100_000 / MODES.dom.capturePerSec;
  readonly objectiveRadius = MODES.dom.captureRadius;
  moved = 0;
  aimedMs = 0;
  heldMs = 0;
  objectiveDistance = Number.POSITIVE_INFINITY;
  private hit = false;
  private reloadComplete = false;
  private pingComplete = false;
  private objectiveComplete = false;
  private checkpointIndex = 0;
  private checkpointTravel = 0;
  private previous: TrainingObjective | null = null;
  private readonly ammo = new Map<number, AuthoritativeAmmo>();
  private activeReload: ActiveReload | null = null;

  constructor(readonly spec: TrainingRouteSpec) {}

  get route(): TrainingRouteSpec["route"] { return this.spec.route; }
  get objective(): TrainingObjective | undefined {
    return this.spec.route === "undertow" ? this.spec.objective : undefined;
  }

  sample(active: boolean, x: number, z: number, aiming: boolean, dtMs: number): void {
    if (!active || !Number.isFinite(x) || !Number.isFinite(z)) {
      this.previous = null;
      if (this.aimedMs < 500) this.aimedMs = 0;
      if (!this.objectiveComplete) this.heldMs = 0;
      return;
    }

    let discontinuity = false;
    if (this.previous !== null) {
      const distance = Math.hypot(x - this.previous.x, z - this.previous.z);
      if (distance < 2) {
        this.moved = Math.min(4, this.moved + distance);
        this.checkpointTravel = Math.min(4, this.checkpointTravel + distance);
      } else {
        discontinuity = true;
      }
    }
    this.previous = { x, z };

    switch (this.spec.route) {
      case "relay":
        if (this.moved >= 4 && this.aimedMs < 500) {
          this.aimedMs = aiming ? Math.min(500, this.aimedMs + boundedDelta(dtMs)) : 0;
        }
        return;
      case "undertow":
        this.sampleObjective(x, z, dtMs, discontinuity);
        return;
      case "switchyard":
        this.sampleCheckpoint(x, z, discontinuity);
        return;
    }
  }

  confirmHit(): void {
    if (this.spec.route === "relay" && this.step === "hit") this.hit = true;
  }

  observeWeaponAction(localId: string, event: TrainingWeaponAction): void {
    if (this.spec.route !== "relay" || event.id !== localId) return;
    const state = event.state;
    if (state !== null && state.kind !== "cycle" && this.step === "reload") {
      this.activeReload = {
        weaponIndex: state.weaponIndex,
        serial: state.serial,
        baseline: this.ammo.get(state.weaponIndex) ?? null,
        state,
      };
      return;
    }
    if (state === null && this.activeReload !== null &&
        (event.serial === undefined || event.serial === this.activeReload.serial)) {
      this.activeReload = null;
    }
  }

  observeAmmo(event: AuthoritativeAmmo): void {
    const previous = this.ammo.get(event.weaponIndex);
    this.ammo.set(event.weaponIndex, event);
    const reload = this.activeReload;
    if (this.spec.route !== "relay" || this.step !== "reload" || reload === null || reload.weaponIndex !== event.weaponIndex) return;
    const baseline = reload.baseline ?? previous;
    if (baseline !== undefined && baseline !== null && (event.mag > baseline.mag || event.reserve < baseline.reserve)) {
      this.reloadComplete = true;
      this.activeReload = null;
    }
  }

  confirmPing(from: string, myId: string, active: boolean): void {
    if (this.spec.route === "relay" && this.step === "ping" && active && from === myId) this.pingComplete = true;
  }

  reloadProgress(serverNow: number): number | null {
    const state = this.activeReload?.state;
    if (state === undefined || !Number.isFinite(serverNow) || state.endsAt <= serverNow) return null;
    const duration = Math.max(1, state.endsAt - state.phaseStartedAt);
    return Math.max(0, Math.min(1, 1 - (state.endsAt - serverNow) / duration));
  }

  get step(): TrainingStepId {
    switch (this.spec.route) {
      case "relay":
        if (this.moved < 4) return "move";
        if (this.aimedMs < 500) return "aim";
        if (!this.hit) return "hit";
        if (!this.reloadComplete) return "reload";
        return this.pingComplete ? "complete" : "ping";
      case "undertow":
        if (this.objectiveComplete) return "complete";
        return this.moved >= 4 && this.objectiveDistance <= this.objectiveRadius ? "hold-objective" : "reach-objective";
      case "switchyard": {
        const checkpoint = this.spec.checkpoints[this.checkpointIndex];
        return checkpoint === undefined ? "complete" : `reach-${checkpoint.id}`;
      }
    }
  }

  private sampleObjective(x: number, z: number, dtMs: number, discontinuity: boolean): void {
    if (this.spec.route !== "undertow") return;
    this.objectiveDistance = Math.hypot(x - this.spec.objective.x, z - this.spec.objective.z);
    if (this.objectiveComplete) return;
    const ready = this.moved >= 4 && this.objectiveDistance <= this.objectiveRadius;
    this.heldMs = ready && !discontinuity ? Math.min(this.objectiveHoldMs, this.heldMs + boundedDelta(dtMs)) : 0;
    this.objectiveComplete = this.heldMs >= this.objectiveHoldMs;
  }

  private sampleCheckpoint(x: number, z: number, discontinuity: boolean): void {
    if (this.spec.route !== "switchyard") return;
    const checkpoint = this.spec.checkpoints[this.checkpointIndex];
    if (checkpoint === undefined || discontinuity || this.checkpointTravel < 4) return;
    if (Math.hypot(x - checkpoint.x, z - checkpoint.z) > checkpoint.radius) return;
    this.checkpointIndex += 1;
    this.checkpointTravel = 0;
  }
}

function boundedDelta(dtMs: number): number {
  return Number.isFinite(dtMs) ? Math.max(0, Math.min(100, dtMs)) : 0;
}
