import type { Box, Bounds, Vec3 } from "../physics.js";
import { ARENA } from "../config.js";
import type { MapDef } from "./types.js";

/**
 * ASCII tilemap compiler — turns a level author's plain grid of characters into a
 * {@link MapDef} the room/client/bots already know how to consume (the exact same
 * contract `arena1.ts`/`arena2.ts`'s hand-authored box lists produce). Two jobs:
 *  1. Walk the grid once, bucketing each tile into a height class, a ramp, a
 *     spawn/cap marker, or a floor no-op — and erroring loudly on anything else,
 *     since a level here is a plain 2D array of characters, so a typo is caught
 *     at compile time instead of surfacing as "why is there a wall in the middle
 *     of my platform."
 *  2. Collapse same-height-class tiles into the fewest AABBs via greedy
 *     rectangle merging (horizontal runs per row, then vertical runs across rows
 *     whose horizontal span matches exactly) — one box per tile would still be
 *     physically correct, but needlessly bloats every `moveAndSlide` obstacle scan.
 *
 * Why tiles: a hand-placed box list (arena1.ts's style) is precise but opaque —
 * nudging one wall means re-deriving raw coordinates by hand, and there's no way
 * to "read" a level's shape from its source. A monospace ASCII grid is both a
 * literal top-down blueprint and something an LLM (or a human) can edit
 * character-by-character with the whole layout visible in the diff.
 *
 * Legend (fixed — this is the wire contract between whoever draws a map and this
 * compiler, not a per-map configurable):
 *
 * | char      | meaning                                                        |
 * |-----------|----------------------------------------------------------------|
 * | `.`       | floor — no-op, just walkable ground                             |
 * | `#`       | wall — height 2.5 m, full cover                                 |
 * | `x`       | crate — height 1.1 m, climbable by jumping                      |
 * | `X`       | stack — height 2.2 m, reachable only via an adjacent `x`        |
 * | `=`       | platform — height 1.2 m, walkable top, climbable via jump/ramp  |
 * | `< > ^ v` | ramp — rises 0→1.2 m across 3 steps in one tile (see below)     |
 * | `r` / `b` | red / blue team spawn — compiles as floor; position extracted   |
 * | `1`/`2`/`3` | domination cap a / b / c — compiles as floor; position extracted |
 *
 * Ramps: each step is `TILE/3` (≈0.667 m) deep along the direction of travel and
 * TILE (2 m) wide across it, at heights 0.4 / 0.8 / 1.2 m. The arrow names the
 * direction that climbs: `>` climbs going +x, `<` going −x, `v` going +z, `^`
 * going −z. The top (1.2 m) step must sit flush against an adjacent `=` tile in
 * that same direction of travel — the level author's job; this compiler emits
 * the 3 step boxes for a ramp tile unconditionally and does not verify that
 * adjacency.
 *
 * Coordinate convention: row `i` is a `TILE`-deep strip z ∈ [i·TILE, (i+1)·TILE);
 * column `j` is a `TILE`-wide strip x ∈ [j·TILE, (j+1)·TILE) — reading the ASCII
 * grid top-to-bottom, left-to-right maps onto +z, +x, exactly like reading the
 * arena from above. Every marker's extracted point sits at its tile's center,
 * y = 0.
 */

export const TILE = 2;

type HeightClass = "#" | "x" | "X" | "=";

const HEIGHTS: Record<HeightClass, number> = {
  "#": 2.5,
  x: 1.1,
  X: 2.2,
  "=": 1.2,
};

const HEIGHT_CLASSES: readonly HeightClass[] = ["#", "x", "X", "="];

type RampChar = "<" | ">" | "^" | "v";

const STEP_HEIGHTS = [0.4, 0.8, 1.2] as const;

export interface CompileOptions {
  /** Overrides `ARENA.ceiling` for the compiled map's `bounds.ceiling`. */
  readonly ceiling?: number;
  /** Passed through unchanged onto the compiled {@link MapDef}. */
  readonly capWaypoints?: MapDef["capWaypoints"];
}

