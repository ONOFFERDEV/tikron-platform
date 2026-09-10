// Deterministic topology/physics audit, separate from live network acceptance.
import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const built = await build({ stdin: { contents: `
  export { ARENA2 as map } from './src/map/arena2.js';
  export { UNDERTOW_CRATES as crates } from './src/map/undertow-structures.js';
  export { PROP_LIBRARY as props } from './client/prop-library.js';
  export { canStand, moveAndSlide, nearestBox } from './src/physics.js';
  export { CoreCollision } from './src/core-gate.js';
  export { GroundNavigator } from './src/map/navigation.js';
  export { MOVE, PLAYER } from './src/config.js';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const { map, crates, props, canStand, moveAndSlide, nearestBox, CoreCollision, GroundNavigator, MOVE, PLAYER } =
  await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const collision = new CoreCollision(map), nav = new GroundNavigator(map), checks = [];
assert.equal(map.structures.length, 2);
for (const crate of crates) {
  const size = ['x','y','z'].map(a => crate.max[a] - crate.min[a]);
  size.forEach((n,i) => assert.ok(Math.abs(n - props['ammo-crate-stack'].sizeM[i]) < 1e-9));
}
checks.push('all four crate colliders match the frozen detailed envelope');
let steps = 0;
for (const east of [false,true]) {
  const point = p => east ? { ...p, x: 150 - p.x } : p;
  const building = map.structures[east ? 1 : 0];
  for (const part of building.parts) {
    assert.ok(collision.closed.includes(part.box) && collision.open.includes(part.box));
    assert.equal(map.boxes.some(b => b.min.y === 0 && b.min.x === building.footprint.minX
      && b.max.x === building.footprint.maxX && b.min.z === 58 && b.max.z === 64), false, 'old sealed housing retained');
  }
  for (const stride of [MOVE.walk * .05, MOVE.sprint * .05]) {
    let p = point({ x:37,y:0,z:66 });
    const route = [
      [37,0,63],[37,0,61],[38,0,61],[38,0,59.5],[47,3,59.5],[47,3,61.5],
      [47,3,59.5],[38,0,59.5],[47,3,59.5],[47,3,61.5],[41,3,61.5],
      [41,0,66],[45,0,66],[45,0,63],[50.9,0,63],[50.9,0,61.5],
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
  for(const x of [37,45]) assert.equal(ray({x,y:1.65,z:65},{x,y:1.65,z:63}),Infinity);
  assert.equal(ray({x:50.9,y:1.65,z:61.5},{x:53,y:1.65,z:61.5}),Infinity);
  assert.ok(Number.isFinite(ray({x:50.9,y:.7,z:61.5},{x:53,y:.7,z:61.5})));
  assert.ok(Number.isFinite(ray({x:34,y:1.65,z:65},{x:34,y:1.65,z:63})));
  assert.ok(Number.isFinite(ray({x:47,y:2,z:61.5},{x:47,y:4,z:61.5})));
  assert.deepEqual(nav.next(point({x:37,z:66}),point({x:37,z:61})),point({x:37,z:61}));
  checks.push(`${east?'east':'west'}: walk/sprint doors, slope both ways, slab/drop/head clearance; window/sill/wall/roof rays; ground bot entry`);
}
const report = { status:'PASS',steps,checks, note:'Local deterministic physics/topology only; live acknowledged-command movement and natural rounds are separate evidence.' };
await writeFile('.inspect/session94-structure-audit.json',JSON.stringify(report,null,2));
console.log(report);
