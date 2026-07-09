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
  return ctx;
}

function ready(): AudioContext | null {
  const c = ensure();
  if (!c || muted || c.state !== "running") return null;
  return c;
}

/** Rifle crack: a fast noise burst through a bandpass, plus a short body thump. */
export function playFire(): void {
  const c = ready();
  if (!c || !master || !noise) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noise;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1600;
  bp.Q.value = 0.8;
  const g = c.createGain();
  g.gain.setValueAtTime(0.9, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  src.connect(bp).connect(g).connect(master);
  src.start(t);
  src.stop(t + 0.1);

  const osc = c.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(180, t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.08);
  const og = c.createGain();
  og.gain.setValueAtTime(0.5, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  osc.connect(og).connect(master);
  osc.start(t);
  osc.stop(t + 0.1);
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
