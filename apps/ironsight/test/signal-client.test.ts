import { expect, it } from 'vitest';
import * as THREE from 'three';
import { SignalArray } from '../client/signal-array.js';
import { signalFrame } from '../src/signal-event.js';
import { SignalCore } from '../client/signal-core.js';
import { Predictor } from '../client/predict.js';
import { ARENA2 } from '../src/map/arena2.js';
import { ARENA1 } from '../src/map/arena1.js';

it.each([ARENA1,ARENA2])('$presentation matches replicated shutters in prediction and rendering with constant resources and Reduced motion',(map)=>{
  const scene=new THREE.Scene(),core=new SignalCore(scene,map.signalCore!);
  const objects:THREE.Object3D[]=[];scene.traverse(o=>objects.push(o));
  for(const open of [false,true,false,true]) {
    core.setOpen(open);core.update(signalFrame(1000,'live',10500),true);
    expect(core.inspect().shutterY).toBe(open?3:0);
    const p=new Predictor(map);p.pos={x:map.signalCore!.chamber.min.x-3,y:0,z:50};p.setCoreOpen(open);
    for(let i=0;i<85;i++)p.frame(50,{mx:0,mz:1,jump:false,crouch:false,sprint:false},Math.PI/2);
    if(open)expect(p.pos.x).toBeGreaterThan(map.signalCore!.chamber.max.x+1);else expect(p.pos.x).toBeLessThan(map.signalCore!.chamber.min.x);
  }
  const final:THREE.Object3D[]=[];scene.traverse(o=>final.push(o));
  expect(final).toEqual(objects);expect(final.some(o=>o instanceof THREE.Light)).toBe(false);
  expect(final.filter(o=>o instanceof THREE.Mesh).every(o=>!o.castShadow)).toBe(true);
});

it('keeps all moving solid parts outside the map, with fixed resources and no lights',()=>{
  const scene=new THREE.Scene(),array=new SignalArray(scene,75);
  const objects:THREE.Object3D[]=[],geometry:THREE.BufferGeometry[]=[];
  scene.traverse(o=>{objects.push(o);if(o instanceof THREE.Mesh)geometry.push(o.geometry);});
  for(let time=1000;time<185000;time+=200) {
    array.update(signalFrame(1000,'live',time),false);scene.updateMatrixWorld(true);
    for(const o of objects)if(o instanceof THREE.Mesh && !(o.geometry instanceof THREE.RingGeometry)) {
      const b=new THREE.Box3().setFromObject(o);expect(b.max.z).toBeLessThan(0);
    }
  }
  const final:THREE.Object3D[]=[];scene.traverse(o=>final.push(o));expect(final).toEqual(objects);
  expect(final.filter(o=>o instanceof THREE.Light)).toHaveLength(0);
  expect(final.filter(o=>o instanceof THREE.Mesh).map(o=>o.geometry)).toEqual(geometry);
  expect(final.filter(o=>o instanceof THREE.Mesh).every(o=>!o.castShadow)).toBe(true);
});

it('seeks the same pose after a skipped interval and preserves alignment under Reduced motion',()=>{
  const a=new SignalArray(new THREE.Scene(),75),b=new SignalArray(new THREE.Scene(),75);
  for(let t=1000;t<=10200;t+=20)a.update(signalFrame(1000,'live',t),false);
  const active=signalFrame(1000,'live',10200);b.update(active,true);
  expect(a.inspect().yaw).toBe(b.inspect().yaw);expect(a.inspect().pitch).toBe(b.inspect().pitch);
  expect(a.inspect().waves).toBe(2);expect(b.inspect().waves).toBe(0);
  a.update(signalFrame(1000,'live',25000),false);expect(a.inspect().waves).toBe(0);
});
