import type { ArenaState } from '../src/schema.js';

export function warmupSeconds(state: ArenaState, serverNow: number): number | null {
  if (state.phase !== 'warmup' || !(state.warmupEndMs > 0) ||
      !Number.isFinite(state.warmupEndMs) || !Number.isFinite(serverNow)) return null;
  return Math.max(0, Math.ceil((state.warmupEndMs - serverNow) / 1000));
}

export type DeploymentCue = 'tick' | 'go';
export interface DeploymentFrame {
  kind: 'hidden' | 'waiting' | 'countdown' | 'standby' | 'go';
  seconds: number;
  cue?: DeploymentCue;
}

/** Observe every frame, including pause/disconnect. Never schedule future audio,
 * replay missed numbers, or infer LIVE from the expiry of a client clock. */
export class DeploymentPresentation {
  private phase: ArenaState['phase'] | undefined;
  private deadline = 0;
  private lowestSeconds = Infinity;
  private active = false;
  private goUntil = 0;

  update(state: ArenaState, serverNow: number, active: boolean, frameNow = serverNow): DeploymentFrame {
    active &&= Number.isFinite(serverNow) && Number.isFinite(frameNow) && state.mode !== 3;
    const seconds = warmupSeconds(state, serverNow);
    let cue: DeploymentCue | undefined;
    if (active && this.active) {
      if (state.phase === 'live' && this.phase === 'warmup' && this.deadline > 0 &&
          Math.abs(serverNow - this.deadline) <= 1500) {
        this.goUntil = frameNow + 2200;
        cue = 'go';
      } else if (state.phase === 'warmup' && this.phase === 'warmup' &&
          state.warmupEndMs === this.deadline && seconds !== null &&
          seconds < this.lowestSeconds && seconds >= 1 && seconds <= 3 &&
          state.warmupEndMs - serverNow > (seconds - .3) * 1000) cue = 'tick';
    }
    if (!active || state.phase !== 'live' || frameNow >= this.goUntil) this.goUntil = 0;
    if (this.phase !== state.phase || this.deadline !== state.warmupEndMs) this.lowestSeconds = Infinity;
    this.lowestSeconds = Math.min(this.lowestSeconds, seconds ?? Infinity);
    this.phase = state.phase; this.deadline = state.warmupEndMs; this.active = active;
    if (!active) return { kind: 'hidden', seconds: 0 };
    if (state.phase === 'warmup') return {
      kind: seconds === null ? 'waiting' : seconds === 0 ? 'standby' : 'countdown',
      seconds: seconds ?? 0, cue,
    };
    return { kind: state.phase === 'live' && frameNow < this.goUntil ? 'go' : 'hidden', seconds: 0, cue };
  }
}
