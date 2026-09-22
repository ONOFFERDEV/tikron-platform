import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { deflateSync } from "node:zlib";
import { build } from "esbuild";
import { auditGlb } from "../scripts/ww1-glb-core.mjs";

class EnvironmentBuildError extends Error {
  constructor(code, detail) { super(`${code}: ${detail}`); this.name = "EnvironmentBuildError"; this.code = code; }
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const pad4 = (bytes, fill = 0) => {
  const output = Buffer.alloc(bytes.length + ((4 - bytes.length % 4) % 4), fill); output.set(bytes); return output;
};
const concat = (parts) => Buffer.concat(parts.map((part) => Buffer.from(part.buffer, part.byteOffset, part.byteLength)));

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) { value ^= byte; for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (0xedb88320 & -(value & 1)); }
  return (value ^ 0xffffffff) >>> 0;
}

function pngChunk(name, data) {
  const type = Buffer.from(name); const size = Buffer.alloc(4); size.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([size, type, data, checksum]);
}

function repeatTexture(seed) {
  const width = 512, height = 512, raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1); raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const grain = ((x * 17 + y * 31 + seed * 43) ^ (x * y)) & 31; const offset = row + 1 + x * 4;
      raw[offset] = 88 + grain; raw[offset + 1] = 75 + Math.floor(grain * .7); raw[offset + 2] = 53 + Math.floor(grain * .45); raw[offset + 3] = 255;
    }
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), pngChunk("IHDR", header), pngChunk("IDAT", deflateSync(raw, { level: 9 })), pngChunk("IEND", Buffer.alloc(0))]);
}

function meshBuilder() { return { positions: [], normals: [], uvs: [], indices: [] }; }
function vertex(mesh, position, normal, uv) { mesh.positions.push(...position); mesh.normals.push(...normal); mesh.uvs.push(...uv); return mesh.positions.length / 3 - 1; }
function rotate([x, y, z], rz, ry) {
  const cz = Math.cos(rz), sz = Math.sin(rz), cy = Math.cos(ry), sy = Math.sin(ry);
  const zx = x * cz - y * sz, zy = x * sz + y * cz;
  return [zx * cy + z * sy, zy, -zx * sy + z * cy];
}
function box(mesh, center, size, rz = 0, ry = 0) {
  const faces = [[0,1,2,3,[0,0,-1]],[5,4,7,6,[0,0,1]],[4,0,3,7,[-1,0,0]],[1,5,6,2,[1,0,0]],[3,2,6,7,[0,1,0]],[4,5,1,0,[0,-1,0]]];
  const corners = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]
    .map(([x,y,z]) => rotate([x*size[0]/2,y*size[1]/2,z*size[2]/2],rz,ry).map((value,index)=>value+center[index]));
  for (const [a,b,c,d,n] of faces) { const base = mesh.positions.length/3; const normal=rotate(n,rz,ry); [a,b,c,d].forEach((i,j)=>vertex(mesh,corners[i],normal,[[0,0],[1,0],[1,1],[0,1]][j])); mesh.indices.push(base,base+1,base+2,base,base+2,base+3); }
}
function ellipsoid(mesh, center, radius, rings = 6, sectors = 10) {
  const base=mesh.positions.length/3;
  for(let r=0;r<=rings;r+=1) for(let s=0;s<=sectors;s+=1){const v=r/rings,u=s/sectors,p=Math.PI*v,t=Math.PI*2*u;const n=[Math.sin(p)*Math.cos(t),Math.cos(p),Math.sin(p)*Math.sin(t)];vertex(mesh,n.map((q,i)=>center[i]+q*radius[i]),n,[u,v]);}
  for(let r=0;r<rings;r+=1) for(let s=0;s<sectors;s+=1){const a=base+r*(sectors+1)+s,b=a+sectors+1;mesh.indices.push(a,b,a+1,a+1,b,b+1);}
}
function beam(mesh, start, end, thickness, sides = 8) {
  const dx=end[0]-start[0],dy=end[1]-start[1],dz=end[2]-start[2],length=Math.hypot(dx,dy,dz),w=[dx/length,dy/length,dz/length];
  const seed=Math.abs(w[1])<.9?[0,1,0]:[1,0,0],u=[w[1]*seed[2]-w[2]*seed[1],w[2]*seed[0]-w[0]*seed[2],w[0]*seed[1]-w[1]*seed[0]],ul=Math.hypot(...u),un=u.map(q=>q/ul),v=[w[1]*un[2]-w[2]*un[1],w[2]*un[0]-w[0]*un[2],w[0]*un[1]-w[1]*un[0]],base=mesh.positions.length/3;
  for(let endIndex=0;endIndex<2;endIndex+=1) for(let side=0;side<sides;side+=1){const a=Math.PI*2*side/sides,n=un.map((q,i)=>q*Math.cos(a)+v[i]*Math.sin(a));vertex(mesh,n.map((q,i)=>(endIndex?end:start)[i]+q*thickness/2),n,[side/sides,endIndex]);}
  for(let side=0;side<sides;side+=1){const next=(side+1)%sides,a=base+side,b=base+next,c=base+sides+side,d=base+sides+next;mesh.indices.push(a,c,b,b,c,d);}
}

