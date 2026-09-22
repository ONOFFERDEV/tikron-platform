// Rebuilds original, texture-free skyline geometry from the runtime fallback.
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// GLTFExporter uses this browser adapter only to assemble binary Blob chunks.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); });
  }
};
const bundle = await build({ stdin: { contents: `
  export { buildRelaySkyline } from './client/relay-skyline.js';
  export { ARENA1 } from './src/map/arena1.js';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const { buildRelaySkyline, ARENA1 } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const skyline = buildRelaySkyline(ARENA1.bounds);
skyline.name = 'relay-signal-village';
const binary = await new GLTFExporter().parseAsync(skyline, { binary: true });
if (!(binary instanceof ArrayBuffer)) throw Error('Skyline export must be binary');
const bytes = Buffer.from(binary);
if (bytes.length > 1168772) throw Error('Replacement skyline must shrink the inherited asset');
const output = process.argv[2] ?? 'public/assets/maps/relay-skyline.glb';
await writeFile(output, bytes);
let triangles = 0;
skyline.traverse(node => {
  if (node.isMesh) triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
});
const receipt = { output, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
  provenance: skyline.userData.provenance, triangles, materials: 1, textures: 0,
  command: 'node tools/dump-relay-skyline.mjs', bounds: ARENA1.bounds };
await mkdir('.inspect/aaa-loop-world', { recursive: true });
await writeFile('.inspect/aaa-loop-world/session2-skyline-receipt.json', JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt));
