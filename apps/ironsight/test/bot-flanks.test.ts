import { afterEach, expect, it, vi } from 'vitest';
import { createTestRoom } from '@tikron/server/testing';
import { botThink, createBotBrain, resetBotPerception, startBotFlank, type BotBrain, type BotView } from '../src/bots.js';
import { ARENA1 } from '../src/map/arena1.js';
import { ARENA3 } from '../src/map/arena3.js';
import { GroundNavigator } from '../src/map/navigation.js';
import { canStand } from '../src/physics.js';
import { PLAYER } from '../src/config.js';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema, type ArenaPlayer } from '../src/schema.js';

afterEach(() => { vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers(); });
const route = [{x:20,z:10},{x:40,z:10},{x:40,z:30}];
function fixture() {
  const brain = createBotBrain({seed:1,role:'rusher',flankRoute:route,waypoints:[{x:10,y:10}],aimNoiseRad:0});
  const view:BotView = {self:{x:20,y:0,z:10,yaw:0,pitch:0,team:0,alive:true,crouch:false},
    enemies:[{id:'enemy',x:20,y:0,z:30,team:1,alive:true,crouch:false}],boxes:[],teamless:false};
  startBotFlank(brain,view.self);
  return {brain,view};
}

it('commits past a distant visible target, preserving reaction/fire and current collision navigation', () => {
  const {brain,view}=fixture();
  view.navigate=vi.fn(p=>p);
  let d=botThink(view,brain,50);
  expect(d.move.mx).toBeCloseTo(1);expect(d.move.mz).toBeCloseTo(0);expect(d.fire).toBe(false);
  expect(view.navigate).toHaveBeenLastCalledWith(route[1]);
  for(let i=0;i<4;i++)d=botThink(view,brain,50);
  expect(d.fire).toBe(true);expect(d.move.mx).toBeCloseTo(1);
  // The hidden enemy can move anywhere without changing this authored goal.
  view.boxes=[{min:{x:18,y:0,z:14},max:{x:22,y:3,z:16}}];
  d=botThink(view,brain,50);expect(d.fire).toBe(false);expect(brain.lockId).toBeNull();
  expect(view.navigate).toHaveBeenLastCalledWith(route[1]);
});

it('handles a close fight, resumes the same route, then releases at completion or timeout', () => {
  const {brain,view}=fixture();view.navigate=vi.fn(p=>p);
  view.enemies=[{...view.enemies[0]!,z:17}];
  botThink(view,brain,50);expect(view.navigate).not.toHaveBeenCalled();expect(brain.flank?.index).toBe(1);
  view.enemies=[];botThink(view,brain,50);expect(view.navigate).toHaveBeenLastCalledWith(route[1]);
  Object.assign(view.self,{x:40,z:10});botThink(view,brain,50);expect(brain.flank?.index).toBe(2);
  Object.assign(view.self,{z:30});botThink(view,brain,50);expect(brain.flank).toBeUndefined();
  startBotFlank(brain,view.self);brain.clockMs=brain.flank!.untilMs;
  botThink(view,brain,50);expect(brain.flank).toBeUndefined();
});

it('orients from the actual spawn and clears old-life state; objectives cancel and training stays stationary', () => {
  const {brain,view}=fixture();startBotFlank(brain,{x:41,z:30});
  expect(brain.flank?.points[0]).toEqual(route[2]);
  resetBotPerception(brain);expect(brain.flank).toBeUndefined();
  startBotFlank(brain,view.self);view.objective={x:10,z:10};
  const d=botThink(view,brain,50);expect(d.move.mx).toBeCloseTo(-1);expect(brain.flank).toBeUndefined();
  view.showcase={role:'idle',faceYaw:0};startBotFlank(brain,view.self);
  expect(botThink(view,brain,50)).toMatchObject({move:{mx:0,mz:0},fire:false});
});

it.each([ARENA1,ARENA3])('walks both directions of every $presentation flank from every spawn without clipping', map => {
  const nav=new GroundNavigator(map);
  const solids=[...map.boxes,...(map.ramps??[]).map(r=>({min:{x:r.minX,y:0,z:r.minZ},max:{x:r.maxX,y:r.topY,z:r.maxZ}}))];
  for(const points of map.flankRoutes!)for(const spawn of [...map.spawns.red,...map.spawns.blue]) {
    const brain=createBotBrain({seed:1,role:'rusher',waypoints:[{x:0,y:0}],flankRoute:points});
    startBotFlank(brain,spawn);let p={x:spawn.x,z:spawn.z};
    for(const goal of brain.flank!.points) {
      let steps=0;
      while(Math.hypot(goal.x-p.x,goal.z-p.z)>.35&&steps++<1500) {
        const next=nav.next(p,goal),d=Math.hypot(next.x-p.x,next.z-p.z);
        if(d<.001)break;
        const step=Math.min(.12,d);p={x:p.x+(next.x-p.x)/d*step,z:p.z+(next.z-p.z)/d*step};
        expect(canStand(p.x,0,p.z,PLAYER.radius,PLAYER.standHeight,solids,map.bounds)).toBe(true);
      }
      expect(Math.hypot(goal.x-p.x,goal.z-p.z),`${spawn.x},${spawn.z} -> ${goal.x},${goal.z}, stopped ${p.x},${p.z}`).toBeLessThan(.4);
    }
  }
});

it('normal room fill assigns opposite lanes to paired rushers, renews on spawn, and leaves DOM/practice alone', async () => {
  vi.useFakeTimers();vi.setSystemTime(1000000);
  for(const mode of ['tdm','ffa','dom','practice']) {
    const h=await createTestRoom(ArenaRoomImpl,{id:`arena-${mode}`,codec:ArenaSchema,sync:'throttled'});
    await h.advance(100);
    const runtime=h.room as unknown as {botBrains:Map<string,BotBrain>;state:{players:Record<string,ArenaPlayer>};spawnInto:(p:ArenaPlayer,id:string)=>void};
    for(const [id,b] of runtime.botBrains) {
      if((mode==='tdm'||mode==='ffa')&&b.role==='rusher') {
        expect(b.flankRoute).toHaveLength(6);expect(b.flank).toBeDefined();
        b.flank=undefined;runtime.spawnInto(runtime.state.players[id]!,id);expect(b.flank).toBeDefined();
      } else expect(b.flankRoute).toBeUndefined();
    }
    if(mode==='tdm') {
      expect(runtime.botBrains.get('bot-1')!.flankRoute).toBe(ARENA1.flankRoutes![0]);
      expect(runtime.botBrains.get('bot-7')!.flankRoute).toBe(ARENA1.flankRoutes![1]);
    }
  }
});
