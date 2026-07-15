// generate-manifests.mjs — regenerates arena1.manifest.json/arena2.manifest.json
// in this same directory (run: `node client/dressing/generate-manifests.mjs`
// from the app root). These manifests are the input is-armfix's manifest→bundle
// CLI bakes into public/assets/maps/arena{1,2}-dressing.glb; src/map/arena1.ts
// and arena2.ts (the collision data) are NEVER read or written here.
//
// Placement principle: scale each asset so NEITHER horizontal (x/z) extent
// exceeds its target box's footprint (using the MORE constraining of the two
// ratios) — visual must never stick out past invisible collision (the
// "looks solid, bullets pass through" bug). Height is allowed to come in
// under the box's own height (the safe direction — extra invisible collision
// above a slightly-short model is far less noticeable than a visual
// overhang with no collision behind it); platforms/crates meant to be stood
// on are top-anchored to the box's own top so the player's feet line up
// with the mesh; ground-sitting objects (dividers, cover) are floor-anchored.
//
// DIMS below are each asset's native [W(x), H(y), D(z)] bounding box in
// metres, measured with gltf-transform's getBounds() (handles quantized
// meshes correctly, unlike reading the raw accessor min/max) — re-measure a
// swapped-in asset with:
//   node -e "import('@gltf-transform/core').then(async({NodeIO})=>{const io=new NodeIO();const{ALL_EXTENSIONS}=await import('@gltf-transform/extensions');io.registerExtensions(ALL_EXTENSIONS);const{getBounds}=await import('@gltf-transform/functions');const doc=await io.read('<path.glb>');const b=getBounds(doc.getRoot().listScenes()[0]);console.log(b)})"
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT_DIR = dirname(fileURLToPath(import.meta.url)); // always this file's own directory

const ASSET_BASE = "buildings/"; // relative folder inside the bundle source, for is-armfix's CLI to resolve against GLB/
const PROP_BASE = "props/";
const MISC_BASE = "misc/";

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

let placements = [];
let skyline = [];
let capProps = [];

function place(asset, dims, scale, cx, topY, cz, rotY = 0, note = "") {
  const [, h] = dims;
  placements.push({
    asset,
    position: { x: cx, y: topY - h * scale, z: cz }, // topY is where the mesh's OWN top should land
    rotationY: rotY,
    scale: { x: scale, y: scale, z: scale },
    note,
  });
}

// ---------------------------------------------------------------------------
// arena1 — box indices match ARENA1_BOXES order in src/map/arena1.ts exactly.
// ---------------------------------------------------------------------------
placements = [];
const hiddenArena1 = [];

// Box 0/1: lane dividers, x[14,46] (32m) z[13,14]/[26,27], height 2.5,
// ground-anchored. Segment width is chosen to tile the FULL 32m span with NO
// gap (round 2 rejection #3) — 8 segments × exactly 4.0m — then the per-segment
// scale is derived from THAT width (not a free height-match), so it comes in
// at height 2.4m (96% of the 2.5m box — comfortably over the ≥85% bar from
// round 2 rejection #1) while still never exceeding the 4.0m width slot.
for (const [bi, z0, z1] of [
  [0, 13, 14],
  [1, 26, 27],
]) {
  const x0 = 14,
    x1 = 46;
  const n = 8;
  const segW = (x1 - x0) / n; // 4.0m exactly — zero gap across the 32m span
  const scale = segW / DIMS.wallGeneric[0];
  const cz = (z0 + z1) / 2;
  for (let i = 0; i < n; i++) {
    const cx = x0 + segW / 2 + i * segW;
    place(ASSET_BASE + "SM_Bld_Advanced_01.glb", DIMS.wallGeneric, scale, cx, 2.5, cz, 0, `divider ${bi} segment ${i + 1}/${n}`);
  }
  hiddenArena1.push(bi);
}

