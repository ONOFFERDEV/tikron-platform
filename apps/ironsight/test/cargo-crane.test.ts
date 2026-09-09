import {expect,it} from 'vitest';
import * as T from 'three';
import {CargoCrane} from '../client/cargo-crane.js';
import {signalFrame} from '../src/signal-event.js';
import {buildSwitchyardEnvironment} from '../client/switchyard-environment.js';
import {ARENA3} from '../src/map/arena3.js';

it('keeps the complete hoist outside play throughout both transfer directions with fixed GPU resources',()=>{
  const scene=new T.Scene(), crane=new CargoCrane(scene,150,100);
  const objects:T.Object3D[]=[];scene.traverse(o=>objects.push(o));
  const meshes=objects.filter((o):o is T.Mesh=>o instanceof T.Mesh);
  const geometry=meshes.map(m=>m.geometry),materials=meshes.map(m=>m.material);
  const matrix=new T.Matrix4(),bounds=new T.Box3();
  for(let age=-1000;age<=180000;age+=250) {
    crane.update(signalFrame(1000,'live',1000+age));scene.updateMatrixWorld(true);
    for(const mesh of meshes) {
      mesh.geometry.computeBoundingBox();
      if(mesh instanceof T.InstancedMesh)for(let i=0;i<mesh.count;i++) {
        mesh.getMatrixAt(i,matrix);matrix.premultiply(mesh.matrixWorld);
        bounds.copy(mesh.geometry.boundingBox!).applyMatrix4(matrix);
        expect(bounds.min.x).toBeGreaterThan(153);
        expect(bounds.min.y).toBeGreaterThan(3.9);
      } else {
        bounds.setFromObject(mesh);expect(bounds.min.x).toBeGreaterThan(153);
        expect(bounds.min.y).toBeGreaterThan(3.9);
      }
      expect(mesh.castShadow).toBe(false);
    }
  }
  const final:T.Object3D[]=[];scene.traverse(o=>final.push(o));
  expect(final).toEqual(objects);expect(meshes.map(m=>m.geometry)).toEqual(geometry);
  expect(meshes.map(m=>m.material)).toEqual(materials);
  expect(meshes).toHaveLength(4);expect(objects.some(o=>o instanceof T.Light)).toBe(false);
});

it('lifts before carrying, lowers at the destination and seeks the same pose on a late join',()=>{
  const crane=new CargoCrane(new T.Scene(),150,100);
  const seek=(age:number)=>{crane.update(signalFrame(1000,'live',1000+age));return crane.inspect();};
  expect(seek(-1)).toMatchObject({berth:-14,lift:0,playableRoute:false});
  expect(seek(7999)).toMatchObject({berth:-14,lift:0,phase:'warning'});
  expect(seek(11000)).toMatchObject({berth:-14,lift:8});
  expect(seek(15500)).toMatchObject({berth:0,lift:8});
  expect(seek(20000)).toMatchObject({berth:14,lift:8});
  expect(seek(23000)).toMatchObject({berth:14,lift:0,phase:'recovery'});
  expect(seek(90000)).toMatchObject({berth:14,lift:0,phase:'warning'});
  expect(seek(113000)).toMatchObject({berth:-14,lift:0});
  const late=new CargoCrane(new T.Scene(),150,100);
  for(let age=0;age<=15500;age+=50)seek(age);
  late.update(signalFrame(1000,'live',16500));expect(late.inspect()).toEqual(crane.inspect());
  late.update(signalFrame(1000,'ended',16500));expect(late.inspect()).toMatchObject({phase:'idle',berth:-14,lift:0});
});

it('clears every permanent exterior structure throughout the cargo sweep',()=>{
  const scene=new T.Scene(), crane=new CargoCrane(scene,150,100), environment=new T.Scene();
  buildSwitchyardEnvironment(environment,ARENA3,true);environment.updateMatrixWorld(true);
  const obstacles:T.Box3[]=[],matrix=new T.Matrix4();
  environment.traverse(object=>{
    if(!(object instanceof T.InstancedMesh)||!object.name.startsWith('switchyard-exterior'))return;
    object.geometry.computeBoundingBox();
    for(let i=0;i<object.count;i++) {
      object.getMatrixAt(i,matrix);matrix.premultiply(object.matrixWorld);
      obstacles.push(object.geometry.boundingBox!.clone().applyMatrix4(matrix));
    }
  });
  expect(obstacles.length).toBeGreaterThan(100);
  const cargo=scene.getObjectByName('cargo-module')!,bounds=new T.Box3();
  for(let age=0;age<=120000;age+=250) {
    crane.update(signalFrame(1000,'live',1000+age));scene.updateMatrixWorld(true);bounds.setFromObject(cargo);
    expect(obstacles.some(o=>o.intersectsBox(bounds)),`cargo at age ${age}`).toBe(false);
  }
});
