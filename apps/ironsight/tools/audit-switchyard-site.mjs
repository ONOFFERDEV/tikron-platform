// Original depot envelopes, edge enclosure, sign visibility and crane clearance.
// node tools/audit-switchyard-site.mjs [output.json] [baseline-map.json]
import { build } from 'esbuild';
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const bundle = await build({stdin:{contents:`
  export { switchyardSiteBoundary, switchyardSiteSupplies, switchyardSiteSigns } from './client/switchyard-site.js';
  export { PROP_LIBRARY } from './client/prop-library.js';
  export { ARENA3 as map } from './src/map/arena3.js';
  export { canStand } from './src/physics.js';
  export { PLAYER } from './src/config.js';
`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const {switchyardSiteBoundary,switchyardSiteSupplies,switchyardSiteSigns,PROP_LIBRARY,map,canStand,PLAYER} =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const {width,depth}=map.bounds, parts=switchyardSiteBoundary(width,depth);
const bounds=p=>({
  minX:p.x-(Math.abs(Math.cos(p.yaw))*p.w+Math.abs(Math.sin(p.yaw))*p.d)/2,
  maxX:p.x+(Math.abs(Math.cos(p.yaw))*p.w+Math.abs(Math.sin(p.yaw))*p.d)/2,
  minZ:p.z-(Math.abs(Math.sin(p.yaw))*p.w+Math.abs(Math.cos(p.yaw))*p.d)/2,
  maxZ:p.z+(Math.abs(Math.sin(p.yaw))*p.w+Math.abs(Math.cos(p.yaw))*p.d)/2,
  minY:p.y-p.h/2,maxY:p.y+p.h/2,
});
const exterior=p=>{const b=bounds(p);return b.maxX<=1e-9||b.minX>=width-1e-9||b.maxZ<=1e-9||b.minZ>=depth-1e-9;};
const contains=(p,x,y,z)=>{
  const dx=x-p.x,dz=z-p.z,c=Math.cos(p.yaw),s=Math.sin(p.yaw);
  return Math.abs(dx*c-dz*s)<=p.w/2+1e-9&&Math.abs(dx*s+dz*c)<=p.d/2+1e-9&&Math.abs(y-p.y)<=p.h/2+1e-9;
};
const overlap=(a,b)=>a.minX<b.maxX-1e-6&&a.maxX>b.minX+1e-6&&a.minY<b.maxY-1e-6&&a.maxY>b.minY+1e-6&&a.minZ<b.maxZ-1e-6&&a.maxZ>b.minZ+1e-6;
// Conservative union of the animated load, spreader, trolley and cables.
const cargo={minX:width+3.8,maxX:width+8.2,minY:0,maxY:19.7,minZ:depth/2-20.2,maxZ:depth/2+20.2};
for(const [i,p] of parts.entries()) {
  assert(Object.values(p).every(Number.isFinite)&&p.w>0&&p.h>0&&p.d>0,`finite part ${i}`);
  assert(Number.isInteger(p.material)&&p.material>=0&&p.material<6,`resident material ${i}`);
  assert(exterior(p),`part intrudes into play ${i}: ${JSON.stringify(p)}`);
  assert(!overlap(bounds(p),cargo),`part intersects hoist sweep ${i}`);
}
let edgeSamples=0;
for(let x=0;x<=width;x+=.5)for(const [z,y] of [[-.5,.8],[depth+.5,1.65]]) {
  assert(parts.some(p=>contains(p,x,y,z)),`north/south edge ${x},${z}`);edgeSamples++;
}
for(let z=0;z<=depth;z+=.5)for(const x of [-.5,width+.5]) {
  assert(parts.some(p=>contains(p,x,1.65,z)),`west/east edge ${x},${z}`);edgeSamples++;
}
// Check overlapping top faces that can cause the earlier coping shimmer.
let topPairs=0;
for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++) {
  const a=parts[i],b=parts[j];
  if(a.yaw||b.yaw||a.material===b.material||Math.abs(a.y+a.h/2-b.y-b.h/2)>1e-6)continue;
  const aa=bounds(a),bb=bounds(b),x0=Math.max(aa.minX,bb.minX),x1=Math.min(aa.maxX,bb.maxX),z0=Math.max(aa.minZ,bb.minZ),z1=Math.min(aa.maxZ,bb.maxZ);
  if(x1-x0<.02||z1-z0<.02)continue;topPairs++;
  for(const u of [.1,.5,.9])for(const v of [.1,.5,.9])assert(parts.some((p,k)=>k!==i&&k!==j&&contains(p,x0+(x1-x0)*u,aa.maxY+.001,z0+(z1-z0)*v)),`exposed coplanar top ${i}/${j}`);
}
const signs=switchyardSiteSigns(width,depth);let signSamples=0;
for(const s of signs) {
  assert(exterior({...s,w:s.width,h:s.width/8,d:0}), 'exterior sign');
  for(const u of [-.49,-.25,0,.25,.49])for(const v of [-.49,0,.49])for(let distance=0;distance<=1;distance+=.1){
    const x=s.x+u*s.width*Math.cos(s.yaw)+distance*Math.sin(s.yaw),z=s.z-u*s.width*Math.sin(s.yaw)+distance*Math.cos(s.yaw),y=s.y+v*s.width/8;
    assert(!parts.some(p=>contains(p,x,y,z)),`sign clipped ${JSON.stringify({s,u,v,distance})}`);signSamples++;
  }
}
const supplies=switchyardSiteSupplies(depth),[w,h,d]=PROP_LIBRARY['ammo-crate-stack'].sizeM;
for(const p of supplies){
  assert(exterior({...p,y:p.y+h/2,w,h,d,yaw:0}),'exterior supply');
  for(const dx of [-w/2,w/2])for(const dz of [-d/2,d/2])assert(parts.some(part=>contains(part,p.x+dx,p.y-.01,p.z+dz)),'supply base supported');
}
const cameras={west:[6,1.65,49,-12,7,49],east:[144,1.65,49,166,8,49],south:[57,1.65,97,45,7,109]};
for(const [name,p] of Object.entries(cameras))assert(canStand(p[0],p[1]-PLAYER.standEye,p[2],PLAYER.radius,PLAYER.standHeight,map.boxes,map.bounds),`standing ${name} camera`);
const mapHash=createHash('sha256').update(JSON.stringify(map)).digest('hex');
if(process.argv[3])assert.equal(mapHash,JSON.parse(await readFile(process.argv[3],'utf8')).hash,'identical collision, ramps, spawns and route metadata');
const report={passed:true,parts:parts.length,triangles:parts.length*12,materials:[...new Set(parts.map(p=>p.material))],edgeSamples,topPairs,exposedTopConflicts:0,signSamples,supplies:supplies.length,supplySizeM:[w,h,d],cargoSweep:cargo,cameras,bounds:map.bounds,boxes:map.boxes.length,ramps:map.ramps.length,mapHash,
  note:'All new geometry is outside the convex playable rectangle. No playable sightline, collider, route or saved-position migration is added. Movement and human visibility are separate checks.'};
await writeFile(process.argv[2]??'.inspect/switchyard-site-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
