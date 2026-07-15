// to-bundler-manifest.mjs <arena1|arena2> <catalog.json>
//   node client/dressing/to-bundler-manifest.mjs arena1 path/to/asset_catalog.json
//
// Flattens this directory's <map>.manifest.json (placements+skyline+wallDecor+
// capProps; position:{x,y,z}, rotationY in radians, scale:{x,y,z} uniform-only)
// into is-armfix's build_map_dressing.py input format (flat array of
// {glb, pos:[x,y,z], rotY-in-degrees, scale-scalar}), and validates every
// asset path against the real asset_catalog.json (~/synty-work/ on the
// bake host) before ever invoking that CLI — catches a renamed/miscategorized
// asset (e.g. a file actually under misc/ that this manifest lists under
// buildings/) as a loud failure here instead of a silent skip during the bake.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const map = process.argv[2];
const catalogPath = process.argv[3];
if (!map || !catalogPath) {
  console.error("usage: node to-bundler-manifest.mjs <arena1|arena2> <catalog.json>");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(HERE, `${map}.manifest.json`), "utf8"));
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
const entries = Array.isArray(catalog) ? catalog : catalog.entries;
const known = new Set(entries.map((e) => e.file));

const all = [...manifest.placements, ...manifest.skyline, ...(manifest.wallDecor ?? []), ...(manifest.capProps ?? [])];

const missing = all.filter((p) => !known.has(p.asset));
if (missing.length > 0) {
  console.error("MISSING FROM CATALOG (fix before bundling):");
  for (const m of missing) console.error(" -", m.asset);
  process.exit(1);
}

const nonUniform = all.filter((p) => p.scale.x !== p.scale.y || p.scale.y !== p.scale.z);
if (nonUniform.length > 0) {
  console.error("NON-UNIFORM SCALE (bundler only accepts a single scalar):", nonUniform.length, "entries");
  process.exit(1);
}

const flat = all.map((p) => ({
  glb: p.asset,
  pos: [p.position.x, p.position.y, p.position.z],
  rotY: (p.rotationY * 180) / Math.PI,
  scale: p.scale.x,
}));

const outPath = join(HERE, `${map}.bundler-input.json`);
writeFileSync(outPath, JSON.stringify(flat, null, 1));
console.log(`OK — ${flat.length} placements, all asset paths validated against the catalog.`);
console.log(`wrote ${outPath}`);
