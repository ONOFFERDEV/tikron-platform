import type { ArenaPlayer, ArenaState } from './schema.js';
import { nearestBox, type Box, type Bounds, type Vec3 } from './physics.js';

export const DRONE = { kills: 7, durationMs: 12000, cooldownMs: 60000, range: 22,
  warningMs: 900, intervalMs: 1800, damage: 34, dodgeRadius: .85, tether: 30 } as const;
export interface DroneLock { point: Vec3; fireAt: number }
export interface DroneFlight extends Vec3 { owner: string; team: number; startedAt: number; endsAt: number; lock: DroneLock | null }
export interface DroneView { queued: boolean; readyAt: number; flights: DroneFlight[] }
export interface DroneShot { owner: string; victim: string | null; origin: Vec3; point: Vec3 }
export const emptyDrone = (): DroneView => ({ queued: false, readyAt: 0, flights: [] });
interface Entry { flight: DroneFlight; target: string | null; nextAt: number }
const torso = (p: ArenaPlayer): Vec3 => ({ x: p.x, y: p.y + (p.crouch ? .65 : 1.1), z: p.z });
const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export function droneVisible(a: Vec3, b: Vec3, boxes: readonly Box[]): boolean {
  const d = distance(a, b);
  return d > .01 && nearestBox(a, { x: (b.x-a.x)/d, y: (b.y-a.y)/d, z: (b.z-a.z)/d }, boxes, d) >= d;
}

/** Stationary sentry, bounded by seats and one per team. Every lock is a frozen
 * aim point: move .85m or break LOS during the 900ms warning to evade. Its owner
 * must also see the target and stay within 30m; this never shoots over blind cover.
 * No activation/damage/target payload exists for a client to forge. */
