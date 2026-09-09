import { expect,it } from 'vitest';
import * as THREE from 'three';
import { SentryDrone } from '../client/sentry-drone.js';
import { readDrone } from '../client/drone-view.js';
const flights=[0,1].map(team=>({owner:String(team),team,x:8+team*10,y:3.2,z:11,startedAt:1000,endsAt:13000,lock:{point:{x:16,y:1.1,z:11},fireAt:2500}}));
it('rejects malformed drone/lock views, nonfinite fields, invalid times and oversized pools; copies frozen points',()=>{
  const v={queued:false,readyAt:61000,flights};const read=readDrone(v,1600,150,100)!;
  expect(read).toEqual(v);expect(read.flights[0]!.lock!.point).not.toBe(flights[0]!.lock.point);
  for(const bad of [null,{}, {...v,flights:[...flights,...flights]}, {...v,readyAt:NaN},
    {...v,flights:[{...flights[0],x:Infinity}]},{...v,flights:[{...flights[0],endsAt:14000}]},
    {...v,flights:[{...flights[0],lock:{point:{x:2,y:1,z:Infinity},fireAt:2500}}]}])expect(readDrone(bad,1600,150,100)).toBeNull();
});
it('keeps three fixed draws, zero lights/textures and the exact lock point under Reduced motion, then fully drains',()=>{
  const scene=new THREE.Scene(),fx=new SentryDrone(scene),objects:THREE.Object3D[]=[];scene.traverse(o=>objects.push(o));
  fx.update(flights,1800);expect(fx.inspect()).toMatchObject({bodies:2,beams:6,draws:3});
  const beam=objects.find(o=>o.name==='sentry-lock') as THREE.InstancedMesh;
  const before=new THREE.Matrix4(),after=new THREE.Matrix4();beam.getMatrixAt(0,before);
  fx.update(flights,1800,true);beam.getMatrixAt(0,after);expect(after).toEqual(before);
  for(let t=1900;t<14000;t+=33)fx.update(flights,t);
  expect(fx.inspect()).toMatchObject({bodies:0,beams:0,draws:0});
  const final:THREE.Object3D[]=[];scene.traverse(o=>final.push(o));expect(final).toEqual(objects);
  expect(objects.some(o=>o instanceof THREE.Light)).toBe(false);
});
