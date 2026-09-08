/**
 * Player-adjustable settings: mouse sensitivity, vertical look inversion, and
 * keybindings. This module is deliberately DOM-free — no `HTMLElement`, no
 * `addEventListener` — so it can be unit-tested in plain Node under vitest
 * without a browser or jsdom. `settings-ui.ts` is the DOM layer built on top
 * of this store; `input.ts` reads `get().binds`/`get().sensitivity`/
 * `get().invertY` on every event instead of capturing them once, so a change
 * made in the panel takes effect on the very next keypress or mouse move
 * without requiring a reload.
 *
 * Persistence is a plain `localStorage` blob (key `ironsight.settings.v1`),
 * written synchronously after every mutation. The storage backend is
 * constructor-injectable (default `window.localStorage`) purely so tests can
 * substitute an in-memory fake — there's no product reason to ever pass
 * anything else at runtime. Loading is defensive by design: a missing key,
 * malformed JSON, or a saved value of the wrong shape/type must never throw
 * or crash the game, it just falls back to defaults for the affected field
 * (or entirely, for a totally corrupt blob). This matters because the saved
 * blob outlives any particular version of this file — a future rename of a
 * `BindAction` or a hand-edited localStorage value shouldn't brick the game.
 *
 * Rebinding enforces a single invariant: a key can only ever be bound to one
 * action at a time. `rebind()` therefore both sets the new action's binding
 * AND strips that key out of every other action's binding list in the same
 * step, rather than leaving it as a two-owner ambiguity for `input.ts` to
 * puzzle out later.
 */

/** The 9 rebindable actions. Digit1-5 (slot select), mouse buttons, and the
 *  scroll-wheel weapon-cycle are intentionally NOT here — those stay fixed
 *  per the spec, so `input.ts` keeps handling them as literal codes. */
export type BindAction =
  | "forward"
  | "back"
  | "left"
  | "right"
  | "jump"
  | "crouch"
  | "sprint"
  | "reload"
  | "grenade"
  | "ping";

export interface Settings {
  /** Multiplier applied on top of the base `MOUSE_SENSITIVITY` rad/px constant. */
  sensitivity: number;
  invertY: boolean;
  reducedMotion: boolean;
  volume: number;
  binds: Record<BindAction, string[]>;
}

/** Minimal storage shape `SettingsStore` depends on — matches the subset of
 *  `Storage` (i.e. `window.localStorage`) it actually uses, so tests can pass
 *  a plain in-memory object instead of standing up jsdom. */
export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORAGE_KEY = "ironsight.settings.v1";
const MIN_SENSITIVITY = 0.1;
const MAX_SENSITIVITY = 3.0;

export const BIND_ACTIONS: readonly BindAction[] = [
  "forward",
  "back",
  "left",
  "right",
  "jump",
  "crouch",
  "sprint",
  "reload",
  "grenade",
  "ping",
];

/** Matches today's hardcoded `input.ts` behavior exactly, so shipping this
 *  feature changes nothing for a player who never opens the settings panel. */
const DEFAULT_BINDS: Record<BindAction, string[]> = {
  forward: ["KeyW"],
  back: ["KeyS"],
  left: ["KeyA"],
  right: ["KeyD"],
  jump: ["Space"],
  crouch: ["ControlLeft", "KeyC"],
  sprint: ["ShiftLeft", "ShiftRight"],
  reload: ["KeyR"],
  grenade: ["KeyG"],
  ping: ["KeyQ"],
};

const DEFAULT_SENSITIVITY = 1.0;
const DEFAULT_INVERT_Y = false;

function defaultSettings(): Settings {
  const binds = {} as Record<BindAction, string[]>;
  for (const action of BIND_ACTIONS) binds[action] = [...DEFAULT_BINDS[action]];
  return { sensitivity: DEFAULT_SENSITIVITY, invertY: DEFAULT_INVERT_Y, reducedMotion: false, volume: 1, binds };
}

