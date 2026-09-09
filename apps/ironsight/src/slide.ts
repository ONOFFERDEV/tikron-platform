import { MOVE } from './config.js';
import { isSprinting } from './handling.js';

/** Simulation time only. No client positions, velocity or deadlines are accepted. */
export const SLIDE = Object.freeze({ runUpMs: 300, durationMs: 800, cooldownMs: 1200,
  startSpeed: 12, endSpeed: 4, minTravelFraction: .7 });
export interface SlideInput {
  mx: number; mz: number; crouch: boolean; sprint: boolean; jump: boolean; ads?: boolean;
}

/** Shared by fixed-step prediction and the room. Collision remains moveAndSlide's job. */
export class SprintSlide {
  private runMs = 0;
  private remainingMs = 0;
  private cooldownMs = 0;
  private held = false;
  private direction = { x: 0, z: 1 };
  private charging = false;
  private stepMs = 0;
  private expectedTravel = 0;
  get active(): boolean { return this.remainingMs > 0; }
  get progress(): number { return this.active ? 1 - this.remainingMs / SLIDE.durationMs : 0; }

  step(dtMs: number, input: SlideInput, grounded: boolean, yaw: number) {
    this.stepMs = dtMs;
    this.cooldownMs = Math.max(0, this.cooldownMs - dtMs);
    const edge = input.crouch && !this.held;
    this.held = input.crouch;
    if (this.active && (!grounded || !input.crouch || input.ads || input.jump || input.mz <= 0)) this.stop();
    if (edge && grounded && !input.ads && !input.jump && input.mz > 0 &&
        this.runMs >= SLIDE.runUpMs && this.cooldownMs === 0) {
      const sy = Math.sin(yaw), cy = Math.cos(yaw);
      const length = Math.hypot(input.mx, input.mz);
      this.direction = { x: (sy * input.mz + cy * input.mx) / length,
        z: (cy * input.mz - sy * input.mx) / length };
      this.remainingMs = SLIDE.durationMs;
      this.runMs = 0;
    }
    this.charging = !this.active && isSprinting(input, grounded);
    if (!this.charging) this.runMs = 0;
    if (!this.active) { this.expectedTravel = MOVE.sprint * dtMs / 1000; return null; }
    // Midpoint integration: exactly 6.4 m in 800 ms on unobstructed level ground.
    const t = Math.min(1, (SLIDE.durationMs - this.remainingMs + dtMs / 2) / SLIDE.durationMs);
    const speed = SLIDE.startSpeed + (SLIDE.endSpeed - SLIDE.startSpeed) * t;
    this.expectedTravel = speed * dtMs / 1000;
    return { ...this.direction, speed };
  }

  /** A held sprint against a wall cannot bank a slide; impact ends momentum. */
  observe(travel: number, grounded: boolean): void {
    const clear = grounded && travel >= this.expectedTravel * SLIDE.minTravelFraction;
    if (this.charging) this.runMs = clear ? Math.min(SLIDE.runUpMs, this.runMs + this.stepMs) : 0;
    if (this.active) {
      this.remainingMs = Math.max(0, this.remainingMs - this.stepMs);
      if (!clear || this.remainingMs === 0) this.stop();
    }
  }

  private stop(): void { this.remainingMs = 0; this.cooldownMs = SLIDE.cooldownMs; }
}
