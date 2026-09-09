import type { MatchPhase } from './schema.js';

/** One server-authored epoch per round. No client input can trigger or extend it. */
export const SIGNAL = { firstWarningMs: 30000, warningMs: 8000, blackoutMs: 15000,
  recoveryMs: 3000, periodMs: 90000, turnMs: 6000 } as const;
export type SignalPhase = 'idle' | 'warning' | 'blackout' | 'recovery';
export interface SignalFrame {
  phase: SignalPhase; cycle: number; elapsedMs: number; remainingMs: number;
  /** Absolute dish pose: reconnect/frame rate never integrates another rotation. */
  alignment: number;
}
export function signalFrame(epoch: number, phase: MatchPhase, now: number): SignalFrame {
  const idle: SignalFrame = { phase: 'idle', cycle: -1, elapsedMs: 0, remainingMs: 0, alignment: 0 };
  if (!Number.isFinite(epoch) || epoch <= 0 || !Number.isFinite(now) || phase !== 'live') return idle;
  const age = now - epoch;
  if (age < 0) return idle;
  const cycle = Math.floor(age / SIGNAL.periodMs), elapsed = age % SIGNAL.periodMs;
  const previous = cycle % 2;
  if (elapsed < SIGNAL.warningMs)
    return { phase: 'warning', cycle, elapsedMs: elapsed, remainingMs: SIGNAL.warningMs - elapsed, alignment: previous };
  const turning = elapsed - SIGNAL.warningMs;
  const t = Math.min(1, turning / SIGNAL.turnMs), smooth = t * t * (3 - 2 * t);
  const alignment = previous + (previous ? -smooth : smooth);
  if (turning < SIGNAL.blackoutMs)
    return { phase: 'blackout', cycle, elapsedMs: turning, remainingMs: SIGNAL.blackoutMs - turning, alignment };
  const recovery = turning - SIGNAL.blackoutMs;
  if (recovery < SIGNAL.recoveryMs)
    return { phase: 'recovery', cycle, elapsedMs: recovery, remainingMs: SIGNAL.recoveryMs - recovery, alignment };
  return { ...idle, cycle, alignment };
}

/** Seed from a room reset, never a join, respawn or client clock. */
export function signalEpoch(presentation: string | undefined, live: boolean, now: number): number {
  return presentation === 'relay' && live ? now + SIGNAL.firstWarningMs : 0;
}
