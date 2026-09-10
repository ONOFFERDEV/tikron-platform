// Exact shared geometry; the live Worker check separately compares commands.
import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const built = await build({ stdin: { contents: `
  export { ARENA3 as map } from './src/map/arena3.js';
  export { canStand, moveAndSlide, nearestBox } from './src/physics.js';
  export { CoreCollision } from './src/core-gate.js';
  export { GroundNavigator } from './src/map/navigation.js';
  export { terrainGeometry, exteriorApronGeometry } from './client/terrain-geometry.js';
  export { MOVE, PLAYER } from './src/config.js';
  export { SWITCHYARD_CRATES as crates } from './src/map/switchyard-structures.js';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const { map, canStand, moveAndSlide, nearestBox, CoreCollision, GroundNavigator,
  terrainGeometry, exteriorApronGeometry, MOVE, PLAYER, crates } =
  await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const core = new CoreCollision(map), rail = map.structures.find(s => s.id === 'rail-loading-cut');
assert.equal(map.bounds.floor, -3);
assert.equal(rail.ramps.length, 2);
for (const b of [...rail.parts.map(p => p.box), ...map.terrain.boxes, ...crates.filter(b => b.min.y < 0)]) {
  assert.ok(core.closed.includes(b) && core.open.includes(b), 'Cargo Shift must retain the lower route');
  assert.ok(b.max.y <= 0, 'new solids cannot enclose previously valid yard positions');
}
let steps = 0;
const runs = [], route = [[32,0,72],[38,-1.5,72],[43,-3,72],[48,-3,74],[54,-3,74],
  [58,-3,72],[68,-3,72],[75,-3,72],[82,-3,72],[92,-3,74],[102,-3,74],
  [107,-3,72],[112,-1.5,72],[118,0,72]];
const advance = (p, delta) => moveAndSlide(p,PLAYER.radius,PLAYER.standHeight,
  {...delta,y:-.1},-2,map.boxes,map.bounds,MOVE.stepUp,map.ramps).pos;
for (const east of [false,true]) for (const speed of [MOVE.walk, MOVE.sprint]) {
  const point = ([x,y,z]) => ({ x:east ? 150-x : x, y, z });
  let p = point(route[0]);
  for (const tuple of route.slice(1)) {
    const goal = point(tuple); let remaining = 2000;
    while (Math.hypot(p.x-goal.x,p.z-goal.z) > .01 && remaining-- > 0) {
      const dx=goal.x-p.x,dz=goal.z-p.z,d=Math.hypot(dx,dz),stride=Math.min(speed*.05,d);
      p=advance(p,{x:dx/d*stride,z:dz/d*stride});
      assert.ok(canStand(p.x,p.y,p.z,PLAYER.radius-1e-6,PLAYER.standHeight,map.boxes,map.bounds),`clearance ${JSON.stringify(p)}`);
      steps++;
    }
    assert.ok(remaining > 0 && Math.abs(p.y-goal.y)<.025,`rail target ${JSON.stringify({p,goal})}`);
  }
  runs.push({east,speed,exit:p});
}
for (const x of [46,75,104]) for (const reverse of [false,true]) {
  let p = {x,y:0,z:reverse?77.5:66};
  for (let i=0;i<60;i++) p=advance(p,{x:0,z:(reverse?-1:1)*11.5/60});
  assert.ok(Math.abs(p.z-(reverse?66:77.5))<.01 && p.y===0,`yard bridge ${JSON.stringify(p)}`);
}
// Slide along each thin retaining face, below grade, including under a bridge.
for (const z of [68.73,75.27]) {
  let p={x:70,y:-3,z};
  for(let i=0;i<40;i++) p=advance(p,{x:.2,z:0});
  assert.ok(Math.abs(p.x-78)<.01 && p.y===-3,'retaining face traversal');
}
const ray = (a,b) => {const d=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);
  return nearestBox(a,{x:(b.x-a.x)/d,y:(b.y-a.y)/d,z:(b.z-a.z)/d},core.closedHits,d);};
assert.equal(ray({x:70,y:-1.35,z:72},{x:80,y:-1.35,z:72}),Infinity,'clear rail underpass');
for(const target of [{x:75,y:-1.35,z:67},{x:75,y:.5,z:72},{x:75,y:-4,z:72}])
  assert.ok(Number.isFinite(ray({x:75,y:-1.35,z:72},target)),'earth/retaining/bridge blocks shots');
assert.ok(Number.isFinite(ray({x:48,y:-1.35,z:70},{x:54,y:-1.35,z:70})),'cabinet stops body shots');
assert.equal(ray({x:48,y:-1.35,z:74},{x:54,y:-1.35,z:74}),Infinity,'cabinet bypass is open');
const nav = new GroundNavigator(map);
let p={x:26,z:72}, navSteps=0;
while(Math.hypot(p.x-124,p.z-72)>.2 && navSteps++<2500) {
  const n=nav.next(p,{x:124,z:72}),d=Math.hypot(n.x-p.x,n.z-p.z),s=Math.min(.15,d);
  assert.ok(d>.00001,`navigation stuck ${JSON.stringify(p)}`);
  p={x:p.x+(n.x-p.x)/d*s,z:p.z+(n.z-p.z)/d*s};
}
assert.ok(navSteps<2500,'connected lower navigation');
const apron=exteriorApronGeometry(map).getAttribute('position');
for(let i=0;i<apron.count;i+=3) {
  const xs=[0,1,2].map(j=>apron.getX(i+j)),zs=[0,1,2].map(j=>apron.getZ(i+j));
  assert.ok(Math.max(...xs)<=0||Math.min(...xs)>=150||Math.max(...zs)<=0||Math.min(...zs)>=100);
}
const floor=terrainGeometry(map).getAttribute('position');
assert.equal([...Array(floor.count).keys()].filter(i=>Math.abs(floor.getY(i)+3.012)<1e-5).length,6);
for(const eye of [{x:26,y:0,z:72},{x:45,y:-3,z:73.5},{x:75,y:0,z:66}])
  assert.ok(canStand(eye.x,eye.y,eye.z,PLAYER.radius,PLAYER.standHeight,map.boxes,map.bounds),'review camera feet');
const report={passed:true,steps,navSteps,runs,boxes:map.boxes.length,ramps:map.ramps.length,
  checks:['walk/sprint both end ramps and cabinet bypasses','three yard bridges both ways',
    'thin retaining walls','exact earth/slab/cabinet hit barriers in both Cargo Shift states',
    'old valid positions not enclosed','connected lower navigation','real floor hole and exterior apron','standing review cameras'],
  note:'Deterministic geometry only; live command agreement and natural bot visits are measured separately.'};
await writeFile(process.argv[2]??'.inspect/switchyard-rail-audit.json',JSON.stringify(report,null,2));
console.log(report);
