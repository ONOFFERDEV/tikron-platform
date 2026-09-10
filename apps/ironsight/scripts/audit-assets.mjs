import { readdir, stat, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
const root = fileURLToPath(new URL('../public/', import.meta.url));
const approvedDerived = [
  'assets/models/player.glb', 'assets/models/weapons-vm.glb',
  'assets/maps/arena1-dressing.glb', 'assets/maps/arena2-dressing.glb', 'assets/maps/relay-skyline.glb',
];
const libraryAdditions = ['ammo-crate-stack', 'field-chest-panel', 'fuel-drum-cluster'];
const approvedOriginal = [...libraryAdditions.map(name => `assets/props/${name}.glb`),
  'assets/maps/relay-architecture.glb', 'assets/maps/undertow-architecture.glb',
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
// New library entries carry a review receipt tied to the shipped bytes. This catches
// accidentally publishing the raw 2k source or a rejected candidate under an approved name.
for (const name of libraryAdditions) {
  const buffer = await readFile(join(root, `assets/props/${name}.glb`));
  const meta = JSON.parse(await readFile(join(root, `assets/props/${name}.meta.json`), 'utf8'));
  const shipped = meta.adoption;
  if (!shipped || shipped.sha256 !== createHash('sha256').update(buffer).digest('hex') || shipped.bytes !== buffer.length)
    throw Error(`Library provenance does not match shipped bytes: ${name}`);
  if (buffer.readUInt32LE(0) !== 0x46546c67 || buffer.readUInt32LE(4) !== 2 || buffer.readUInt32LE(8) !== buffer.length
      || buffer.readUInt32LE(16) !== 0x4e4f534a) throw Error(`Invalid library GLB: ${name}`);
  const gltf = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString());
  let triangles = 0;
  for (const mesh of gltf.meshes ?? []) for (const primitive of mesh.primitives) {
    if ((primitive.mode ?? 4) !== 4) throw Error(`Non-triangle library primitive: ${name}`);
    triangles += gltf.accessors[primitive.indices ?? primitive.attributes.POSITION].count / 3;
  }
  if (triangles > 4000 || triangles !== shipped.triangles) throw Error(`Library triangle budget/receipt mismatch: ${name}`);
  if ((gltf.images ?? []).some(image => image.mimeType !== 'image/webp' || image.uri))
    throw Error(`Library requires embedded WebP textures: ${name}`);
  if (shipped.textureMaxSize !== 512 || shipped.origin !== 'base-centre') throw Error(`Missing library scale/texture review: ${name}`);
}
const assetBytes = files.filter(f => f.path.startsWith('assets/')).reduce((n, f) => n + f.bytes, 0);
const publicBytes = files.reduce((n, f) => n + f.bytes, 0);
// Raised 40 -> 60 MiB by owner decision 2026-09-10 for the visual-fidelity phase.
// Per-map lazy loading is what keeps first load reasonable; the cap is the ceiling, not a target.
if (publicBytes > 60 * 1024 * 1024) throw Error('Deployed public asset set exceeds 60 MiB budget');
console.log(JSON.stringify({ assetBytes, publicBytes, maxFileBytes: Math.max(...files.map(f => f.bytes)),
  derivedFiles: files.filter(f => approvedDerived.includes(f.path)), originalFiles: files.filter(f => approvedOriginal.includes(f.path)), note: 'All purchased derivatives must remain unversioned; see .gitignore and assets/README.md.' }, null, 2));
