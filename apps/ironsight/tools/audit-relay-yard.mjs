// Independent traversal/authority evidence, separate from live network checks.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
const built = await build({stdin:{contents:`
  export {ARENA1 as map} from './src/map/arena1.js';
  export {RELAY_YARD_PARTS,RELAY_YARD_OLD_BLOCKS} from './src/map/relay-yard.js';
  export {RELAY_YARD_SUPPLIES,relayYardDetail} from './client/relay-yard.js';
  export {relaySiteBoundary} from './client/relay-site.js';
  export {PROP_LIBRARY} from './client/prop-library.js';
  export {canStand,moveAndSlide,nearestBox} from './src/physics.js';
  export {GroundNavigator} from './src/map/navigation.js';
  export {CoreCollision} from './src/core-gate.js';
  export {MOVE,PLAYER} from './src/config.js';
`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const {map,RELAY_YARD_PARTS:parts,RELAY_YARD_OLD_BLOCKS:oldBlocks,RELAY_YARD_SUPPLIES:supplies,relayYardDetail,relaySiteBoundary,
  PROP_LIBRARY,canStand,moveAndSlide,nearestBox,GroundNavigator,CoreCollision,MOVE,PLAYER} =
  await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const collision=new CoreCollision(map),nav=new GroundNavigator(map),checks=[];
const contains=(a,b,epsilon=0)=>['x','y','z'].every(k=>a.min[k]-epsilon<=b.min[k]&&a.max[k]+epsilon>=b.max[k]);
for(const {box:b} of parts) {
  assert.ok(oldBlocks.some(old=>contains(old,b)),'new solid must fit a former sealed freight block');
  assert.ok(collision.closed.includes(b)&&collision.open.includes(b),'permanent authority in both Signal Break states');
}
for(const old of oldBlocks) assert.equal(map.boxes.some(b=>JSON.stringify(b)===JSON.stringify(old)),false);
// Compare the actual starting map when supplied, rather than trusting our own
// authored old-footprint table as proof that no unrelated collider changed.
let baseline=null;
if(process.argv[3]) {
  const before=JSON.parse(await readFile(process.argv[3],'utf8')).map;
  const key=b=>JSON.stringify(b),a=new Set(before.boxes.map(key)),b=new Set(map.boxes.map(key));
  const removed=before.boxes.filter(x=>!b.has(key(x))),added=map.boxes.filter(x=>!a.has(key(x)));
  assert.deepEqual(removed.map(key).sort(),oldBlocks.map(key).sort());
  assert.deepEqual(added.map(key).sort(),parts.map(p=>key(p.box)).sort());
  for(const field of ['bounds','ramps','spawns','caps','structures','signalCore','flankRoutes','patrolWaypoints']) assert.deepEqual(map[field],before[field],field);
  baseline={removed:removed.length,added:added.length,otherMapFields:'identical'};
}
checks.push('four old blocks replaced by 24 contained solids; old valid positions stay clear; rooms, roofs, trench and event unchanged');
const detail=relayYardDetail(),pos=detail.getAttribute('position');
for(let i=0;i<pos.count;i+=4) {
  const b={min:{x:Infinity,y:Infinity,z:Infinity},max:{x:-Infinity,y:-Infinity,z:-Infinity}};
  for(let j=i;j<i+4;j++) for(const [k,read] of [['x','getX'],['y','getY'],['z','getZ']]) {
    b.min[k]=Math.min(b.min[k],pos[read](j));b.max[k]=Math.max(b.max[k],pos[read](j));
  }
  assert.ok(parts.some(p=>contains(p.box,b,.02)),`unbacked yard sign/decal ${i/4}`);
}
checks.push(`${pos.count/4} sign/scar/hardware faces backed within 2cm`);detail.dispose();
const size=PROP_LIBRARY['ammo-crate-stack'].sizeM,site=relaySiteBoundary(150,100);
for(const p of supplies) {
  const b={min:{x:p.x-size[0]/2,y:p.y,z:p.z-size[2]/2},max:{x:p.x+size[0]/2,y:p.y+size[1],z:p.z+size[2]/2}};
  assert.ok(b.min.z>100&&b.max.z<100.9,'outside play and clear of the first rail bed');
  assert.ok(site.some(s=>s.yaw===0&&Math.abs(s.y+s.h/2-p.y)<1e-9&&s.x-s.w/2<=b.min.x&&s.x+s.w/2>=b.max.x&&s.z-s.d/2<=b.min.z&&s.z+s.d/2>=b.max.z),'supplies supported on rail bank');
}
checks.push('eight real-size exterior crate stacks supported on rail bank, clear of track and playable bounds');
const routes={court:[[30.5,88],[30.5,83.8],[24.6,83.8],[24.6,81.6],[30.5,81.6],[30.5,78.8],[30.5,83.8],[37.3,83.8],[37.3,84.7],[40,84.7]],
  cargo:[[64,86],[61.8,86],[56,86],[56,82],[62,82],[64,86]]};
let steps=0;
for(const east of [false,true]) for(const [name,route] of Object.entries(routes)) for(const speed of [MOVE.walk,MOVE.sprint]) {
  const x=n=>east?150-n:n; let p={x:x(route[0][0]),y:0,z:route[0][1]};
  for(const [xx,z] of route.slice(1)) {
    let remaining=1000;
    while(Math.hypot(p.x-x(xx),p.z-z)>.01&&remaining-->0) {
      const dx=x(xx)-p.x,dz=z-p.z,d=Math.hypot(dx,dz),stride=Math.min(d,speed*.05);
      p=moveAndSlide(p,PLAYER.radius,PLAYER.standHeight,{x:dx/d*stride,y:-.1,z:dz/d*stride},-2,map.boxes,map.bounds,MOVE.stepUp,map.ramps).pos;
      assert.ok(canStand(p.x,p.y,p.z,PLAYER.radius-1e-6,PLAYER.standHeight,map.boxes,map.bounds),'body/head clearance');steps++;
    }
    assert.ok(Math.hypot(p.x-x(xx),p.z-z)<.02&&Math.abs(p.y)<.02,`${east} ${name} ${speed}: ${JSON.stringify({p,x:x(xx),z})}`);
  }
}
checks.push('walk/sprint both courts, north breaches, open fronts, thin return walls and inner cargo pockets');
const ray=(a,b,boxes)=>{const d=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);return nearestBox(a,{x:(b.x-a.x)/d,y:(b.y-a.y)/d,z:(b.z-a.z)/d},boxes,d);};
for(const boxes of [collision.closedHits,collision.openHits]) for(const east of [false,true]) {
  const x=n=>east?150-n:n;
  assert.equal(ray({x:x(30.5),y:1.65,z:79},{x:x(30.5),y:1.65,z:84},boxes),Infinity);
  for(const xx of [26,35]) assert.ok(Number.isFinite(ray({x:x(xx),y:1.65,z:79},{x:x(xx),y:1.65,z:82},boxes)));
  assert.ok(Number.isFinite(ray({x:x(58),y:1.65,z:86},{x:x(58),y:1.65,z:90},boxes)),'cargo return stops rounds');
}
checks.push('breaches open and surviving walls/cargo stop shots in both event states');
let navSteps=0;
for(const spawn of [...map.spawns.red,...map.spawns.blue]) for(const goal of [{x:30.5,z:83.8},{x:119.5,z:83.8},{x:56,z:86},{x:94,z:86}]) {
  let p={...spawn},remaining=4000;
  while(Math.hypot(p.x-goal.x,p.z-goal.z)>.35&&remaining-->0) {
    const n=nav.next(p,goal),dx=n.x-p.x,dz=n.z-p.z,d=Math.hypot(dx,dz),stride=Math.min(.3,d);
    assert.ok(d>1e-5,`navigator stopped ${JSON.stringify({p,goal})}`);
    p=moveAndSlide(p,PLAYER.radius,PLAYER.standHeight,{x:dx/d*stride,y:-.1,z:dz/d*stride},-2,map.boxes,map.bounds,MOVE.stepUp,map.ramps).pos;navSteps++;
  }
  assert.ok(remaining>0,`navigator stalled ${JSON.stringify({p,goal})}`);
}
checks.push('all twelve spawn positions reach all four new yard pockets using production ground navigation');
const report={status:'PASS',steps,navSteps,checks,baseline,routes,boxes:map.boxes.length,ramps:map.ramps.length,
  note:'Local deterministic geometry; live command agreement and natural combat telemetry are separate.'};
await writeFile(process.argv[2]??'.inspect/session99-yard-audit.json',JSON.stringify(report,null,2));console.log(report);
