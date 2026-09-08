// Meshy text-to-3D -> GLB for ironsight. Original generated assets; credits are consumed.
//
//   node tools/meshy-generate.mjs --name <slug> --prompt "<what>" [--texture "<look>"]
//        [--polycount 3000] [--no-pbr] [--preview-only] [--ai-model latest] [--out D:/game-assets/generated/meshy]
//   node tools/meshy-generate.mjs --balance
//
// Key: ~/.claude/secrets/meshy.json {"apiKey"}. Output: <out>/<name>/{model.glb,thumbnail.png,meta.json}.
// A preview+PBR refine costs ~15-20 credits and takes ~5-10 minutes. Raw Meshy GLBs embed 2k
// JPEG textures (~6 MB); run tools/shrink-glb.py before shipping.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const flag = name => args.includes(name);
const { apiKey } = JSON.parse(await readFile(join(homedir(), '.claude/secrets/meshy.json'), 'utf8'));
const api = async (method, path, body) => {
  const res = await fetch('https://api.meshy.ai' + path, { method, headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
};
const balance = async () => (await api('GET', '/openapi/v1/balance')).balance;

if (flag('--balance')) { console.log(JSON.stringify({ balance: await balance() })); process.exit(0); }
const name = opt('--name'), prompt = opt('--prompt');
if (!name || !prompt || !/^[a-z0-9-]+$/.test(name)) throw new Error('usage: --name <slug> --prompt "<text>" [--texture "<text>"] [--polycount N] [--no-pbr] [--preview-only]');
const out = join(opt('--out', 'D:/game-assets/generated/meshy'), name);
await mkdir(out, { recursive: true });
const before = await balance();
console.log(`[meshy] balance ${before} credits; generating "${name}"`);

const wait = async id => {
  for (;;) {
    const task = await api('GET', `/openapi/v2/text-to-3d/${id}`);
    if (task.status === 'SUCCEEDED') return task;
    if (task.status === 'FAILED' || task.status === 'CANCELED') throw new Error(`task ${id} ${task.status}: ${task.task_error?.message ?? ''}`);
    process.stdout.write(`\r[meshy] ${task.type} ${task.status} ${task.progress ?? 0}%   `);
    await new Promise(r => setTimeout(r, 8000));
  }
};
const { result: previewId } = await api('POST', '/openapi/v2/text-to-3d', {
  mode: 'preview', prompt, ai_model: opt('--ai-model', 'latest'), should_remesh: true, topology: 'triangle',
  target_polycount: Number(opt('--polycount', 3000)), target_formats: ['glb'], auto_size: true, origin_at: 'bottom',
});
let task = await wait(previewId);
let refineId;
if (!flag('--preview-only')) {
  ({ result: refineId } = await api('POST', '/openapi/v2/text-to-3d', {
    mode: 'refine', preview_task_id: previewId, enable_pbr: !flag('--no-pbr'), texture_resolution: '2k',
    ...(opt('--texture') ? { texture_prompt: opt('--texture') } : {}), target_formats: ['glb'], auto_size: true, origin_at: 'bottom',
  }));
  task = await wait(refineId);
}
console.log('');
const save = async (url, file) => { const buf = Buffer.from(await (await fetch(url)).arrayBuffer()); await writeFile(join(out, file), buf); return buf.length; };
const glbBytes = await save(task.model_urls.glb, 'model.glb');
if (task.thumbnail_url) await save(task.thumbnail_url, 'thumbnail.png');
const after = await balance();
const meta = { name, prompt, texture_prompt: opt('--texture') ?? null, previewId, refineId: refineId ?? null, ai_model: task.ai_model ?? opt('--ai-model', 'latest'),
  target_polycount: Number(opt('--polycount', 3000)), pbr: !flag('--no-pbr') && !flag('--preview-only'), glbBytes, creditsUsed: before - after, balanceAfter: after,
  generatedAt: new Date().toISOString(), license: 'Meshy-generated original asset for this project; see Meshy terms for the account plan.' };
await writeFile(join(out, 'meta.json'), JSON.stringify(meta, null, 2));
console.log(JSON.stringify({ out, glbBytes, creditsUsed: meta.creditsUsed, balanceAfter: after }));
