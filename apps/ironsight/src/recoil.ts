import type { WeaponSpec } from './config.js';

/** Angles are absolute offsets from mouse aim, in radians (+pitch is up).
 * First shot is centered, four vertical shots precede lateral drift. */
export interface RecoilProfile {
  readonly pattern: readonly (readonly [number, number])[];
  readonly recoverMs: number;
  readonly adsMul: number;
  readonly crouchMul: number;
  readonly hybridAfter: number;
  readonly hybridSpread: number;
}

const VERTICAL = [[0, 0], [0, .003], [0, .006], [0, .009]] as const;
export const RECOIL: readonly RecoilProfile[] = [
  { pattern: [...VERTICAL, [.002, .012], [.004, .015], [.006, .018], [.007, .021], [.005, .024], [.002, .026], [-.002, .028], [-.005, .030]], recoverMs: 300, adsMul: .65, crouchMul: .75, hybridAfter: 8, hybridSpread: .003 },
  { pattern: [...VERTICAL, [-.003, .012], [-.006, .014], [-.009, .016], [-.006, .018], [-.002, .020], [.004, .022], [.008, .024]], recoverMs: 250, adsMul: .7, crouchMul: .75, hybridAfter: 7, hybridSpread: .004 },
  { pattern: [[0, 0], [0, .018]], recoverMs: 350, adsMul: .8, crouchMul: .75, hybridAfter: 8, hybridSpread: .002 },
  { pattern: [[0, 0], [0, .025]], recoverMs: 400, adsMul: .5, crouchMul: .75, hybridAfter: 8, hybridSpread: .002 },
  { pattern: [[0, 0], [0, .004], [0, .008], [0, .012], [.002, .014], [.003, .016]], recoverMs: 280, adsMul: .65, crouchMul: .75, hybridAfter: 5, hybridSpread: .002 },
];

export interface RecoilState { slot: number; count: number; at: number }
export const emptyRecoil = (): RecoilState => ({ slot: 0, count: 0, at: 0 });

/** Silence is the release/recovery signal; a forged release cannot reset a spray.
 * Arrival time is authoritative. Slow single-shot weapons settle between shots. */
export function recoilSample(state: RecoilState, spec: WeaponSpec, now: number, ads = false) {
  const elapsed = Math.max(0, now - state.at);
  const settle = Math.max(0, Math.min(1, (elapsed - Math.min(150, spec.fireIntervalMs * 1.5)) / spec.recoil.recoverMs));
  const count = state.slot === spec.slot && settle < 1 ? state.count : 0;
  const point = spec.recoil.pattern[Math.min(count, spec.recoil.pattern.length - 1)] ?? [0, 0];
  const scale = (1 - settle) * (ads ? spec.recoil.adsMul : 1);
  return { index: count, yaw: point[0] * scale, pitch: point[1] * scale };
}

export function advanceRecoil(state: RecoilState, spec: WeaponSpec, now: number): RecoilState {
  return { slot: spec.slot, count: Math.min(spec.mag, recoilSample(state, spec, now).index + 1), at: now };
}

/** Rebuild only unacknowledged predictions after each authoritative reply.
 * A dropped shot cannot permanently advance the local pattern. */
export class RecoilPrediction {
  state = emptyRecoil();
  private pending: { seq: number; spec: WeaponSpec; at: number }[] = [];
  private ack = 0;
  reset(lastSentSeq = this.ack): void {
    this.ack = Math.max(this.ack, lastSentSeq);
    this.state = emptyRecoil(); this.pending = [];
  }
  fire(seq: number, spec: WeaponSpec, at: number): void {
    this.pending.push({ seq, spec, at });
    if (this.pending.length > 64) this.pending.shift();
    this.state = advanceRecoil(this.state, spec, at);
  }
  reconcile(seq: number, state: RecoilState): void {
    if (seq <= this.ack) return;
    this.ack = seq;
    this.pending = this.pending.filter(p => p.seq > seq);
    this.state = { ...state };
    for (const p of this.pending) this.state = advanceRecoil(this.state, p.spec, Math.max(state.at, p.at));
  }
}
