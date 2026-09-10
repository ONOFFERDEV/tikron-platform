import { readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
const root = fileURLToPath(new URL('../public/', import.meta.url));
const approvedDerived = [
  'assets/models/player.glb', 'assets/models/weapons-vm.glb',
  'assets/maps/arena1-dressing.glb', 'assets/maps/arena2-dressing.glb', 'assets/maps/relay-skyline.glb',
];
const approvedOriginal = ['assets/maps/relay-architecture.glb', 'assets/maps/undertow-architecture.glb',
  'assets/maps/switchyard-architecture.glb', 'assets/props/switchyard-transformer.glb', 'assets/props/relay-uplink.glb',
  'assets/props/field-radio-pack.glb',
  'assets/props/relay-field-sandbags.glb',
  'assets/weapons/field-carbine.glb',
  'assets/ui/damage-vignette.png', 'assets/undertow-dusk.hdr', 'assets/undertow-dusk-sky.png',
  'assets/switchyard-overcast.hdr', 'assets/switchyard-overcast-sky.png'];
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else files.push({ path: relative(root, path).replaceAll('\\', '/'), bytes: (await stat(path)).size });
  }
}
await walk(root);
for (const file of files) {
  if (file.bytes >= 25 * 1024 * 1024) throw Error(`Cloudflare per-file cap exceeded: ${file.path}`);
  if (/\.(fbx|blend|zip|unitypackage)$/i.test(file.path)) throw Error(`Raw source asset in public: ${file.path}`);
  if (file.path.endsWith('.glb') && !approvedDerived.includes(file.path) && !approvedOriginal.includes(file.path)) throw Error(`Document provenance before shipping: ${file.path}`);
}
for (const path of [...approvedDerived, ...approvedOriginal]) if (!files.some(f => f.path === path)) throw Error(`Restore private derived asset: ${path}`);
const assetBytes = files.filter(f => f.path.startsWith('assets/')).reduce((n, f) => n + f.bytes, 0);
const publicBytes = files.reduce((n, f) => n + f.bytes, 0);
// Raised 40 -> 60 MiB by owner decision 2026-09-10 for the visual-fidelity phase.
// Per-map lazy loading is what keeps first load reasonable; the cap is the ceiling, not a target.
if (publicBytes > 60 * 1024 * 1024) throw Error('Deployed public asset set exceeds 60 MiB budget');
console.log(JSON.stringify({ assetBytes, publicBytes, maxFileBytes: Math.max(...files.map(f => f.bytes)),
  derivedFiles: files.filter(f => approvedDerived.includes(f.path)), originalFiles: files.filter(f => approvedOriginal.includes(f.path)), note: 'All purchased derivatives must remain unversioned; see .gitignore and assets/README.md.' }, null, 2));
