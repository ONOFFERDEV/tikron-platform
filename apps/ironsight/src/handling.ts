import type { WeaponSpec } from './config.js';

/** Server arrival time / local prediction time, never a client-claimed deadline. */
export class WeaponHandling {
  private slot = -1;
  private adsAt: number | null = null;
  private sprinting = false;
  private sprintUntil = 0;
  private now = 0;
  private adsMs = 1;
  private blocked = false;

  update(now: number, spec: WeaponSpec, sprinting: boolean, ads: boolean, blocked = false): void {
    this.now = Math.max(this.now, now);
    if (this.slot !== spec.slot) { this.adsAt = null; this.slot = spec.slot; }
    this.adsMs = spec.adsMs;
    // Start the full recovery on release, including a press/release in one batch.
    if (sprinting || this.sprinting) this.sprintUntil = this.now + spec.sprintToFireMs;
    this.sprinting = sprinting;
    this.blocked = blocked;
    if (!ads || sprinting || blocked) this.adsAt = null;
    else this.adsAt ??= this.now;
  }

  get adsProgress(): number {
    return this.adsAt === null ? 0 : Math.min(1, (this.now - this.adsAt) / this.adsMs);
  }
  get canFire(): boolean {
    return !this.blocked && !this.sprinting && this.now >= this.sprintUntil &&
      (this.adsAt === null || this.adsProgress >= 1);
  }
  get remainingMs(): number {
    return Math.max(0, this.sprintUntil - this.now,
      this.adsAt === null ? 0 : this.adsAt + this.adsMs - this.now);
  }
}

export function isSprinting(input: { sprint: boolean; mz: number; crouch: boolean; ads?: boolean }, grounded: boolean): boolean {
  return input.sprint && input.mz > 0 && !input.crouch && !input.ads && grounded;
}

/** Exact finite-duration sight/FOV interpolation; no second exponential tail. */
export function easeAds(progress: number): number {
  const t = Math.min(1, Math.max(0, progress));
  return t * t * (3 - 2 * t);
}
