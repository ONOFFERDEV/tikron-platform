import type { ArenaState } from './schema.js';
import type { Box, Bounds, Vec3 } from './physics.js';
import type { RampDef } from './map/types.js';
import { STRAFE, StrafeSupport, type StrafeCorridor, type StrafeShot } from './strafe-support.js';

export const DRONE = { ...STRAFE, durationMs: STRAFE.warningMs + STRAFE.passMs } as const;
export interface DroneLock { readonly point: Vec3; readonly fireAt: number }
export interface DroneFlight extends Vec3 { readonly owner: string; readonly team: number; readonly startedAt: number;
  readonly endsAt: number; readonly lock: DroneLock | null; readonly kind?: 'attack_biplane';
  readonly warningEndsAt?: number; readonly corridor?: StrafeCorridor }
export interface DroneView { readonly queued: boolean; readonly readyAt: number; readonly flights: readonly DroneFlight[];
  readonly protocol?: 2; readonly kind?: 'fixed_linear_strafe' }
export type DroneShot = StrafeShot;
export const emptyDrone = (): DroneView => ({
  protocol: 2, kind: 'fixed_linear_strafe', queued: false, readyAt: 0, flights: [],
});

/** Wire-name compatibility while shared consumers migrate from `drone` to
 * `strafe`. Runtime behavior is exclusively the fixed linear biplane pass. */
export class DroneSupport {
  private readonly support = new StrafeSupport();

  earn(id: string, count: number, state: ArenaState): void { this.support.earn(id, count, state); }
  tick(state: ArenaState, now: number, boxes: readonly Box[], bounds: Bounds,
    practiceTargets: ReadonlyMap<string, unknown>, ramps: readonly RampDef[] = []) {
    return this.support.tick(state, now, boxes, bounds, practiceTargets, ramps);
  }
  view(id: string, state: ArenaState, _boxes?: readonly Box[]): DroneView {
    const view = this.support.view(id, state);
    return { ...view, flights: view.flights.map(flight => ({ ...flight, lock: null })) };
  }
  shutdown(_victim: string, _killer: string, _state: ArenaState, _now: number): number { return 0; }
  forget(id: string): void { this.support.forget(id); }
  clear(): void { this.support.clear(); }
}
