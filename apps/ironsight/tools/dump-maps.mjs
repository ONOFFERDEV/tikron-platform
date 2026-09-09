// node tools/dump-maps.mjs <out.json> — collision geometry per presentation for bake-ground-ao.py.
import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = process.argv[2];
if (!out) throw new Error('usage: node tools/dump-maps.mjs <out.json>');
const dir = await mkdtemp(join(tmpdir(), 'ironsight-maps-'));
const bundle = join(dir, 'maps.mjs');
await build({
  stdin: {
    contents: `export { ARENA1 as relay } from './src/map/arena1.js'; export { ARENA2 as undertow } from './src/map/arena2.js'; export { ARENA3 as switchyard } from './src/map/arena3.js';`,
    resolveDir: new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
  },
  bundle: true, platform: 'node', format: 'esm', outfile: bundle, logLevel: 'warning',
});
const maps = await import(pathToFileURL(bundle).href);
// Bake the permanent shell. Dynamic shutters must not leave a stale ground shadow.
const pick = (m) => ({ bounds: m.bounds, boxes: m.boxes.filter(b => !m.signalCore?.doors.includes(b)), ramps: m.ramps ?? [] });
await writeFile(out, JSON.stringify(Object.fromEntries(Object.entries(maps).filter(([key]) => !process.argv[3] || key === process.argv[3]).map(([k, m]) => [k, pick(m)]))));
await rm(dir, { recursive: true, force: true });
console.log(`[dump-maps] ${Object.keys(maps).join(', ')} -> ${out}`);