function recipe(key, detail) {
  const mesh=meshBuilder(), d=Math.max(1,detail);
  if(key==="trench-wall") { box(mesh,[0,1.15,0],[4,2.3,.28]); for(let x=-1.65;x<=1.65;x+=.55) box(mesh,[x,1.15,-.16],[.42,2.25,.11],(x%1.1)*.018); box(mesh,[0,.12,.13],[4,.24,.17]);box(mesh,[0,2.35,0],[4,.1,.45]);if(d>1){beam(mesh,[-1.7,.15,.16],[-1,2.2,.16],.12,6);beam(mesh,[1.7,.15,.16],[1,2.2,.16],.12,6);}if(d>2){for(const x of [-1.65,-.55,.55,1.65])beam(mesh,[x,2.12,-.16],[x,2.12,.16],.05,6);} }
  if(key==="duckboard") { box(mesh,[0,.025,0],[2,.05,.86]); const count=d>2?11:d>1?8:5; for(let i=0;i<count;i+=1){const x=-.9+i*1.8/(count-1);box(mesh,[x,.075,0],[.16,.05,1]);} box(mesh,[0,.035,-.34],[2,.07,.1]);box(mesh,[0,.035,.34],[2,.07,.1]); }
  if(key==="sandbag") { const rows=d>1?3:2,columns=d>2?6:d>1?5:4; for(let row=0;row<rows;row+=1) for(let col=0;col<columns;col+=1){const x=-.82+col*1.64/(columns-1),y=rows===3?.14+row*.22:.14+row*.44;ellipsoid(mesh,[x,y,0],[.18,.14,.31],d>2?6:4,d>2?12:8);} }
  if(key==="timber-brace") { box(mesh,[-1.1,1.2,0],[.2,2.4,.22]);box(mesh,[1.1,1.2,0],[.2,2.4,.22]);box(mesh,[0,2.4,0],[2.4,.2,.22]);if(d>1){beam(mesh,[-1.03,.16,0],[-.35,2.3,0],.12,6);beam(mesh,[1.03,.16,0],[.35,2.3,0],.12,6);}if(d>2){beam(mesh,[-1.15,2.38,-.08],[-1.15,2.38,.08],.05);beam(mesh,[1.15,2.38,-.08],[1.15,2.38,.08],.05);} }
  if(key==="wire") { const posts=d>1?3:2; for(let i=0;i<posts;i+=1){const x=-1.465+i*2.93/(posts-1);beam(mesh,[x,0,0],[x,1.1,0],.07,6);}const strands=d>2?5:d>1?3:2;for(let s=0;s<strands;s+=1){const y=.18+s*.72/(strands-1);for(let i=0;i<12*d;i+=1){const x0=-1.494+i*2.988/(12*d),x1=-1.494+(i+1)*2.988/(12*d);beam(mesh,[x0,y,Math.sin(i*.9+s)*.081],[x1,y,Math.sin((i+1)*.9+s)*.081],.018,5);if(d>2&&i%3===0)beam(mesh,[x0,y-.055,0],[x0,y+.055,0],.012,4);}}box(mesh,[0,.55,-.087],[.03,.03,.006]);box(mesh,[0,.55,.087],[.03,.03,.006]); }
  if(key==="rail-platform") { const sleepers=d>1?9:5;for(let i=0;i<sleepers;i+=1){const x=-1.88+i*3.76/(sleepers-1);box(mesh,[x,.08,0],[.24,.16,2.4]);}for(const z of [-.72,.72]){box(mesh,[0,.2,z],[4,.12,.12]);if(d>1)box(mesh,[0,.295,z],[4,.05,.18]);}if(d>2)for(let i=0;i<8;i+=1)box(mesh,[-1.75+i*.5,.18,0],[.38,.1,.95],(i%2-.5)*.015); }
  if(key==="brick-rubble") { box(mesh,[0,.035,0],[2.4,.07,.65]);const layers=d>2?[7,5,3,1]:d>1?[5,3,1]:[3,1];for(const [row,count] of layers.entries()){for(let i=0;i<count;i+=1){const x=(i-(count-1)/2)*.34,y=.14+row*.145,z=((i+row)%2?-.11:.11);box(mesh,[x,y,z],[.31,.14,.22],(i%3-1)*.06,(row%2-.5)*.08);}}const topRow=layers.length-1,topY=.14+topRow*.145;box(mesh,[0,(topY+.07+.8)/2,0],[.28,.8-(topY+.07),.2],.08);if(d>1){for(let i=0;i<4*d;i+=1){const x=-1.02+i*2.04/(4*d-1),z=((i*11)%7-3)*.065;ellipsoid(mesh,[x,.105,z],[.075,.055,.06],d>2?4:3,d>2?8:6);}} }
  if(key==="field-telephone") { box(mesh,[0,.0825,0],[.28,.165,.22]);box(mesh,[0,.172,-.002],[.255,.014,.19]);for(const x of [-.105,.105])beam(mesh,[x,.176,-.072],[x,.176,.072],.012,6);beam(mesh,[-.09,.204,-.055],[.09,.204,-.055],.03,d>1?8:6);for(const x of [-.105,.105])ellipsoid(mesh,[x,.204,-.055],[.035,.016,.026],d>1?5:3,d>1?8:6);beam(mesh,[.143,.105,.025],[.143,.105,.085],.012,6);ellipsoid(mesh,[.143,.105,.092],[.018,.018,.018],3,6);if(d>1){for(const x of [-.055,.055])ellipsoid(mesh,[x,.185,.075],[.012,.012,.012],3,6);beam(mesh,[-.12,.04,.112],[.12,.04,.112],.008,5);}if(d>2){for(let i=0;i<6;i+=1){const a=i*Math.PI/5;beam(mesh,[.11*Math.cos(a),.025,.112+.035*Math.sin(a)],[.11*Math.cos(a+.3),.025,.112+.035*Math.sin(a+.3)],.006,5);}} }
  if(key==="ammo-crate") { box(mesh,[0,.29,0],[1.12,.56,.56]);box(mesh,[0,.60,0],[1.16,.10,.58]);for(const z of [-.315,.315])box(mesh,[0,.32,z],[1.2,.075,.055]);for(const x of [-.615,.615])box(mesh,[x,.32,0],[.055,.58,.62]);for(const z of [-.335,.335]){beam(mesh,[-.5,.12,z],[.5,.52,z],.035,d>1?7:5);beam(mesh,[-.5,.52,z],[.5,.12,z],.035,d>1?7:5);}if(d>1){for(const x of [-.31,0,.31])box(mesh,[x,.625,0],[.045,.05,.62]);for(const z of [-.20,.20])beam(mesh,[-.645,.34,z],[-.645,.48,z],.025,6);beam(mesh,[-.16,.66,0],[.16,.66,0],.025,7);}if(d>2){for(let i=0;i<5;i+=1)box(mesh,[-.42+i*.21,.595,.345],[.16,.025,.025],(i%2-.5)*.04);}}
  if(key==="supply-wagon") { box(mesh,[0,.72,-.12],[2.55,.18,1.35]);for(const x of [-1.18,1.18])box(mesh,[x,1.18,-.12],[.16,.92,1.35]);box(mesh,[0,1.18,-.72],[2.55,.92,.16]);box(mesh,[0,1.18,.48],[2.55,.92,.16]);for(const z of [-.72,.48])for(let i=0;i<(d>2?7:d>1?5:3);i+=1){const x=-1.05+i*2.1/((d>2?7:d>1?5:3)-1);box(mesh,[x,1.18,z],[.12,.78,.12]);}for(const z of [-.72,.72]){beam(mesh,[-1.62,.55,z],[1.62,.55,z],.11,d>1?8:6);for(const x of [-1.25,1.25]){ellipsoid(mesh,[x,.55,z],[.12,.55,.55],d>2?8:5,d>2?16:10);const spokes=d>2?10:d>1?8:6;for(let i=0;i<spokes;i+=1){const a=i*Math.PI*2/spokes;beam(mesh,[x,.55,z],[x,.55+.46*Math.cos(a),z+.46*Math.sin(a)],.035,6);}}}beam(mesh,[0,.62,.55],[0,.46,1.9],.12,d>1?8:6);beam(mesh,[-.52,.62,.55],[0,.46,1.9],.09,d>1?8:6);beam(mesh,[.52,.62,.55],[0,.46,1.9],.09,d>1?8:6);if(d>1){for(const x of [-.82,0,.82])box(mesh,[x,.83,-.12],[.08,.08,1.15]);}if(d>2){for(const x of [-1.18,1.18])for(const y of [.82,1.18,1.54])ellipsoid(mesh,[x,y,.57],[.055,.055,.035],4,8);}}
  if(key==="observation-post") { box(mesh,[0,.1,0],[2.4,.2,2.4]);box(mesh,[-1.06,1.55,0],[.28,2.7,2.4]);box(mesh,[1.06,1.55,0],[.28,2.7,2.4]);box(mesh,[0,1.55,-1.06],[2.4,2.7,.28]);for(const x of [-1.08,1.08])for(const z of [-1.08,1.08])beam(mesh,[x,.18,z],[x,3.12,z],.15,d>1?8:6);box(mesh,[0,3.25,0],[2.4,.3,2.4]);box(mesh,[0,2.24,1.12],[2.4,.72,.16]);box(mesh,[0,.9,1.12],[2.4,1.8,.16]);for(const x of [-1.04,1.04])box(mesh,[x,1.72,1.13],[.22,1.05,.18]);const bags=d>2?7:d>1?5:3;for(let i=0;i<bags;i+=1){const x=-1.02+i*2.04/(bags-1);ellipsoid(mesh,[x,2.69,1.10],[.18,.12,.28],d>2?5:4,d>2?10:8);}if(d>1){for(const x of [-.78,0,.78])beam(mesh,[x,.2,-1.08],[x,3.1,-1.08],.11,6);box(mesh,[0,2.94,-1.1],[2.2,.12,.16]);}if(d>2){beam(mesh,[-1.18,.2,-.6],[-.65,3.08,-.6],.1,7);beam(mesh,[1.18,.2,-.6],[.65,3.08,-.6],.1,7);} }
  if(key==="freight-wagon-wreck") { box(mesh,[0,.43,0],[7.4,.22,1.45],0,.018);box(mesh,[0,.61,0],[6.7,.16,1.75],0,-.012);for(const x of [-2.35,2.35]){beam(mesh,[x,.45,-1.12],[x,.45,1.12],.12,d>1?8:6);for(const z of [-1.1,1.1])ellipsoid(mesh,[x,.45,z],[.38,.45,.25],d>1?6:4,d>2?12:8);}for(const x of [-3.35,3.35])beam(mesh,[x,.57,-.7],[x,1.45,.7],.13,d>1?8:6);beam(mesh,[-3.62,.58,0],[-2.4,1.75,.25],.16,d>1?8:6);beam(mesh,[3.62,.58,0],[2.55,2.7,-.2],.16,d>1?8:6);box(mesh,[2.55,2.7,-.2],[.2,.2,.35],.18);const planks=d>2?11:d>1?7:4;for(let i=0;i<planks;i+=1){const x=-2.9+i*5.8/(planks-1),y=.82+(i%3)*.14,z=(i%2?-.52:.52);box(mesh,[x,y,z],[.48,.09,.82],(i%4-1.5)*.12,(i%3-1)*.08);}if(d>1){beam(mesh,[-2.9,.65,-1.18],[2.9,.95,-.95],.08,6);beam(mesh,[-2.9,.7,1.18],[2.7,1.15,.98],.08,6);}if(d>2){for(const x of [-1.8,0,1.8])beam(mesh,[x,.65,-.8],[x+.35,1.5,.65],.07,6);} }
  if(key==="biplane") { box(mesh,[0,1.15,.2],[.75,.72,4.4],0,0);box(mesh,[0,1.18,-2.55],[.48,.5,1.1],0,0);box(mesh,[0,1.72,.1],[9.2,.16,1.25],0,0);box(mesh,[0,.72,.15],[8.4,.16,1.2],0,0);box(mesh,[0,1.45,-2.65],[3.1,.1,.7],0,0);box(mesh,[0,1.95,-2.8],[.12,1.6,.8]);for(const x of [-2.7,-.9,.9,2.7]){beam(mesh,[x,.8,-.3],[x,1.65,.35],.07,6);beam(mesh,[x,.8,.35],[x,1.65,-.3],.07,6);}beam(mesh,[0,1.15,2.25],[0,1.15,3.17],.18,8);box(mesh,[0,1.15,3.13],[2.1,.11,.14],.18);if(d>1){for(const x of [-.72,.72]){beam(mesh,[x,.78,.05],[x,.26,.35],.08,7);ellipsoid(mesh,[x,.26,.38],[.26,.26,.08],6,10);}}if(d>2)ellipsoid(mesh,[0,1.58,.55],[.42,.24,.58],6,10);for(let i=1;i<mesh.positions.length;i+=3)mesh.positions[i]-=1.375; }
  return mesh;
}

