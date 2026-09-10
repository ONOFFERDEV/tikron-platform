// Deterministic topology/physics audit, separate from live network acceptance.
import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const built = await build({ stdin: { contents: `
  export { ARENA3 as map } from './src/map/arena3.js';
  export { SWITCHYARD_CRATES as crates } from './src/map/switchyard-structures.js';
  export { PROP_LIBRARY as props } from './client/prop-library.js';
  export { canStand, moveAndSlide, nearestBox } from './src/physics.js';
  export { CoreCollision } from './src/core-gate.js';
  export { GroundNavigator } from './src/map/navigation.js';
  export { MOVE, PLAYER } from './src/config.js';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const { map, crates, props, canStand, moveAndSlide, nearestBox, CoreCollision, GroundNavigator, MOVE, PLAYER } =
  await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const collision = new CoreCollision(map), nav = new GroundNavigator(map), checks = [];
assert.equal(map.structures.filter(s => ['west-maintenance', 'east-dispatch'].includes(s.id)).length, 2);
for (const crate of crates) {
  const size = ['x','y','z'].map(a => crate.max[a] - crate.min[a]);
  size.forEach((n,i) => assert.ok(Math.abs(n - props['ammo-crate-stack'].sizeM[i]) < 1e-9));
}
checks.push('every crate collider matches the frozen detailed envelope');
let steps = 0;
for (const east of [false,true]) {
  const point = p => east ? { ...p, x: 150 - p.x } : p;
  const building = map.structures[east ? 1 : 0];
  for (const part of building.parts) {
    assert.ok(collision.closed.includes(part.box) && collision.open.includes(part.box));
    assert.ok(part.box.min.x >= building.footprint.minX && part.box.max.x <= building.footprint.maxX
      && part.box.min.z >= 58 && part.box.max.z <= 64 && part.box.min.y >= 0 && part.box.max.y <= 6,
    'new solid must fit the removed sealed housing, preserving old valid positions');
    assert.equal(map.boxes.some(b => b.min.y === 0 && b.min.x === building.footprint.minX
      && b.max.x === building.footprint.maxX && b.min.z === 58 && b.max.z === 64), false, 'old sealed housing retained');
  }
  for (const stride of [MOVE.walk * .05, MOVE.sprint * .05]) {
    let p = point({ x:40,y:0,z:66 });
    const route = [
      [40,0,63],[40,0,61],[39,0,61],[39,0,59.5],[47,3,59.5],[47,3,61.5],
      [47,3,59.5],[39,0,59.5],[47,3,59.5],[47,3,61.5],[42,3,61.5],
      [42,0,66],[44,0,66],[44,0,63],[48.9,0,63],[48.9,0,61.5],
    ];
    for (const [x,y,z] of route) {
      const goal = point({x,y,z}); let remaining = 1000;
      while (Math.hypot(p.x-goal.x,p.z-goal.z) > .01 && remaining-- > 0) {
        const dx=goal.x-p.x,dz=goal.z-p.z,d=Math.hypot(dx,dz),s=Math.min(stride,d);
        p=moveAndSlide(p,PLAYER.radius,PLAYER.standHeight,{x:dx/d*s,y:-.1,z:dz/d*s},-2,map.boxes,map.bounds,MOVE.stepUp,map.ramps).pos;
        assert.ok(canStand(p.x,p.y,p.z,PLAYER.radius-1e-6,PLAYER.standHeight,map.boxes,map.bounds), `head clearance ${JSON.stringify(p)}`);
        steps++;
      }
      // Settle a deliberate roof drop with the same collision query.
      for (let i=0;i<40;i++) p=moveAndSlide(p,PLAYER.radius,PLAYER.standHeight,{x:0,y:-.1,z:0},-2,map.boxes,map.bounds,MOVE.stepUp,map.ramps).pos;
      assert.ok(Math.hypot(p.x-goal.x,p.z-goal.z) < .02 && Math.abs(p.y-goal.y) < .02, `route goal ${JSON.stringify({p,goal})}`);
    }
  }
  // Both full-height primary doors pass player-eye rays; wall, sill and slab stop them.
  const ray = (a,b) => { a=point(a);b=point(b);const d=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);
    return nearestBox(a,{x:(b.x-a.x)/d,y:(b.y-a.y)/d,z:(b.z-a.z)/d},collision.closedHits,d); };
  for(const x of [40,44]) assert.equal(ray({x,y:1.65,z:65},{x,y:1.65,z:63}),Infinity);
  assert.equal(ray({x:48.9,y:1.65,z:61.5},{x:51,y:1.65,z:61.5}),Infinity);
  assert.ok(Number.isFinite(ray({x:48.9,y:.7,z:61.5},{x:51,y:.7,z:61.5})));
  assert.ok(Number.isFinite(ray({x:35,y:1.65,z:65},{x:35,y:1.65,z:63})));
  assert.ok(Number.isFinite(ray({x:47,y:2,z:61.5},{x:47,y:4,z:61.5})));
  for (const x of [40,44])
    assert.deepEqual(nav.next(point({x,z:66}),point({x,z:63})),point({x,z:63}));
  checks.push(`${east?'east':'west'}: walk/sprint doors, slope both ways, slab/drop/head clearance; window/sill/wall/roof rays; ground bot entry`);
}
// Both entrance centres fit one 78-degree cone from a real standing point. Roofs
// can contest each other; no solid visually advertised as cover lacks authority.
for (const east of [false,true]) {
  const x = n => east ? 150-n : n;
  const from={x:x(42),y:1.65,z:61};
  assert.ok(canStand(from.x,0,from.z,PLAYER.radius,PLAYER.standHeight,map.boxes,map.bounds));
  for (const doorX of [40,44]) {
    const dx=x(doorX)-from.x,dz=64-from.z,d=Math.hypot(dx,dz);
    assert.ok(Math.abs(Math.atan2(dx,dz)) < 39*Math.PI/180);
    assert.equal(nearestBox(from,{x:dx/d,y:0,z:dz/d},collision.closedHits,d),Infinity);
  }
}
const roofA={x:48.9,y:4.65,z:61.5};
assert.equal(nearestBox(roofA,{x:1,y:0,z:0},collision.closedHits,101.1-roofA.x),Infinity);
checks.push('both primary door centres co-visible within 78 degrees; opposing roof eye ray clears');
for (const p of [{x:54,y:0,z:67},{x:42,y:0,z:61},{x:47,y:3,z:61.5},{x:48.9,y:0,z:61.5},{x:60,y:0,z:61.5}])
  assert.ok(canStand(p.x,p.y,p.z,PLAYER.radius,PLAYER.standHeight,map.boxes,map.bounds),`standing review eye ${JSON.stringify(p)}`);
checks.push('final frontage, defender, roof and enemy-window review cameras have valid standing feet');
checks.push('all added building solids fit the old sealed 6m housings; no old valid position is enclosed');
const report = { status:'PASS',steps,checks, boxes:map.boxes.length, ramps:map.ramps.length,
  buildings:map.structures.map(s=>({id:s.id,footprint:s.footprint,parts:s.parts.length})),
  note:'Local deterministic physics/topology only; live acknowledged-command movement and natural rounds are separate evidence.' };
await writeFile(process.argv[2] ?? '.inspect/session96-structure-audit.json',JSON.stringify(report,null,2));
console.log(report);
