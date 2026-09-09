import { describe, expect, it } from 'vitest';
import { Predictor } from '../client/predict.js';
import { ARENA2 } from '../src/map/arena2.js';
import { TICK_MS } from '../src/config.js';
const jump={mx:0,mz:1,crouch:false,sprint:false,jump:true}, yaw=Math.PI/2;
describe('predicted waist traversal',()=>{
  it('matches the server vault endpoint over an actual Undertow barrier',()=>{
    const p=new Predictor(ARENA2);p.reconcile({x:22,y:0,z:43.2});
    for(let i=0;i<13;i++)p.frame(TICK_MS,{...jump,jump:i===0},0);
    expect(p.pos.z).toBeCloseTo(46.48);expect(p.pos.x).toBe(22);expect(p.pos.y).toBe(0);
  });
  it('death/respawn drops the local committed route',()=>{
    const p=new Predictor(ARENA2);p.reconcile({x:19.2,y:0,z:45});p.frame(TICK_MS,jump,yaw);
    expect(p.isTraversing).toBe(true);p.setAlive(false);expect(p.isTraversing).toBe(false);
    p.setAlive(true);p.reconcile({x:55,y:0,z:27});p.frame(TICK_MS,{...jump,jump:false,mz:0},yaw);
    expect(p.isTraversing).toBe(false);expect(p.pos.x).toBe(55);
  });
});
