import type { ArenaState } from './schema.js';

/** End-of-round evidence only. Never used for damage, mode score or rewards. */
export interface RoundMvp {
  id: string;
  team: number;
  kills: number;
  assists: number;
  captureSeconds: number;
  score: number;
}

export interface RoundResult {
  /** Server-clock deadline for automatic return to warmup; older servers omit it. */
  intermissionEndMs?: number;
  winner: string;
  red: number;
  blue: number;
  /** Absent for draws, practice, zero contribution or an older server. */
  mvp?: RoundMvp;
}

/** Seat-scoped, bounded by room capacity. Reset with the round, not with a life.
 * Capture credit is actual gauge movement divided equally among living capturers:
 * idle ownership, contested flags and crowding cannot multiply contribution. */
export class RoundHonors {
  private readonly contributions = new Map<string, { assists: number; captureMs: number }>();

  private entry(id: string) {
    let value = this.contributions.get(id);
    if (!value) { value = { assists: 0, captureMs: 0 }; this.contributions.set(id, value); }
    return value;
  }

  assist(state: ArenaState, id: string | undefined, killer: string, victim: string): void {
    if (state.phase !== 'live' || state.mode === 3 || !id || id === killer || id === victim) return;
    const player = state.players[id], target = state.players[victim];
    if (!player || !target || (state.mode !== 1 && player.team === target.team)) return;
    this.entry(id).assists++;
  }

  capture(ids: readonly string[], progressMs: number): void {
    if (!ids.length || !Number.isFinite(progressMs) || progressMs <= 0) return;
    const share = progressMs / ids.length;
    for (const id of ids) this.entry(id).captureMs += share;
  }

  select(state: ArenaState, winner: string): RoundMvp | undefined {
    if (winner === 'draw' || state.mode === 3) return;
    const team = winner === 'red' ? 0 : winner === 'blue' ? 1 : -1;
    const candidates = Object.entries(state.players)
      .filter(([id, p]) => state.mode === 1 ? id === winner : p.team === team)
      .map(([id, p]) => {
        const credit = this.contributions.get(id);
        const captureSeconds = state.mode === 2 ? Math.floor(((credit?.captureMs ?? 0) + 1e-6) / 1000) : 0;
        const assists = credit?.assists ?? 0;
        return { id, team: p.team, kills: p.k, assists, captureSeconds,
          score: p.k * 2 + assists + captureSeconds, deaths: p.d };
      })
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score || b.captureSeconds - a.captureSeconds ||
        b.assists - a.assists || a.deaths - b.deaths || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const best = candidates[0];
    if (!best) return;
    const { deaths: _deaths, ...mvp } = best;
    return mvp;
  }

  forget(id: string): void { this.contributions.delete(id); }
  clear(): void { this.contributions.clear(); }
}
