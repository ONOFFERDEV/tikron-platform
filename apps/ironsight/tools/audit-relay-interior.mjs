// Independent physical-backing and atlas checks; no browser or gameplay mutation.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const built = await build({ stdin: { contents: `
  export { ARENA1 as map } from './src/map/arena1.js';
  export { relayInteriorFaces, relayInteriorDetail } from './client/relay-interior-detail.js';
  export { ATLAS_W, ATLAS_H, tiles } from './client/relay-service-geometry.js';
  export { FIELDWORKS_ATLAS, relaySandbagGeometry, relayDamageGeometry } from './client/relay-fieldworks.js';
  export { canStand } from './src/physics.js'; export { PLAYER } from './src/config.js';
  export * as T from 'three';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const { map, relayInteriorFaces, relayInteriorDetail, ATLAS_W, ATLAS_H, tiles, FIELDWORKS_ATLAS,
  relaySandbagGeometry, relayDamageGeometry, canStand, PLAYER, T } =
  await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const faces = relayInteriorFaces(map), geometry = relayInteriorDetail(map);
const pos = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
const solids = map.boxes.map(b => new T.Box3(new T.Vector3(b.min.x,b.min.y,b.min.z),new T.Vector3(b.max.x,b.max.y,b.max.z)));
for (let i=0;i<pos.count;i+=4) {
  const bounds = new T.Box3();
  for(let j=0;j<4;j++) bounds.expandByPoint(new T.Vector3().fromBufferAttribute(pos,i+j));
  const n = new T.Vector3().fromBufferAttribute(normal,i);
  // The entire face, pushed inward 2cm, must be inside one authoritative solid.
  // Stronger than near-vertex checks: catches a panel spanning a doorway.
  const inward = bounds.clone().translate(n.multiplyScalar(-.02));
  assert(solids.some(b=>b.clone().expandByScalar(.00001).containsBox(inward)),`unsupported face ${i/4}: ${JSON.stringify(faces[i/4])}`);
}
assert.equal(geometry.groups.length,0);
const allTiles = [...Object.entries(tiles), ...Object.entries(FIELDWORKS_ATLAS)];
for(const [name,a]of allTiles) {
  assert(a[0]>=0&&a[1]>=0&&a[0]+a[2]<=ATLAS_W&&a[1]+a[3]<=ATLAS_H,name+' bounds');
  for(const [other,b]of allTiles) if(name<other)
    assert(a[0]+a[2]<=b[0]||b[0]+b[2]<=a[0]||a[1]+a[3]<=b[1]||b[1]+b[3]<=a[1],name+' overlaps '+other);
}
for(const v of geometry.getAttribute('uv').array) assert(Number.isFinite(v)&&v>0&&v<1);
// Generated sack vertices still address the original 512px source tile after
// atlas expansion. This fixture checks real helper output, not duplicated UV math.
const model=new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial());
const sacks=relaySandbagGeometry(model,150,[ATLAS_W,ATLAS_H]), sackUV=sacks.getAttribute('uv');
for(let i=0;i<sackUV.count;i++) {
  assert(sackUV.getX(i)*ATLAS_W>=512&&sackUV.getX(i)*ATLAS_W<=1024);
  assert(sackUV.getY(i)*ATLAS_H>=512&&sackUV.getY(i)*ATLAS_H<=1024);
}
const damage=relayDamageGeometry(map).getAttribute('uv');
for(let i=0;i<damage.count;i++) assert(damage.getX(i)*ATLAS_W<512,'damage retains left column');
const cameras={west:[41,1.65,42,47,1.5,35],east:[109,1.65,42,103,1.5,35],door:[45,1.65,37,45,1.65,46]};
for(const [name,p]of Object.entries(cameras)) assert(canStand(p[0],0,p[2],PLAYER.radius,PLAYER.standHeight,map.boxes,map.bounds),name+' valid standing camera');
assert(canStand(50.3,0,38,PLAYER.radius,PLAYER.standHeight,map.boxes,map.bounds),'operator fixture');
let baselineIdentical=null;
if(process.argv[3]) {
  assert.deepEqual(JSON.parse(JSON.stringify(map)),JSON.parse(await readFile(process.argv[3],'utf8')).map);
  baselineIdentical=true;
}
const result={status:'PASS',faces:faces.length,triangles:geometry.index.count/3,solidBacked:true,
  atlas:[ATLAS_W,ATLAS_H],residentTextureDeltaMiB:(ATLAS_W*ATLAS_H-1024*1024)*4*4/3/1048576,
  baselineIdentical,mapSha256:createHash('sha256').update(JSON.stringify(map)).digest('hex'),cameras};
if(process.argv[2]) await writeFile(process.argv[2],JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