function biplaneMarkings(detail) { const mesh=meshBuilder(); for(const x of [-3.3,3.3])ellipsoid(mesh,[x,.445,.1],[.38,.025,.38],detail>2?5:3,detail>1?12:8); return mesh; }

function accessorData(mesh) {
  const positions=new Float32Array(mesh.positions),normals=new Float32Array(mesh.normals),uvs=new Float32Array(mesh.uvs),max=Math.max(...mesh.indices),indices=max<65536?new Uint16Array(mesh.indices):new Uint32Array(mesh.indices);
  return { positions,normals,uvs,indices,indexComponent:max<65536?5123:5125,triangles:indices.length/3 };
}

const FITTED_AUTHORED_KEYS = new Set(["brick-rubble", "field-telephone", "ammo-crate", "supply-wagon", "observation-post", "freight-wagon-wreck"]);
function fitAuthoredBounds(mesh, dimensions, origin) {
  const minimum=[Infinity,Infinity,Infinity],maximum=[-Infinity,-Infinity,-Infinity];
  for(let index=0;index<mesh.positions.length;index+=3)for(let axis=0;axis<3;axis+=1){minimum[axis]=Math.min(minimum[axis],mesh.positions[index+axis]);maximum[axis]=Math.max(maximum[axis],mesh.positions[index+axis]);}
  const targetMinimum=origin==="centre-of-mass"?dimensions.map(value=>-value/2):[-dimensions[0]/2,0,-dimensions[2]/2];
  for(let index=0;index<mesh.positions.length;index+=3)for(let axis=0;axis<3;axis+=1){const span=maximum[axis]-minimum[axis];mesh.positions[index+axis]=targetMinimum[axis]+(mesh.positions[index+axis]-minimum[axis])*dimensions[axis]/span;}
  return mesh;
}

