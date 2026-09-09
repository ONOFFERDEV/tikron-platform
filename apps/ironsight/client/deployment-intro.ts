import type { ArenaState } from '../src/schema.js';
import type { MapDef } from '../src/map/types.js';

export const INTRO = { durationMs: 4500, countdownLeadMs: 3500, minimumMs: 1000 } as const;
export interface IntroPose {
  eye: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  fov: number;
}

/** One introduction per connection. Time spent preparing/paused never extends the
 * room's warmup. A changed deadline, live state or loss of control ends it forever. */
export class DeploymentIntro {
  private started = -1;
  private ends = 0;
  private deadline = 0;
  private done = false;
  private progress = 0;
  private still = false;
  private lastNow = -Infinity;
  active = false;

  update(state: ArenaState, serverNow: number, frameNow: number, available: boolean, reduced: boolean): boolean {
    const valid = Number.isFinite(serverNow) && Number.isFinite(frameNow) &&
      Number.isFinite(state.warmupEndMs) && state.warmupEndMs > 0;
    if (this.done) return false;
    if (state.mode === 3 || state.phase !== 'warmup') { this.skip(); return false; }
    if (this.started >= 0 && (!valid || !available || state.warmupEndMs !== this.deadline)) {
      this.skip(); return false;
    }
    if (!available) return false;
    // An operator already exploring a waiting lobby must not have their camera
    // taken later when another seat joins and arms the countdown.
    if (!valid) { this.skip(); return false; }
    const left = state.warmupEndMs - serverNow - INTRO.countdownLeadMs;
    if (this.started < 0) {
      if (left < INTRO.minimumMs) { this.skip(); return false; }
      this.started = frameNow;
      this.ends = frameNow + Math.min(INTRO.durationMs, left);
      this.deadline = state.warmupEndMs;
      this.still = reduced;
      this.progress = reduced ? .35 : 0;
    }
    this.lastNow = Math.max(this.lastNow, frameNow);
    if (left <= 0 || this.lastNow >= this.ends) { this.skip(); return false; }
    // Toggling Reduced motion freezes the current view; never restarts a flight.
    this.still ||= reduced;
    if (!this.still) this.progress = Math.max(this.progress, (this.lastNow - this.started) / INTRO.durationMs);
    this.active = true;
    return true;
  }

  skip(): boolean {
    const consumed = this.active;
    this.active = false; this.done = true;
    return consumed;
  }

  inspect() { return { active: this.active, progress: this.progress, still: this.still,
    startedAt: this.started, endsAt: this.ends, deadline: this.deadline, done: this.done }; }

  pose(map: MapDef, out: IntroPose): IntroPose { return introPose(map, this.progress, out); }
}

/** Authored glide above the existing yards. Remains inside bounds, above every
 * playable roof. Cut to the real eye on completion; never fly through cover. */
export function introPose(map: MapDef, progress: number, out: IntroPose): IntroPose {
  const t = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const s = t * t * (3 - 2 * t);
  const { width, depth } = map.bounds;
  out.eye.x = width * (.70 - .14 * s);
  out.eye.y = 30 - 8 * s;
  out.eye.z = depth * (.94 - .14 * s);
  out.target.x = width * .5;
  out.target.y = map.presentation === 'relay' ? 9 : 4;
  out.target.z = depth * (map.presentation === 'undertow' ? .32 : .38);
  out.fov = 68;
  return out;
}
