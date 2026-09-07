/**
 * Web Audio SFX layer (POLISH-EMBERFALL A1 + G2). One AudioContext, one master
 * GainNode, a per-URL decoded-buffer cache, and a fire-and-forget `playSfx(id)`
 * API keyed off logical ids (never file paths) so callers stay asset-agnostic —
 * the same "logical id" contract the AssetRegistry uses for models.
 *
 * Browser autoplay policy: an AudioContext starts suspended until a user
 * gesture resumes it. This module self-registers a one-shot pointerdown/keydown
 * listener at load that resumes the context — callers never wire that up. SFX
 * fired before the context is running are dropped (nothing audible anyway).
 *
 * G2 guards: the same logical id plays at most once per 50ms, and no more than
 * 8 voices sound at once (extra plays drop) — an AOI-wide burst of combat
 * events can't turn into an audio avalanche.
 *
 * Node-safe at import: every window/document/localStorage touch is guarded, so
 * net.ts/ui.ts/inventory-ui.ts importing `playSfx` doesn't break their Node
 * unit tests (test/client-net.test.ts / client-m2.test.ts import those modules).
 */
import { showToast } from "./ui.js";

const AUDIO_BASE = "/assets/audio/";
const VOLUME_KEY = "ef_volume";
const MUTED_KEY = "ef_muted";
const DEFAULT_VOLUME = 0.7;
const DEBOUNCE_MS = 50;
const MAX_VOICES = 8;

/**
 * Logical SFX id -> file(s) under `public/assets/audio/` (Kenney RPG/UI Audio,
 * CC0 — see `public/assets/LICENSE.md`). An array rotates a random member per
 * play (A2's "타격 3종 랜덤"). Several ids share one file on purpose (e.g.
 * `resurrect` reuses the level-up fanfare, A2) — the buffer cache is keyed by
 * URL, so a shared file still decodes only once.
 */
const SFX_FILES = {
  hit: ["knifeSlice.ogg", "knifeSlice2.ogg", "chop.ogg"],
  hurt: "metalPot1.ogg",
  castStart: "drawKnife1.ogg",
  castFire: "cloth3.ogg",
  arrow: "cloth3.ogg", // Bow/javelin release whoosh — reuses the cloth swish (no new asset)
  dash: "cloth3.ogg", // Space-dash whoosh — reuses the cloth swish (no new asset)
  death: "dropLeather.ogg",
  levelup: "handleCoins.ogg",
  resurrect: "handleCoins.ogg",
  click: "click1.ogg",
  buy: "handleCoins.ogg",
  sell: "handleCoins2.ogg",
  equip: "metalClick.ogg",
  unequip: "cloth1.ogg",
  potion: "beltHandle1.ogg",
  invOpen: "bookOpen.ogg",
} satisfies Record<string, string | readonly string[]>;

export type SfxId = keyof typeof SFX_FILES;

// --- module state (lazily initialized; nothing below touches the DOM at import) ---
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let volume = DEFAULT_VOLUME;
let muted = false;
let activeVoices = 0;
const buffers = new Map<string, AudioBuffer>();
const pending = new Map<string, Promise<AudioBuffer | null>>();
const lastPlayed = new Map<string, number>();

type WebkitWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/** Reads persisted volume/mute prefs. Guarded — localStorage throws in private mode. */
function readPrefs(): void {
  try {
    const v = localStorage.getItem(VOLUME_KEY);
    if (v !== null) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0 && n <= 1) volume = n;
    }
    muted = localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    // localStorage unavailable — keep defaults.
  }
}

/** Lazily builds the AudioContext + master gain. Returns null off-DOM or when
 *  the browser has no Web Audio (both leave `playSfx` a silent no-op). */
function ensureContext(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : volume;
  master.connect(ctx.destination);
  return ctx;
}

/** Fetches + decodes `url` once, caching the buffer by URL. Never rejects: a
 *  failed load warns and resolves null (that one SFX stays silent). */
function loadBuffer(context: AudioContext, url: string): Promise<AudioBuffer | null> {
  const cached = buffers.get(url);
  if (cached) return Promise.resolve(cached);
  let p = pending.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status} ${r.statusText}`))))
      .then((data) => context.decodeAudioData(data))
      .then((buf) => {
        buffers.set(url, buf);
        pending.delete(url);
        return buf;
      })
      .catch((err) => {
        pending.delete(url);
        console.warn(`[audio] failed to load ${url}`, err);
        return null;
      });
    pending.set(url, p);
  }
  return p;
}

function pickFile(id: SfxId): string {
  const f = SFX_FILES[id];
  if (typeof f === "string") return f;
  return f[Math.floor(Math.random() * f.length)]!;
}

/**
 * Plays SFX `id` once. Fire-and-forget: callers never await. Silently drops the
 * play when muted, before the context is running (pre-gesture), within 50ms of
 * the same id (debounce), or when 8 voices already sound (voice cap) — the G2
 * budget. The first play of a not-yet-cached file is async (fetch+decode) and
 * may not sound; every later play hits the buffer cache.
 */
export function playSfx(id: SfxId): void {
  const context = ensureContext();
  if (!context || muted || context.state !== "running") return;
  const t = nowMs();
  const last = lastPlayed.get(id);
  if (last !== undefined && t - last < DEBOUNCE_MS) return;
  lastPlayed.set(id, t);
  if (activeVoices >= MAX_VOICES) return;
  const url = AUDIO_BASE + pickFile(id);
  void loadBuffer(context, url).then((buf) => {
    if (!buf || !master || activeVoices >= MAX_VOICES) return;
    const src = context.createBufferSource();
    src.buffer = buf;
    src.connect(master);
    activeVoices++;
    src.onended = () => {
      activeVoices = Math.max(0, activeVoices - 1);
    };
    src.start();
  });
}

function applyGain(): void {
  if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.01);
}

/** Sets + persists master volume (0..1, clamped). */
export function setVolume(v: number): void {
  volume = Math.max(0, Math.min(1, v));
  try {
    localStorage.setItem(VOLUME_KEY, String(volume));
  } catch {
    // ignore persistence failure
  }
  applyGain();
}

export function getVolume(): number {
  return volume;
}

export function isMuted(): boolean {
  return muted;
}

/** Toggles + persists mute, returning the new muted state. */
export function toggleMute(): boolean {
  muted = !muted;
  try {
    localStorage.setItem(MUTED_KEY, muted ? "1" : "0");
  } catch {
    // ignore persistence failure
  }
  applyGain();
  return muted;
}

function isTypingTarget(e: KeyboardEvent): boolean {
  const t = e.target;
  return (
    t instanceof HTMLInputElement ||
    t instanceof HTMLTextAreaElement ||
    (t instanceof HTMLElement && t.isContentEditable)
  );
}

// --- self-wiring (guarded so import is a no-op in Node tests) ---------------------------
if (typeof window !== "undefined") {
  readPrefs();

  // Autoplay policy: resume the context on the first user gesture (once).
  const resume = (): void => {
    const context = ensureContext();
    if (context && context.state === "suspended") void context.resume();
  };
  window.addEventListener("pointerdown", resume, { once: true });
  window.addEventListener("keydown", resume, { once: true });

  // 'M' toggles mute globally (A4 pre-settings fallback), ignored while typing.
  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() !== "m" || e.repeat || isTypingTarget(e)) return;
    const nowMuted = toggleMute();
    try {
      showToast(nowMuted ? "🔇 음소거" : "🔊 소리 켜짐");
    } catch {
      // showToast is best-effort here; never let it break the toggle.
    }
  });
}
