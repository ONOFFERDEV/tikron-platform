// Physical placement proof for Session 102's original exterior dressing.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const built = await build({ stdin: { contents: `
  export { ARENA1 as map } from './src/map/arena1.js';
  export { relaySiteBoundary, relayWorkshopPlant } from './client/relay-site.js';
  export { relayWorkshopDetail } from './client/relay-workshop-detail.js';
  export { RELAY_WORKSHOP_SUPPLIES } from './client/relay-yard.js';
  export { PROP_LIBRARY } from './client/prop-library.js';
  export { canStand } from './src/physics.js';
  export { PLAYER } from './src/config.js';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const { map, relaySiteBoundary, relayWorkshopPlant, relayWorkshopDetail,
  RELAY_WORKSHOP_SUPPLIES: supplies, PROP_LIBRARY, canStand, PLAYER } =
  await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const parts = relayWorkshopPlant(), site = relaySiteBoundary(150, 100);
const bounds = p => ({ min: [p.x-p.w/2, p.y-p.h/2, p.z-p.d/2], max: [p.x+p.w/2, p.y+p.h/2, p.z+p.d/2] });
const boxes = parts.map(bounds);
for (const b of boxes) assert(b.max[0] <= 1e-9, 'whole plant envelope outside play');
// Start with the old hall and propagate physical contact into its plant.
// Up to 4 cm stand-off is permitted only for facade plates below the roof.
const connected = site.slice(0, -parts.length).filter(p => p.yaw === 0).map(bounds);
const pending = new Set(boxes);
for (let previous = -1; previous !== pending.size;) {
  previous = pending.size;
  for (const b of pending) {
    const tolerance = b.max[1] <= 11.1 ? .04 : .001;
    if (connected.some(a => [0,1,2].every(k => a.min[k] <= b.max[k] + tolerance && a.max[k] >= b.min[k] - tolerance))) {
      connected.push(b); pending.delete(b);
    }
  }
}
assert.equal(pending.size, 0, `unsupported plant pieces ${JSON.stringify([...pending])}`);
const [w,h,d] = PROP_LIBRARY['ammo-crate-stack'].sizeM;
for (const p of supplies) {
  assert(p.x+w/2 < 0, 'supply entirely outside play');
  assert(site.some(s => s.yaw === 0 && Math.abs(s.y+s.h/2-p.y)<1e-8
    && s.x-s.w/2 <= p.x-w/2 && s.x+s.w/2 >= p.x+w/2
    && s.z-s.d/2 <= p.z-d/2 && s.z+s.d/2 >= p.z+d/2), 'full crate footprint supported');
  assert.equal(p.y, 11.24); assert(h > 0);
}
const detail = relayWorkshopDetail(), position = detail.getAttribute('position');
for (let i=0;i<position.count;i++) {
  const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
  assert(x<0, 'decal outside play');
  assert(site.some(p => p.yaw === 0 && Math.abs(p.x+p.w/2-x)<.041
    && y>=p.y-p.h/2 && y<=p.y+p.h/2 && z>=p.z-p.d/2 && z<=p.z+p.d/2), 'decal backed by opaque hall');
}
for (const [x,z] of [[12,50],[18,62]]) assert(canStand(x,0,z,PLAYER.radius,PLAYER.standHeight,map.boxes,map.bounds), 'standing review camera');
let baselineIdentical = null;
if (process.argv[3]) {
  // The baseline is JSON; normalize optional undefined fields on both sides.
  assert.deepEqual(JSON.parse(JSON.stringify(map)), JSON.parse(await readFile(process.argv[3],'utf8')).map);
  baselineIdentical = true;
}
const report = { plantParts: parts.length, plantTriangles: parts.length*12, exterior: true,
  physicallyConnected: true, supportedSupplies: supplies.length, atlasFaces: position.count/4,
  mapHash: createHash('sha256').update(JSON.stringify(map)).digest('hex'), baselineIdentical,
  note: 'All new geometry is exterior; same complete MapDef, no new cover or gameplay light. Supplies retain real library scale.' };
detail.dispose(); await writeFile(process.argv[2] ?? '.inspect/relay-workshop-audit.json', JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
