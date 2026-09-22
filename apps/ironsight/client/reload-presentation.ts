import type { WeaponActionState } from "../src/weapon-action.js";

/** Cosmetic timeline driven only by server ammo acknowledgements. */
export class ReloadPresentation {
  private started = 0;
  private until = 0;
  private duration = 0;
  sync(remainingMs: number, durationMs: number, now: number): void {
    if (!Number.isFinite(remainingMs) || remainingMs <= 0) { this.until = 0; return; }
    this.duration = Math.max(1, durationMs, remainingMs);
    this.until = now + remainingMs;
    this.started = this.until - this.duration;
  }
  progress(now: number): number | null {
    return this.until > now ? Math.max(0, Math.min(1, (now - this.started) / this.duration)) : null;
  }
}
const smooth = (p: number, a: number, b: number): number => {
  const t = Math.max(0, Math.min(1, (p - a) / (b - a))); return t * t * (3 - 2 * t);
};
/** Magazine out -> insert -> charging handle -> return; normalized to the
 * authoritative weapon duration, never changes ammo or enables firing. */
export function reloadPose(progress: number | null) {
  const p = progress ?? 1;
  return {
    tilt: smooth(p, 0, 0.14) * (1 - smooth(p, 0.82, 1)),
    magazine: smooth(p, 0.18, 0.34) * (1 - smooth(p, 0.48, 0.64)),
    reach: smooth(p, 0.08, 0.18) * (1 - smooth(p, 0.65, 0.76)),
    chargeReach: smooth(p, 0.68, 0.74) * (1 - smooth(p, 0.86, 0.94)),
    bolt: smooth(p, 0.72, 0.78) * (1 - smooth(p, 0.80, 0.86)),
    phase: progress === null ? 'idle' : p < 0.18 ? 'reach' : p < 0.48 ? 'mag-out' : p < 0.70 ? 'mag-in' : p < 0.86 ? 'bolt' : 'return',
  };
}

/** State deadlines survive AOI entry and reconnect without replaying a start event. */
export function remoteReloadProgress(alive: boolean, end: number, duration: number, now: number): number | null {
  if (!alive || !Number.isFinite(end) || !Number.isFinite(now) || !Number.isFinite(duration) || duration <= 0 || end <= now) return null;
  return Math.max(0, Math.min(1, 1 - (end - now) / duration));
}

export type InspectionWeaponAction = {
  readonly state: WeaponActionState | null;
  readonly serverNow: number;
  readonly provenance: "synthetic-inspector";
};

/** Visual-only adapter for the deterministic inspector. It exercises the same
 * presentation contract as gameplay but never represents server or player input. */
export function inspectionWeaponAction(weaponIndex: number, progress: number | null, intent: "reload" | "cycle" = "reload"): InspectionWeaponAction {
  const idle = { state: null, serverNow: 0, provenance: "synthetic-inspector" as const };
  if (progress === null || !Number.isFinite(progress) || !Number.isInteger(weaponIndex)
      || weaponIndex < 0 || weaponIndex > 4) return idle;
  const overall = Math.max(0, Math.min(1 - Number.EPSILON, progress));
  if (intent === "cycle" && (weaponIndex === 2 || weaponIndex === 3)) {
    const state: WeaponActionState = {
      weaponIndex, kind: "cycle", phase: "cycle", startedAt: 0, phaseStartedAt: 0, endsAt: 1,
      serial: 0, committed: 0, fireBuffered: false,
    };
    return { state, serverNow: overall, provenance: "synthetic-inspector" };
  }
  let kind: WeaponActionState["kind"] = weaponIndex === 3 ? "bolt_reload" : "magazine_reload";
  let phase: WeaponActionState["phase"] = "reload";
  let local = overall;
  if (weaponIndex === 2) {
    kind = "pump_reload";
    if (overall < .46) { phase = "reload_start"; local = overall / .46; }
    else if (overall < .76) { phase = "reload_insert"; local = (overall - .46) / .3; }
    else { phase = "reload_end"; local = (overall - .76) / .24; }
  }
  const state: WeaponActionState = {
    weaponIndex, kind, phase, startedAt: 0, phaseStartedAt: 0, endsAt: 1,
    serial: 0, committed: 0, fireBuffered: false,
  };
  return { state, serverNow: Math.min(1 - Number.EPSILON, Math.max(0, local)), provenance: "synthetic-inspector" };
}
export type WeaponActionPose = ReturnType<typeof reloadPose> & {
  readonly pump: number;
  readonly shell: number;
  readonly clip: number;
  readonly boltLift: number;
  readonly boltPull: number;
  readonly boltReturn: number;
  readonly boltLock: number;
  readonly progress: number;
};

const actionProgress = (state: WeaponActionState, now: number): number => {
  const duration = Math.max(1, state.endsAt - state.phaseStartedAt);
  return Math.max(0, Math.min(1, 1 - (state.endsAt - now) / duration));
};

export function weaponActionPose(state: WeaponActionState | null, now: number): WeaponActionPose {
  const idle = { ...reloadPose(null), pump: 0, shell: 0, clip: 0,
    boltLift: 0, boltPull: 0, boltReturn: 0, boltLock: 0, progress: 0 };
  if (state === null || state.endsAt <= now || now < state.phaseStartedAt) return idle;
  const progress = actionProgress(state, now);
  if (state.kind === "magazine_reload") return { ...idle, ...reloadPose(progress), progress };
  if (state.kind === "cycle") {
    if (state.weaponIndex === 3) return boltPose(progress, idle);
    return { ...idle, pump: state.weaponIndex === 2 ? Math.sin(progress * Math.PI) : 0, progress, phase: "cycle" };
  }
  if (state.kind === "bolt_reload") {
    const bolt = boltPose(progress, idle);
    const reload = reloadPose(progress);
    return { ...reload, ...bolt, magazine: 0, pump: 0,
      clip: smooth(progress, .08, .28) * (1 - smooth(progress, .62, .86)), progress, phase: reload.phase };
  }
  const stage = state.phase;
  const travel = Math.sin(progress * Math.PI);
  return {
    ...reloadPose(null),
    tilt: stage === "reload_end" ? 1 - progress : Math.min(1, progress * 2),
    reach: stage === "reload_insert" ? 1 : travel,
    pump: stage === "reload_end" ? travel : 0,
    shell: stage === "reload_insert" ? smooth(progress, .05, .25) * (1 - smooth(progress, .68, .9)) : 0,
    clip: 0,
    boltLift: 0,
    boltPull: 0,
    boltReturn: 0,
    boltLock: 0,
    progress,
    phase: stage,
  };
}

function boltPose(progress: number, idle: WeaponActionPose): WeaponActionPose {
  const boltLift = smooth(progress, .04, .16) * (1 - smooth(progress, .2, .34));
  const boltPull = smooth(progress, .18, .38) * (1 - smooth(progress, .52, .68));
  const boltReturn = smooth(progress, .5, .68) * (1 - smooth(progress, .76, .88));
  const boltLock = smooth(progress, .78, .94);
  const bolt = smooth(progress, .18, .38) * (1 - smooth(progress, .52, .82));
  return { ...idle, bolt, boltLift, boltPull, boltReturn, boltLock, progress, phase: "cycle" };
}
