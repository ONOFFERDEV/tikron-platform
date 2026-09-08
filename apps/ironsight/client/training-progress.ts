import { MODES } from '../src/config.js';

export interface TrainingObjective { x: number; z: number }

/** Local teaching progress, never combat state. Rejoining starts a fresh lesson. */
export class TrainingProgress {
  moved = 0;
  aimedMs = 0;
  hit = false;
  private pingDone = false;
  readonly objectiveHoldMs = 100000 / MODES.dom.capturePerSec;
  readonly objectiveRadius = MODES.dom.captureRadius;
  heldMs = 0;
  objectiveDistance = Infinity;
  private objectiveDone = false;
  private previous: { x: number; z: number } | null = null;
  constructor(readonly hasTargets: boolean, readonly objective?: TrainingObjective) {}

  sample(active: boolean, x: number, z: number, aiming: boolean, dt: number): void {
    if (!active) {
      this.previous = null;
      if (this.aimedMs < 500) this.aimedMs = 0;
      if (!this.objectiveDone) this.heldMs = 0;
      return;
    }
    let discontinuity = false;
    if (this.previous) {
      const distance = Math.hypot(x - this.previous.x, z - this.previous.z);
      // Ignore respawns/corrections; require actual displacement, not a held key at a wall.
      if (distance < 2) this.moved = Math.min(4, this.moved + distance);
      else discontinuity = true;
    }
    this.previous = { x, z };
    if (this.aimedMs < 500) this.aimedMs = aiming ? this.aimedMs + Math.min(100, dt) : 0;
    if (this.objective) {
      this.objectiveDistance = Math.hypot(x - this.objective.x, z - this.objective.z);
      if (!this.objectiveDone) {
        // Same XZ occupancy as Domination. This rehearses a neutral capture; it
        // never changes a gauge/score or pretends to simulate enemy contesting.
        const inside = this.objectiveDistance <= this.objectiveRadius;
        const ready = this.moved >= 4 && this.aimedMs >= 500 && (!this.hasTargets || this.hit);
        this.heldMs = inside && ready && !discontinuity ? Math.min(this.objectiveHoldMs, this.heldMs + Math.max(0, Math.min(100, dt))) : 0;
        this.objectiveDone = this.heldMs >= this.objectiveHoldMs;
      }
    }
  }

  confirmHit(): void { if (this.hasTargets) this.hit = true; }
  /** Called only after validation of a server echo, never on local key-down. */
  confirmPing(from: string, myId: string, active: boolean): void {
    if (active && from === myId && this.step === 5) this.pingDone = true;
  }
  get step(): number {
    return this.moved < 4 ? 0 : this.aimedMs < 500 ? 1 : this.hasTargets && !this.hit ? 2
      : this.objective && !this.objectiveDone ? 4 : !this.pingDone ? 5 : 3;
  }
}