/** Compiles a rectangular ASCII grid (see this file's header for the legend and
 *  coordinate convention) into a {@link MapDef}. `rows` must be non-empty and
 *  every row the same length; the compiled bounds (`cols·TILE` × `rows.length·TILE`)
 *  must exactly equal `ARENA.width`/`ARENA.depth` — every map shares one wire-fixed
 *  extent (see `map-invariants.test.ts`'s `mapForMode` check) — or this throws. */
export function compileTileMap(rows: readonly string[], opts: CompileOptions = {}): MapDef {
  if (rows.length === 0) throw new Error("compileTileMap: rows must be non-empty");
  const cols = rows[0]!.length;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i]!.length !== cols) {
      throw new Error(`compileTileMap: row ${i} has length ${rows[i]!.length}, expected ${cols} (row 0's length)`);
    }
  }

  const width = cols * TILE;
  const depth = rows.length * TILE;
  if (width !== ARENA.width || depth !== ARENA.depth) {
    throw new Error(
      `compileTileMap: ${cols}x${rows.length} tiles compiles to ${width}x${depth}m, ` +
        `but ARENA bounds are ${ARENA.width}x${ARENA.depth}m`,
    );
  }

  // Height-class grid for the rectangle merge below; ramps are handled
  // separately (never merged — each ramp tile always emits exactly 3 boxes).
  const grid: (HeightClass | null)[][] = rows.map(() => new Array<HeightClass | null>(cols).fill(null));
  const rampBoxes: Box[] = [];
  const spawnsRed: Vec3[] = [];
  const spawnsBlue: Vec3[] = [];
  let capA: Vec3 | undefined;
  let capB: Vec3 | undefined;
  let capC: Vec3 | undefined;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    for (let j = 0; j < cols; j++) {
      const ch = row[j]!;
      const cx = j * TILE + TILE / 2;
      const cz = i * TILE + TILE / 2;

      switch (ch) {
        case ".":
          break;
        case "#":
        case "x":
        case "X":
        case "=":
          grid[i]![j] = ch;
          break;
        case "<":
        case ">":
        case "^":
        case "v":
          rampBoxes.push(...rampSteps(ch, j, i));
          break;
        case "r":
          spawnsRed.push({ x: cx, y: 0, z: cz });
          break;
        case "b":
          spawnsBlue.push({ x: cx, y: 0, z: cz });
          break;
        case "1":
          if (capA) throw new Error(`compileTileMap: duplicate cap 'a' (1) at row ${i}, col ${j}`);
          capA = { x: cx, y: 0, z: cz };
          break;
        case "2":
          if (capB) throw new Error(`compileTileMap: duplicate cap 'b' (2) at row ${i}, col ${j}`);
          capB = { x: cx, y: 0, z: cz };
          break;
        case "3":
          if (capC) throw new Error(`compileTileMap: duplicate cap 'c' (3) at row ${i}, col ${j}`);
          capC = { x: cx, y: 0, z: cz };
          break;
        default:
          throw new Error(`compileTileMap: unrecognized character '${ch}' at row ${i}, col ${j}`);
      }
    }
  }

  if (spawnsRed.length === 0) throw new Error("compileTileMap: team red has zero spawns ('r')");
  if (spawnsBlue.length === 0) throw new Error("compileTileMap: team blue has zero spawns ('b')");
  if (!capA) throw new Error("compileTileMap: missing cap 'a' (1)");
  if (!capB) throw new Error("compileTileMap: missing cap 'b' (2)");
  if (!capC) throw new Error("compileTileMap: missing cap 'c' (3)");

  const mergedBoxes: Box[] = [];
  for (const cls of HEIGHT_CLASSES) {
    mergedBoxes.push(...mergeClass(grid, cls, cols, rows.length));
  }

  return {
    bounds: { width, depth, ceiling: opts.ceiling ?? ARENA.ceiling },
    boxes: [...mergedBoxes, ...rampBoxes],
    spawns: { red: spawnsRed, blue: spawnsBlue },
    caps: { a: capA, b: capB, c: capC },
    capWaypoints: opts.capWaypoints,
  };
}

