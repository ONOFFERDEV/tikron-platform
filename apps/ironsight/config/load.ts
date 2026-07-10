/**
 * Config loader + coupling-constant asserts — ironsight's "landmine guard" (mirrors
 * `gg`'s quarterview-arpg `load.ts`). Every assert here recovers, at LOAD time, an
 * invariant that today lives only as a doc-comment promise scattered across
 * src/config.ts, src/modes.ts, client/config.ts, client/scene.ts, and
 * arena-room.ts — e.g. "weaponMeta.swapMs === client's SWAP_DOWN_MS+SWAP_UP_MS".
 * Lifting those scattered constants into one `GameConfig` value means the loader
 * can check the coupling directly instead of trusting the comments to stay true.
 *
 * Each `assert*` returns a flat `string[]` of human-readable problems (never
 * throws). `validateConfig` aggregates them into `{errors, warnings}`; `loadConfig`
 * throws `ConfigError` on any error and logs warnings.
 */

import type { GameConfig } from "./schema.js";

// ── #1 — maps fit the arena / wire quant freeze ──────────────────────────────

/** Every map's `bounds` deep-equals `arena`'s extents — the position codec's quant
 *  ranges are pinned to `ARENA` (schema.ts's `PlayerSchema`), so a map with
 *  different bounds would silently clip coordinates on the wire. */
export function assertMapsFitArena(cfg: GameConfig): string[] {
  const errs: string[] = [];
  const { width, depth, ceiling } = cfg.arena;
  for (const [id, map] of Object.entries(cfg.maps)) {
    const b = map.bounds;
    if (b.width !== width || b.depth !== depth || b.ceiling !== ceiling) {
      errs.push(
        `map "${id}".bounds (${b.width}x${b.depth}x${b.ceiling}) must equal arena extents ` +
          `(${width}x${depth}x${ceiling}) — the wire codec's quant ranges are pinned to arena`,
      );
    }
  }
  return errs;
}

// ── #2 — parallel per-weapon array lengths ───────────────────────────────────

/** `weapons`, `weaponVis.recoil`, `camera.adsFov`, and `audio.fireParams` are all
 *  indexed the SAME way (by weapon index) — a length mismatch means one of them
 *  is missing (or has an extra) entry for some weapon. */
export function assertParallelArrayLengths(cfg: GameConfig): string[] {
  const errs: string[] = [];
  const n = cfg.weapons.length;
  const lens: [string, number][] = [
    ["weaponVis.recoil", cfg.weaponVis.recoil.length],
    ["camera.adsFov", cfg.camera.adsFov.length],
    ["audio.fireParams", cfg.audio.fireParams.length],
  ];
  for (const [name, len] of lens) {
    if (len !== n) {
      errs.push(`${name}.length (${len}) must equal weapons.length (${n})`);
    }
  }
  return errs;
}

// ── #3 — dom capture points don't overlap ────────────────────────────────────

/** Every map's three capture-point centers sit at least `2 × captureRadius` apart
 *  (ground plane only — `dom.captureRadius` gates a `playersAt(x, z, r)` query),
 *  so no two points can ever be captured by standing in one spot. Checked on
 *  every map (not only the one dom is actually played on) — `MapDef.caps` is
 *  required on every map so `mapForMode` never special-cases a missing field. */
export function assertCapSeparation(cfg: GameConfig): string[] {
  const errs: string[] = [];
  const minDist = 2 * cfg.modes.dom.captureRadius;
  for (const [id, map] of Object.entries(cfg.maps)) {
    const { a, b, c } = map.caps;
    const pairs: [string, string, { x: number; z: number }, { x: number; z: number }][] = [
      ["a", "b", a, b],
      ["b", "c", b, c],
      ["a", "c", a, c],
    ];
    for (const [k1, k2, p1, p2] of pairs) {
      const dist = Math.hypot(p1.x - p2.x, p1.z - p2.z);
      if (dist < minDist) {
        errs.push(
          `map "${id}" caps ${k1}/${k2} are ${dist.toFixed(2)}m apart, under the ` +
            `2×captureRadius minimum (${minDist}m)`,
        );
      }
    }
  }
  return errs;
}

