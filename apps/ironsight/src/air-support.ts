import type { ArenaPlayer, ArenaState } from './schema.js';

/** Air Support arc: recon is the first earned tier. No client activation message. */
export const RECON = { kills: 3, durationMs: 12000, pulseDelayMs: 2000, pulseEveryMs: 4000,
  contactMs: 2200, cooldownMs: 30000 } as const;
export interface ReconFlight { owner: string; team: number; startedAt: number; endsAt: number }
export interface ReconScan { startedAt: number; sampledAt: number; expiresAt: number; contacts: { x: number; z: number }[] }
export interface SupportView { count: number; queued: boolean; readyAt: number; flights: ReconFlight[]; scan: ReconScan | null }
interface Flight extends ReconFlight { key: string; pulse: number; scan: ReconScan | null }

/** Room-local, bounded by seats. Cold restore already starts a fresh round. */
export class AirSupport {
  private readonly flights = new Map<string, Flight>();
  private readonly queue = new Map<string, string>();
  private readonly ready = new Map<string, number>();
  private key(id: string, p: ArenaPlayer, mode: number): string { return mode === 3 ? `solo:${id}` : `team:${p.team}`; }
  eligible(state: ArenaState): boolean { return state.phase === 'live' && [0, 2, 3].includes(state.mode); }

  earn(id: string, count: number, state: ArenaState): void {
    const p = state.players[id];
    if (count === RECON.kills && this.eligible(state) && p?.alive)
      this.queue.set(id, this.key(id, p, state.mode));
  }

  /** Returns true only on a launch, pulse, cancellation or expiry. A delayed tick
   * takes ONE current snapshot, never replays missed scans. Blackout consumes the
   * pulse without sampling, so recovery cannot resurrect hidden enemy locations. */
  tick(state: ArenaState, now: number, blackout: boolean): boolean {
    if (!this.eligible(state)) {
      const changed = this.flights.size > 0 || this.queue.size > 0;
      this.clear(); return changed;
    }
    let changed = false;
    for (const [key, f] of this.flights) {
      const p = state.players[f.owner];
      if (!p?.alive || this.key(f.owner, p, state.mode) !== key || now >= f.endsAt) {
        this.flights.delete(key); changed = true; continue;
      }
      if (blackout && f.scan) { f.scan = null; changed = true; }
      const pulse = Math.floor((now - f.startedAt - RECON.pulseDelayMs) / RECON.pulseEveryMs);
      if (pulse >= 0 && pulse > f.pulse) {
        f.pulse = pulse; changed = true;
        f.scan = blackout ? null : { startedAt: f.startedAt, sampledAt: now,
          expiresAt: Math.min(now + RECON.contactMs, f.endsAt),
          contacts: Object.entries(state.players).filter(([id, enemy]) => id !== f.owner && enemy.alive && !enemy.prot &&
            (state.mode === 3 || enemy.team !== f.team)).slice(0, 12)
            .map(([, enemy]) => ({ x: Math.round(enemy.x), z: Math.round(enemy.z) })) };
      }
    }
    for (const [id, key] of this.queue) {
      const p = state.players[id];
      if (!p?.alive || this.key(id, p, state.mode) !== key) { this.queue.delete(id); changed = true; continue; }
      if (this.flights.has(key) || now < (this.ready.get(key) ?? 0) || blackout) continue;
      this.queue.delete(id);
      this.flights.set(key, { key, owner: id, team: p.team, startedAt: now, endsAt: now + RECON.durationMs, pulse: -1, scan: null });
      this.ready.set(key, now + RECON.cooldownMs); changed = true;
    }
    return changed;
  }

  view(id: string, count: number, state: ArenaState, now: number): SupportView {
    const p = state.players[id];
    if (!p || !this.eligible(state)) return { count: 0, queued: false, readyAt: 0, flights: [], scan: null };
    const key = this.key(id, p, state.mode), own = this.flights.get(key);
    // Only public flight metadata goes to opponents. Never send IDs, health,
    // live positions or private scans across teams (including syncView).
    return { count, queued: this.queue.has(id), readyAt: this.ready.get(key) ?? 0,
      flights: [...this.flights.values()].filter(f => now < f.endsAt && (state.mode !== 3 || f.owner === id))
        .map(({ owner, team, startedAt, endsAt }) => ({ owner, team, startedAt, endsAt })),
      scan: p.alive && own?.scan && own.scan.expiresAt > now ? own.scan : null };
  }
  forget(id: string): void { this.queue.delete(id); this.ready.delete(`solo:${id}`); }
  clear(): void { this.flights.clear(); this.queue.clear(); this.ready.clear(); }
}
