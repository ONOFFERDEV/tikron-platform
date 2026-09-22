import type { ArenaPlayer, ArenaState } from './schema.js';
import { nearestBox, type Box, type Bounds, type Vec3 } from './physics.js';
import { rampSurfaceY } from './physics.js';
import type { RampDef } from './map/types.js';

export const STRAFE = {
  kills: 7, warningMs: 3_000, passMs: 2_000, corridorLength: 60, corridorWidth: 4,
  bursts: 4, intervalMs: 500, damage: 25, cooldownMs: 60_000, altitude: 8,
  presentation: 'fixed_linear_strafing', warningCue: 'aircraft_approach', passCue: 'biplane_strafe',
} as const;

export interface StrafeCorridor {
  readonly start: Vec3;
  readonly end: Vec3;
  readonly width: number;
}
export interface StrafeFlight extends Vec3 {
  readonly kind: 'attack_biplane';
  readonly owner: string;
  readonly team: number;
  readonly startedAt: number;
  readonly warningEndsAt: number;
  readonly endsAt: number;
  readonly corridor: StrafeCorridor;
}
export interface StrafeView {
  readonly protocol: 2;
  readonly kind: 'fixed_linear_strafe';
  readonly queued: boolean;
  readonly readyAt: number;
  readonly flights: readonly StrafeFlight[];
}
export interface StrafeShot {
  readonly owner: string;
  readonly victim: string;
  readonly origin: Vec3;
  readonly point: Vec3;
  readonly burst: number;
}

interface ActiveFlight { readonly key: string; readonly flight: StrafeFlight; nextBurst: number }
const torso = (player: ArenaPlayer): Vec3 => ({
  x: player.x, y: player.y + (player.crouch ? .65 : 1.1), z: player.z,
});
const teamKey = (id: string, player: ArenaPlayer, mode: number): string =>
  mode === 3 ? `solo:${id}` : `team:${player.team}`;
const eligible = (state: ArenaState): boolean => state.phase === 'live' && [0, 2, 3].includes(state.mode);

function corridorFor(player: ArenaPlayer, bounds: Bounds): StrafeCorridor {
  const half = STRAFE.corridorLength / 2;
  const alongX = Math.abs(Math.sin(player.yaw)) >= Math.abs(Math.cos(player.yaw));
  if (alongX) {
    const center = Math.min(bounds.width - half - 1, Math.max(half + 1, player.x));
    const z = Math.min(bounds.depth - 1, Math.max(1, player.z));
    const sign = Math.sin(player.yaw) < 0 ? -1 : 1;
    return { start: { x: center - sign * half, y: 0, z }, end: { x: center + sign * half, y: 0, z }, width: STRAFE.corridorWidth };
  }
  const center = Math.min(bounds.depth - half - 1, Math.max(half + 1, player.z));
  const x = Math.min(bounds.width - 1, Math.max(1, player.x));
  const sign = Math.cos(player.yaw) < 0 ? -1 : 1;
  return { start: { x, y: 0, z: center - sign * half }, end: { x, y: 0, z: center + sign * half }, width: STRAFE.corridorWidth };
}

function rampOccludes(origin: Vec3, target: Vec3, ramps: readonly RampDef[]): boolean {
  const interval = (start: number, delta: number, min: number, max: number): readonly [number, number] | null => {
    if (Math.abs(delta) < 1e-9) return start >= min && start <= max ? [0, 1] : null;
    const a = (min - start) / delta, b = (max - start) / delta;
    return [Math.min(a, b), Math.max(a, b)];
  };
  const dx = target.x - origin.x, dy = target.y - origin.y, dz = target.z - origin.z;
  for (const ramp of ramps) {
    const tx = interval(origin.x, dx, ramp.minX, ramp.maxX);
    const tz = interval(origin.z, dz, ramp.minZ, ramp.maxZ);
    if (!tx || !tz) continue;
    const enter = Math.max(0, tx[0], tz[0]), exit = Math.min(1, tx[1], tz[1]);
    if (enter > exit) continue;
    for (const t of [enter, exit]) {
      const x = origin.x + dx * t, y = origin.y + dy * t, z = origin.z + dz * t;
      if (y >= (ramp.baseY ?? 0) - .01 && y <= rampSurfaceY(ramp, x, z) + .01) return true;
    }
  }
  return false;
}

function visible(origin: Vec3, target: Vec3, boxes: readonly Box[], ramps: readonly RampDef[]): boolean {
  const dx = target.x - origin.x, dy = target.y - origin.y, dz = target.z - origin.z;
  const distance = Math.hypot(dx, dy, dz);
  return distance > .01 && nearestBox(origin, { x: dx / distance, y: dy / distance, z: dz / distance }, boxes, distance) >= distance
    && !rampOccludes(origin, target, ramps);
}

