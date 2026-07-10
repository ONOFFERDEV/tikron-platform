/**
 * Web Audio SFX — fully synthesized (no asset files): a rifle crack, a hit-confirm
 * tick, and a kill-confirm ding. One AudioContext + master gain, resumed on the
 * first user gesture (browser autoplay policy), muted with `M`. A reduced sibling
 * of emberfall's file-based `audio.ts`; the same lifecycle, oscillators instead of
 * decoded buffers.
 */

const MUTED_KEY = "iron_muted";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let muted = false;

type WebkitWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ctx.destination);
  // One second of white noise, reused for every gunshot.
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
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
  const buf = c.createBuffer(1, c.sampleRate * 4, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 500;
  lp.Q.value = 0.5;
  const g = c.createGain();
  g.gain.value = 0.05;
  src.connect(lp).connect(g).connect(m);
  src.start(0);
}

function ready(): AudioContext | null {
  const c = ensure();
  if (!c || muted || c.state !== "running") return null;
  return c;
}

/** Per-weapon crack character (indexed like WEAPONS: AR/SMG/Shotgun/Sniper/Pistol). */
const FIRE_PARAMS = [
  { bp: 1600, dur: 0.09, gain: 0.9, thump: 180 }, // AR — the baseline crack
  { bp: 2300, dur: 0.055, gain: 0.65, thump: 240 }, // SMG — short & snappy
  { bp: 650, dur: 0.18, gain: 1.1, thump: 110 }, // Shotgun — low boom
  { bp: 900, dur: 0.26, gain: 1.2, thump: 80 }, // Sniper — big & long
  { bp: 1300, dur: 0.08, gain: 0.75, thump: 200 }, // Pistol
] as const;

/** Gunshot: a noise burst through a bandpass + a body thump, tuned per weapon. */
export function playFire(weaponIndex = 0): void {
  const c = ready();
  if (!c || !master || !noise) return;
  const p = FIRE_PARAMS[weaponIndex] ?? FIRE_PARAMS[0];
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noise;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = p.bp;
  bp.Q.value = 0.8;
  const g = c.createGain();
  g.gain.setValueAtTime(p.gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + p.dur);
  src.connect(bp).connect(g).connect(master);
  src.start(t);
  src.stop(t + p.dur + 0.02);

  const osc = c.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(p.thump, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(45, p.thump / 3), t + p.dur * 0.9);
  const og = c.createGain();
  og.gain.setValueAtTime(0.5, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + p.dur);
  osc.connect(og).connect(master);
  osc.start(t);
  osc.stop(t + p.dur + 0.02);
}

/** Grenade detonation: a long low-passed noise rumble + a 50 Hz sub swell. */
export function playBoom(): void {
  const c = ready();
  if (!c || !master || !noise) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noise;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(900, t);
  lp.frequency.exponentialRampToValueAtTime(80, t + 0.45);
  const g = c.createGain();
  g.gain.setValueAtTime(1.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  src.connect(lp).connect(g).connect(master);
  src.start(t);
  src.stop(t + 0.52);

  const sub = c.createOscillator();
  sub.type = "sine";
  sub.frequency.value = 50;
  const sg = c.createGain();
  sg.gain.setValueAtTime(0.0001, t);
  sg.gain.linearRampToValueAtTime(0.6, t + 0.02);
  sg.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  sub.connect(sg).connect(master);
  sub.start(t);
  sub.stop(t + 0.42);
}

/** Weapon-swap: a short mechanical double click. */
export function playSwap(): void {
  const c = ready();
  if (!c || !master) return;
  const t = c.currentTime;
  for (const [i, f] of [420, 300].entries()) {
    const osc = c.createOscillator();
    osc.type = "square";
    osc.frequency.value = f;
    const g = c.createGain();
    const start = t + i * 0.06;
    g.gain.setValueAtTime(0.12, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.03);
    osc.connect(g).connect(master);
    osc.start(start);
    osc.stop(start + 0.04);
  }
}

/** Hit confirm: a short high tick. */
export function playHit(head = false): void {
  const c = ready();
  if (!c || !master) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "square";
  osc.frequency.value = head ? 1400 : 900;
  const g = c.createGain();
  g.gain.setValueAtTime(0.28, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + 0.07);
}

/** Footstep: a soft short low-passed noise tap, scaled by `atten` (distance falloff
 *  for remote players; self always passes 1). */
export function playFootstep(atten = 1): void {
  const c = ready();
  if (!c || !master || !noise || atten <= 0.02) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noise;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 350;
  const g = c.createGain();
  g.gain.setValueAtTime(0.12 * atten, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  src.connect(lp).connect(g).connect(master);
  src.start(t);
  src.stop(t + 0.06);
}

/** Hurt: a short descending low-register thud, distinct from the shooter-side
 *  `playHit` tick — this is the VICTIM's feedback on taking damage. */
export function playHurt(): void {
  const c = ready();
  if (!c || !master) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(180, t);
  osc.frequency.exponentialRampToValueAtTime(70, t + 0.12);
  const g = c.createGain();
  g.gain.setValueAtTime(0.35, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + 0.14);
}

/** Kill confirm: a quick two-tone rising ding. */
export function playKill(): void {
  const c = ready();
  if (!c || !master) return;
  const t = c.currentTime;
  for (const [i, f] of [660, 990].entries()) {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    const g = c.createGain();
    const start = t + i * 0.07;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(0.3, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
    osc.connect(g).connect(master);
    osc.start(start);
    osc.stop(start + 0.13);
  }
}

export function isMuted(): boolean {
  return muted;
}

function applyMute(): void {
  if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.01);
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
    if (e.code !== "KeyM" || e.repeat) return;
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