export class DroneSupport {
  private readonly queue = new Set<string>();
  private readonly active = new Map<string, Entry>();
  private readonly ready = new Map<string, number>();
  private eligible(s: ArenaState) { return s.phase === 'live' && [0,2,3].includes(s.mode); }
  private key(id: string, p: ArenaPlayer, s: ArenaState) { return s.mode === 3 ? `solo:${id}` : `team:${p.team}`; }
  earn(id: string, count: number, s: ArenaState): void {
    if (count === DRONE.kills && s.players[id]?.alive && this.eligible(s)) this.queue.add(id);
  }
  private canTarget(s: ArenaState, f: DroneFlight, id: string, boxes: readonly Box[], practiceTargets: ReadonlyMap<string, unknown>): boolean {
    const p = s.players[id], owner = s.players[f.owner];
    return !!owner?.alive && !!p?.alive && !p.prot && id !== f.owner &&
      (s.mode === 3 ? practiceTargets.has(id) : p.team !== f.team) &&
      distance(f, torso(owner)) <= DRONE.tether && distance(f, torso(p)) <= DRONE.range &&
      droneVisible(f, torso(p), boxes) && droneVisible(torso(owner), torso(p), boxes);
  }
  tick(s: ArenaState, now: number, boxes: readonly Box[], bounds: Bounds, practiceTargets: ReadonlyMap<string, unknown>): { changed: boolean; shots: DroneShot[] } {
    if (!this.eligible(s)) { const changed = this.active.size + this.queue.size > 0; this.clear(); return { changed, shots: [] }; }
    let changed = false; const shots: DroneShot[] = [];
    for (const [key, e] of this.active) {
      const f = e.flight, owner = s.players[f.owner];
      if (!owner?.alive || this.key(f.owner, owner, s) !== key || now >= f.endsAt) {
        this.active.delete(key); changed = true; continue;
      }
      if (f.lock && now >= f.lock.fireAt) {
        const p = e.target ? s.players[e.target] : undefined;
        // Stalled ticks drop old shots, never compress missed volleys into a burst.
        if (now - f.lock.fireAt < 250 && droneVisible(f, f.lock.point, boxes)) {
          const hit = e.target && p && this.canTarget(s, f, e.target, boxes, practiceTargets) && distance(torso(p), f.lock.point) <= DRONE.dodgeRadius;
          shots.push({ owner: f.owner, victim: hit ? e.target : null, origin: { x:f.x,y:f.y,z:f.z }, point: { ...f.lock.point } });
        }
        f.lock = null; e.target = null; changed = true;
      }
      if (!f.lock && now >= e.nextAt && now + DRONE.warningMs < f.endsAt) {
        e.nextAt = now + DRONE.intervalMs;
        const target = Object.keys(s.players).filter(id => this.canTarget(s,f,id,boxes,practiceTargets))
          .sort((a,b) => distance(f,torso(s.players[a]!)) - distance(f,torso(s.players[b]!)) || a.localeCompare(b))[0];
        if (target) { e.target = target; f.lock = { point: torso(s.players[target]!), fireAt: now + DRONE.warningMs }; changed = true; }
      }
    }
    for (const id of this.queue) {
      const p = s.players[id];
      if (!p?.alive) { this.queue.delete(id); changed = true; continue; }
      const key = this.key(id,p,s);
      if (this.active.has(key) || now < (this.ready.get(key) ?? 0)) continue;
      // Prefer ahead/right, then test the other shoulders. A single obstructed
      // side must not strand an earned reward beside otherwise open cover.
      const point = [[4,3],[4,-3],[-4,3],[-4,-3]].map(([forward,side])=>({
        x:p.x+Math.sin(p.yaw)*forward!+Math.cos(p.yaw)*side!, y:p.y+3.2,
        z:p.z+Math.cos(p.yaw)*forward!-Math.sin(p.yaw)*side!,
      })).find(q=>q.x>=1.6 && q.z>=1.6 && q.x<=bounds.width-1.6 && q.z<=bounds.depth-1.6 && q.y<=bounds.ceiling-1 &&
        !boxes.some(b=>q.x+1.6>b.min.x && q.x-1.6<b.max.x && q.z+1.3>b.min.z && q.z-1.3<b.max.z && q.y+.5>b.min.y && q.y-.5<b.max.y) &&
        droneVisible(torso(p),q,boxes) && nearestBox(q,{x:0,y:1,z:0},boxes,100)>=100);
      if (!point) continue;
      this.queue.delete(id); this.ready.set(key,now+DRONE.cooldownMs);
      this.active.set(key,{ target:null, nextAt:now+600, flight:{ ...point,owner:id,team:p.team,startedAt:now,endsAt:now+DRONE.durationMs,lock:null } });
      changed = true;
    }
    return { changed, shots };
  }
  /** Explicit mild catch-up: one consumed hostile flight, gun/grenade shutdown
   * only, +1 TDM point when behind by 5, +5 DOM when behind by 20. No stat buff. */
  shutdown(victim: string, killer: string, s: ArenaState, now: number): number {
    const p = s.players[killer];
    if (!p?.alive || ![0,2].includes(s.mode) || s.phase !== 'live') return 0;
    const entry = [...this.active.entries()].find(([,e]) => e.flight.owner === victim && e.flight.team !== p.team && now < e.flight.endsAt);
    if (!entry) return 0;
    this.active.delete(entry[0]);
    const deficit = p.team === 0 ? s.blueScore-s.redScore : s.redScore-s.blueScore;
    return deficit >= (s.mode === 2 ? 20 : 5) ? (s.mode === 2 ? 5 : 1) : 0;
  }
  view(id: string, s: ArenaState, boxes: readonly Box[]): DroneView {
    const p = s.players[id]; if (!p || !this.eligible(s)) return emptyDrone();
    return { queued: p.alive && this.queue.has(id), readyAt:this.ready.get(this.key(id,p,s)) ?? 0,
      flights:[...this.active.values()].filter(e=>s.mode !== 3 || e.flight.owner===id).map(({flight:f,target})=>({ ...f,lock:f.lock && p.alive && (target===id || distance(torso(p),f)<40 && droneVisible(torso(p),f.lock.point,boxes)) ? {point:{...f.lock.point},fireAt:f.lock.fireAt}:null })) };
  }
  forget(id: string): void {
    this.queue.delete(id); this.ready.delete(`solo:${id}`);
    for (const [key,e] of this.active) if (e.flight.owner === id) this.active.delete(key);
  }
  clear(): void { this.queue.clear(); this.active.clear(); this.ready.clear(); }
}
