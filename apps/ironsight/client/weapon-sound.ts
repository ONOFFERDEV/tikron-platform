/** Original offline synthesis. Baked once per context, never in the firing path.
 * Mono tails describe a short open industrial yard, not simulated room occlusion. */
import type { WeaponActionState } from '../src/weapon-action.js';

export const WEAPON_FAMILY_NAMES = ['rifle', 'smg', 'shotgun', 'sniper', 'pistol'] as const;
export const WEAPON_SOUND_SHAPES = [
  { mechanical: 3100, click: 0.024, body: 0.10, tail: 0.32, reflection: 0.047 },
  { mechanical: 4200, click: 0.014, body: 0.065, tail: 0.22, reflection: 0.031 },
  { mechanical: 1900, click: 0.036, body: 0.19, tail: 0.46, reflection: 0.063 },
  { mechanical: 2600, click: 0.028, body: 0.25, tail: 0.58, reflection: 0.079 },
  { mechanical: 3600, click: 0.020, body: 0.085, tail: 0.27, reflection: 0.039 },
] as const;

type FireTone = { bp: number; dur: number; gain: number; thump: number };
export const FIRE_VARIANTS = 3;

export type WeaponMechanicCue = 'mag-out' | 'mag-in' | 'bolt' | 'shell';
export interface WeaponMechanicCuePlan {
  readonly cue: WeaponMechanicCue;
  readonly delayMs: number;
  readonly serial: number;
}
export interface WeaponActionAudioUpdate {
  readonly accepted: boolean;
  readonly cancelSerial: number | null;
  readonly cues: readonly WeaponMechanicCuePlan[];
}

export interface WeaponActionAudioEvent {
  readonly id: string;
  readonly state: WeaponActionState | null;
  readonly serial?: number;
  readonly weaponIndex?: number;
}

export function consumeWeaponActionAudio(
  gate: WeaponAudioEventGate,
  event: WeaponActionAudioEvent,
  context: { readonly observedAt: number; readonly localId: string; readonly remoteKnown: boolean },
): WeaponActionAudioUpdate & { readonly schedule: boolean } {
  const update = gate.updateAction(event.id, event.state, context.observedAt, event);
  return {
    ...update,
    schedule: update.accepted && event.state !== null && update.cues.length > 0
      && (event.id === context.localId || context.remoteKnown),
  };
}

export class WeaponAudioEventGate {
  private readonly seen = new Set<string>();
  private readonly order: string[] = [];
  private readonly actions = new Map<string, {
    serial: number;
    weaponIndex: number;
    latestPhaseStartedAt: number;
    latestCommitted: number;
    markers: Set<string>;
  }>();

