// Exact-collision traversal and shot audit. Live network evidence is separate.
import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const built = await build({ stdin: { contents: `
  export { ARENA2 as map } from './src/map/arena2.js';
  export { canStand, moveAndSlide, nearestBox } from './src/physics.js';
  export { CoreCollision } from './src/core-gate.js';
  export { GroundNavigator } from './src/map/navigation.js';
  export { routeFloor } from './src/map/terrain.js';
  export { terrainGeometry, exteriorApronGeometry } from './client/terrain-geometry.js';
  export { MOVE, PLAYER } from './src/config.js';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const { map, canStand, moveAndSlide, nearestBox, CoreCollision, GroundNavigator,
  routeFloor, terrainGeometry, exteriorApronGeometry, MOVE, PLAYER } =
  await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const core = new CoreCollision(map), channel = map.structures.find(s => s.id === 'pump-channel');
assert.equal(map.bounds.floor, -3);
assert.equal(channel.ramps.length, 2);
for (const b of [...channel.parts.map(p => p.box), ...map.terrain.boxes])
  assert.ok(core.closed.includes(b) && core.open.includes(b), 'dynamic event must retain channel collision');
let steps = 0;
const runs = [];
const route = [[32,0,71],[38,-1.5,71],[43,-3,71],[54,-3,72.5],[60,-3,72.5],
  [66,-3,70],[75,-3,71],[84,-3,70],[90,-3,72.5],[96,-3,72.5],[107,-3,71],[112,-1.5,71],[118,0,71]];
for (const east of [false,true]) for (const speed of [MOVE.walk, MOVE.sprint]) {
  const point = ([x,y,z]) => ({ x:east ? 150-x : x, y, z });
  let p = point(route[0]);
  for (const tuple of route.slice(1)) {
    const goal = point(tuple); let remaining = 2000;
    while (Math.hypot(p.x-goal.x,p.z-goal.z) > .01 && remaining-- > 0) {
      const dx=goal.x-p.x,dz=goal.z-p.z,d=Math.hypot(dx,dz),stride=Math.min(speed*.05,d);
      p=moveAndSlide(p,PLAYER.radius,PLAYER.standHeight,{x:dx/d*stride,y:-.1,z:dz/d*stride},-2,
        map.boxes,map.bounds,MOVE.stepUp,map.ramps).pos;
      assert.ok(canStand(p.x,p.y,p.z,PLAYER.radius-1e-6,PLAYER.standHeight,map.boxes,map.bounds),`clearance ${JSON.stringify(p)}`);
      steps++;
    }
    assert.ok(remaining > 0 && Math.abs(p.y-goal.y)<.025,`channel target ${JSON.stringify({p,goal})}`);
  }
  runs.push({east,speed,exit:p});
}
for (const x of [46,75,104]) for (const reverse of [false,true]) {
  let p = {x,y:0,z:reverse?75.5:66};
  for (let i=0;i<40;i++) p=moveAndSlide(p,PLAYER.radius,PLAYER.standHeight,
    {x:0,y:-.1,z:(reverse?-1:1)*9.5/40},-2,map.boxes,map.bounds,MOVE.stepUp,map.ramps).pos;
  assert.ok(Math.abs(p.z-(reverse?66:75.5))<.01 && p.y===0,'yard bridge traversal');
}
const ray = (a,b) => {const d=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);
  return nearestBox(a,{x:(b.x-a.x)/d,y:(b.y-a.y)/d,z:(b.z-a.z)/d},core.closedHits,d);};
assert.equal(ray({x:70,y:-1.35,z:71},{x:80,y:-1.35,z:71}),Infinity,'clear bridge underpass');
for(const target of [{x:75,y:-1.35,z:67},{x:75,y:.5,z:71},{x:75,y:-4,z:71}])
  assert.ok(Number.isFinite(ray({x:75,y:-1.35,z:71},target)),'earth/retaining/bridge blocks shots');
assert.ok(Number.isFinite(ray({x:54,y:-1.35,z:70},{x:60,y:-1.35,z:70})),'pump stops body-height shots');
assert.equal(ray({x:54,y:-1.35,z:72.5},{x:60,y:-1.35,z:72.5}),Infinity,'pump bypass is open');
const nav = new GroundNavigator(map);
let p={x:32,z:71}, navSteps=0;
while(Math.hypot(p.x-118,p.z-71)>.2 && navSteps++<2500) {
  const n=nav.next(p,{x:118,z:71}),d=Math.hypot(n.x-p.x,n.z-p.z),s=Math.min(.15,d);
  assert.ok(d>.00001,`navigation stuck ${JSON.stringify(p)}`);
  p={x:p.x+(n.x-p.x)/d*s,z:p.z+(n.z-p.z)/d*s};
}
assert.ok(navSteps<2500,'connected lower navigation');
// A flat apron must never close the visual excavation. Check every triangle.
const apron=exteriorApronGeometry(map).getAttribute('position');
for(let i=0;i<apron.count;i+=3) {
  const xs=[0,1,2].map(j=>apron.getX(i+j)),zs=[0,1,2].map(j=>apron.getZ(i+j));
  assert.ok(Math.max(...xs)<=0||Math.min(...xs)>=150||Math.max(...zs)<=0||Math.min(...zs)>=100);
}
const floor=terrainGeometry(map).getAttribute('position');
assert.equal([...Array(floor.count).keys()].filter(i=>Math.abs(floor.getY(i)+3.012)<1e-5).length,6);
const report={passed:true,steps,navSteps,runs,boxes:map.boxes.length,
  checks:['walk/sprint both end stairs and pump bypasses','three yard bridges both ways',
    'exact wall/earth/slab/pump hit barriers in both gallery states','connected lower bot navigation',
    'real floor hole; no apron triangles over playable ground'],
  note:'Deterministic geometry checks only. Bots are not assigned a channel visit; live command agreement is measured separately.'};
await writeFile(process.argv[2]??'.inspect/undertow-channel-audit.json',JSON.stringify(report,null,2));
console.log(report);
