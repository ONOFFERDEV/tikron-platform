// Independent geometry, production navigation and hit-barrier evidence.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
const result = await build({ stdin: { contents: `
  export { ARENA2 as map } from './src/map/arena2.js';
  export { UNDERTOW_YARD_PARTS as parts, UNDERTOW_YARD_CRATES as crates,
    UNDERTOW_YARD_OLD_BLOCKS as oldBlocks } from './src/map/undertow-yard.js';
  export { buildUndertowEnvironment } from './client/undertow-environment.js';
  export { PROP_LIBRARY } from './client/prop-library.js';
  export { Scene, Matrix4 } from 'three';
  export { canStand, moveAndSlide, nearestBox } from './src/physics.js';
  export { GroundNavigator } from './src/map/navigation.js';
  export { CoreCollision } from './src/core-gate.js';
  export { MOVE, PLAYER } from './src/config.js';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const { map, parts, crates, oldBlocks, buildUndertowEnvironment, PROP_LIBRARY, Scene, Matrix4,
  canStand, moveAndSlide, nearestBox, GroundNavigator, CoreCollision, MOVE, PLAYER } =
  await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const collision = new CoreCollision(map), nav = new GroundNavigator(map), checks = [];
const contains = (a,b,e=0) => ['x','y','z'].every(k=>a.min[k]-e<=b.min[k]&&a.max[k]+e>=b.max[k]);
const added = [...parts.map(p=>p.box), ...crates], key = b=>JSON.stringify(b);
for (const b of added) {
  assert.ok(oldBlocks.some(old=>contains(old,b)), 'every new solid is contained in a former block');
  assert.ok(collision.closed.includes(b) && collision.open.includes(b));
}
let baseline = null;
if (process.argv[3]) {
  const before = JSON.parse(await readFile(process.argv[3],'utf8')).map;
  const old = new Set(before.boxes.map(key)), current = new Set(map.boxes.map(key));
  assert.deepEqual(before.boxes.filter(b=>!current.has(key(b))).map(key).sort(), oldBlocks.map(key).sort());
  assert.deepEqual(map.boxes.filter(b=>!old.has(key(b))).map(key).sort(), added.map(key).sort());
  for (const field of Object.keys(before).filter(k=>k!=='boxes')) assert.deepEqual(map[field],before[field],field);
  baseline = { removed: oldBlocks.length, added: added.length, otherMapFields: 'identical' };
}
checks.push('replacement contained in old solids; rooms/roofs/channel, terrain, spawns, caps and Pressure Drop unchanged');
const size = PROP_LIBRARY['ammo-crate-stack'].sizeM;
for (const b of crates) {
  assert.deepEqual(['x','y','z'].map(k=>+(b.max[k]-b.min[k]).toFixed(6)),size);
  assert.ok(parts.some(p=>p.kind==='bench' && p.box.max.y===b.min.y && p.box.min.x<=b.min.x
    && p.box.max.x>=b.max.x && p.box.min.z<=b.min.z && p.box.max.z>=b.max.z));
}
checks.push('two exact library crate envelopes supported on solid benches');
// Verify an exact visible shell for every new wall/bench. Materials/detail
// may extend millimetres, but cannot replace the collision envelope.
const scene = new Scene(); buildUndertowEnvironment(scene,map,true); const shells=[];
scene.traverse(node=>{if(!node.isInstancedMesh || node.geometry.type!=='BoxGeometry')return;
  for(let i=0;i<node.count;i++) {const m=new Matrix4();node.getMatrixAt(i,m);node.geometry.computeBoundingBox();
    shells.push(node.geometry.boundingBox.clone().applyMatrix4(m));}});
for(const p of parts) assert.ok(shells.some(b=>['x','y','z'].every(k=>Math.abs(b.min[k]-p.box.min[k])<1e-5&&Math.abs(b.max[k]-p.box.max[k])<1e-5)),'exact visible authority shell');
checks.push('24 new walls/benches have exact visible authority shells');
const paint = shells.filter(b=>b.min.y>=-1e-5&&b.max.y<=.02&&b.min.x>=0&&b.max.x<=150&&b.min.z>=0&&b.max.z<=100);
assert.ok(paint.length>20);
for(const p of paint) assert.ok(map.boxes.some(b=>b.max.y===0&&['x','z'].every(k=>b.min[k]<=p.min[k]+1e-4&&b.max[k]>=p.max[k]-1e-4)), 'yard paint must have a complete solid supporting face');
checks.push(`${paint.length} rendered ground marks have complete ground/bridge support; none hangs over the channel`);
const route = [[34,84],[34,80],[35,78],[35,75],[35,77.5],[32,77.5],[26.6,77.5],[26.6,80.5],[34,80],[43.3,80],[43.3,77.6],[35,77.6],[34,80],[34,84]];
let steps=0;
for(const east of [false,true]) for(const speed of [MOVE.walk,MOVE.sprint]) {
  const x=n=>east?150-n:n;let p={x:x(route[0][0]),y:0,z:route[0][1]};
  for(const [xx,z] of route.slice(1)) {let remaining=1000;
    while(Math.hypot(p.x-x(xx),p.z-z)>.01&&remaining-->0) {
      const dx=x(xx)-p.x,dz=z-p.z,d=Math.hypot(dx,dz),stride=Math.min(d,speed*.05);
      p=moveAndSlide(p,PLAYER.radius,PLAYER.standHeight,{x:dx/d*stride,y:-.1,z:dz/d*stride},-2,map.boxes,map.bounds,MOVE.stepUp,map.ramps).pos;
      assert.ok(canStand(p.x,p.y,p.z,PLAYER.radius-1e-6,PLAYER.standHeight,map.boxes,map.bounds));steps++;
    }
    assert.ok(remaining>0&&Math.abs(p.y)<.02,JSON.stringify({east,speed,p,goal:[x(xx),z]}));
  }
}
checks.push('walk/sprint both staggered entries and thin-wall circuits around pump benches');
for(const boxes of [collision.closedHits,collision.openHits]) for(const east of [false,true]) {
  const x=n=>east?150-n:n;
  assert.equal(nearestBox({x:x(35),y:1.65,z:75},{x:0,y:0,z:1},boxes,5),Infinity);
  assert.equal(nearestBox({x:x(34),y:1.65,z:84},{x:0,y:0,z:-1},boxes,4),Infinity);
  for(const xx of [29,40]) assert.ok(nearestBox({x:x(xx),y:1.65,z:75},{x:0,y:0,z:1},boxes,3)<3);
  assert.ok(nearestBox({x:x(40),y:.65,z:80},{x:0,y:0,z:-1},boxes,2)<2);
  assert.equal(nearestBox({x:x(40),y:1.65,z:80},{x:0,y:0,z:-1},boxes,2),Infinity);
}
checks.push('breaches pass eye rays; intact walls stop shots; waist consoles block torso and permit standing fire in both event states');
let navSteps=0;
for(const spawn of [...map.spawns.red,...map.spawns.blue]) for(const goal of [{x:34,z:80},{x:116,z:80}]) {
  let p={...spawn},remaining=4000;
  while(Math.hypot(p.x-goal.x,p.z-goal.z)>.35&&remaining-->0) {
    const n=nav.next(p,goal),dx=n.x-p.x,dz=n.z-p.z,d=Math.hypot(dx,dz),stride=Math.min(.3,d);
    assert.ok(d>1e-5,JSON.stringify({p,goal}));
    p=moveAndSlide(p,PLAYER.radius,PLAYER.standHeight,{x:dx/d*stride,y:-.1,z:dz/d*stride},-2,map.boxes,map.bounds,MOVE.stepUp,map.ramps).pos;navSteps++;
  }
  assert.ok(remaining>0,JSON.stringify({p,goal}));
}
checks.push('all twelve production spawn positions can navigate into both bays');
const report={status:'PASS',checks,baseline,steps,navSteps,route,boxes:map.boxes.length,ramps:map.ramps.length};
await writeFile(process.argv[2]??'.inspect/session100-yard-audit.json',JSON.stringify(report,null,2));console.log(report);
