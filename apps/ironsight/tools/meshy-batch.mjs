// Parallel Meshy generation for the grounded-warfare asset library.
//
//   node tools/meshy-batch.mjs [--concurrency 4] [--out .inspect/meshy-warfare] [--only slug,slug]
//        [--budget-credits 60] [--reserve-credits 300] [--dry-run]
//
// Runs tools/meshy-generate.mjs jobs concurrently (each job is an independent API task, so
// wall time is roughly total/concurrency). Writes a manifest with credits, bytes and status
// so a session can adopt from the library instead of waiting on generation.
// Style suffix keeps the whole set on the ART-CONCEPT palette.
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const CONCURRENCY = Number(opt('--concurrency', 4));
const OUT = opt('--out', '.inspect/meshy-warfare');
const only = opt('--only')?.split(',');
const BUDGET = Number(opt('--budget-credits', 60));
const RESERVE = Number(opt('--reserve-credits', 300));
const JOB_CREDITS = 30; // Measured preview + PBR refine; session receipt is the actual charge.
if (!Number.isInteger(CONCURRENCY) || CONCURRENCY < 1 || CONCURRENCY > 4) throw Error('Concurrency must be 1..4');
if (!Number.isInteger(BUDGET) || BUDGET < 0 || BUDGET > 150) throw Error('Budget must be 0..150 credits');
if (!Number.isInteger(RESERVE) || RESERVE < 200) throw Error('Keep at least 200 credits in reserve');

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
  ['field-generator', 'one rectangular stationary diesel generator cabinet with CLOSED solid access doors and recessed ventilation grilles, broad flat skid rails underneath, two small lifting eyes, dark exhaust pipe. NO wheels, NO trailer, NO open engine cavity, NO tall frame'],
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

if (only?.some(slug => !JOBS.some(([name]) => name === slug))) throw Error('Unknown --only slug');
const manifestPath = join(OUT, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, 'utf8')) : {};
const available = JOBS.filter(([slug]) => (!only || only.includes(slug)) && !manifest[slug]?.ok);
const jobs = available.slice(0, Math.floor(BUDGET / JOB_CREDITS));
const plannedCredits = jobs.length * JOB_CREDITS;
const deferred = available.slice(jobs.length).map(([slug]) => slug);
if (args.includes('--dry-run')) {
  console.log(JSON.stringify({ jobs: jobs.map(([slug]) => slug), plannedCredits, deferred, reserve: RESERVE }));
  process.exit(0);
}
if (!jobs.length) { console.log('[batch] No jobs fit the remaining selection/budget'); process.exit(0); }
const exec = promisify(execFile);
const balance = async () => JSON.parse((await exec(process.execPath, ['tools/meshy-generate.mjs', '--balance'], { windowsHide: true })).stdout).balance;
const before = await balance();
if (!Number.isFinite(before) || before - plannedCredits < RESERVE) throw Error('Batch would breach credit reserve');
// Check interrupted jobs before starting ANY paid request. Never silently resubmit a task.
for (const [slug] of jobs) if (existsSync(join(OUT, slug, 'model.glb')) || existsSync(join(OUT, slug, 'task-state.json')))
  throw Error(`Existing output/task for ${slug}; inspect and reconcile the manifest first`);
await mkdir(OUT, { recursive: true });
const receiptPath = join(OUT, `batch-${Date.now()}.json`);
const receipt = { balanceBefore: before, reserve: RESERVE, plannedCredits, jobs: jobs.map(([slug]) => slug), deferred, status: 'running' };
await writeFile(receiptPath, JSON.stringify(receipt, null, 2));

const run = (slug, prompt) => new Promise((resolve) => {
  const started = Date.now();
  const child = spawn(process.execPath, ['tools/meshy-generate.mjs', '--batch', '--name', slug, '--prompt', `${prompt}. ${STYLE}`,
    '--texture', TEX, '--polycount', '3000', '--out', OUT], { cwd: process.cwd(), shell: false, windowsHide: true });
  let out = '';
  child.stdout.on('d' + 'ata', b => { out += b; });
  child.stderr.on('d' + 'ata', b => { out += b; });
  child.on('error', error => { out += String(error); });
  child.on('close', code => {
    let result = { slug, ok: code === 0, minutes: Math.round((Date.now() - started) / 6000) / 10 };
    try { Object.assign(result, JSON.parse(out.trim().split('\n').filter(l => l.startsWith('{')).pop())); } catch {}
    if (!result.ok) result.tail = out.slice(-300).replace(/\s+/g, ' ');
    result.estimatedCredits = JOB_CREDITS;
    result.batchReceipt = receiptPath;
    console.log(`[batch] ${result.ok ? 'OK  ' : 'FAIL'} ${slug} ${result.minutes} min ${result.glbBytes ?? ''} B ${result.tail ?? ''}`);
    resolve(result);
  });
});

let cursor = 0;
const results = [];
let writes = Promise.resolve();
const worker = async () => {
  while (cursor < jobs.length) {
    const [slug, prompt] = jobs[cursor++];
    if (manifest[slug]?.ok) { console.log(`[batch] SKIP ${slug} (already in manifest)`); continue; }
    const r = await run(slug, prompt);
    manifest[slug] = r; results.push(r);
    const snapshot = JSON.stringify(manifest, null, 2);
    writes = writes.then(() => writeFile(manifestPath, snapshot));
    await writes;
  }
};
console.log(`[batch] ${jobs.length} jobs, concurrency ${CONCURRENCY}, out ${OUT}`);
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
const ok = results.filter(r => r.ok);
const after = await balance();
const creditsUsed = before - after;
await writeFile(receiptPath, JSON.stringify({ ...receipt, balanceAfter: after, creditsUsed,
  status: ok.length === results.length ? 'complete' : 'failed', finishedAt: new Date().toISOString() }, null, 2));
console.log(`[batch] done: ${ok.length}/${results.length} ok, ${creditsUsed} account credits, manifest ${manifestPath}, receipt ${receiptPath}`);
if (ok.length !== results.length || creditsUsed > BUDGET || after < RESERVE) process.exitCode = 1;