// ── #4 — weapon swap timing lockstep ─────────────────────────────────────────

/** `weaponMeta.swapMs` (the server's fire-gate delay) equals `weaponVis.swapDownMs
 *  + swapUpMs` (the client's lower→raise animation) — client/scene.ts's own doc
 *  comment: "down+up = the server's 350 ms switch delay". */
export function assertSwapMsCoupling(cfg: GameConfig): string[] {
  const total = cfg.weaponVis.swapDownMs + cfg.weaponVis.swapUpMs;
  if (total !== cfg.weaponMeta.swapMs) {
    return [
      `weaponMeta.swapMs (${cfg.weaponMeta.swapMs}) must equal weaponVis.swapDownMs + ` +
        `swapUpMs (${cfg.weaponVis.swapDownMs} + ${cfg.weaponVis.swapUpMs} = ${total})`,
    ];
  }
  return [];
}

// ── #5 — respawn countdown display lockstep ──────────────────────────────────

/** `match.respawnMs` (the server's actual downed→respawn delay) equals
 *  `feel.respawnDisplayMs` (main.ts's own `RESPAWN_MS`, used only to render the
 *  client-side countdown) — a mismatch would show a countdown that doesn't match
 *  when the server actually respawns the player. */
export function assertRespawnCoupling(cfg: GameConfig): string[] {
  if (cfg.match.respawnMs !== cfg.feel.respawnDisplayMs) {
    return [
      `match.respawnMs (${cfg.match.respawnMs}) must equal feel.respawnDisplayMs ` +
        `(${cfg.feel.respawnDisplayMs}) — the client countdown must match the server's real delay`,
    ];
  }
  return [];
}

// ── #6 — interpolation delay lockstep ────────────────────────────────────────

/** `feel.interpDelayMs` (how far in the past the client renders remotes) equals
 *  `lag.interpolationMs` (the server's own rewind-interpolation constant) — the
 *  two independently tune the same "no subtick timestamp" fallback window. */
export function assertInterpCoupling(cfg: GameConfig): string[] {
  if (cfg.feel.interpDelayMs !== cfg.lag.interpolationMs) {
    return [
      `feel.interpDelayMs (${cfg.feel.interpDelayMs}) must equal lag.interpolationMs ` +
        `(${cfg.lag.interpolationMs})`,
    ];
  }
  return [];
}

// ── #7 — weapon index invariants ─────────────────────────────────────────────

/** `weaponMeta.pistolIndex` is the LAST weapon slot and really is a pistol (slot
 *  5); `defaultIndex` resolves to a real weapon. */
export function assertWeaponIndices(cfg: GameConfig): string[] {
  const errs: string[] = [];
  const n = cfg.weapons.length;
  const { defaultIndex, pistolIndex } = cfg.weaponMeta;
  if (pistolIndex !== n - 1) {
    errs.push(`weaponMeta.pistolIndex (${pistolIndex}) must equal weapons.length-1 (${n - 1})`);
  } else if (cfg.weapons[pistolIndex]?.slot !== 5) {
    errs.push(`weapons[weaponMeta.pistolIndex].slot must be 5, got ${cfg.weapons[pistolIndex]?.slot}`);
  }
  if (defaultIndex < 0 || defaultIndex >= n) {
    errs.push(`weaponMeta.defaultIndex (${defaultIndex}) is out of range [0, ${n})`);
  }
  return errs;
}

// ── #8 — modes wire order + map references ───────────────────────────────────

const WIRE_MODE_PREFIX: readonly string[] = ["tdm", "ffa", "dom", "practice"];