function atBurst(corridor: StrafeCorridor, burst: number): Vec3 {
  const t = (burst + .5) / STRAFE.bursts;
  return {
    x: corridor.start.x + (corridor.end.x - corridor.start.x) * t,
    y: STRAFE.altitude,
    z: corridor.start.z + (corridor.end.z - corridor.start.z) * t,
  };
}

function insideBurst(player: ArenaPlayer, corridor: StrafeCorridor, burst: number): boolean {
  const dx = corridor.end.x - corridor.start.x, dz = corridor.end.z - corridor.start.z;
  const length = Math.hypot(dx, dz), ux = dx / length, uz = dz / length;
  const px = player.x - corridor.start.x, pz = player.z - corridor.start.z;
  const along = px * ux + pz * uz, across = Math.abs(px * -uz + pz * ux);
  const center = (burst + .5) * length / STRAFE.bursts;
  return across <= corridor.width / 2 && Math.abs(along - center) <= length / STRAFE.bursts / 2;
}

export class StrafeSupport {
  private readonly queue = new Set<string>();
  private readonly active = new Map<string, ActiveFlight>();
  private readonly ready = new Map<string, number>();

  earn(id: string, count: number, state: ArenaState): void {
    if (count === STRAFE.kills && state.players[id]?.alive && eligible(state)) this.queue.add(id);
  }

  tick(state: ArenaState, now: number, boxes: readonly Box[], bounds: Bounds,
    practiceTargets: ReadonlyMap<string, unknown>, ramps: readonly RampDef[] = []): { changed: boolean; shots: StrafeShot[] } {
    if (!eligible(state)) {
      const changed = this.active.size > 0 || this.queue.size > 0;
      this.clear();
      return { changed, shots: [] };
    }
    let changed = false;
    const shots: StrafeShot[] = [];
    for (const [key, entry] of this.active) {
      const flight = entry.flight, owner = state.players[flight.owner];
      if (!owner?.alive || teamKey(flight.owner, owner, state.mode) !== key || now >= flight.endsAt) {
        this.active.delete(key); changed = true; continue;
      }
      const due = Math.floor((now - flight.warningEndsAt) / STRAFE.intervalMs);
      if (due < entry.nextBurst || entry.nextBurst >= STRAFE.bursts) continue;
      const burst = Math.min(due, STRAFE.bursts - 1);
      entry.nextBurst = burst + 1; changed = true;
      if (now - (flight.warningEndsAt + burst * STRAFE.intervalMs) >= 250) continue;
      const origin = atBurst(flight.corridor, burst);
      for (const [id, target] of Object.entries(state.players)) {
        const hostile = state.mode === 3 ? practiceTargets.has(id) : target.team !== flight.team;
        if (id === flight.owner || !hostile || !target.alive || target.prot || !insideBurst(target, flight.corridor, burst)) continue;
        const point = torso(target);
        if (visible(origin, point, boxes, ramps)) shots.push({ owner: flight.owner, victim: id, origin, point, burst });
      }
    }
    for (const id of this.queue) {
      const owner = state.players[id];
      if (!owner?.alive) { this.queue.delete(id); changed = true; continue; }
      const key = teamKey(id, owner, state.mode);
      if (this.active.has(key) || now < (this.ready.get(key) ?? 0)) continue;
      const corridor = corridorFor(owner, bounds);
      const start = { ...corridor.start, y: STRAFE.altitude };
      this.queue.delete(id); this.ready.set(key, now + STRAFE.cooldownMs);
      this.active.set(key, { key, nextBurst: 0, flight: { ...start, kind: 'attack_biplane', owner: id,
        team: owner.team, startedAt: now, warningEndsAt: now + STRAFE.warningMs,
        endsAt: now + STRAFE.warningMs + STRAFE.passMs, corridor } });
      changed = true;
    }
    return { changed, shots };
  }

  view(id: string, state: ArenaState): StrafeView {
    const player = state.players[id];
    if (!player || !eligible(state)) return { protocol: 2, kind: 'fixed_linear_strafe', queued: false, readyAt: 0, flights: [] };
    return { protocol: 2, kind: 'fixed_linear_strafe', queued: player.alive && this.queue.has(id),
      readyAt: this.ready.get(teamKey(id, player, state.mode)) ?? 0,
      flights: [...this.active.values()].filter(({ flight }) => state.mode !== 3 || flight.owner === id).map(({ flight }) => flight) };
  }

  forget(id: string): void {
    this.queue.delete(id); this.ready.delete(`solo:${id}`);
    for (const [key, entry] of this.active) if (entry.flight.owner === id) this.active.delete(key);
  }
  clear(): void { this.queue.clear(); this.active.clear(); this.ready.clear(); }
}
