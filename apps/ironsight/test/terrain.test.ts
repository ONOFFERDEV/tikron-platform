import { describe, expect, it, vi } from 'vitest';
import { encodeFull, decodeFull } from '@tikron/schema';
import { createTestRoom } from '@tikron/server/testing';
import { ARENA1 } from '../src/map/arena1.js';
import { ARENA2 } from '../src/map/arena2.js';
import { excavate, groundRay } from '../src/map/terrain.js';
import { RELAY_TRENCH_CUT } from '../src/map/relay-trench.js';
import { canStand, moveAndSlide, nearestBox, rampSurfaceY, type Vec3 } from '../src/physics.js';
import { CoreCollision } from '../src/core-gate.js';
import { MOVE, PLAYER } from '../src/config.js';
import { stepGrenade } from '../src/grenade.js';
import { ArenaSchema, type ArenaState, type ArenaPlayer } from '../src/schema.js';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { Predictor } from '../client/predict.js';
import { terrainGeometry } from '../client/terrain-geometry.js';
import { buildWedgeGeometry } from '../client/site-wedge.js';
import { resolvePing } from '../src/ping.js';
import { mortarTarget } from '../src/mortar.js';

const collision = new CoreCollision(ARENA1);
const walkRoute = [{x:36,y:0,z:76},{x:48,y:-3,z:76},{x:57,y:-3,z:77.6},{x:63,y:-3,z:77.6},
  {x:87,y:-3,z:74.4},{x:94,y:-3,z:74.4},{x:102,y:-3,z:76},{x:114,y:0,z:76}];
function walk(points: readonly Vec3[], stride: number) {
  let p = {...points[0]!}; const samples = [p];
  for (const goal of points.slice(1)) {
    let limit = 1500;
    while (Math.hypot(p.x-goal.x,p.z-goal.z) > .03 && limit-- > 0) {
      const dx=goal.x-p.x,dz=goal.z-p.z,d=Math.hypot(dx,dz),step=Math.min(stride,d);
      const next=moveAndSlide(p,PLAYER.radius,PLAYER.standHeight,{x:dx/d*step,y:-.025,z:dz/d*step},-.5,
        ARENA1.boxes,ARENA1.bounds,MOVE.stepUp,ARENA1.ramps);
      p=next.pos; samples.push(p);
      expect(next.grounded, JSON.stringify(p)).toBe(true);
      expect(canStand(p.x,p.y,p.z,PLAYER.radius-1e-6,PLAYER.standHeight,ARENA1.boxes,ARENA1.bounds),JSON.stringify(p)).toBe(true);
    }
    expect(Math.hypot(p.x-goal.x,p.z-goal.z)).toBeLessThan(.04); expect(p.y).toBeCloseTo(goal.y,2);
  }
  return samples;
}

