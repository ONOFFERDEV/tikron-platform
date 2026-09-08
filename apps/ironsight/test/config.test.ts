import { describe, it, expect } from "vitest";
import {
  validateConfig,
  loadConfig,
  ConfigError,
  assertMapsFitArena,
  assertParallelArrayLengths,
  assertCapSeparation,
  assertSwapMsCoupling,
  assertRespawnCoupling,
  assertInterpCoupling,
  assertWeaponIndices,
  assertModesWireOrder,
  assertTracerSpeedPositive,
} from "../config/load.js";
import type { GameConfig } from "../config/schema.js";
import { ironsightConfig } from "../config/ironsight.config.js";
import { GAME } from "../src/game-config.js";
import { ARENA, PLAYER, MOVE, WEAPONS, GRENADE, MATCH, LAG, MODES, DEFAULT_WEAPON, PISTOL_INDEX, WEAPON } from "../src/config.js";
import { MODE_ORDER } from "../src/modes.js";
import { ARENA1 } from "../src/map/arena1.js";
import { ARENA2 } from "../src/map/arena2.js";

/**
 * ironsightConfig is the game's data layer (M4 W1), consumed by room/client code
 * via `GAME` since W2/W3. These tests gate: (a) the live config loads clean,
 * (b) each of the 8 coupling/reference asserts actually fires on a broken clone,
 * (c) the lift didn't fork any value away from what src/*.ts still exports.
 *
 * M4 W3 tagging: the loader-assert describes (b) test the assert FUNCTIONS
 * against structurally-mutated clones of ironsightConfig — generic loader
 * behavior, [blueprint]. The two describes that instead check what's actually
 * loaded into the live `GAME` singleton, or compare it against ironsight's own
 * src/config.ts exports, are [config: ironsight] — they fail by design once a
 * different theme is loaded into GAME.
 */

function clone(cfg: GameConfig): GameConfig {
  return structuredClone(cfg);
}

describe("loadConfig(ironsightConfig) [blueprint] — the static config object always loads", () => {
  it("loads the live config with zero hard errors", () => {
    expect(() => loadConfig(ironsightConfig)).not.toThrow();
    const { errors } = validateConfig(ironsightConfig);
    expect(errors).toEqual([]);
  });
});

describe("GAME wiring [config: ironsight]", () => {
  it("src/game-config.ts's GAME is the same loaded instance", () => {
    expect(GAME).toBe(ironsightConfig);
  });
});

describe("validateConfig — negative cases (one per coupling assert) [blueprint]", () => {
  it("assertMapsFitArena fires when a map's bounds diverge from arena extents", () => {
    const bad = clone(ironsightConfig);
    const arena1 = bad.maps["arena1"]!;
    bad.maps["arena1"] = { ...arena1, bounds: { ...arena1.bounds, width: bad.arena.width + 1 } };
    const errs = assertMapsFitArena(bad);
    expect(errs.length).toBeGreaterThan(0);
    expect(errs[0]).toMatch(/bounds/);
    expect(validateConfig(bad).errors.length).toBeGreaterThan(0);
  });

  it("assertParallelArrayLengths fires when weaponVis.recoil is short one entry", () => {
    const bad = clone(ironsightConfig);
    bad.weaponVis.recoil = bad.weaponVis.recoil.slice(0, -1);
    const errs = assertParallelArrayLengths(bad);
    expect(errs.length).toBeGreaterThan(0);
    expect(errs[0]).toMatch(/weaponVis\.recoil/);
  });

  it("assertCapSeparation fires when two capture points coincide", () => {
    const bad = clone(ironsightConfig);
    const arena1 = bad.maps["arena1"]!;
    bad.maps["arena1"] = { ...arena1, caps: { ...arena1.caps, b: { ...arena1.caps.a } } };
    const errs = assertCapSeparation(bad);
    expect(errs.length).toBeGreaterThan(0);
    expect(errs[0]).toMatch(/caps a\/b/);
  });

  it("assertSwapMsCoupling fires when swapDownMs+swapUpMs no longer equals weaponMeta.swapMs", () => {
    const bad = clone(ironsightConfig);
    bad.weaponVis.swapUpMs += 1;
    const errs = assertSwapMsCoupling(bad);
    expect(errs.length).toBe(1);
    expect(errs[0]).toMatch(/weaponMeta\.swapMs/);
  });

  it("assertRespawnCoupling fires when feel.respawnDisplayMs drifts from match.respawnMs", () => {
    const bad = clone(ironsightConfig);
    bad.feel.respawnDisplayMs += 500;
    const errs = assertRespawnCoupling(bad);
    expect(errs.length).toBe(1);
    expect(errs[0]).toMatch(/match\.respawnMs/);
  });

  it("assertInterpCoupling fires when lag.interpolationMs drifts from feel.interpDelayMs", () => {
    const bad = clone(ironsightConfig);
    bad.lag.interpolationMs += 10;
    const errs = assertInterpCoupling(bad);
    expect(errs.length).toBe(1);
    expect(errs[0]).toMatch(/feel\.interpDelayMs/);
  });

  it("assertWeaponIndices fires when pistolIndex no longer points at the last weapon", () => {
    const bad = clone(ironsightConfig);
    bad.weaponMeta.pistolIndex = 0;
    const errs = assertWeaponIndices(bad);
    expect(errs.length).toBeGreaterThan(0);
    expect(errs[0]).toMatch(/pistolIndex/);
  });

  it("assertModesWireOrder fires when the tdm/ffa/dom/practice prefix is reordered", () => {
    const bad = clone(ironsightConfig);
    bad.modes.order = ["ffa", "tdm", "dom", "practice"];
    const errs = assertModesWireOrder(bad);
    expect(errs.length).toBeGreaterThan(0);
    expect(errs[0]).toMatch(/modes\.order\[0\]/);
  });

  it("assertModesWireOrder also fires when mapFor references an undeclared map", () => {
    const bad = clone(ironsightConfig);
    bad.modes.mapFor = { ...bad.modes.mapFor, dom: "arena99" };
    const errs = assertModesWireOrder(bad);
    expect(errs.some((e) => e.includes('references missing map "arena99"'))).toBe(true);
  });

  // Tracer speed (client/scene.ts's addTracer) is cosmetic-only — this guard is
  // purely defense-in-depth against a missing/degenerate value, not a coupling
  // check against anything else, unlike this describe's other entries.
  it("assertTracerSpeedPositive fires when a weapon's tracerSpeed is missing, 0, or negative", () => {
    const missing = clone(ironsightConfig);
    missing.weapons = missing.weapons.map((w, i) => (i === 0 ? { ...w, tracerSpeed: undefined as unknown as number } : w));
    expect(assertTracerSpeedPositive(missing).length).toBeGreaterThan(0);

    const zero = clone(ironsightConfig);
    zero.weapons = zero.weapons.map((w, i) => (i === 1 ? { ...w, tracerSpeed: 0 } : w));
    const zeroErrs = assertTracerSpeedPositive(zero);
    expect(zeroErrs.length).toBe(1);
    expect(zeroErrs[0]).toMatch(/tracerSpeed/);

    const negative = clone(ironsightConfig);
    negative.weapons = negative.weapons.map((w, i) => (i === 2 ? { ...w, tracerSpeed: -500 } : w));
    expect(assertTracerSpeedPositive(negative).length).toBe(1);

    // Positive control: the live config itself has zero tracerSpeed errors.
    expect(assertTracerSpeedPositive(ironsightConfig)).toEqual([]);
  });

  it("loadConfig throws ConfigError (not a generic Error) when validation fails", () => {
    const bad = clone(ironsightConfig);
    bad.lag.interpolationMs += 10;
    expect(() => loadConfig(bad)).toThrow(ConfigError);
  });
});