/** The 3 step boxes for one ramp tile at grid column `j`, row `i` — see this
 *  file's header for the step depth/height/direction convention. Boundaries are
 *  computed as `(k·TILE)/3` (k = 0..3) rather than accumulating a rounded 2/3 m
 *  constant, so the first and last boundary land exactly on the tile's edges. */
function rampSteps(ch: RampChar, j: number, i: number): Box[] {
  const x0 = j * TILE;
  const z0 = i * TILE;
  const along = (base: number, k: number) => base + (k * TILE) / 3;

  const boxes: Box[] = [];
  for (let s = 0; s < 3; s++) {
    const h = STEP_HEIGHTS[s]!;
    let minX: number, maxX: number, minZ: number, maxZ: number;
    if (ch === ">") {
      // Climbs going +x: low step at the −x (entry) end, high step flush with +x neighbor.
      minX = along(x0, s);
      maxX = along(x0, s + 1);
      minZ = z0;
      maxZ = z0 + TILE;
    } else if (ch === "<") {
      // Climbs going −x: low step at the +x end, high step flush with −x neighbor.
      minX = along(x0, 2 - s);
      maxX = along(x0, 3 - s);
      minZ = z0;
      maxZ = z0 + TILE;
    } else if (ch === "v") {
      // Climbs going +z: low step at the −z (entry) end, high step flush with +z neighbor.
      minX = x0;
      maxX = x0 + TILE;
      minZ = along(z0, s);
      maxZ = along(z0, s + 1);
    } else {
      // "^" — climbs going −z: low step at the +z end, high step flush with −z neighbor.
      minX = x0;
      maxX = x0 + TILE;
      minZ = along(z0, 2 - s);
      maxZ = along(z0, 3 - s);
    }
    boxes.push({ min: { x: minX, y: 0, z: minZ }, max: { x: maxX, y: h, z: maxZ } });
  }
  return boxes;
}

/** Greedy rectangle merge for one height class: merge horizontal runs of `cls`
 *  within each row, then merge those runs vertically across rows whose
 *  horizontal span (`[x0, x1)`) matches exactly and whose rows are contiguous.
 *  Not a globally-minimal rectangle cover (an L-shape stays 2 boxes rather than
 *  hunting for a cheaper split) — deterministic and cheap, which is the point. */
function mergeClass(
  grid: readonly (HeightClass | null)[][],
  cls: HeightClass,
  cols: number,
  rowCount: number,
): Box[] {
  // Pass 1: horizontal runs per row.
  const runsBySpan = new Map<string, number[]>(); // "x0,x1" -> rows (ascending)
  for (let i = 0; i < rowCount; i++) {
    let j = 0;
    while (j < cols) {
      if (grid[i]![j] !== cls) {
        j++;
        continue;
      }
      const x0 = j;
      while (j < cols && grid[i]![j] === cls) j++;
      const key = `${x0},${j}`;
      const rows = runsBySpan.get(key);
      if (rows) rows.push(i);
      else runsBySpan.set(key, [i]);
    }
  }

  // Pass 2: merge contiguous rows within each identical span into one box.
  const height = HEIGHTS[cls];
  const boxes: Box[] = [];
  for (const [key, rowsForSpan] of runsBySpan) {
    const [x0Str, x1Str] = key.split(",");
    const x0 = Number(x0Str);
    const x1 = Number(x1Str);
    let start = 0;
    for (let k = 1; k <= rowsForSpan.length; k++) {
      if (k === rowsForSpan.length || rowsForSpan[k] !== rowsForSpan[k - 1]! + 1) {
        const z0 = rowsForSpan[start]!;
        const z1 = rowsForSpan[k - 1]! + 1;
        boxes.push({
          min: { x: x0 * TILE, y: 0, z: z0 * TILE },
          max: { x: x1 * TILE, y: height, z: z1 * TILE },
        });
        start = k;
      }
    }
  }
  return boxes;
}
