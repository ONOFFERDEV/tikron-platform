import type { ArenaPlayer, ArenaState } from './schema.js';
import { nearestBox, type Box, type Bounds, type Vec3 } from './physics.js';
import { dirFromAngles } from './weapons.js';

export const MORTAR = { kills: 5, range: 60, minimumRange: 8, warningMs: 3000,
  intervalMs: 650, rounds: 3, radius: 6, damage: 125, cooldownMs: 45000, tailMs: 1600 } as const;
export interface MortarStrike extends Vec3 { owner: string; team: number; startedAt: number; endsAt: number }
export interface MortarView { available: boolean; readyAt: number; strikes: MortarStrike[] }
export const emptyMortar = (): MortarView => ({ available: false, readyAt: 0, strikes: [] });

/** Aim is an intent. The server supplies origin, range, surface and sky clearance.
 * This tier designates open ground: roofs, walls and ramps explicitly reject. */
export function mortarTarget(p: ArenaPlayer, yaw: number, pitch: number, boxes: readonly Box[], bounds: Bounds): Vec3 | null {
  if (!Number.isFinite(yaw) || !Number.isFinite(pitch) || Math.abs(pitch) > Math.PI / 2) return null;
  const dir = dirFromAngles(yaw, pitch), origin = { x: p.x, y: p.y + (p.crouch ? 1 : 1.65), z: p.z };
  if (dir.y >= -.001) return null;
  const distance = -origin.y / dir.y;
  if (distance < MORTAR.minimumRange || distance > MORTAR.range || nearestBox(origin, dir, boxes, distance) < distance - .01) return null;
  const x = origin.x + dir.x * distance, z = origin.z + dir.z * distance;
  if (x < 1 || z < 1 || x > bounds.width - 1 || z > bounds.depth - 1) return null;
  const point = { x, y: .12, z };
  return nearestBox(point, { x: 0, y: 1, z: 0 }, boxes, 100) < 100 ? null : point;
}

/** Bounded room scheduler. Death discards uncalled charges and cancels remaining
 * shells. Team cooldown survives death; room reset clears it. No client timers. */
export class MortarSupport {
  private readonly charges = new Set<string>();
  private readonly active = new Map<string, { strike: MortarStrike; next: number }>();
  private readonly cooldown = new Map<string, number>();
  private key(id: string, p: ArenaPlayer, mode: number) { return mode === 3 ? `solo:${id}` : `team:${p.team}`; }
  private eligible(s: ArenaState) { return s.phase === 'live' && [0, 2, 3].includes(s.mode); }
  hasCharge(id: string): boolean { return this.charges.has(id); }
  earn(id: string, count: number, s: ArenaState): void {
    if (count === MORTAR.kills && s.players[id]?.alive && this.eligible(s)) this.charges.add(id);
  }
  call(id: string, s: ArenaState, now: number, point: Vec3): boolean {
    const p = s.players[id];
    if (!p?.alive || !this.eligible(s) || !this.charges.has(id)) return false;
    const key = this.key(id, p, s.mode);
    if (this.active.has(key) || now < (this.cooldown.get(key) ?? 0)) return false;
    this.charges.delete(id); this.cooldown.set(key, now + MORTAR.cooldownMs);
    this.active.set(key, { next: 0, strike: { ...point, owner: id, team: p.team, startedAt: now,
      endsAt: now + MORTAR.warningMs + (MORTAR.rounds - 1) * MORTAR.intervalMs + MORTAR.tailMs } });
    return true;
  }
  tick(s: ArenaState, now: number): { changed: boolean; impacts: MortarStrike[] } {
    if (!this.eligible(s)) { const changed = this.active.size + this.charges.size > 0; this.clear(); return { changed, impacts: [] }; }
    let changed = false; const impacts: MortarStrike[] = [];
    for (const id of this.charges) if (!s.players[id]?.alive) { this.charges.delete(id); changed = true; }
    for (const [key, entry] of this.active) {
      const { strike } = entry, p = s.players[strike.owner];
      if (!p?.alive || key !== this.key(strike.owner, p, s.mode) || now >= strike.endsAt) {
        this.active.delete(key); changed = true; continue;
      }
      const due = Math.floor((now - strike.startedAt - MORTAR.warningMs) / MORTAR.intervalMs);
      if (due >= entry.next && entry.next < MORTAR.rounds) {
        // A stalled worker never replays a stack of missed damage at once.
        entry.next = Math.min(MORTAR.rounds, due + 1); changed = true;
        if (due < MORTAR.rounds) impacts.push({ ...strike });
      }
    }
    return { changed, impacts };
  }
  view(id: string, s: ArenaState): MortarView {
    const p = s.players[id]; if (!p || !this.eligible(s)) return emptyMortar();
    return { available: p.alive && this.charges.has(id), readyAt: this.cooldown.get(this.key(id, p, s.mode)) ?? 0,
      strikes: [...this.active.values()].filter(({ strike }) => s.mode !== 3 || strike.owner === id).map(({ strike }) => ({ ...strike })) };
  }
  forget(id: string): void {
    this.charges.delete(id); this.cooldown.delete(`solo:${id}`);
    for (const [key, e] of this.active) if (e.strike.owner === id) this.active.delete(key);
  }
  clear(): void { this.charges.clear(); this.active.clear(); this.cooldown.clear(); }
}
