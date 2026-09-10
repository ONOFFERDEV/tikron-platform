// Original exterior bounds, sign planes, supply envelopes and edge enclosure.
// node tools/audit-undertow-site.mjs [.inspect/session95-site-boundary.json]
import { build } from 'esbuild';
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const bundle = await build({ stdin: { contents: `
  export { undertowSiteBoundary, undertowSiteSigns, undertowSiteSupplies, undertowCanalLookouts } from './client/undertow-site.js';
  export { PROP_LIBRARY } from './client/prop-library.js';
  export { buildUndertowCanalWater } from './client/undertow-environment.js';
  export { Scene } from 'three';
  export { ARENA2 as map } from './src/map/arena2.js';
  export { canStand } from './src/physics.js';
  export { PLAYER } from './src/config.js';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const { undertowSiteBoundary, undertowSiteSigns, undertowSiteSupplies, undertowCanalLookouts, buildUndertowCanalWater, Scene, PROP_LIBRARY, map, canStand, PLAYER } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const { width, depth } = map.bounds, parts = undertowSiteBoundary(width, depth);
const exterior = (x, z, w, d, yaw = 0) => {
  const rx = (Math.abs(Math.cos(yaw)) * w + Math.abs(Math.sin(yaw)) * d) / 2;
  const rz = (Math.abs(Math.sin(yaw)) * w + Math.abs(Math.cos(yaw)) * d) / 2;
  return x + rx <= 1e-9 || x - rx >= width - 1e-9 || z + rz <= 1e-9 || z - rz >= depth - 1e-9;
};
for (const [i, p] of parts.entries()) {
  assert(Object.values(p).every(Number.isFinite), `finite part ${i}`);
  assert(p.w > 0 && p.h > 0 && p.d > 0, `dimensions ${i}`);
  assert(Number.isInteger(p.material) && p.material >= 0 && p.material < 6, `existing lit material ${i}`);
  assert(exterior(p.x, p.z, p.w, p.d, p.yaw), `exterior part ${i}: ${JSON.stringify(p)}`);
}
const contains = (p, x, y, z) => {
  const dx = x - p.x, dz = z - p.z, c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  return Math.abs(dx * c - dz * s) <= p.w / 2 + 1e-9
    && Math.abs(dx * s + dz * c) <= p.d / 2 + 1e-9 && Math.abs(y - p.y) <= p.h / 2;
};
// Same-facing exposed top planes produce shimmering even when all bounds
// are legal. Check different materials on the axis-aligned exterior kit;
// body/rib joins under a third, solid coping piece are intentionally hidden.
let topPairs = 0;
for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
  const a = parts[i], b = parts[j];
  if (a.yaw || b.yaw || a.material === b.material || Math.abs(a.y + a.h / 2 - b.y - b.h / 2) > 1e-6) continue;
  const x0 = Math.max(a.x - a.w / 2, b.x - b.w / 2), x1 = Math.min(a.x + a.w / 2, b.x + b.w / 2);
  const z0 = Math.max(a.z - a.d / 2, b.z - b.d / 2), z1 = Math.min(a.z + a.d / 2, b.z + b.d / 2);
  if (x1 - x0 < .02 || z1 - z0 < .02) continue;
  topPairs++;
  for (const u of [.1, .5, .9]) for (const v of [.1, .5, .9]) {
    assert(parts.some((p, k) => k !== i && k !== j && contains(p,
      x0 + (x1 - x0) * u, a.y + a.h / 2 + .001, z0 + (z1 - z0) * v)),
    `exposed coplanar top faces ${i}/${j}`);
  }
}
let edgeSamples = 0;
for (let x = 0; x <= width; x += .5) for (const z of [-.5, depth + .5]) {
  const y = z > depth && undertowCanalLookouts(width).some(([from,to]) => x >= from && x <= to) ? .8 : 1.65;
  assert(parts.some(p => contains(p, x, y, z)), `north/south mass ${x},${z}`); edgeSamples++;
}
// The low exterior lookout must expose real water from ordinary eye height.
// Sampling the segment also catches full-height ribs accidentally left in it.
for (const x of [width * .38, width * .62]) {
  assert(canStand(x, 0, depth - 1, PLAYER.radius, PLAYER.standHeight, map.boxes, map.bounds),
    'lookout camera has a valid standing position on the authoritative yard');
  for (let t = 0; t <= 1; t += .01)
    assert(!parts.some(p => contains(p, x + (x < width/2 ? -4 : 4) * t, 1.65 + (.025 - 1.65) * t,
      depth - 1 + 16 * t)), 'standing view from yard across the canal');
}
for (let z = 0; z <= depth; z += .5) {
  for (const [x, y] of [[-.5, 1.65], [-4.6, 4.65], [width + .5, 1.65], [width + .5, 4.65]]) {
    assert(parts.some(p => contains(p, x, y, z)), `west/east mass ${x},${y},${z}`); edgeSamples++;
  }
}
const signs = undertowSiteSigns(width, depth);
let signSamples = 0;
for (const s of signs) {
  assert(exterior(s.x, s.z, s.width, 0, s.yaw), `exterior sign ${JSON.stringify(s)}`);
  // Check the whole face, not just its centre: awnings and shutter ribs
  // must not clip text. Samples extend one metre toward the visible normal.
  for (const u of [-.49, -.25, 0, .25, .49]) for (const v of [-.49, 0, .49]) {
    for (let distance = 0; distance <= 1; distance += .1) {
      const x = s.x + u * s.width * Math.cos(s.yaw) + distance * Math.sin(s.yaw);
      const z = s.z - u * s.width * Math.sin(s.yaw) + distance * Math.cos(s.yaw);
      const y = s.y + v * s.width / 8;
      assert(!parts.some(p => contains(p, x, y, z)), `unobstructed sign ${JSON.stringify({s,u,v,distance})}`);
      signSamples++;
    }
  }
}
const supplies = undertowSiteSupplies(depth), size = PROP_LIBRARY['ammo-crate-stack'].sizeM;
for (const p of supplies) {
  assert(exterior(p.x, p.z, size[0], size[2]), `exterior supplies ${JSON.stringify(p)}`);
  assert(parts.some(part => contains(part, p.x, p.y - .01, p.z)), 'supplies have a solid visible base');
}
const waterScene = new Scene(); buildUndertowCanalWater(waterScene, map);
const water = waterScene.getObjectByName('undertow-canal-water');
const vertices = water.geometry.getAttribute('position'), normals = water.geometry.getAttribute('normal');
for (let i = 0; i < vertices.count; i++) {
  assert(vertices.getZ(i) > depth, 'exterior water vertex');
  assert(Math.abs(Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i)) - 1) < 1e-6, 'unit water normal');
}
assert(!water.material.transparent && !water.material.map && !water.material.normalMap && !water.castShadow,
  'opaque existing-environment reflection, no added texture or caster');
const report = { passed: true, parts: parts.length, triangles: parts.length * 12,
  materials: [...new Set(parts.map(p => p.material))], edgeSamples, topPairs, exposedTopConflicts: 0,
  signs: signs.length, signSamples,
  supplies: supplies.length, supplySizeM: size, waterTriangles: water.geometry.index.count / 3, waterTextures: 0, bounds: map.bounds,
  boxes: map.boxes.length, ramps: map.ramps.length,
  mapHash: createHash('sha256').update(JSON.stringify(map)).digest('hex'),
  note: 'Every added envelope is exterior. Edge mass, signs and real-size supplies are checked; unchanged map hash establishes collision identity. Human visual acceptance is separate.' };
await writeFile(process.argv[2] ?? '.inspect/session95-site-boundary.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
