// Bounds contract for the original exterior kit. Node-only: no browser/GPU.
// Run from apps/ironsight: node tools/audit-relay-site.mjs
import { build } from 'esbuild';
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('.inspect', { recursive: true });
await build({ stdin: { contents: `
 export { relaySiteBoundary } from './client/relay-site.js';
 export { ARENA1 } from './src/map/arena1.js';
 export { relayBoundaryDetail } from './client/relay-service-geometry.js';
 `, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm',
 outfile: '.inspect/relay-site-audit-bundle.mjs' });
const { relaySiteBoundary, relayBoundaryDetail, ARENA1: map } = await import('../.inspect/relay-site-audit-bundle.mjs');
const { width, depth } = map.bounds;
const parts = relaySiteBoundary(width, depth), materials = new Set();
for (const [i, p] of parts.entries()) {
  assert(Object.values(p).filter(v => typeof v === 'number').every(Number.isFinite), `finite part ${i}`);
  assert(p.w > 0 && p.h > 0 && p.d > 0, `positive dimensions ${i}`);
  // Exact bounding extents for every yawed box, not merely its centre.
  const rx = (Math.abs(Math.cos(p.yaw)) * p.w + Math.abs(Math.sin(p.yaw)) * p.d) / 2;
  const rz = (Math.abs(Math.sin(p.yaw)) * p.w + Math.abs(Math.cos(p.yaw)) * p.d) / 2;
  assert(p.x + rx <= 1e-9 || p.x - rx >= width - 1e-9 || p.z + rz <= 1e-9 || p.z - rz >= depth - 1e-9,
    `exterior part ${i}: ${JSON.stringify(p)}`);
  materials.add(p.material);
}
// Continuous readable enclosure along every edge, including at roof eye level
// on the hall sides; low north retains the dish/sandbag outlook by design.
const contains = (p, x, y, z) => {
  const dx = x - p.x, dz = z - p.z, c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  return Math.abs(dx * c - dz * s) <= p.w / 2 + 1e-9
    && Math.abs(dx * s + dz * c) <= p.d / 2 + 1e-9 && Math.abs(y - p.y) <= p.h / 2;
};
let boundarySamples = 0;
for (let x = 0; x <= width; x += .5) for (const z of [-.5, depth + .5]) {
  assert(parts.some(p => contains(p, x, 1.65, z)), `enclosed north/south ${x},${z}`); boundarySamples++;
}
for (let z = 0; z <= depth; z += .5) for (const x of [-.5, width + .5]) {
  assert(parts.some(p => contains(p, x, 4.65, z)), `enclosed west/east ${x},${z}`); boundarySamples++;
}
assert(materials.size <= 7, 'Use existing architecture materials');
const labels = relayBoundaryDetail(map), vertices = labels.getAttribute('position');
for (let i = 0; i < vertices.count; i++)
  assert(vertices.getX(i) < 0 || vertices.getX(i) > width, `exterior sign vertex ${i}`);
for (const uv of labels.getAttribute('uv').array) assert(uv > 0 && uv < 1, 'sign atlas coordinates');
assert.equal(labels.index.count / 3, 16);
labels.dispose();
const report = { parts: parts.length, triangles: parts.length * 12, materials: [...materials], boundarySamples,
  signTriangles: 16,
  exterior: true, mapHash: createHash('sha256').update(JSON.stringify(map)).digest('hex'),
  bounds: map.bounds, boxes: map.boxes.length, ramps: map.ramps.length,
  note: 'Exterior vertex bounds and continuous edge mass. Map hash can be compared before/after; human visual acceptance is separate.' };
await writeFile('.inspect/session92-site-boundary-audit.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