/** `modes.order`'s first four entries are exactly tdm/ffa/dom/practice, in that
 *  order (modes.ts's own doc comment: "Append-only — an existing index must never
 *  move or its meaning changes for already-synced clients"). Also checks
 *  `mapFor`'s keys are declared modes and its values resolve to a real map. */
export function assertModesWireOrder(cfg: GameConfig): string[] {
  const errs: string[] = [];
  const order = cfg.modes.order;
  for (let i = 0; i < WIRE_MODE_PREFIX.length; i++) {
    if (order[i] !== WIRE_MODE_PREFIX[i]) {
      errs.push(
        `modes.order[${i}] must be "${WIRE_MODE_PREFIX[i]}" (append-only wire encoding), got ` +
          `${order[i] === undefined ? "undefined" : `"${order[i]}"`}`,
      );
    }
  }
  const orderSet = new Set<string>(order);
  const mapIds = new Set(Object.keys(cfg.maps));
  for (const [mode, mapId] of Object.entries(cfg.modes.mapFor)) {
    if (!orderSet.has(mode)) errs.push(`modes.mapFor key "${mode}" is not in modes.order`);
    if (!mapIds.has(mapId)) errs.push(`modes.mapFor["${mode}"] references missing map "${mapId}"`);
  }
  return errs;
}

// ── warnings tier — suspicious but legal values ──────────────────────────────

/** Values that typecheck and load fine but are probably a typo (an absurdly high
 *  score target, a weapon that fires faster than the server tick) — surfaced as
 *  warnings, not load-blocking errors. */
export function collectWarnings(cfg: GameConfig): string[] {
  const warnings: string[] = [];
  const scoreTargets: [string, number][] = [
    ["match.killTarget", cfg.match.killTarget],
    ["modes.tdm.killTarget", cfg.modes.tdm.killTarget],
    ["modes.ffa.killTarget", cfg.modes.ffa.killTarget],
    ["modes.dom.scoreTarget", cfg.modes.dom.scoreTarget],
  ];
  for (const [name, value] of scoreTargets) {
    if (value > 500) warnings.push(`${name} (${value}) is unusually high (>500) — check for a typo`);
  }
  for (const w of cfg.weapons) {
    if (w.fireIntervalMs < 50) {
      warnings.push(`weapon "${w.name}".fireIntervalMs (${w.fireIntervalMs}) is under 50ms — faster than most tick rates`);
    }
  }
  return warnings;
}

// ── aggregate ────────────────────────────────────────────────────────────────

const ERROR_ASSERTS: readonly ((cfg: GameConfig) => string[])[] = [
  assertMapsFitArena,
  assertParallelArrayLengths,
  assertCapSeparation,
  assertSwapMsCoupling,
  assertRespawnCoupling,
  assertInterpCoupling,
  assertWeaponIndices,
  assertModesWireOrder,
];

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

/** Run every assert and return the errors + warnings (`errors: []` ⇒ loadable). */
export function validateConfig(cfg: GameConfig): ValidationResult {
  return {
    errors: ERROR_ASSERTS.flatMap((fn) => fn(cfg)),
    warnings: collectWarnings(cfg),
  };
}

/** Thrown by {@link loadConfig} when a config fails validation. */
export class ConfigError extends Error {
  constructor(public readonly problems: string[]) {
    super(`invalid game.config:\n  - ${problems.join("\n  - ")}`);
    this.name = "ConfigError";
  }
}

/** Validate and return `cfg`, throwing {@link ConfigError} on any hard error.
 *  Warnings are logged, not thrown. */
export function loadConfig(cfg: GameConfig): GameConfig {
  const { errors, warnings } = validateConfig(cfg);
  if (warnings.length > 0) {
    console.warn(`game.config warnings:\n  - ${warnings.join("\n  - ")}`);
  }
  if (errors.length > 0) throw new ConfigError(errors);
  return cfg;
}
