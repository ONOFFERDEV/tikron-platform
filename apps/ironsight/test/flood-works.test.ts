import { expect,it } from 'vitest';
import * as T from 'three';
import { FloodWorks } from '../client/flood-works.js';
import { signalFrame } from '../src/signal-event.js';

it('keeps sluices and all stream/foam instances outside collision bounds throughout both cycles',()=>{
  const scene=new T.Scene(),works=new FloodWorks(scene,75);
  const objects:T.Object3D[]=[],geometries:T.BufferGeometry[]=[];
  scene.traverse(o=>{objects.push(o);if(o instanceof T.Mesh)geometries.push(o.geometry);});
  const matrix=new T.Matrix4(),box=new T.Box3();
  for(let age=0;age<120000;age+=250) {
    works.update(signalFrame(1000,'live',1000+age),false);scene.updateMatrixWorld(true);
    for(const object of objects)if(object instanceof T.Mesh) {
      object.geometry.computeBoundingBox();
      if(object instanceof T.InstancedMesh)for(let i=0;i<object.count;i++) {
        object.getMatrixAt(i,matrix);matrix.premultiply(object.matrixWorld);
        box.copy(object.geometry.boundingBox!).applyMatrix4(matrix);expect(box.max.z).toBeLessThan(-2);
      } else expect(new T.Box3().setFromObject(object).max.z).toBeLessThan(-2);
    }
  }
  const final:T.Object3D[]=[];scene.traverse(o=>final.push(o));expect(final).toEqual(objects);
  expect(final.filter(o=>o instanceof T.Light)).toHaveLength(0);
  expect(final.filter(o=>o instanceof T.Mesh).map(o=>o.geometry)).toEqual(geometries);
  expect(final.filter(o=>o instanceof T.Mesh).every(o=>!o.castShadow)).toBe(true);
});

it('seeks deterministically after late join, preserves gate/water under Reduced motion, drains at end',()=>{
  const normal=new FloodWorks(new T.Scene(),75),reduced=new FloodWorks(new T.Scene(),75);
  for(let age=0;age<=12000;age+=50)normal.update(signalFrame(1000,'live',1000+age),false);
  reduced.update(signalFrame(1000,'live',13000),true);
  expect(normal.inspect()).toMatchObject({lift:10,streams:24,foam:24,playableRoute:false});
  expect(reduced.inspect()).toMatchObject({lift:10,streams:24,foam:0,reducedMotion:true});
  normal.update(signalFrame(1000,'live',27000),false);
  expect(normal.inspect()).toMatchObject({lift:0,streams:0,foam:0});
  normal.update(signalFrame(1000,'ended',13000),false);
  expect(normal.inspect()).toMatchObject({phase:'idle',lift:0,streams:0,foam:0});
});