describe("validateConfig — warnings tier (suspicious but legal) [blueprint]", () => {
  it("warns (does not error) on an absurdly high score target", () => {
    const cfg = clone(ironsightConfig);
    cfg.match.killTarget = 5000;
    const { errors, warnings } = validateConfig(cfg);
    expect(errors).toEqual([]);
    expect(warnings.some((w) => w.includes("match.killTarget"))).toBe(true);
  });

  it("warns (does not error) on a sub-50ms weapon fire interval", () => {
    const cfg = clone(ironsightConfig);
    cfg.weapons = cfg.weapons.map((w, i) => (i === 0 ? { ...w, fireIntervalMs: 10 } : w));
    const { errors, warnings } = validateConfig(cfg);
    expect(errors).toEqual([]);
    expect(warnings.some((w) => w.includes("fireIntervalMs"))).toBe(true);
  });
});

describe("equivalence — the lift didn't fork any value away from src/*.ts [config: ironsight]", () => {
  it("imported groups are the exact same object src/config.ts and the map modules export", () => {
    expect(GAME.arena.width).toBeGreaterThanOrEqual(ARENA1.bounds.width);
    expect(GAME.arena.depth).toBeGreaterThanOrEqual(ARENA1.bounds.depth);
    expect(GAME.player).toBe(PLAYER);
    expect(GAME.move).toBe(MOVE);
    expect(GAME.weapons).toBe(WEAPONS);
    // grenade is GRENADE's fields + a transcribed muzzleOffset (W2 finding), so it's
    // a new object — every original field must still match GRENADE by value.
    expect(GAME.grenade).toEqual({ ...GRENADE, muzzleOffset: GAME.grenade.muzzleOffset });
    expect(GAME.lag).toBe(LAG);
    expect(GAME.maps["arena1"]).toBe(ARENA1);
    expect(GAME.maps["arena2"]).toBe(ARENA2);
    expect(GAME.modes.order).toBe(MODE_ORDER);
  });

  it("match/weaponMeta fields match MATCH/DEFAULT_WEAPON/PISTOL_INDEX/WEAPON.swapMs", () => {
    expect(GAME.match.killTarget).toBe(MATCH.killTarget);
    expect(GAME.match.timeLimitMs).toBe(MATCH.timeLimitMs);
    expect(GAME.match.fillToPlayers).toBe(MATCH.fillToPlayers);
    expect(GAME.match.killstreakThresholds).toBe(MATCH.killstreakThresholds);
    expect(GAME.weaponMeta.defaultIndex).toBe(DEFAULT_WEAPON);
    expect(GAME.weaponMeta.pistolIndex).toBe(PISTOL_INDEX);
    expect(GAME.weaponMeta.swapMs).toBe(WEAPON.swapMs);
  });

  it("modes.tdm/ffa/dom mirror src/config.ts's MODES values", () => {
    expect(GAME.modes.tdm.killTarget).toBe(MODES.tdm.killTarget);
    expect(GAME.modes.ffa.killTarget).toBe(MODES.ffa.killTarget);
    expect(GAME.modes.dom).toEqual(MODES.dom);
  });

  it("room-only literals (maxInputsPerSecond, aoiViewRadius) match arena-room.ts's hardcoded values", () => {
    expect(GAME.match.maxInputsPerSecond).toBe(90);
    expect(GAME.match.aoiViewRadius).toBe(100);
  });
});
