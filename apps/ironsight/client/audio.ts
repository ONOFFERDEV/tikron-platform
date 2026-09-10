/**
 * Web Audio SFX — fully synthesized (no asset files): a rifle crack, a hit-confirm
 * tick, and a kill-confirm ding. One AudioContext + master gain, resumed on the
 * first user gesture (browser autoplay policy), muted with `M`. A reduced sibling
 * of emberfall's file-based `audio.ts`; the same lifecycle, oscillators instead of
 * decoded buffers.
 */
import type { MapDef } from "../src/map/types.js";
import { coverMix, footSurface, spatialMix, type SoundPoint } from "./spatial-audio.js";
import { FIRE_VARIANTS, synthesizeWeaponSound } from "./weapon-sound.js";
import { GAME } from "../src/game-config.js";
import type { DeploymentCue } from './deployment-presentation.js';

const MUTED_KEY = "iron_muted";
const A = GAME.audio;

/** One short, resolved commendation sting through the existing mute/volume bus. */
export function playHonorsCue(): void {
  const c = ready(); if (!c || !master) return;
  const now = c.currentTime;
  for (const [index, frequency] of [196, 293.66, 392, 493.88].entries()) {
    const at = now + index * .09;
    const osc = c.createOscillator(), gain = c.createGain();
    osc.type = 'triangle'; osc.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(0, now);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(.045, at + .015);
    gain.gain.exponentialRampToValueAtTime(.001, at + .55);
    osc.connect(gain).connect(master); osc.start(at); osc.stop(at + .57);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
}

/** Three short countdown pips and a resolved start chord. Called on observed
 * phase/second edges only; no timer queue can leak a GO after cancellation. */
export function playDeploymentCue(cue: DeploymentCue): void {
  const c = ready(); if (!c || !master) return;
  const t = c.currentTime, duration = cue === 'go' ? .48 : .085;
  const frequencies = cue === 'go' ? [164.81, 246.94, 329.63] : [740];
  for (const frequency of frequencies) {
    const osc = c.createOscillator(), gain = c.createGain();
    osc.type = 'triangle'; osc.frequency.setValueAtTime(frequency, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(cue === 'go' ? .065 : .10, t + .008);
    gain.gain.exponentialRampToValueAtTime(.001, t + duration);
    osc.connect(gain).connect(master); osc.start(t); osc.stop(t + duration + .015);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
}

/** Short mechanical cues at presentation phase boundaries. No scheduled tails
 * survive death/swap; each transient releases and disconnects within 90 ms. */
export function playReloadCue(phase: string, source?: SoundPoint, threatGain = 1): void {
  const frequencies: Record<string, number> = { 'mag-out': 380, 'mag-in': 620, bolt: 1150 };
  const frequency = frequencies[phase];
  if (!frequency) return;
  const c = ready(); if (!c || !master) return;
  const bus = spatialBus(c, source, threatGain); if (!bus) return;
  const t = c.currentTime, osc = c.createOscillator(), gain = c.createGain();
  osc.type = 'triangle'; osc.frequency.setValueAtTime(frequency, t);
  osc.frequency.exponentialRampToValueAtTime(frequency * 0.45, t + 0.06);
  gain.gain.setValueAtTime(0.09, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  osc.connect(gain).connect(bus.input); osc.start(t); osc.stop(t + 0.09);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); bus.release(); };
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
const fireBuffers: AudioBuffer[][] = [];
let fireVariation = 0;
let muted = false;
let volume = 1;
const listener = { x: 0, y: 0, z: 0 };
let listenerYaw = 0;
let remoteVoices = 0;
let acousticMap: MapDef | undefined;
let auditMixes: { gain: number; cutoff: number; pan: number; threatGain: number; blocked: boolean }[] | null = null;
export function setAudioMap(map: MapDef): void { acousticMap = map; }
export function setAudioListener(pos: SoundPoint, yaw: number): void {
  Object.assign(listener, pos); listenerYaw = yaw;
}
/** Bounded short-lived stereo graph; confirmation cues bypass this voice budget. */
function spatialBus(c: AudioContext, source?: SoundPoint, threatGain = 1) {
  if (!master) return null;
  if (!source) return { input: master as AudioNode, release: () => {} };
  const mix = spatialMix(source, listener, listenerYaw);
  if (mix.gain < 0.015) return null;
  const cover = coverMix(source, listener, acousticMap?.boxes ?? []);
  // Reserve four of the existing twenty voices for clear enemy foley.
  if (remoteVoices >= (threatGain > 1 && !cover.blocked ? 20 : 16)) return null;
  remoteVoices++;
  const gain = c.createGain(), pan = c.createStereoPanner(), filter = c.createBiquadFilter();
  gain.gain.value = mix.gain * 0.7 * threatGain * cover.gain; pan.pan.value = mix.pan;
  filter.type = 'lowpass'; filter.frequency.value = Math.min(mix.cutoff, cover.cutoff);
  auditMixes?.push({ gain: gain.gain.value, cutoff: filter.frequency.value, pan: pan.pan.value, threatGain, blocked: cover.blocked });
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
  // A compressor's attack can overshoot on synchronized volleys. The final
  // safety knee is linear below 0.8 and bounds that transient before output.
  const ceiling = ctx.createWaveShaper();
  const curve = new Float32Array(2049);
  for (let i = 0; i < curve.length; i++) {
    const x = i / (curve.length - 1) * 2 - 1, a = Math.abs(x);
    curve[i] = Math.sign(x) * (a <= 0.8 ? a : 0.8 + 0.18 * (1 - Math.exp(-(a - 0.8) / 0.18)));
  }
  ceiling.curve = curve;
  master.connect(compressor).connect(ceiling).connect(ctx.destination);
  // One second of white noise, reused for every gunshot.
  const buf = ctx.createBuffer(1, ctx.sampleRate * A.noiseBufferSec, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noise = buf;
  for (const [weapon, tone] of A.fireParams.entries()) {
    const variants: AudioBuffer[] = [];
    for (let variation = 0; variation < FIRE_VARIANTS; variation++) {
      const pcm = synthesizeWeaponSound(ctx.sampleRate, weapon, tone, variation);
      const shot = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
      shot.copyToChannel(pcm, 0); variants.push(shot);
    }
    fireBuffers.push(variants);
  }
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

/** Mechanical snap, ballistic body and outdoor reflections in one cached source.
 * One remote voice covers the complete tail; all layers share spatial attenuation. */
export function playFire(weaponIndex = 0, source?: SoundPoint): void {
  const c = ready();
  if (!c || !master) return;
  const variants = fireBuffers[weaponIndex] ?? fireBuffers[0];
  const buffer = variants?.[fireVariation % FIRE_VARIANTS];
  if (!buffer) return;
  const bus = spatialBus(c, source); if (!bus) return;
  fireVariation++;
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.connect(bus.input);
  src.onended = () => { src.disconnect(); bus.release(); };
  src.start(c.currentTime);
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
export function playFootstep(atten = 1, source?: SoundPoint, feet?: SoundPoint): void {
  const c = ready();
  if (!c || !master || !noise || atten <= 0.02) return;
  const bus = spatialBus(c, source, source ? atten : 1); if (!bus) return;
  const metal = feet && footSurface(feet, acousticMap) === 'metal';
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = metal ? 1.35 : 0.85;
  const lp = c.createBiquadFilter();
  lp.type = metal ? "bandpass" : "lowpass";
  lp.Q.value = metal ? 2.2 : 0.7;
  lp.frequency.value = metal ? 1900 : A.footstep.lpFreq;
  const g = c.createGain();
  g.gain.setValueAtTime(A.footstep.gain * (source ? 1 : atten), t);
  g.gain.exponentialRampToValueAtTime(0.001, t + A.footstep.rampSec);
  src.connect(lp).connect(g).connect(bus.input);
  src.start(t);
  src.stop(t + A.footstep.stopSec);
  src.onended = () => { src.disconnect(); lp.disconnect(); g.disconnect(); bus.release(); };
}

/** Surface scrape + equipment transient. Reuses prepared noise; bounded to 800 ms. */
export function playSlide(feet: SoundPoint, source?: SoundPoint, threatGain = 1): () => void {
  const c = ready();
  if (!c || !master || !noise) return () => {};
  const bus = spatialBus(c, source, threatGain); if (!bus) return () => {};
  const t = c.currentTime, src = c.createBufferSource(), filter = c.createBiquadFilter(), gain = c.createGain();
  src.buffer = noise; src.loop = true;
  const metal = footSurface(feet, acousticMap) === 'metal';
  filter.type = 'bandpass'; filter.Q.value = metal ? 1.7 : .6;
  filter.frequency.setValueAtTime(metal ? 1800 : 950, t);
  filter.frequency.exponentialRampToValueAtTime(180, t + .8);
  gain.gain.setValueAtTime(.001, t); gain.gain.linearRampToValueAtTime(.19, t + .025);
  gain.gain.exponentialRampToValueAtTime(.001, t + .8);
  src.connect(filter).connect(gain).connect(bus.input); src.start(t); src.stop(t + .82);
  let ended = false;
  src.onended = () => { ended = true; src.disconnect(); filter.disconnect(); gain.disconnect(); bus.release(); };
  playReloadCue('mag-out', source, threatGain);
  return () => { if (!ended) { gain.gain.cancelScheduledValues(c.currentTime);
    gain.gain.setTargetAtTime(.001, c.currentTime, .015); src.stop(c.currentTime + .06); } };
}

export function playLanding(feet: SoundPoint): void {
  playFootstep(1.4, undefined, feet);
  playReloadCue('mag-in');
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

export function setMuted(value: boolean): void {
  muted = value;
  try { localStorage.setItem(MUTED_KEY, muted ? '1' : '0'); } catch { /* private storage */ }
  applyMute();
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
    setMuted(!muted);
    try {
      localStorage.setItem(MUTED_KEY, muted ? "1" : "0");
    } catch {
      // ignore persistence failure
    }
    applyMute();
    onToggle?.(muted);
  });
}

/** Explicit developer fixture: real Web Audio nodes after a user gesture.
 * No gameplay state changes; map/listener restored even if an assertion fails. */
export async function inspectThreatAudio() {
  const c = ready(); if (!c) throw Error('Audio context is not running');
  const savedMap = acousticMap, savedListener = { ...listener }, savedYaw = listenerYaw;
  const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
  const source = { x: 0, y: 1, z: 10 };
  const mixes: NonNullable<typeof auditMixes> = [];
  try {
    await wait(600);
    acousticMap = { ...savedMap!, boxes: [] };
    auditMixes = mixes;
    setAudioListener({ x: 0, y: 1, z: 0 }, 0);
    playFootstep(1, source, { ...source, y: 0 });
    playFootstep(1.4, source, { ...source, y: 0 });
    playReloadCue('mag-in', source, 1);
    playReloadCue('mag-in', source, 1.4);
    acousticMap = { ...savedMap!, boxes: [{ min: { x: -2, y: 0, z: 4 }, max: { x: 2, y: 3, z: 5 } }] };
    playFootstep(1.4, source, { ...source, y: 0 });
    auditMixes = null;
    await wait(600);
    acousticMap = { ...savedMap!, boxes: [] };
    setAudioListener({ x: 0, y: 1, z: 0 }, 0);
    for (let i = 0; i < 24; i++) playReloadCue('mag-in', source, 1);
    const ordinaryPeak = remoteVoices;
    for (let i = 0; i < 24; i++) playReloadCue('bolt', source, 1.4);
    const threatPeak = remoteVoices;
    playHit(); playKill(); // confirmed cues remain outside the remote budget
    await wait(600);
    return { context: c.state, sampleRate: c.sampleRate, mixes, ordinaryPeak, threatPeak, drained: remoteVoices,
      note: 'Actual node parameters before master compressor; not headphone loudness or HRTF acceptance.' };
  } finally {
    auditMixes = null; acousticMap = savedMap; setAudioListener(savedListener, savedYaw);
  }
}

/** Induction coil rise and compressed-air release on an accepted room launch. */
export function playLaunch(source?: SoundPoint, threatGain = 1): void {
  const c=ready(); if (!c || !master || !noise) return;
  const bus=spatialBus(c,source,threatGain); if (!bus) return;
  const t=c.currentTime, air=c.createBufferSource(), filter=c.createBiquadFilter(),
    coil=c.createOscillator(), gain=c.createGain();
  air.buffer=noise; filter.type='bandpass'; filter.Q.value=.7;
  filter.frequency.setValueAtTime(280,t); filter.frequency.exponentialRampToValueAtTime(2400,t+.16);
  filter.frequency.exponentialRampToValueAtTime(450,t+.65);
  coil.type='sine';coil.frequency.setValueAtTime(90,t);coil.frequency.exponentialRampToValueAtTime(620,t+.18);
  coil.frequency.exponentialRampToValueAtTime(120,t+.7);
  gain.gain.setValueAtTime(.001,t);gain.gain.linearRampToValueAtTime(.2,t+.025);
  gain.gain.exponentialRampToValueAtTime(.001,t+.75);
  air.connect(filter).connect(gain);coil.connect(gain);gain.connect(bus.input);
  air.start(t);coil.start(t);air.stop(t+.78);coil.stop(t+.78);
  air.onended=()=>{air.disconnect();filter.disconnect();coil.disconnect();gain.disconnect();bus.release();};
}

/** Hand contact and sleeve scrape, emitted only by an accepted room traversal. */
export function playTraversal(source?: SoundPoint, threatGain = 1): void {
  const c=ready(); if (!c || !master || !noise) return;
  const bus=spatialBus(c,source,threatGain); if (!bus) return;
  const t=c.currentTime, src=c.createBufferSource(), filter=c.createBiquadFilter(), gain=c.createGain();
  src.buffer=noise; filter.type='lowpass'; filter.frequency.value=1300;
  gain.gain.setValueAtTime(.001,t); gain.gain.linearRampToValueAtTime(.23,t+.015);
  gain.gain.exponentialRampToValueAtTime(.025,t+.09); gain.gain.exponentialRampToValueAtTime(.001,t+.3);
  src.connect(filter).connect(gain).connect(bus.input); src.start(t); src.stop(t+.32);
  src.onended=()=>{src.disconnect();filter.disconnect();gain.disconnect();bus.release();};
}

/** Map-wide PA/relay cue, bounded below confirmed combat transients. Uses the
 * existing master volume, mute and limiter, with no lingering loop/timers. */
export function playSignalCue(phase: 'idle'|'warning'|'blackout'|'recovery'): void {
  const c=ready();if(!c || !master || !noise || phase==='idle')return;
  const t=c.currentTime, gain=c.createGain(), tone=c.createOscillator(),
    air=c.createBufferSource(), filter=c.createBiquadFilter();
  const blackout=phase==='blackout', duration=blackout ? 1.8 : .85;
  tone.type=blackout ? 'triangle' : 'sine';
  tone.frequency.setValueAtTime(blackout ? 150 : phase==='warning' ? 440 : 660,t);
  tone.frequency.exponentialRampToValueAtTime(blackout ? 38 : phase==='warning' ? 330 : 990,t+duration*.75);
  air.buffer=noise;filter.type='lowpass';filter.frequency.value=blackout ? 460 : 120;
  gain.gain.setValueAtTime(.001,t);gain.gain.linearRampToValueAtTime(blackout ? .17 : .10,t+.05);
  gain.gain.exponentialRampToValueAtTime(.001,t+duration);
  tone.connect(gain);air.connect(filter).connect(gain);gain.connect(master);
  tone.start(t);air.start(t);tone.stop(t+duration);air.stop(t+duration);
  air.onended=()=>{air.disconnect();filter.disconnect();tone.disconnect();gain.disconnect();};
}

/** Undertow PA uses the same warning ident; discharge adds a short filtered
 * water/servo release. No perpetual loop, new buffer, or delayed cue queue. */
export function playFloodCue(phase: 'idle'|'warning'|'blackout'|'recovery'): void {
  if(phase!=='blackout'){playSignalCue(phase);return;}
  const c=ready();if(!c||!master||!noise)return;
  const t=c.currentTime,air=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain(),servo=c.createOscillator();
  air.buffer=noise;air.loop=true;filter.type='lowpass';filter.frequency.setValueAtTime(350,t);
  filter.frequency.exponentialRampToValueAtTime(1800,t+.7);filter.frequency.exponentialRampToValueAtTime(400,t+2.4);
  servo.type='sine';servo.frequency.setValueAtTime(110,t);servo.frequency.exponentialRampToValueAtTime(45,t+2.4);
  gain.gain.setValueAtTime(.001,t);gain.gain.linearRampToValueAtTime(.11,t+.25);gain.gain.exponentialRampToValueAtTime(.001,t+2.4);
  air.connect(filter).connect(gain);servo.connect(gain);gain.connect(master);
  air.start(t);servo.start(t);air.stop(t+2.45);servo.stop(t+2.45);
  air.onended=()=>{air.disconnect();filter.disconnect();servo.disconnect();gain.disconnect();};
}

/** Cargo hoist: bounded motor/chain take-up through the existing mute, master
 * and limiter. The visual transfer continues silently after this short ident. */
export function playCargoCue(phase: 'idle'|'warning'|'blackout'|'recovery'): void {
  if(phase!=='blackout'){playSignalCue(phase);return;}
  const c=ready();if(!c||!master||!noise)return;
  const t=c.currentTime,chain=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain(),motor=c.createOscillator();
  chain.buffer=noise;chain.loop=true;filter.type='bandpass';filter.Q.value=1.1;
  filter.frequency.setValueAtTime(180,t);filter.frequency.exponentialRampToValueAtTime(620,t+1.2);
  filter.frequency.exponentialRampToValueAtTime(220,t+3.2);
  motor.type='triangle';motor.frequency.setValueAtTime(58,t);motor.frequency.linearRampToValueAtTime(95,t+1.2);
  motor.frequency.linearRampToValueAtTime(50,t+3.2);
  gain.gain.setValueAtTime(.001,t);gain.gain.linearRampToValueAtTime(.075,t+.12);
  gain.gain.exponentialRampToValueAtTime(.001,t+3.2);
  chain.connect(filter).connect(gain);motor.connect(gain);gain.connect(master);
  chain.start(t);motor.start(t);chain.stop(t+3.25);motor.stop(t+3.25);
  chain.onended=()=>{chain.disconnect();filter.disconnect();motor.disconnect();gain.disconnect();};
}

/** Short radio-ident and radar chirp. Entire graph drains in <=1.25s, through
 * the existing volume/mute/limiter. No browser speech dependency or extra loop. */
export function playSupportCue(kind: 'earned' | 'friendly' | 'enemy' | 'pulse'): void {
  const c = ready(); if (!c || !master) return;
  const notes = kind === 'earned' ? [330, 440, 660, 880] : kind === 'friendly' ? [440, 660, 880] : kind === 'enemy' ? [330, 247, 165] : [1046];
  const t = c.currentTime;
  for (const [i, frequency] of notes.entries()) {
    const tone = c.createOscillator(), gain = c.createGain(), start = t + i * .21;
    tone.type = kind === 'enemy' ? 'triangle' : 'sine'; tone.frequency.value = frequency;
    gain.gain.setValueAtTime(.001, start); gain.gain.linearRampToValueAtTime(kind === 'pulse' ? .045 : .09, start + .015);
    gain.gain.exponentialRampToValueAtTime(.001, start + .42);
    tone.connect(gain).connect(master); tone.start(start); tone.stop(start + .44);
    tone.onended = () => { tone.disconnect(); gain.disconnect(); };
  }
}

/** Quiet two-note radio ident, not positional enemy audio. The card supplies
 * direction and lane even with audio muted. Every node drains within 240ms. */
export function playContactCue(): void {
  const c = ready(); if (!c || !master) return;
  const t = c.currentTime;
  for (const [i, frequency] of [620, 830].entries()) {
    const tone = c.createOscillator(), gain = c.createGain(), start = t + i * .10;
    tone.type = 'sine'; tone.frequency.value = frequency;
    gain.gain.setValueAtTime(.001, start); gain.gain.linearRampToValueAtTime(.045, start + .008);
    gain.gain.exponentialRampToValueAtTime(.001, start + .12);
    tone.connect(gain).connect(master); tone.start(start); tone.stop(start + .14);
    tone.onended = () => { tone.disconnect(); gain.disconnect(); };
  }
}

/** Short falling-shell whistle; spatial, capped and released before impact. */
export function playMortarWhistle(source: SoundPoint): void {
  const c = ready(); if (!c) return;
  const bus = spatialBus(c, source, 1.4); if (!bus) return;
  const t = c.currentTime, tone = c.createOscillator(), gain = c.createGain();
  tone.type = 'triangle'; tone.frequency.setValueAtTime(1500, t);
  tone.frequency.exponentialRampToValueAtTime(280, t + .65);
  gain.gain.setValueAtTime(.001, t); gain.gain.linearRampToValueAtTime(.11, t + .45);
  gain.gain.exponentialRampToValueAtTime(.001, t + .69);
  tone.connect(gain).connect(bus.input); tone.start(t); tone.stop(t + .7);
  tone.onended = () => { tone.disconnect(); gain.disconnect(); bus.release(); };
}

/** Directional laser charge and short dual-cannon pulse. Existing capped,
 * occluded spatial bus and volume controls; every node drains within 900ms. */
export function playDroneCue(source: SoundPoint, kind: 'lock' | 'fire'): void {
  const c=ready();if(!c)return;
  const bus=spatialBus(c,source,1.4);if(!bus)return;
  const t=c.currentTime,tone=c.createOscillator(),gain=c.createGain(),duration=kind==='lock'?.86:.18;
  tone.type=kind==='lock'?'sine':'triangle';tone.frequency.setValueAtTime(kind==='lock'?420:180,t);
  tone.frequency.exponentialRampToValueAtTime(kind==='lock'?1260:55,t+duration*.9);
  gain.gain.setValueAtTime(.001,t);gain.gain.linearRampToValueAtTime(kind==='lock'?.055:.17,t+.025);
  gain.gain.exponentialRampToValueAtTime(.001,t+duration);
  tone.connect(gain).connect(bus.input);tone.start(t);tone.stop(t+duration+.01);
  tone.onended=()=>{tone.disconnect();gain.disconnect();bus.release();};
}