function clampSensitivity(value: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_SENSITIVITY;
  return Math.min(MAX_SENSITIVITY, Math.max(MIN_SENSITIVITY, value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/** Overlays whatever well-typed fields exist in `raw` onto a fresh set of
 *  defaults. Anything missing, mistyped, or unrecognized is silently ignored
 *  rather than rejecting the whole blob — a partial save (e.g. from an older
 *  version of this file with fewer actions) should merge cleanly. */
function mergeWithDefaults(raw: unknown): Settings {
  const out = defaultSettings();
  if (raw === null || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;

  if (typeof r.sensitivity === "number") out.sensitivity = clampSensitivity(r.sensitivity);
  if (typeof r.invertY === "boolean") out.invertY = r.invertY;
  if (typeof r.reducedMotion === "boolean") out.reducedMotion = r.reducedMotion;
  if (typeof r.volume === "number" && Number.isFinite(r.volume)) out.volume = Math.max(0, Math.min(1, r.volume));

  if (r.binds !== null && typeof r.binds === "object") {
    const rb = r.binds as Record<string, unknown>;
    if (!('ping' in rb) && Object.values(rb).some(v => isStringArray(v) && v.includes('KeyQ'))) out.binds.ping = [];
    for (const action of BIND_ACTIONS) {
      const bound = rb[action];
      if (isStringArray(bound)) out.binds[action] = [...bound];
    }
  }
  return out;
}

function load(storage: SettingsStorage): Settings {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return defaultSettings();
    return mergeWithDefaults(JSON.parse(raw));
  } catch {
    return defaultSettings();
  }
}

function save(storage: SettingsStorage, settings: Settings): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can throw (quota exceeded, private-browsing restrictions, etc).
    // The in-memory settings still apply for the rest of this session.
  }
}

/** Mutable settings holder. `get()` always returns the current snapshot;
 *  every mutator persists immediately and replaces that snapshot, so callers
 *  never need to poll or re-fetch. */
export class SettingsStore {
  private current: Settings;

  constructor(private readonly storage: SettingsStorage = window.localStorage) {
    this.current = load(this.storage);
  }

  get(): Settings {
    return this.current;
  }

  setSensitivity(value: number): void {
    this.current = { ...this.current, sensitivity: clampSensitivity(value) };
    save(this.storage, this.current);
  }

  setInvertY(value: boolean): void {
    this.current = { ...this.current, invertY: value };
    save(this.storage, this.current);
  }

  setReducedMotion(value: boolean): void {
    this.current = { ...this.current, reducedMotion: value };
    save(this.storage, this.current);
  }

  setVolume(value: number): void {
    this.current = { ...this.current, volume: Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1 };
    save(this.storage, this.current);
  }

  /** Bind `action` to exactly `[code]`, replacing whatever it held before,
   *  and remove `code` from every other action that currently holds it. */
  rebind(action: BindAction, code: string): void {
    const binds = {} as Record<BindAction, string[]>;
    for (const a of BIND_ACTIONS) {
      binds[a] = a === action ? [code] : this.current.binds[a].filter((c) => c !== code);
    }
    this.current = { ...this.current, binds };
    save(this.storage, this.current);
  }

  /** Restore one action's binding to its shipped default. */
  resetBind(action: BindAction): void {
    this.current = {
      ...this.current,
      binds: { ...this.current.binds, [action]: [...DEFAULT_BINDS[action]] },
    };
    save(this.storage, this.current);
  }

  /** Restore sensitivity, invert-Y, and every binding to shipped defaults. */
  resetAll(): void {
    this.current = defaultSettings();
    save(this.storage, this.current);
  }
}

const MODIFIER_NAMES: Record<string, string> = {
  Control: "CTRL",
  Shift: "SHIFT",
  Alt: "ALT",
  Meta: "META",
};

const ARROW_SYMBOLS: Record<string, string> = {
  Up: "↑",
  Down: "↓",
  Left: "←",
  Right: "→",
};

/** Formats a raw `KeyboardEvent.code` into a short display label for the
 *  keybinding table. Unrecognized codes pass through unchanged rather than
 *  failing, since `input.ts` can in principle capture any physical key. */
export function formatKeyLabel(code: string): string {
  if (code === "Space") return "SPACE";

  const keyMatch = /^Key([A-Z])$/.exec(code);
  if (keyMatch) return keyMatch[1]!;

  const digitMatch = /^Digit([0-9])$/.exec(code);
  if (digitMatch) return digitMatch[1]!;

  const arrowMatch = /^Arrow(Up|Down|Left|Right)$/.exec(code);
  if (arrowMatch) return ARROW_SYMBOLS[arrowMatch[1]!]!;

  const modifierMatch = /^(Control|Shift|Alt|Meta)(Left|Right)$/.exec(code);
  if (modifierMatch) {
    const side = modifierMatch[2] === "Left" ? "L" : "R";
    return `${side}-${MODIFIER_NAMES[modifierMatch[1]!]}`;
  }

  return code;
}

/** Formats a full binding (0+ codes) for display, e.g. `["ControlLeft",
 *  "KeyC"]` -> `"L-CTRL / C"`, `[]` -> `"—"`. */
export function formatBinding(codes: string[]): string {
  if (codes.length === 0) return "—";
  return codes.map(formatKeyLabel).join(" / ");
}
