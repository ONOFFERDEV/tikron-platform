import { describe, it, expect } from "vitest";
import { ARENA1 } from "../src/map/arena1.js";
import { ARENA2 } from "../src/map/arena2.js";
import { ARENA3 } from "../src/map/arena3.js";
import type { MapDef } from "../src/map/types.js";
import { walkSeconds } from "../src/map/nav.js";

/**
 * Map instrumentation gate: every map must offer red and blue a symmetric walk
 * to each capture point, and every spawn must actually be able to reach every
 * cap on foot. Runs on every map edit (always on, no env gate) — see
 * src/map/nav.ts for the walk-time model and its ground-walk-only caveat.
 */
const MAPS: { readonly name: string; readonly map: MapDef }[] = [
  { name: "arena1 (tdm/ffa)", map: ARENA1 },
  { name: "arena2 (dom)", map: ARENA2 },
  { name: "arena3 (ffa)", map: ARENA3 },
];

const CAP_KEYS = ["a", "b", "c"] as const;
const MAX_SPAWN_ETA_SKEW_S = 0.75;

describe.each(MAPS)("map timing — $name", ({ map, name }) => {
  it("every spawn can walk to every capture point", () => {
    for (const side of ["red", "blue"] as const) {
      for (const spawn of map.spawns[side]) {
        for (const key of CAP_KEYS) {
          expect(walkSeconds(map, spawn, map.caps[key])).toBeLessThan(Infinity);
        }
      }
    }
  });

  it("both teams' k-th nearest caps are equally near (sorted-ETA comparison, ≤ 0.75 s each)", () => {
    // Per-cap red≈blue symmetry is the WRONG invariant for home-cap layouts:
    // arena2 is Battlefield-style DOM (cap a = red's home, c = blue's home,
    // b = the contested middle), where each team is SUPPOSED to be ~5 s closer
    // to its own home cap. Fairness there is MIRROR symmetry — my home is as
    // close to me as yours is to you — which the mode-agnostic formulation
    // below captures for both tdm and dom without per-cap exceptions: sort
    // each team's best ETA per cap ascending and compare element-wise, i.e.
    // "each team's k-th nearest cap is equally near."
    const bestEtas = (side: "red" | "blue"): number[] =>
      CAP_KEYS.map((key) => Math.min(...map.spawns[side].map((s) => walkSeconds(map, s, map.caps[key])))).sort(
        (a, b) => a - b,
      );
    const red = bestEtas("red");
    const blue = bestEtas("blue");
    console.log(
      `[map-timing] ${name} sorted ETAs: red=[${red.map((v) => v.toFixed(2)).join(", ")}] blue=[${blue.map((v) => v.toFixed(2)).join(", ")}]`,
    );
    for (let k = 0; k < CAP_KEYS.length; k++) {
      expect(red[k]).toBeLessThan(Infinity);
      expect(blue[k]).toBeLessThan(Infinity);
      expect(Math.abs(red[k]! - blue[k]!)).toBeLessThanOrEqual(MAX_SPAWN_ETA_SKEW_S);
    }
  });
});