  constructor(private readonly capacity = 512) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new RangeError('invalid audio identity capacity');
  }

  private accept(key: string): boolean {
    if (this.seen.has(key)) return false;
    this.seen.add(key); this.order.push(key);
    if (this.order.length > this.capacity) {
      const oldest = this.order.shift();
      if (oldest !== undefined) this.seen.delete(oldest);
    }
    return true;
  }

  acceptLocalAttempt(shotId: string): boolean {
    return shotId.length > 0 && this.accept(`fire:${shotId}`);
  }

  acceptRemoteShot(shotId: string | undefined, fromSelf: boolean): boolean {
    return !fromSelf && shotId !== undefined && shotId.length > 0 && this.accept(`fire:${shotId}`);
  }

  acceptConfirmation(kind: 'hit' | 'kill', shotId: string | undefined): boolean {
    return shotId !== undefined && shotId.length > 0 && this.accept(`${kind}:${shotId}`);
  }

  updateAction(
    actorId: string,
    state: WeaponActionState | null,
    observedAt = state?.phaseStartedAt ?? 0,
    finished?: { readonly serial?: number; readonly weaponIndex?: number },
  ): WeaponActionAudioUpdate {
    const active = this.actions.get(actorId);
    if (state === null) {
      if (active !== undefined && ((finished?.serial !== undefined && finished.serial !== active.serial)
        || (finished?.weaponIndex !== undefined && finished.weaponIndex !== active.weaponIndex))) {
        return { accepted: false, cancelSerial: null, cues: [] };
      }
      this.actions.delete(actorId);
      return { accepted: true, cancelSerial: active?.serial ?? null, cues: [] };
    }
    if (active !== undefined && state.serial < active.serial) return { accepted: false, cancelSerial: null, cues: [] };
    if (active?.serial === state.serial && (state.phaseStartedAt < active.latestPhaseStartedAt
      || (state.phaseStartedAt === active.latestPhaseStartedAt && state.committed < active.latestCommitted))) {
      return { accepted: false, cancelSerial: null, cues: [] };
    }
    const cancelSerial = active !== undefined && active.serial !== state.serial ? active.serial : null;
    const action = active?.serial === state.serial ? active : {
      serial: state.serial,
      weaponIndex: state.weaponIndex,
      latestPhaseStartedAt: state.phaseStartedAt,
      latestCommitted: state.committed,
      markers: new Set<string>(),
    };
    this.actions.set(actorId, action);
    const marker = `${state.phase}:${state.committed}`;
    if (action.markers.has(marker)) return { accepted: true, cancelSerial, cues: [] };
    action.markers.add(marker);
    action.latestPhaseStartedAt = Math.max(action.latestPhaseStartedAt, state.phaseStartedAt);
    action.latestCommitted = Math.max(action.latestCommitted, state.committed);
    const duration = Math.max(0, state.endsAt - state.phaseStartedAt);
    let cues: readonly WeaponMechanicCuePlan[];
    if (state.phase === 'cycle' || state.phase === 'reload_end') cues = [{ cue: 'bolt', delayMs: 0, serial: state.serial }];
    else if (state.phase === 'reload_insert') cues = [{ cue: 'shell', delayMs: 0, serial: state.serial }];
    else if (state.phase === 'reload_start') cues = [{ cue: 'mag-out', delayMs: 0, serial: state.serial }];
    else if (state.kind === 'magazine_reload') cues = [
      { cue: 'mag-out', delayMs: 0, serial: state.serial },
      { cue: 'mag-in', delayMs: Math.round(duration * .65), serial: state.serial },
      { cue: 'bolt', delayMs: Math.round(duration * .88), serial: state.serial },
    ];
    else cues = [
      { cue: 'bolt', delayMs: 0, serial: state.serial },
      { cue: 'mag-in', delayMs: Math.round(duration * .45), serial: state.serial },
      { cue: 'bolt', delayMs: Math.round(duration * .82), serial: state.serial },
    ];
    const elapsed = Math.max(0, observedAt - state.phaseStartedAt);
    return {
      accepted: true,
      cancelSerial,
      cues: cues.filter(cue => cue.delayMs + 150 >= elapsed)
        .map(cue => ({ ...cue, delayMs: Math.max(0, cue.delayMs - elapsed) })),
    };
  }

  clear(): void {
    this.seen.clear(); this.order.length = 0; this.actions.clear();
  }
}

export function synthesizeWeaponSound(sampleRate: number, weapon: number, tone: FireTone, variant = 0): Float32Array<ArrayBuffer> {
  const shape = WEAPON_SOUND_SHAPES[weapon] ?? WEAPON_SOUND_SHAPES[0];
  const length = Math.ceil(sampleRate * shape.tail);
  const samples = new Float32Array(length);
  let seed = (0x72656c61 ^ ((weapon + 1) * 7919) ^ ((variant + 1) * 104729)) >>> 0;
  let low = 0, air = 0, phase = 0;
  const pitch = 1 + (variant - 1) * 0.018;
  const alpha = 1 - Math.exp(-2 * Math.PI * tone.bp / sampleRate);
  const airAlpha = 1 - Math.exp(-2 * Math.PI * 780 / sampleRate);
  const reflection = Math.round(shape.reflection * sampleRate);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    const white = (seed >>> 0) / 2147483648 - 1;
    low += alpha * (white - low); air += airAlpha * (white - air);
    const attack = Math.min(1, t / 0.0007);
    const crack = (white - low * 0.65) * Math.exp(-t * 6 / tone.dur) * tone.gain * 0.40;
    const click = Math.sin(2 * Math.PI * shape.mechanical * pitch * t) * Math.exp(-t * 7 / shape.click) * 0.11;
    phase += 2 * Math.PI * (tone.thump * pitch * Math.exp(-t * 13) + 38) / sampleRate;
    const body = Math.sin(phase) * Math.exp(-t * 5 / shape.body) * 0.32;
    // Diffuse low-frequency air arrives behind the crack; two quiet, damped
    // reflections reuse the baked waveform rather than allocating delay nodes.
    const tail = air * Math.min(1, t / 0.025) * Math.exp(-t * 4 / shape.tail) * 0.35;
    const echo = i >= reflection ? samples[i - reflection]! * 0.13 : 0;
    const echo2 = i >= reflection * 2 ? samples[i - reflection * 2]! * 0.06 : 0;
    const fade = Math.min(1, (length - 1 - i) / (sampleRate * 0.015));
    samples[i] = ((crack + click + body + tail) * attack + echo + echo2) * fade;
  }
  return samples;
}