// Box 2: central cover stack, x[28.5,31.5] z[18.5,21.5], height 2.2,
// ground-anchored. Round 2 rejection #2: a single crate only reached ~1.0m of
// the 2.2m box. Stack two width-matched copies (each's own footprint already
// safely under the 3m×3m box, so stacking doesn't touch the "never exceed
// horizontal footprint" rule) directly on top of each other — combined height
// 2.08m (94% of 2.2m), still under so it can't create a shoot-through overhang.
{
  const target = [3, 3];
  const scale = Math.min(target[0] / DIMS.crateLarge[0], target[1] / DIMS.crateLarge[2]);
  const h = DIMS.crateLarge[1] * scale;
  place(PROP_BASE + "SM_Prop_Crate_Large_01.glb", DIMS.crateLarge, scale, 30, h, 20, 0, "central cover — bottom layer");
  place(PROP_BASE + "SM_Prop_Crate_Large_01.glb", DIMS.crateLarge, scale, 30, 2 * h, 20, 0, "central cover — top layer (stacked to reach ~2.08m of the 2.2m box)");
  hiddenArena1.push(2);
}

// Box 3/4: flanking crates, 2x1.2x2 each, ground-anchored — 2 cages side by side.
for (const [bi, cx0] of [
  [3, 24],
  [4, 36],
]) {
  const scale = 1.2 / DIMS.cage02[1]; // height-match (low cover you can see over — height matters for LOS)
  const w = DIMS.cage02[0] * scale;
  place(PROP_BASE + "SM_Prop_Cage_02.glb", DIMS.cage02, scale, cx0 - w * 0.55, DIMS.cage02[1] * scale, 20, 0, `flanking crate ${bi} — left`);
  place(PROP_BASE + "SM_Prop_Cage_02.glb", DIMS.cage02, scale, cx0 + w * 0.55, DIMS.cage02[1] * scale, 20, 0, `flanking crate ${bi} — right`);
  hiddenArena1.push(bi);
}

// Box 5/6: raised platforms, 6x1.2x5, TOP-anchored (walkable surface at y=1.2).
for (const [bi, cz] of [
  [5, 6.5],
  [6, 33.5],
]) {
  const target = [6, 5];
  const scale = Math.min(target[0] / DIMS.landingPad[0], target[1] / DIMS.landingPad[2]);
  place(ASSET_BASE + "SM_Bld_LandingPad_01.glb", DIMS.landingPad, scale, 30, 1.2, cz, 0, `raised platform ${bi} — landing pad reads as intentionally hovering above ground (scifi), top-anchored to y=1.2`);
  hiddenArena1.push(bi);
}

// Skyline: background buildings ringing the map outside its bounds (0..60 x,
// 0..40 z). Round 2 recommendation: the grid read as too mechanical — jitter
// position (±3m), rotation (fully random, not a fixed increment), and scale
// (±15%, reads as a height variation across the skyline) via the seeded PRNG
// above so re-running this generator still reproduces the same skyline.
skyline = [];
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
let si = pushSkylineRing(skyline, [-15, -5, 65, 75], [5, 20, 35], 0);
pushSkylineRing(skyline, [10, 30, 50], [-15, -5, 45, 55], si);

// Wall decor: AC units + pipes + neon signs on the perimeter walls (client renders
// these regardless of dressing — walls stay procedural; decor just attaches visually).
const wallDecor = [
  { asset: PROP_BASE + "SM_Prop_AirConditioningUnit_01.glb", position: { x: 10, y: 1.5, z: 0.25 }, rotationY: 0, scale: { x: 1, y: 1, z: 1 } },
  { asset: PROP_BASE + "SM_Prop_AirConditioningUnit_01.glb", position: { x: 50, y: 1.5, z: 39.75 }, rotationY: Math.PI, scale: { x: 1, y: 1, z: 1 } },
  { asset: PROP_BASE + "SM_Prop_Pipes_01.glb", position: { x: 0.25, y: 1.8, z: 15 }, rotationY: Math.PI / 2, scale: { x: 1, y: 1, z: 1 } },
  { asset: MISC_BASE + "SM_Sign_Neon_01.glb", position: { x: 59.75, y: 2.2, z: 25 }, rotationY: -Math.PI / 2, scale: { x: 1, y: 1, z: 1 } },
];


