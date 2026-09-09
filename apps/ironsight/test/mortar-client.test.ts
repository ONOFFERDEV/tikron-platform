import { expect, it } from 'vitest';
import * as THREE from 'three';
import { MortarFx } from '../client/mortar-fx.js';
import { readMortar } from '../client/mortar-view.js';

const strikes=[0,1].map(team=>({owner:String(team),team,x:20+team*10,y:.12,z:11,startedAt:1000,endsAt:6900}));
it('bounds and copies mortar events, rejecting forged times, coordinates, counts and nonfinite values',()=>{
  const v={available:true,readyAt:46000,strikes};
  expect(readMortar(v,1000,150,100)).toEqual(v);
  expect(readMortar(v,1000,150,100)!.strikes[0]).not.toBe(strikes[0]);
  for(const bad of [null,{}, {...v,strikes:[...strikes,...strikes]}, {...v,readyAt:NaN},
    {...v,strikes:[{...strikes[0],x:Infinity}]}, {...v,strikes:[{...strikes[0],endsAt:7000}]}])
    expect(readMortar(bad,1000,150,100)).toBeNull();
});
it('uses at most three fixed draws with no new textures/lights; Reduced motion retains hazard radius and the pool drains',()=>{
  const scene=new THREE.Scene(),fx=new MortarFx(scene), objects:THREE.Object3D[]=[];
  scene.traverse(o=>objects.push(o));
  for(let now=1000;now<8000;now+=25){fx.update(strikes,now);expect(fx.inspect().draws).toBeLessThanOrEqual(3);}
  expect(fx.inspect()).toEqual({rings:0,shells:0,debris:0,draws:0});
  const final:THREE.Object3D[]=[];scene.traverse(o=>final.push(o));expect(final).toEqual(objects);
  expect(objects.some(o=>o instanceof THREE.Light)).toBe(false);
  fx.update(strikes,2500,true);expect(fx.inspect().rings).toBe(2);
  const matrix=new THREE.Matrix4();(objects[1] as THREE.InstancedMesh).getMatrixAt(0,matrix);
  const scale=new THREE.Vector3();matrix.decompose(new THREE.Vector3(),new THREE.Quaternion(),scale);expect(scale.x).toBeCloseTo(6);
  fx.update(strikes,4400,true);expect(fx.inspect().debris).toBe(48);
});
