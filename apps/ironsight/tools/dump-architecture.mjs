// Exports ONLY original procedural geometry; no GLB loader or purchased input.
import { build } from 'esbuild';
import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('.inspect', { recursive: true });
await build({ stdin: { contents: `
import * as T from 'three';
import { buildRelayEnvironment } from './client/relay-environment.js';
import { buildUndertowEnvironment } from './client/undertow-environment.js';
import { buildWedgeGeometry } from './client/site-wedge.js';
import { architectureMeshes } from './client/site-architecture.js';
import { ARENA1 } from './src/map/arena1.js';
import { ARENA2 } from './src/map/arena2.js';
export function dump() {
 const result = {};
 for (const [name, map, build] of [['relay', ARENA1, buildRelayEnvironment], ['undertow', ARENA2, buildUndertowEnvironment]]) {
  const scene = new T.Scene(); build(scene, map, true);
  for (const ramp of map.ramps ?? []) scene.add(new T.Mesh(buildWedgeGeometry(ramp), new T.MeshStandardMaterial({color:0x667a7b,roughness:0.84,side:T.DoubleSide})));
  scene.updateMatrixWorld(true);
  const materials = [], ids = new Map(), meshes = [];
  for (const mesh of architectureMeshes(scene)) {
   const mat = mesh.material;
   if (!ids.has(mat)) { ids.set(mat, materials.length); materials.push({color:mat.color.toArray(),roughness:mat.roughness,metalness:mat.metalness,doubleSide:mat.side===T.DoubleSide}); }
   for (let i=0;i<(mesh.isInstancedMesh ? mesh.count : 1);i++) {
    const matrix = mesh.matrixWorld.clone();
    if (mesh.isInstancedMesh) { const instance = new T.Matrix4(); mesh.getMatrixAt(i,instance); matrix.multiply(instance); }
    const geo=mesh.geometry.clone().applyMatrix4(matrix);
    meshes.push({material:ids.get(mat),positions:Array.from(geo.attributes.position.array),normals:Array.from(geo.attributes.normal.array),indices:geo.index ? Array.from(geo.index.array) : Array.from({length:geo.attributes.position.count},(_,i)=>i)});
    geo.dispose();
   }
  }
  result[name]={materials,meshes};
 }
 return result;
}`, resolveDir: process.cwd() }, bundle: true, platform:'node', format:'esm', outfile:'.inspect/architecture-bundle.mjs' });
const { dump } = await import('../.inspect/architecture-bundle.mjs');
const data = dump();
await writeFile(process.argv[2] ?? '.inspect/architecture.json', JSON.stringify(data));
console.log(Object.fromEntries(Object.entries(data).map(([k,v]) => [k,{parts:v.meshes.length,materials:v.materials.length}])));
