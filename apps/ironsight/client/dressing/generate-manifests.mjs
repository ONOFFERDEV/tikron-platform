// generate-manifests.mjs — regenerates arena1.manifest.json/arena2.manifest.json
// in this same directory (run: `node client/dressing/generate-manifests.mjs`
// from the app root). These manifests are the input is-armfix's manifest→bundle
// CLI bakes into public/assets/maps/arena{1,2}-dressing.glb.
//
// W2b rewrite: placements are now DERIVED from the live compiled tile-map boxes
// (src/map/arena{1,2}.ts's ARENA{1,2}_BOXES, via compileTileMap) instead of a
// hand-maintained per-box-index geometry list — so re-authoring the ASCII tile
// grid and re-running this generator always produces matching dressing, with no
// stale hardcoded box coordinates to drift out of sync.
//
// Classification: each compiled box is either a genuine tile-class box (wall/
// stack/platform/crate) or one of a ramp's 3 step-boxes. A ramp's TOP step is
// 1.2m tall — numerically identical to the platform height — so height alone
// can't disambiguate. The tiebreaker is footprint grid-alignment: every real
// tile-class box's x/z footprint is an exact multiple of the TILE=2m grid
// (tiles merge along grid lines), while ramp steps are always 2m × 0.6667m
// (verified against the live compiled data for both arenas). A box only gets a
// height-class recipe if BOTH its x-span and z-span are grid-aligned; anything
// else is a ramp step and is left procedural (never dressed, no transparent-
// wall risk on the diagonal ramp faces).
//
// Placement principle (unchanged from round 2): scale each asset so NEITHER
// horizontal (x/z) extent exceeds its target box's footprint (the "looks
// solid, bullets pass through" bug) — height is allowed to land short of the
// box's own height, never over. Platforms/stacks meant to be stood on are
// top-anchored to the box's own top; ground-sitting objects (dividers, cover)
// are floor-anchored.
//
// DIMS below are each asset's native [W(x), H(y), D(z)] bounding box in
// metres, measured with gltf-transform's getBounds() (handles quantized
// meshes correctly, unlike reading the raw accessor min/max) — re-measure a
// swapped-in asset with:
//   node -e "import('@gltf-transform/core').then(async({NodeIO})=>{const io=new NodeIO();const{ALL_EXTENSIONS}=await import('@gltf-transform/extensions');io.registerExtensions(ALL_EXTENSIONS);const{getBounds}=await import('@gltf-transform/functions');const doc=await io.read('<path.glb>');const b=getBounds(doc.getRoot().listScenes()[0]);console.log(b)})"
import * as esbuild from "esbuild";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const OUT_DIR = dirname(fileURLToPath(import.meta.url)); // always this file's own directory
const APP_ROOT = join(OUT_DIR, "..", ".."); // apps/ironsight

const ASSET_BASE = "buildings/"; // relative folder inside the bundle source, for is-armfix's CLI to resolve against GLB/
const PROP_BASE = "props/";
const MISC_BASE = "misc/";

// --- live map import --------------------------------------------------------
// arena1.ts/arena2.ts (and their tilemap.ts/config.ts/physics.ts dependencies)
// use NodeNext-style ".js" import specifiers pointing at sibling ".ts" sources
// (no compiled output is checked in), so a plain `import()` can't resolve them.
// Bundle them with esbuild (redirecting ".js" specifiers to the ".ts" sibling
// when the literal ".js" file doesn't exist) into a throwaway temp file, import
// THAT, then delete it — this generator always reflects whatever the tile maps
// currently compile to, with no separate build step to keep in sync.
const rewriteJsToTs = {
  name: "rewrite-js-to-ts",
  setup(build) {
    build.onResolve({ filter: /\.js$/ }, (args) => {
      if (args.path.startsWith(".")) {
        const resolvedDir = dirname(args.importer);
        const tsPath = join(resolvedDir, args.path.slice(0, -3) + ".ts");
        if (existsSync(tsPath)) return { path: tsPath };
      }
      return null;
    });
  },
};

