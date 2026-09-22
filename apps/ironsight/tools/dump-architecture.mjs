// Exports ONLY original procedural geometry; no GLB loader or purchased input.
import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
const bundle = await build({ stdin: { contents: `
import * as T from 'three';
import { buildRelayEnvironment } from './client/relay-environment.js';
import { buildUndertowEnvironment } from './client/undertow-environment.js';
import { buildSwitchyardEnvironment } from './client/switchyard-environment.js';
import { buildWedgeGeometry } from './client/site-wedge.js';
import { architectureMeshes, assertVisualScene, assertVisualSolids, mapVisualResourceTable, visualSolidPlan } from './client/site-architecture.js';
import { ARENA1 } from './src/map/arena1.js';
import { ARENA2 } from './src/map/arena2.js';
import { ARENA3 } from './src/map/arena3.js';
export function dump() {
 const result = {};
 for (const [name, map, build] of [['relay', ARENA1, buildRelayEnvironment], ['undertow', ARENA2, buildUndertowEnvironment], ['switchyard', ARENA3, buildSwitchyardEnvironment]]) {
  const scene = new T.Scene(); build(scene, map, true);
  const visualSolids = visualSolidPlan(map);
  assertVisualSolids(map, visualSolids);
  const rampMaterial = new T.MeshStandardMaterial({color:0x667a7b,roughness:0.84,side:T.DoubleSide});
  for (const ramp of map.ramps ?? []) scene.add(new T.Mesh(buildWedgeGeometry(ramp), rampMaterial));
  scene.updateMatrixWorld(true);
  const sceneAudit = assertVisualScene(map, scene);
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
  result[name]={
    materials,
    meshes,
    bounds:map.bounds,
    resourceTable:mapVisualResourceTable(map),
    sceneAudit,
    visualSolids:visualSolids.map(({id,kind,surface,claddingOffsetM}) => ({id,kind,surface,claddingOffsetM})),
    terrainFaces:(map.terrain?.faces ?? [{minX:0,maxX:map.bounds.width,minZ:0,maxZ:map.bounds.depth,y:0}]),
  };
 }
 return result;
}`, resolveDir: process.cwd() }, bundle: true, platform:'node', format:'esm', write:false, logLevel:'silent' });
const { dump } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const all = dump();
const data = process.argv[3] ? { [process.argv[3]]: all[process.argv[3]] } : all;
await writeFile(process.argv[2] ?? '.inspect/architecture.json', JSON.stringify(data));
console.log(Object.fromEntries(Object.entries(data).map(([k,v]) => [k,{parts:v.meshes.length,materials:v.materials.length}])));