writeFileSync(
  join(OUT_DIR, "arena1.manifest.json"),
  JSON.stringify(
    { map: "arena1", hiddenBoxIndices: hiddenArena1.sort((a, b) => a - b), placements, skyline, wallDecor, capProps: [] },
    null,
    2,
  ),
);

// ---------------------------------------------------------------------------
// arena2 — box indices match ARENA2_BOXES order exactly.
// ---------------------------------------------------------------------------
placements = [];
const hiddenArena2 = [];

// Box 0: central platform (cap B), 6x1.2x4, TOP-anchored to y=1.2.
{
  const target = [6, 4];
  const scale = Math.min(target[0] / DIMS.landingPad[0], target[1] / DIMS.landingPad[2]);
  place(ASSET_BASE + "SM_Bld_LandingPad_01.glb", DIMS.landingPad, scale, 30, 1.2, 20, 0, "cap B platform — top-anchored to y=1.2");
  hiddenArena2.push(0);
}

// Box 1-4: cap A/C cover crates, 4x1.2x3 each, ground-anchored — 2 crates side by side.
const coverBoxes = [
  [1, 15, 11.5],
  [2, 15, 28.5],
  [3, 45, 11.5],
  [4, 45, 28.5],
];
for (const [bi, cx0, cz] of coverBoxes) {
  const target = [2, 3]; // half-width per crate (2 crates fill the 4m box width), full depth 3
  const scale = Math.min(target[0] / DIMS.crateLarge[0], target[1] / DIMS.crateLarge[2]);
  const w = DIMS.crateLarge[0] * scale;
  place(PROP_BASE + "SM_Prop_Crate_Large_01.glb", DIMS.crateLarge, scale, cx0 - w * 0.55, DIMS.crateLarge[1] * scale, cz, 0, `cap cover ${bi} — left`);
  place(PROP_BASE + "SM_Prop_Crate_Large_01.glb", DIMS.crateLarge, scale, cx0 + w * 0.55, DIMS.crateLarge[1] * scale, cz, 0, `cap cover ${bi} — right`);
  hiddenArena2.push(bi);
}

// Skyline (same ring pattern + jitter as arena1 — continues the SAME seeded
// PRNG stream rather than resetting it, so the two maps' skylines don't end
// up mirror-identical).
skyline = [];
si = pushSkylineRing(skyline, [-15, -5, 65, 75], [5, 20, 35], si);
pushSkylineRing(skyline, [10, 30, 50], [-15, -5, 45, 55], si);

// DOM cap markers: control-panel "terminal" prop at each cap point's edge,
// clear of the captureRadius' walkway (offset toward the map's own north/south
// edge, away from the natural approach lanes).
capProps = [
  { asset: PROP_BASE + "SM_Prop_ControlPanel_01.glb", position: { x: 15, y: 0, z: 22.8 }, rotationY: 0, scale: { x: 1.3, y: 1.3, z: 1.3 }, note: "cap A marker" },
  { asset: PROP_BASE + "SM_Prop_ControlPanel_01.glb", position: { x: 32.8, y: 1.2, z: 20 }, rotationY: -Math.PI / 2, scale: { x: 1.3, y: 1.3, z: 1.3 }, note: "cap B marker (on the platform itself)" },
  { asset: PROP_BASE + "SM_Prop_ControlPanel_01.glb", position: { x: 45, y: 0, z: 22.8 }, rotationY: 0, scale: { x: 1.3, y: 1.3, z: 1.3 }, note: "cap C marker" },
];

writeFileSync(
  join(OUT_DIR, "arena2.manifest.json"),
  JSON.stringify(
    { map: "arena2", hiddenBoxIndices: hiddenArena2.sort((a, b) => a - b), placements, skyline, wallDecor: [], capProps },
    null,
    2,
  ),
);

console.log(`wrote ${join(OUT_DIR, "arena1.manifest.json")} and arena2.manifest.json`);
console.log("arena1 hiddenBoxIndices:", hiddenArena1);
console.log("arena2 hiddenBoxIndices:", hiddenArena2);
