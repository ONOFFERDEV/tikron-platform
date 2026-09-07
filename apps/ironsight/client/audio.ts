/**
 * Web Audio SFX — fully synthesized (no asset files): a rifle crack, a hit-confirm
 * tick, and a kill-confirm ding. One AudioContext + master gain, resumed on the
 * first user gesture (browser autoplay policy), muted with `M`. A reduced sibling
 * of emberfall's file-based `audio.ts`; the same lifecycle, oscillators instead of
 * decoded buffers.
 */
import { spatialMix, type SoundPoint } from "./spatial-audio.js";
import { GAME } from "../src/game-config.js";

const MUTED_KEY = "iron_muted";
const A = GAME.audio;

/** Short mechanical cues at presentation phase boundaries. No scheduled tails
 * survive death/swap; each transient releases and disconnects within 90 ms. */
export function playReloadCue(phase: string): void {
  const frequencies: Record<string, number> = { 'mag-out': 380, 'mag-in': 620, bolt: 1150 };
  const frequency = frequencies[phase];
  if (!frequency) return;
  const c = ready(); if (!c || !master) return;
  const t = c.currentTime, osc = c.createOscillator(), gain = c.createGain();
  osc.type = 'triangle'; osc.frequency.setValueAtTime(frequency, t);
  osc.frequency.exponentialRampToValueAtTime(frequency * 0.45, t + 0.06);
  gain.gain.setValueAtTime(0.09, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  osc.connect(gain).connect(master); osc.start(t); osc.stop(t + 0.09);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let muted = false;
let volume = 1;
const listener = { x: 0, y: 0, z: 0 };
let listenerYaw = 0;
let remoteVoices = 0;
export function setAudioListener(pos: SoundPoint, yaw: number): void {
  Object.assign(listener, pos); listenerYaw = yaw;
}
/** Bounded short-lived stereo graph; confirmation cues bypass this voice budget. */
function spatialBus(c: AudioContext, source?: SoundPoint) {
  if (!master) return null;
  if (!source) return { input: master as AudioNode, release: () => {} };
  const mix = spatialMix(source, listener, listenerYaw);
  if (mix.gain < 0.015 || remoteVoices >= 20) return null;
  remoteVoices++;
  const gain = c.createGain(), pan = c.createStereoPanner(), filter = c.createBiquadFilter();
  gain.gain.value = mix.gain * 0.7; pan.pan.value = mix.pan;
  filter.type = 'lowpass'; filter.frequency.value = mix.cutoff;
  filter.connect(gain).connect(pan).connect(master);
  return { input: filter as AudioNode, release: () => { filter.disconnect(); gain.disconnect(); pan.disconnect(); remoteVoices--; } };
}

export function setMasterVolume(value: number): void {
  const next = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
  if (next === volume) return;
  volume = next; applyMute();
}

type WebkitWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : A.masterGain * volume;
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -12; compressor.knee.value = 12;
  compressor.ratio.value = 6; compressor.attack.value = 0.003; compressor.release.value = 0.18;
  master.connect(compressor).connect(ctx.destination);
  // One second of white noise, reused for every gunshot.
  const buf = ctx.createBuffer(1, ctx.sampleRate * A.noiseBufferSec, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noise = buf;
  startAmbient(ctx, master);
  return ctx;
}

/**
 * Ambient wind bed: a long low-passed noise loop through the master gain (so `M`
 * mutes it), started once alongside the rest of the graph. It's silent until the
 * context resumes on the first user gesture — same lifecycle as everything else
 * here, just no explicit resume call of its own.
 */
function startAmbient(c: AudioContext, m: GainNode): void {
  const buf = c.createBuffer(1, c.sampleRate * A.ambient.bufferSec, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = A.ambient.lpFreq;
  lp.Q.value = A.ambient.lpQ;
  const g = c.createGain();
  g.gain.value = A.ambient.gain;
  src.connect(lp).connect(g).connect(m);
  src.start(0);
}

function ready(): AudioContext | null {
  const c = ensure();
  if (!c || muted || c.state !== "running") return null;
  return c;
}

/** Gunshot: a noise burst through a bandpass + a body thump, tuned per weapon. */
export function playFire(weaponIndex = 0, source?: SoundPoint): void {
  const c = ready();
  if (!c || !master || !noise) return;
  const p = A.fireParams[weaponIndex] ?? A.fireParams[0]!;
  const bus = spatialBus(c, source); if (!bus) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noise;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = p.bp;
  bp.Q.value = A.fireBandpassQ;
  const g = c.createGain();
  g.gain.setValueAtTime(p.gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + p.dur);
  src.connect(bp).connect(g).connect(bus.input);
  src.start(t);
  src.stop(t + p.dur + A.fireStopTailSec);

  const osc = c.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(p.thump, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(A.fireThumpFreqFloor, p.thump / 3), t + p.dur * A.fireThumpDecayFrac);
  const og = c.createGain();
  og.gain.setValueAtTime(A.fireThumpGainStart, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + p.dur);
  osc.connect(og).connect(bus.input);
  osc.start(t);
  osc.stop(t + p.dur + A.fireStopTailSec);
  src.onended = () => { src.disconnect(); bp.disconnect(); g.disconnect(); };
  osc.onended = () => { osc.disconnect(); og.disconnect(); bus.release(); };
}

/** Grenade detonation: a long low-passed noise rumble + a 50 Hz sub swell. */
export function playBoom(source?: SoundPoint): void {
  const c = ready();
  if (!c || !master || !noise) return;
  const bus = spatialBus(c, source); if (!bus) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noise;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(A.boom.lpStart, t);
  lp.frequency.exponentialRampToValueAtTime(A.boom.lpEnd, t + A.boom.lpRampSec);
  const g = c.createGain();
  g.gain.setValueAtTime(A.boom.gainStart, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + A.boom.gainRampSec);
  src.connect(lp).connect(g).connect(bus.input);
  src.start(t);
  src.stop(t + A.boom.stopSec);

  const sub = c.createOscillator();
  sub.type = "sine";
  sub.frequency.value = A.boom.subFreq;
  const sg = c.createGain();
  sg.gain.setValueAtTime(0.0001, t);
  sg.gain.linearRampToValueAtTime(A.boom.subGainPeak, t + A.boom.subGainRampUpSec);
  sg.gain.exponentialRampToValueAtTime(0.001, t + A.boom.subGainRampDownSec);
  sub.connect(sg).connect(bus.input);
  sub.start(t);
  sub.stop(t + A.boom.subStopSec);
  let pending = 2; const release = () => { if (--pending === 0) bus.release(); };
  src.onended = () => { src.disconnect(); lp.disconnect(); g.disconnect(); release(); };
  sub.onended = () => { sub.disconnect(); sg.disconnect(); release(); };
}

/** Weapon-swap: a short mechanical double click. */
export function playSwap(): void {
  const c = ready();
  if (!c || !master) return;
  const t = c.currentTime;
  for (const [i, f] of A.swap.freqs.entries()) {
    const osc = c.createOscillator();
    osc.type = "square";
    osc.frequency.value = f;
    const g = c.createGain();
    const start = t + i * A.swap.staggerSec;
    g.gain.setValueAtTime(A.swap.gain, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + A.swap.rampSec);
    osc.connect(g).connect(master);
    osc.start(start);
    osc.stop(start + A.swap.stopSec);
  }
}

/** Hit confirm: a short high tick. */
export function playHit(head = false): void {
  const c = ready();
  if (!c || !master) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "square";
  osc.frequency.value = head ? A.hit.freqHead : A.hit.freqBody;
  const g = c.createGain();
  g.gain.setValueAtTime(A.hit.gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + A.hit.rampSec);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + A.hit.stopSec);
}

/** Footstep: a soft short low-passed noise tap, scaled by `atten` (distance falloff
 *  for remote players; self always passes 1). */
export function playFootstep(atten = 1, source?: SoundPoint): void {
  const c = ready();
  if (!c || !master || !noise || atten <= 0.02) return;
  const bus = spatialBus(c, source); if (!bus) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noise;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = A.footstep.lpFreq;
  const g = c.createGain();
  g.gain.setValueAtTime(A.footstep.gain * atten, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + A.footstep.rampSec);
  src.connect(lp).connect(g).connect(bus.input);
  src.start(t);
  src.stop(t + A.footstep.stopSec);
  src.onended = () => { src.disconnect(); lp.disconnect(); g.disconnect(); bus.release(); };
}

/** Hurt: a short descending low-register thud, distinct from the shooter-side
 *  `playHit` tick — this is the VICTIM's feedback on taking damage. */
export function playHurt(): void {
  const c = ready();
  if (!c || !master) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(A.hurt.freqStart, t);
  osc.frequency.exponentialRampToValueAtTime(A.hurt.freqEnd, t + A.hurt.freqRampSec);
  const g = c.createGain();
  g.gain.setValueAtTime(A.hurt.gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + A.hurt.gainRampSec);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + A.hurt.stopSec);
}

/** Kill confirm: a quick two-tone rising ding. */
export function playKill(): void {
  const c = ready();
  if (!c || !master) return;
  const t = c.currentTime;
  for (const [i, f] of A.kill.freqs.entries()) {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    const g = c.createGain();
    const start = t + i * A.kill.staggerSec;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(A.kill.gainPeak, start + A.kill.rampUpSec);
    g.gain.exponentialRampToValueAtTime(0.001, start + A.kill.rampDownSec);
    osc.connect(g).connect(master);
    osc.start(start);
    osc.stop(start + A.kill.stopSec);
  }
}

export function isMuted(): boolean {
  return muted;
}

function applyMute(): void {
  if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : A.masterGain * volume, ctx.currentTime, 0.01);
}

/** Self-wire gesture-resume + the M mute toggle. Returns the mute state on toggle. */
export function initAudio(onToggle?: (muted: boolean) => void): void {
  if (typeof window === "undefined") return;
  try {
    muted = localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    // localStorage may throw (private mode) — keep the default.
  }
  const resume = (): void => {
    const c = ensure();
    if (c && c.state === "suspended") void c.resume();
  };
  window.addEventListener("pointerdown", resume);
  window.addEventListener("keydown", resume);
  window.addEventListener("keydown", (e) => {
    if (e.code !== "KeyM" || e.repeat || e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return;
    muted = !muted;
    try {
      localStorage.setItem(MUTED_KEY, muted ? "1" : "0");
    } catch {
      // ignore persistence failure
    }
    applyMute();
    onToggle?.(muted);
  });
}