function glbFor(asset, seed) {
  const lodData=[3,2,1].map(detail=>{const built=recipe(asset.key,detail),base=FITTED_AUTHORED_KEYS.has(asset.key)?fitAuthoredBounds(built,asset.dimensionsM,asset.origin):built;return {base:accessorData(base),mark:asset.key==="biplane"?accessorData(biplaneMarkings(detail)):null};}),texture=repeatTexture(seed),chunks=[],views=[],accessors=[];
  const push=(bytes,target) => {const offset=chunks.reduce((sum,item)=>sum+item.length,0),padded=pad4(Buffer.from(bytes.buffer??bytes,bytes.byteOffset??0,bytes.byteLength??bytes.length));chunks.push(padded);views.push({buffer:0,byteOffset:offset,byteLength:bytes.byteLength??bytes.length,...(target?{target}:{})});return views.length-1;};
  const primitive=(data,material,variant=false)=>{const start=accessors.length,positionView=push(data.positions,34962),normalView=push(data.normals,34962),uvView=push(data.uvs,34962),indexView=push(data.indices,34963),count=data.positions.length/3;accessors.push({bufferView:positionView,componentType:5126,count,type:"VEC3"},{bufferView:normalView,componentType:5126,count,type:"VEC3"},{bufferView:uvView,componentType:5126,count,type:"VEC2"},{bufferView:indexView,componentType:data.indexComponent,count:data.indices.length,type:"SCALAR"});return {attributes:{POSITION:start,NORMAL:start+1,TEXCOORD_0:start+2},indices:start+3,material,mode:4,...(variant?{extensions:{KHR_materials_variants:{mappings:[{material:1,variants:[0]},{material:2,variants:[1]}]}}}:{})};};
  const meshes=lodData.map((data,index)=>({name:`${asset.key}_${asset.lods[index]}`,primitives:[primitive(data.base,0),...(data.mark?[primitive(data.mark,1,true)]:[])]})),imageView=push(texture);
  const nodes=[{name:asset.key,children:[1,...asset.joints?Object.keys(asset.joints).map((_,i)=>4+i):[]]},{name:"LOD0",mesh:0,extensions:{MSFT_lod:{ids:[2,3]}}},{name:"LOD1",mesh:1},{name:"LOD2",mesh:2},...Object.entries(asset.joints).map(([name,translation])=>({name,translation})),...(asset.key==="biplane"?[{name:"Faction_Khaki",extras:{variant:"khaki"}},{name:"Faction_Fieldgrey",extras:{variant:"fieldgrey"}}]:[])];
  const document={asset:{version:"2.0",generator:"Ironsight WW1 authored environment builder"},scene:0,scenes:[{nodes:[0]}],nodes,meshes,buffers:[{byteLength:chunks.reduce((sum,item)=>sum+item.length,0)}],bufferViews:views,accessors,materials:[{name:"WW1_Runtime_Repeat",pbrMetallicRoughness:{baseColorTexture:{index:0},roughnessFactor:.82,metallicFactor:asset.surfaces.includes("metal")?.25:0},extras:{surfaces:asset.surfaces}},{name:"Faction_Khaki_Marking",pbrMetallicRoughness:{baseColorFactor:[.55,.42,.18,1],roughnessFactor:.78}},{name:"Faction_Fieldgrey_Marking",pbrMetallicRoughness:{baseColorFactor:[.22,.3,.34,1],roughnessFactor:.78}}],textures:[{sampler:0,source:0}],samplers:[{wrapS:10497,wrapT:10497,minFilter:9987,magFilter:9729}],images:[{name:`${asset.key}_repeat_512`,mimeType:"image/png",bufferView:imageView}],extensionsUsed:["MSFT_lod",...(asset.key==="biplane"?["KHR_materials_variants"]:[])],...(asset.key==="biplane"?{extensions:{KHR_materials_variants:{variants:[{name:"khaki"},{name:"fieldgrey"}]}}}:{}),extras:{coordinateSystem:{units:"metres",up:"+Y",forward:"+Z"},dimensionsM:asset.dimensionsM,origin:asset.origin,textureResolution:[512,512],lodTriangles:lodData.map(data=>data.base.triangles+(data.mark?.triangles??0)),factionVariants:asset.factionVariants??[]}};
  const json=pad4(Buffer.from(JSON.stringify(document)),0x20),binary=concat(chunks),output=Buffer.alloc(12+8+json.length+8+binary.length);output.writeUInt32LE(0x46546c67);output.writeUInt32LE(2,4);output.writeUInt32LE(output.length,8);output.writeUInt32LE(json.length,12);output.writeUInt32LE(0x4e4f534a,16);json.copy(output,20);const binaryHeader=20+json.length;output.writeUInt32LE(binary.length,binaryHeader);output.writeUInt32LE(0x004e4942,binaryHeader+4);binary.copy(output,binaryHeader+8);return {bytes:output,lodTriangles:document.extras.lodTriangles};
}

