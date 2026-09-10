// Parallel Meshy generation for the grounded-warfare asset library.
//
//   node tools/meshy-batch.mjs [--concurrency 4] [--out D:/game-assets/generated/meshy-warfare] [--only slug,slug]
//
// Runs tools/meshy-generate.mjs jobs concurrently (each job is an independent API task, so
// wall time is roughly total/concurrency). Writes a manifest with credits, bytes and status
// so a session can adopt from the library instead of waiting on generation.
// Style suffix keeps the whole set on the ART-CONCEPT palette.
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const CONCURRENCY = Number(opt('--concurrency', 4));
const OUT = opt('--out', 'D:/game-assets/generated/meshy-warfare');
const only = opt('--only')?.split(',');

const STYLE = 'single standalone object, centred, low-poly hard-surface game asset, PBR, '
  + 'desaturated olive drab, grey-brown and rusted steel, matte weathered surfaces, worn paint, '
  + 'military field equipment, no text, no logos, no ground plane, no base';
const TEX = 'weathered olive drab and grey-brown military paint, dust, rust streaks, scratched metal, matte';

// Ordered by what a player sees first, per ART-CONCEPT.md.
const JOBS = [
  ['sandbag-wall', 'a low defensive wall of stacked military sandbags, three courses high, sagging fabric sacks'],
  ['barrier-hesco', 'a large square military earth-filled defensive barrier basket, wire mesh cage with geotextile liner'],
  ['barricade-concrete-block', 'a stack of rough precast concrete blocks forming a chest-high military barricade'],
  ['barrier-jersey', 'a single concrete jersey highway barrier, chipped edges, scuffed paint'],
  ['razor-wire-coil', 'a coil of military razor wire concertina on short steel stakes'],
  ['ammo-crate-stack', 'a stack of three closed military ammunition crates with latches and stencil panels'],
  ['fuel-drum-cluster', 'four dented steel fuel drums standing together, rusted rims, one on its side'],
  ['field-generator', 'a skid-mounted military field generator in a boxy vented steel housing with lifting frame'],
  ['antenna-mast-field', 'a portable military field antenna mast on a tripod base with guy wires and a small dish'],
  ['tool-cart', 'an industrial rolling tool cart with open shelves, scattered tools, dented steel'],
  ['burnt-truck', 'a burnt-out wrecked military cargo truck, no wheels, blackened scorched frame and cab'],
  ['apc-hulk', 'a wrecked abandoned eight-wheeled armoured personnel carrier hull, hatches open, no weapons'],
  ['flatbed-truck', 'a heavy military flatbed cargo truck with an empty load bed and canvas-less frame'],
  ['forklift', 'a heavy industrial diesel forklift with a mast and forks, worn yellow-grey paint'],
  ['container-dented', 'a shipping container with dented corrugated walls and closed doors'],
  ['container-holed', 'a shipping container with a torn blast hole through one corrugated wall'],
  ['pump-housing', 'an industrial water pump housing with flanged pipes and a motor on a concrete pad'],
  ['rubble-pile', 'a pile of broken concrete rubble with bent rebar and shattered slabs'],
  ['collapsed-wall-section', 'a collapsed section of a concrete industrial wall, exposed rebar, cracked edges'],
  ['blast-crater-slab', 'a cratered concrete slab section with a blast hole, cracked and lifted edges'],
  ['cooling-tower', 'a tall industrial concrete hyperbolic cooling tower, weathered streaked concrete'],
  ['chimney-stack', 'a tall industrial brick and steel chimney stack with maintenance ladder and bands'],
  ['silo-cluster', 'three tall cylindrical industrial storage silos joined by a top gantry'],
  ['power-pylon', 'a steel lattice high-voltage transmission pylon with crossarms and insulator strings'],
  ['water-tank', 'an elevated industrial steel water tank on a four-leg lattice frame with a ladder'],
];

const jobs = JOBS.filter(([slug]) => !only || only.includes(slug));
await mkdir(OUT, { recursive: true });
const manifestPath = join(OUT, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, 'utf8')) : {};

const run = (slug, prompt) => new Promise((resolve) => {
  const started = Date.now();
  const child = spawn('node', ['tools/meshy-generate.mjs', '--name', slug, '--prompt', `${prompt}. ${STYLE}`,
    '--texture', TEX, '--polycount', '3000', '--out', OUT], { cwd: process.cwd(), shell: false, windowsHide: true });
  let out = '';
  child.stdout.on('d' + 'ata', b => { out += b; });
  child.stderr.on('d' + 'ata', b => { out += b; });
  child.on('close', code => {
    let result = { slug, ok: code === 0, minutes: Math.round((Date.now() - started) / 6000) / 10 };
    try { Object.assign(result, JSON.parse(out.trim().split('\n').filter(l => l.startsWith('{')).pop())); } catch {}
    if (!result.ok) result.tail = out.slice(-300).replace(/\s+/g, ' ');
    console.log(`[batch] ${result.ok ? 'OK  ' : 'FAIL'} ${slug} ${result.minutes} min ${result.creditsUsed ?? ''} cr ${result.glbBytes ?? ''} B ${result.tail ?? ''}`);
    resolve(result);
  });
});

let cursor = 0;
const results = [];
const worker = async () => {
  while (cursor < jobs.length) {
    const [slug, prompt] = jobs[cursor++];
    if (manifest[slug]?.ok) { console.log(`[batch] SKIP ${slug} (already in manifest)`); continue; }
    const r = await run(slug, prompt);
    manifest[slug] = r; results.push(r);
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  }
};
console.log(`[batch] ${jobs.length} jobs, concurrency ${CONCURRENCY}, out ${OUT}`);
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
const ok = results.filter(r => r.ok);
console.log(`[batch] done: ${ok.length}/${results.length} ok, ${ok.reduce((n, r) => n + (r.creditsUsed ?? 0), 0)} credits, manifest ${manifestPath}`);