async function loadLiveMaps() {
  const result = await esbuild.build({
    entryPoints: [join(APP_ROOT, "src/map/arena1.ts"), join(APP_ROOT, "src/map/arena2.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
    outdir: "virtual", // required by esbuild for multi-entry-point builds even with write:false — nothing is ever written to this path
    plugins: [rewriteJsToTs],
  });
  const tmpDir = mkdtempSync(join(tmpdir(), "ironsight-dressing-"));
  try {
    const modules = {};
    for (const file of result.outputFiles) {
      const outPath = join(tmpDir, basename(file.path));
      writeFileSync(outPath, file.contents);
      modules[basename(file.path, ".js")] = await import(pathToFileURL(outPath).href);
    }
    return modules;
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

const { arena1: arena1Mod, arena2: arena2Mod } = await loadLiveMaps();

// Tiny deterministic PRNG (mulberry32) so re-running this generator reproduces
// the same skyline jitter every time (round 2: gate flagged the grid as
// mechanical-looking — see the skyline section below).
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const jitterRng = mulberry32(20260715);
const jitter = (range) => (jitterRng() * 2 - 1) * range;

// Measured via bbox.mjs (gltf-transform getBounds) — [W(x), H(y), D(z)] at native scale 1.
const DIMS = {
  // round 2: SM_Env_Wall_Generic_01 turned out to be a low-wall-plus-thin-railing
  // shape (single mesh, no sub-hierarchy — checked directly) whose railing top
  // reads as see-through, not a full 2.5m opaque barrier (gate rejection #1).
  // SM_Bld_Advanced_01 is a flat BUILDING FACADE — reliably opaque through its
  // whole height, unlike a decorative railing — used for the dividers instead.
  wallGeneric: [5.0, 3.0, 0.709], // SM_Bld_Advanced_01 (renamed key kept for diff minimality)
  crateLarge: [1.585, 0.55, 0.637],
  cage02: [0.689, 0.876, 0.671],
  landingPad: [7.501, 1.187, 7.885],
  controlPanel: [0.376, 1.095, 0.689],
  bgLrg1: [8.183, 25.475, 11.865],
  bgMed1: [4.423, 23.107, 4.375],
  acUnit1: [0.939, 0.697, 0.642],
  pipes1: [2.5, 0.239, 0.497],
  neon1: [0.843, 0.434, 0.03],
};

const TILE = 2;

function place(out, asset, dims, scale, cx, topY, cz, rotY = 0, note = "") {
  const [, h] = dims;
  out.push({
    asset,
    position: { x: cx, y: topY - h * scale, z: cz }, // topY is where the mesh's OWN top should land
    rotationY: rotY,
    scale: { x: scale, y: scale, z: scale },
    note,
  });
}

// --- box classification ------------------------------------------------------
// A ramp's top step is 1.2m tall, colliding with the platform height — the
// grid-alignment check (both spans exact multiples of TILE) disambiguates:
// every real tile-class box merges along tile lines, every ramp step doesn't
// (verified against live data — see the file header).
function isGridAligned(span) {
  return Math.abs(span % TILE) < 1e-6;
}

function classifyBox(box) {
  const xspan = box.max.x - box.min.x;
  const zspan = box.max.z - box.min.z;
  if (!isGridAligned(xspan) || !isGridAligned(zspan)) return null; // ramp step
  const h = box.max.y;
  if (Math.abs(h - 2.5) < 1e-6) return "wall";
  if (Math.abs(h - 2.2) < 1e-6) return "stack";
  if (Math.abs(h - 1.2) < 1e-6) return "platform";
  if (Math.abs(h - 1.1) < 1e-6) return "crate";
  return null; // unrecognized height — left procedural rather than guessed at
}

// Box 2.5 — lane divider / perimeter wall. Tiles SM_Bld_Advanced_01 along the
// box's long horizontal axis with NO gap: 4.0m segments when the span divides
// evenly (matches the original bake's visual density), else falling back to
// the 2.0m tile grid (always divides, since every box span is a TILE multiple).
function placeWall(out, box, index) {
  const xspan = box.max.x - box.min.x;
  const zspan = box.max.z - box.min.z;
  const horizontal = xspan >= zspan;
  const length = horizontal ? xspan : zspan;
  const segLen = length % 4 === 0 ? 4 : TILE;
  const n = Math.round(length / segLen);
  const scale = segLen / DIMS.wallGeneric[0];
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  for (let i = 0; i < n; i++) {
    const along = horizontal ? box.min.x + segLen / 2 + i * segLen : box.min.z + segLen / 2 + i * segLen;
    const px = horizontal ? along : cx;
    const pz = horizontal ? cz : along;
    const rotY = horizontal ? 0 : Math.PI / 2;
    // Floor-anchored, not box.max.y-topped: this recipe's scale is length-matched
    // (segLen/DIMS.wallGeneric[0]), not height-matched, so top-anchoring at the
    // box's real height would leave a floor gap (mesh floats above y=0 while the
    // invisible collision box still extends to it) — any height shortfall from a
    // non-1:1 aspect ratio lands safely at the wall's top edge instead.
    place(out, ASSET_BASE + "SM_Bld_Advanced_01.glb", DIMS.wallGeneric, scale, px, DIMS.wallGeneric[1] * scale, pz, rotY, `divider box#${index} segment ${i + 1}/${n}`);
  }
}

// Box 2.2 — central cover stack. Stacks the smallest number of SM_Prop_Crate_Large_01
// copies whose combined height, at the horizontal-footprint-bound scale, reaches
// the box's real height exactly (never over — n is the smallest layer count for
// which that scale doesn't exceed the footprint either).
function placeStack(out, box, index) {
  const xspan = box.max.x - box.min.x;
  const zspan = box.max.z - box.min.z;
  const height = box.max.y;
  const horizBound = Math.min(xspan / DIMS.crateLarge[0], zspan / DIMS.crateLarge[2]);
  const n = Math.max(1, Math.ceil(height / (DIMS.crateLarge[1] * horizBound)));
  const scale = height / (n * DIMS.crateLarge[1]); // exact height match; <= horizBound by construction of n
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  for (let layer = 1; layer <= n; layer++) {
    place(out, PROP_BASE + "SM_Prop_Crate_Large_01.glb", DIMS.crateLarge, scale, cx, layer * DIMS.crateLarge[1] * scale, cz, 0, `stack box#${index} layer ${layer}/${n}`);
  }
}

// Box 1.2 — raised platform. Single SM_Bld_LandingPad_01, scaled to the box's
// real footprint, top-anchored to its real height (the walkable surface).
function placePlatform(out, box, index) {
  const xspan = box.max.x - box.min.x;
  const zspan = box.max.z - box.min.z;
  const scale = Math.min(xspan / DIMS.landingPad[0], zspan / DIMS.landingPad[2]);
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  place(out, ASSET_BASE + "SM_Bld_LandingPad_01.glb", DIMS.landingPad, scale, cx, box.max.y, cz, 0, `platform box#${index} — top-anchored to y=${box.max.y}`);
}

// Box 1.1 — low crate cover. Height-matched (not footprint-matched — this is
// jumpable cover you see over, so its height matters more than filling the
// footprint) SM_Prop_Cage_02, two side by side when the box is wide enough for
// the pair, else a single centered cage re-scaled to respect the footprint.
function placeCrate(out, box, index) {
  const xspan = box.max.x - box.min.x;
  const zspan = box.max.z - box.min.z;
  const height = box.max.y;
  const scale = height / DIMS.cage02[1];
  const w = DIMS.cage02[0] * scale;
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  const pairSpan = w * 0.55 * 2 + w; // outer-edge-to-outer-edge span of the 2-cage layout
  if (pairSpan <= xspan + 1e-6) {
    place(out, PROP_BASE + "SM_Prop_Cage_02.glb", DIMS.cage02, scale, cx - w * 0.55, height, cz, 0, `crate box#${index} — left`);
    place(out, PROP_BASE + "SM_Prop_Cage_02.glb", DIMS.cage02, scale, cx + w * 0.55, height, cz, 0, `crate box#${index} — right`);
  } else {
    // Never hit by either current map's crate boxes (both 2x2) — kept as a safe
    // fallback for any future crate box too narrow for the 2-cage layout.
    const safeScale = Math.min(scale, xspan / DIMS.cage02[0], zspan / DIMS.cage02[2]);
    place(out, PROP_BASE + "SM_Prop_Cage_02.glb", DIMS.cage02, safeScale, cx, height, cz, 0, `crate box#${index} — single (footprint too tight for the 2-cage layout)`);
  }
}

const RECIPES = { wall: placeWall, stack: placeStack, platform: placePlatform, crate: placeCrate };

function dressBoxes(boxes) {
  const placements = [];
  const hidden = [];
  boxes.forEach((box, index) => {
    const cls = classifyBox(box);
    if (!cls) return; // ramp step or unrecognized — stays procedural
    RECIPES[cls](placements, box, index);
    hidden.push(index);
  });
  return { placements, hidden };
}

// Skyline: background buildings ringing the map outside its bounds (0..60 x,
// 0..40 z). Round 2 recommendation: the grid read as too mechanical — jitter
// position (±3m), rotation (fully random, not a fixed increment), and scale
// (±15%, reads as a height variation across the skyline) via the seeded PRNG
// above so re-running this generator still reproduces the same skyline.
const skylineAssets = [
  ["SM_Bld_Background_Lrg_01.glb", DIMS.bgLrg1],
  ["SM_Bld_Background_Med_01.glb", DIMS.bgMed1],
];
function pushSkylineRing(out, gridX, gridZ, startIdx) {
  let si = startIdx;
  for (const x of gridX) {
    for (const z of gridZ) {
      const [name] = skylineAssets[si % skylineAssets.length];
      const s = 1 + jitter(0.15);
      out.push({
        asset: ASSET_BASE + name,
        position: { x: x + jitter(3), y: 0, z: z + jitter(3) },
        rotationY: jitterRng() * Math.PI * 2,
        scale: { x: s, y: s, z: s },
      });
      si++;
    }
  }
  return si;
}

// ---------------------------------------------------------------------------
// arena1
// ---------------------------------------------------------------------------
const { placements: placementsArena1, hidden: hiddenArena1 } = dressBoxes(arena1Mod.ARENA1_BOXES);

const skylineArena1 = [];
let si = pushSkylineRing(skylineArena1, [-15, -5, 65, 75], [5, 20, 35], 0);
pushSkylineRing(skylineArena1, [10, 30, 50], [-15, -5, 45, 55], si);

// Wall decor: AC units + pipes + neon signs on the perimeter walls (client renders
// these regardless of dressing — walls stay procedural; decor just attaches visually).
// Tied to the map's own bounds (0..60 x, 0..40 z), unchanged by the box rewrite.
const wallDecorArena1 = [
  { asset: PROP_BASE + "SM_Prop_AirConditioningUnit_01.glb", position: { x: 10, y: 1.5, z: 0.25 }, rotationY: 0, scale: { x: 1, y: 1, z: 1 } },
  { asset: PROP_BASE + "SM_Prop_AirConditioningUnit_01.glb", position: { x: 50, y: 1.5, z: 39.75 }, rotationY: Math.PI, scale: { x: 1, y: 1, z: 1 } },
  { asset: PROP_BASE + "SM_Prop_Pipes_01.glb", position: { x: 0.25, y: 1.8, z: 15 }, rotationY: Math.PI / 2, scale: { x: 1, y: 1, z: 1 } },
  { asset: MISC_BASE + "SM_Sign_Neon_01.glb", position: { x: 59.75, y: 2.2, z: 25 }, rotationY: -Math.PI / 2, scale: { x: 1, y: 1, z: 1 } },
];

writeFileSync(
  join(OUT_DIR, "arena1.manifest.json"),
  JSON.stringify(
    { map: "arena1", hiddenBoxIndices: hiddenArena1.sort((a, b) => a - b), placements: placementsArena1, skyline: skylineArena1, wallDecor: wallDecorArena1, capProps: [] },
    null,
    2,
  ),
);

// ---------------------------------------------------------------------------
// arena2
// ---------------------------------------------------------------------------
const { placements: placementsArena2, hidden: hiddenArena2 } = dressBoxes(arena2Mod.ARENA2_BOXES);

// Skyline continues the SAME seeded PRNG stream from arena1 (not reset), so the
// two maps' skylines don't end up mirror-identical.
const skylineArena2 = [];
si = pushSkylineRing(skylineArena2, [-15, -5, 65, 75], [5, 20, 35], si);
pushSkylineRing(skylineArena2, [10, 30, 50], [-15, -5, 45, 55], si);

// DOM cap markers: control-panel "terminal" prop at each cap point's edge, offset
// clear of the captureRadius' walkway. Offsets are the original hand-tuned deltas
// (cap A/C: +3.8 north/south of the raw cap point; cap B: +1.8/-3, on the platform
// itself at y=1.2), now applied to the LIVE ARENA2_CAPS coordinates rather than a
// hardcoded literal — numerically unchanged since arena2.ts's caps didn't move,
// but no longer able to silently drift out of sync if they ever do.
const capOffsets = {
  a: { dx: 0, dz: 3.8, y: 0, rotY: 0, note: "cap A marker" },
  b: { dx: 1.8, dz: -3, y: 1.2, rotY: -Math.PI / 2, note: "cap B marker (on the platform itself)" },
  c: { dx: 0, dz: 3.8, y: 0, rotY: 0, note: "cap C marker" },
};
const capPropsArena2 = ["a", "b", "c"].map((key) => {
  const cap = arena2Mod.ARENA2_CAPS[key];
  const off = capOffsets[key];
  return {
    asset: PROP_BASE + "SM_Prop_ControlPanel_01.glb",
    position: { x: cap.x + off.dx, y: off.y, z: cap.z + off.dz },
    rotationY: off.rotY,
    scale: { x: 1.3, y: 1.3, z: 1.3 },
    note: off.note,
  };
});

writeFileSync(
  join(OUT_DIR, "arena2.manifest.json"),
  JSON.stringify(
    { map: "arena2", hiddenBoxIndices: hiddenArena2.sort((a, b) => a - b), placements: placementsArena2, skyline: skylineArena2, wallDecor: [], capProps: capPropsArena2 },
    null,
    2,
  ),
);

console.log(`wrote ${join(OUT_DIR, "arena1.manifest.json")} and arena2.manifest.json`);
console.log("arena1 hiddenBoxIndices:", hiddenArena1);
console.log("arena2 hiddenBoxIndices:", hiddenArena2);
