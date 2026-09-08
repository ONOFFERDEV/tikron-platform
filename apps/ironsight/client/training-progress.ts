/** Local teaching progress, never combat state. Rejoining starts a fresh lesson. */
export class TrainingProgress {
  moved = 0;
  aimedMs = 0;
  hit = false;
  private previous: { x: number; z: number } | null = null;
  constructor(readonly hasTargets: boolean) {}

  sample(active: boolean, x: number, z: number, aiming: boolean, dt: number): void {
    if (!active) { this.previous = null; if (this.aimedMs < 500) this.aimedMs = 0; return; }
    if (this.previous) {
      const distance = Math.hypot(x - this.previous.x, z - this.previous.z);
      // Ignore respawns/corrections; require actual displacement, not a held key at a wall.
      if (distance < 2) this.moved = Math.min(4, this.moved + distance);
    }
    this.previous = { x, z };
    if (this.aimedMs < 500) this.aimedMs = aiming ? this.aimedMs + Math.min(100, dt) : 0;
  }

  confirmHit(): void { if (this.hasTargets) this.hit = true; }
  get step(): number { return this.moved < 4 ? 0 : this.aimedMs < 500 ? 1 : this.hasTargets && !this.hit ? 2 : 3; }
}