async function loadManifest() {
  const source=resolve("config/ww1-environment.ts"),temporary=resolve(dirname(source),`.ww1-environment-${process.pid}.mjs`);
  try{await build({entryPoints:[source],outfile:temporary,bundle:true,platform:"node",format:"esm",logLevel:"silent"});return (await import(`${pathToFileURL(temporary).href}?v=${Date.now()}`)).WW1_ENVIRONMENT_MANIFEST;}finally{await rm(temporary,{force:true});}
}
function argsOf(argv){const parsed={build:false,audit:false,assetRoot:resolve("public/assets/ww1")};for(let i=0;i<argv.length;i+=1){const token=argv[i];if(token==="--build"||token==="--audit"){parsed[token.slice(2)]=true;continue;}const value=argv[i+1];if((token==="--out"||token==="--asset-root")&&value){parsed[token==="--out"?"out":"assetRoot"]=isAbsolute(value)?value:resolve(value);i+=1;continue;}throw new EnvironmentBuildError("invalid_argument",token);}if(!parsed.build&&!parsed.audit)throw new EnvironmentBuildError("usage","use --build and/or --audit");if(parsed.audit&&!parsed.out)throw new EnvironmentBuildError("usage","--audit requires --out");return parsed;}
function localPath(root,asset){return resolve(root,asset.key==="biplane"?"support":"environment",`${asset.key}.glb`);}
const authoredSeed = key => ({"trench-wall":1,duckboard:2,sandbag:3,"timber-brace":4,wire:5,"rail-platform":6,biplane:7,"brick-rubble":8,"field-telephone":9,"ammo-crate":10,"observation-post":11,"freight-wagon-wreck":12,"supply-wagon":13})[key];
async function buildAssets(manifest,root){for(const asset of manifest.assets.filter(a=>a.provenance.status==="authored")){const seed=authoredSeed(asset.key);if(seed===undefined)throw new EnvironmentBuildError("missing_seed",asset.key);const output=glbFor(asset,seed),path=localPath(root,asset),hash=sha256(output.bytes),recipeVersion=seed<=7?1:2;await mkdir(dirname(path),{recursive:true});await writeFile(path,output.bytes);await writeFile(path.replace(/\.glb$/,".meta.json"),`${JSON.stringify({schemaVersion:1,key:asset.key,sha256:hash,dimensionsM:asset.dimensionsM,coordinateSystem:manifest.coordinateSystem,origin:asset.origin,lods:asset.lods,lodTriangles:output.lodTriangles,joints:asset.joints,surfaces:asset.surfaces,collision:asset.collision,maxCladdingOffsetM:asset.maxCladdingOffsetM,texture:{width:512,height:512,wrap:"repeat"},source:{kind:"original-authored",generator:"tools/build-ww1-environment.mjs",recipeVersion},provenance:asset.provenance,factionVariants:asset.factionVariants??[],pilotable:asset.pilotable??null,presentation:asset.presentation??[]},null,2)}\n`);}}
async function auditAssets(manifest,root){const files=[];for(const asset of manifest.assets.filter(a=>a.provenance.status==="authored")){const path=localPath(root,asset);try{const bytes=await readFile(path),common=auditGlb(bytes,{role:"environment",assetKey:asset.key}),metadata=JSON.parse(await readFile(path.replace(/\.glb$/,".meta.json"),"utf8")),issues=[...common.issues],jsonLength=bytes.readUInt32LE(12),document=JSON.parse(bytes.subarray(20,20+jsonLength).toString("utf8").trim()),names=new Set((document.nodes??[]).map(node=>node.name)),bounds=common.metrics?.bounds,size=bounds?.max.map((value,index)=>value-bounds.min[index]);if(metadata.sha256!==common.sha256)issues.push({code:"metadata_hash",path});if(asset.provenance.outputSha256!==common.sha256||metadata.provenance?.outputSha256!==common.sha256)issues.push({code:"provenance_hash",path});for(const field of ["dimensionsM","joints","surfaces","collision","maxCladdingOffsetM"])if(JSON.stringify(metadata[field])!==JSON.stringify(asset[field]))issues.push({code:`metadata_${field}`,path});if(!size||size.some((value,index)=>Math.abs(value-asset.dimensionsM[index])>.005))issues.push({code:"geometry_dimensions",path,detail:{expected:asset.dimensionsM,actual:size}});if(bounds){const expectedMin=asset.origin==="centre-of-mass"?asset.dimensionsM.map(value=>-value/2):[-asset.dimensionsM[0]/2,0,-asset.dimensionsM[2]/2];if(bounds.min.some((value,index)=>Math.abs(value-expectedMin[index])>.005))issues.push({code:"geometry_origin",path,detail:{origin:asset.origin,min:bounds.min}});}for(const name of [asset.key,...asset.lods,...Object.keys(asset.joints)])if(!names.has(name))issues.push({code:"missing_node",path,detail:name});const image=document.images?.[0],imageView=image&&document.bufferViews?.[image.bufferView],imageStart=20+jsonLength+8+(imageView?.byteOffset??0);if(!imageView||bytes.readUInt32BE(imageStart+16)!==512||bytes.readUInt32BE(imageStart+20)!==512)issues.push({code:"texture_dimensions",path});const sampler=document.samplers?.[0],materialSurfaces=document.materials?.[0]?.extras?.surfaces;if(sampler?.wrapS!==10497||sampler?.wrapT!==10497||JSON.stringify(materialSurfaces)!==JSON.stringify(asset.surfaces))issues.push({code:"surface_material",path});if(asset.key==="biplane"){for(const name of ["Faction_Khaki","Faction_Fieldgrey"])if(!names.has(name))issues.push({code:"missing_faction_variant",path,detail:name});const variants=document.extensions?.KHR_materials_variants?.variants,mappings=document.meshes?.[0]?.primitives?.[1]?.extensions?.KHR_materials_variants?.mappings;if(JSON.stringify(variants)!==JSON.stringify([{name:"khaki"},{name:"fieldgrey"}])||!Array.isArray(mappings)||mappings.length!==2)issues.push({code:"invalid_faction_variants",path});}const lod=metadata.lodTriangles;if(!Array.isArray(lod)||!(lod[0]>lod[1]&&lod[1]>lod[2]&&lod[2]>0)||lod.some((value,index)=>value>asset.triangleBudget[index]))issues.push({code:"lod_order_or_budget",path});files.push({key:asset.key,path,valid:issues.length===0,sha256:common.sha256,bytes:bytes.length,triangles:common.metrics?.triangles??0,bounds,lodTriangles:lod,issues});}catch(error){files.push({key:asset.key,path,valid:false,sha256:null,bytes:0,triangles:0,issues:[{code:"input_read",path,detail:error instanceof Error?error.message:String(error)}]});}}return files;}
async function main(){const options=argsOf(process.argv.slice(2)),manifest=await loadManifest();if(options.build)await buildAssets(manifest,options.assetRoot);if(options.audit){const files=await auditAssets(manifest,options.assetRoot),generated=manifest.assets.filter(a=>a.provenance.status!=="authored"),outstanding=[...generated.map(a=>a.key),"aside:environment-kit"],localValid=files.every(file=>file.valid),report={schemaVersion:1,verdict:"UNQUALIFIED",localValid,releaseQualified:false,coordinateSystem:manifest.coordinateSystem,files,outstanding,reason:"Generated candidates and Aside visual acceptance are not yet qualified."};await mkdir(dirname(options.out),{recursive:true});await writeFile(options.out,`${JSON.stringify(report,null,2)}\n`);process.stdout.write(`${JSON.stringify({report:options.out,localValid,releaseQualified:false,files:files.length,outstanding:outstanding.length})}\n`);if(!localValid)process.exitCode=1;}}
await main().catch(error=>{process.stderr.write(`${error instanceof Error?error.message:String(error)}\n`);process.exitCode=2;});