describe('excavated Relay freight route', () => {
  it('has exact solid earth, a disjoint ground surface and no second yard face over the cut', () => {
    const terrain=ARENA1.terrain!;
    for (const b of terrain.boxes) { expect(collision.open).toContain(b); expect(collision.closed).toContain(b); }
    const g=terrainGeometry(ARENA1), position=g.getAttribute('position'), uv=g.getAttribute('uv');
    expect(position.count).toBe(30);
    const area=terrain.faces.reduce((n,f)=>n+(f.maxX-f.minX)*(f.maxZ-f.minZ),0);
    expect(area).toBe(15000);
    expect(terrain.faces.filter(f=>f.y<0)).toEqual([{...RELAY_TRENCH_CUT,y:-3}]);
    for(let i=0;i<position.count;i++) {
      expect(uv.getX(i)).toBeCloseTo(position.getX(i)/150,6);
      expect(uv.getY(i)).toBeCloseTo(1-position.getZ(i)/100,6);
    }
    g.dispose();
    expect(()=>excavate(ARENA2,RELAY_TRENCH_CUT,-4)).toThrow('excavation');
    expect(()=>excavate(ARENA2,{...RELAY_TRENCH_CUT,maxX:151},-3)).toThrow('excavation');
  });

  it.each([.1,.32,.45])('walks both ramp directions, equipment chicanes and the bridge underpass at stride %s', stride => {
    for(const points of [walkRoute,[...walkRoute].reverse()]) {
      const samples=walk(points,stride); expect(Math.min(...samples.map(p=>p.y))).toBe(-3);
      expect(samples.some(p=>p.x>73&&p.x<77&&p.y===-3)).toBe(true);
    }
  });

  it('carries a yard crossing above the same underpass and stops a jump at its ceiling', () => {
    const samples=walk([{x:75,y:0,z:71},{x:75,y:0,z:81}],.1);
    expect(samples.every(p=>p.y===0)).toBe(true);
    const up=moveAndSlide({x:75,y:-3,z:76},.4,1.8,{x:0,y:1.2,z:0},7,ARENA1.boxes,ARENA1.bounds,.45,ARENA1.ramps);
    expect(up.pos.y).toBeCloseTo(-2.1); expect(up.vy).toBe(0);
  });

  it('has matched rotated trench cover and exact negative ramp geometry', () => {
    const trench=ARENA1.structures!.find(s=>s.id==='freight-trench')!;
    const near=(a:number,b:number)=>Math.abs(a-b)<1e-6;
    for(const {box:a} of trench.parts) expect(trench.parts.some(({box:b})=>near(b.min.x,150-a.max.x)
      &&near(b.max.x,150-a.min.x)&&near(b.min.z,152-a.max.z)&&near(b.max.z,152-a.min.z)
      &&near(b.min.y,a.min.y)&&near(b.max.y,a.max.y))).toBe(true);
    for(const r of trench.ramps) {
      const g=buildWedgeGeometry(r);g.computeBoundingBox();
      expect(g.boundingBox!.min.y).toBe(-3);expect(g.boundingBox!.max.y).toBe(0);
      expect(rampSurfaceY(r,(r.minX+r.maxX)/2,76)).toBe(-1.5);g.dispose();
    }
  });

  it('blocks earth, machinery and the bridge while allowing fire along the lower route', () => {
    for(const boxes of [collision.openHits,collision.closedHits]) {
      expect(nearestBox({x:65,y:-1.35,z:76},{x:1,y:0,z:0},boxes,20)).toBe(Infinity);
      expect(nearestBox({x:65,y:-1.35,z:76},{x:0,y:0,z:-1},boxes,20)).toBeCloseTo(2.6);
      expect(nearestBox({x:75,y:-1.35,z:76},{x:0,y:1,z:0},boxes,20)).toBeCloseTo(1.05);
      expect(nearestBox({x:65,y:1.65,z:70},{x:0,y:-1,z:0},boxes,20)).toBeCloseTo(1.65);
      expect(groundRay({x:65,y:-1.35,z:76},{x:0,y:-1,z:0},boxes,ARENA1.bounds,20)).toBeCloseTo(1.65);
    }
  });

  it('lets a grenade fall through the hole, bounce below grade and stops fast wall penetration', () => {
    const grenade={pos:{x:65,y:1,z:76},vel:{x:0,y:0,z:0}};let lowest=Infinity,bounced=false;
    for(let i=0;i<80;i++) { bounced=stepGrenade(grenade,.025,20,.45,.12,collision.closedHits,ARENA1.bounds)||bounced;lowest=Math.min(lowest,grenade.pos.y); }
    expect(lowest).toBeLessThan(-2.8);expect(lowest).toBeGreaterThanOrEqual(-2.88001);expect(bounced).toBe(true);
    const fast={pos:{x:65,y:-1,z:76},vel:{x:0,y:0,z:-100}};
    stepGrenade(fast,.05,0,.5,.12,collision.closedHits,ARENA1.bounds);
    expect(fast.pos.z).toBeGreaterThanOrEqual(73.52);expect(fast.vel.z).toBeGreaterThan(0);
  });

  it('pings the actual lower floor and designates visible trench ground while rejecting the bridge', () => {
    const origin={x:65,y:-1.35,z:76},d=Math.hypot(10,1.65),dir={x:10/d,y:-1.65/d,z:0};
    const ping=resolvePing(origin,dir,0,[],collision.closedHits,ARENA1.bounds);
    expect(ping.x).toBeCloseTo(75);expect(ping.z).toBe(76);
    const player={x:79,y:-3,z:76,crouch:false} as ArenaPlayer;
    expect(mortarTarget(player,-Math.PI/2,Math.atan2(-1.65,10),collision.closedHits,ARENA1.bounds)).toMatchObject({x:69,y:-2.88,z:76});
    expect(mortarTarget({...player,x:85},-Math.PI/2,Math.atan2(-1.65,10),collision.closedHits,ARENA1.bounds)).toBeNull();
  });
});

class TerrainRoom extends ArenaRoomImpl {
  protected override fillToPlayers=0;
  protected override startInWarmup=false;
  protected override spawnProtectMs=0;
}
describe('below-grade authority and prediction',()=>{
  it.each([false,true])('accepts corridor shots and rejects earth shots, hybrid=%s',async claim=>{
    vi.useFakeTimers();vi.setSystemTime(1_000_000);
    try {
      for(const blocked of [false,true]) {
        const h=await createTestRoom(TerrainRoom,{id:'arena-tdm',codec:ArenaSchema});
        const a=await h.connect(),b=await h.connect();await h.advance(100);
        const s=(h.room as unknown as {state:ArenaState}).state;
        Object.assign(s.players[a.id]!,{x:65,y:-3,z:76,team:0,prot:false,yaw:blocked?Math.PI:Math.PI/2,pitch:Math.atan2((blocked?4.4:1.4)-1.65,10)});
        Object.assign(s.players[b.id]!,{x:blocked?65:75,y:blocked?0:-3,z:blocked?66:76,team:1,prot:false});
        await h.advance(300);
        const decoded=decodeFull(ArenaSchema,encodeFull(ArenaSchema,s));
        expect(decoded.players[a.id]!.y).toBe(-3);
        await a.send('fire',claim?{claim:{id:b.id,part:'body'}}:undefined);await h.advance(50);
        expect(s.players[b.id]!.hp<100).toBe(!blocked);
      }
    } finally {vi.clearAllTimers();vi.useRealTimers();}
  });

  it('predicts and replicates the same descent from the west yard with ordinary movement intents',async()=>{
    vi.useFakeTimers();vi.setSystemTime(1_000_000);
    try {
      const h=await createTestRoom(TerrainRoom,{id:'arena-tdm',codec:ArenaSchema}),client=await h.connect();await h.advance(100);
      const p=(h.room as unknown as {state:ArenaState}).state.players[client.id]!;
      Object.assign(p,{x:36,y:0,z:76,yaw:Math.PI/2});
      const prediction=new Predictor(ARENA1);prediction.pos={x:36,y:0,z:76};
      const input={mx:0,mz:1,jump:false,crouch:false,sprint:false};
      for(let i=0;i<40;i++) {
        await client.send('move',input);await h.advance(50);prediction.frame(50,input,Math.PI/2);
        expect(prediction.pos.y).toBeCloseTo(p.y,5);expect(prediction.pos.x).toBeCloseTo(p.x,5);
      }
      expect(p.y).toBe(-3);
      expect((client.lastState() as ArenaState).players[client.id]!.y).toBe(-3);
    } finally {vi.clearAllTimers();vi.useRealTimers();}
  });
});

