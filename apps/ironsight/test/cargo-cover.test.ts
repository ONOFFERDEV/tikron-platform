import {afterEach,expect,it,vi} from 'vitest';
import {createTestRoom} from '@tikron/server/testing';
import {ARENA3} from '../src/map/arena3.js';
import {CoreCollision,CoreGate} from '../src/core-gate.js';
import {GroundNavigator} from '../src/map/navigation.js';
import {walkSeconds} from '../src/map/nav.js';
import {PLAYER,MOVE} from '../src/config.js';
import {canStand,nearestBox} from '../src/physics.js';
import {stepGrenade} from '../src/grenade.js';
import {ArenaRoomImpl} from '../src/rooms/arena-room.js';
import {ArenaSchema,type ArenaState} from '../src/schema.js';

afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();});
const c=new CoreCollision(ARENA3),core=ARENA3.signalCore!;
it('removes full cover to open a shorter crossing, with clear bypasses and no permanent overlap',()=>{
  const b=core.chamber;
  expect(c.closed.length-c.open.length).toBe(1);
  expect(c.open.some(o=>o.min.x<b.max.x&&o.max.x>b.min.x&&o.min.z<b.max.z&&o.max.z>b.min.z&&o.min.y<b.max.y&&o.max.y>b.min.y)).toBe(false);
  for(const z of [47,49,50,51])for(let x=121;x<=131;x+=.1)
    expect(canStand(x,0,z,PLAYER.radius,PLAYER.standHeight,c.open,ARENA3.bounds),`${x},${z}`).toBe(true);
  for(const z of [45,53])for(let x=121;x<=131;x+=.2)
    expect(canStand(x,0,z,PLAYER.radius,PLAYER.standHeight,c.closed,ARENA3.bounds),`${x},${z}`).toBe(true);
  for(const y of [.6,1.65,2.8]) {
    expect(nearestBox({x:121,y,z:50},{x:1,y:0,z:0},c.closedHits,10)).toBe(3);
    expect(nearestBox({x:121,y,z:50},{x:1,y:0,z:0},c.openHits,10)).toBe(Infinity);
  }
  const from={x:121,y:0,z:50},to={x:131,y:0,z:50};
  expect(new GroundNavigator({...ARENA3,boxes:c.open}).next(from,to)).toEqual(to);
  expect(new GroundNavigator(ARENA3).next(from,to)).not.toEqual(to);
  expect(walkSeconds(ARENA3,from,to,MOVE.sprint)).toBeGreaterThan(walkSeconds({...ARENA3,boxes:c.open},from,to,MOVE.sprint));
  for(const open of [false,true]) {
    const g={pos:{x:123.5,y:1,z:50},vel:{x:8,y:0,z:0}};
    expect(stepGrenade(g,.1,0,.5,.1,c.boxes(open),ARENA3.bounds)).toBe(!open);
    expect(g.vel.x>0).toBe(open);
  }
});
it('holds the down lock for standing, crouched, airborne and threshold occupants and retains historical cover',()=>{
  const gate=new CoreGate(core);gate.update(true,[],1000);
  for(const p of [{x:126,y:0,z:49},{x:123,y:0,z:50},{x:129,y:0,z:50},{x:126,y:2.9,z:49}]) {
    expect(gate.update(false,[p],2000)).toBe(false);expect(gate.open).toBe(true);
  }
  expect(gate.update(false,[{x:131,y:0,z:50}],2100)).toBe(true);
  expect(gate.at(999)).toBe(false);expect(gate.at(1000)).toBe(true);expect(gate.at(2099)).toBe(true);expect(gate.at(2100)).toBe(false);
});
class FreightRoom extends ArenaRoomImpl {
  protected override fillToPlayers=0;
  protected override startInWarmup=false;
  protected override spawnProtectMs=0;
}
it('FFA rejects forged cover, replicates a held crossing to a late seat and raises safely after ordinary movement',async()=>{
  vi.useFakeTimers();vi.setSystemTime(1000000);
  const h=await createTestRoom(FreightRoom,{codec:ArenaSchema,id:'arena-ffa'}),p=await h.connect();await h.advance(100);
  const s=(h.room as unknown as {state:ArenaState}).state;
  await p.send('move',{mx:0,mz:0,coreOpen:true,signalAt:1});await h.advance(100);expect(s.coreOpen).toBe(false);
  vi.setSystemTime(s.signalAt+8000);await h.advance(50);expect(s.coreOpen).toBe(true);
  Object.assign(s.players[p.id]!,{x:126,y:0,z:50});
  vi.setSystemTime(s.signalAt+23000);await h.advance(50);expect(s.coreOpen).toBe(true);
  const late=await h.connect();await h.advance(50);expect(h.snapshot().coreOpen).toBe(true);expect(late.frames().length).toBeGreaterThan(0);
  await p.send('move',{mx:0,mz:1,yaw:Math.PI/2,pitch:0});await h.advance(1000);
  expect(s.players[p.id]!.x).toBeGreaterThan(129.5);expect(s.coreOpen).toBe(false);expect(s.players[p.id]!.hp).toBe(100);
});
it.each([false,true])('FFA historical cover controls shots across both lock transitions, hybrid=%s',async(claim)=>{
  vi.useFakeTimers();vi.setSystemTime(1000000);
  const h=await createTestRoom(FreightRoom,{codec:ArenaSchema,id:'arena-ffa'}),a=await h.connect(),b=await h.connect();await h.advance(100);
  const s=(h.room as unknown as {state:ArenaState}).state;
  Object.assign(s.players[a.id]!,{x:121,y:0,z:50,prot:false,yaw:Math.PI/2,pitch:Math.atan2(1-PLAYER.standEye,10)});
  Object.assign(s.players[b.id]!,{x:131,y:0,z:50,prot:false});
  vi.setSystemTime(s.signalAt+7700);await h.advance(300);expect(s.coreOpen).toBe(true);
  const fire=()=>a.send('fire',claim?{claim:{id:b.id,part:'body'}}:undefined);
  await fire();await h.advance(50);expect(s.players[b.id]!.hp).toBe(100);
  await h.advance(200);await fire();await h.advance(50);const openHp=s.players[b.id]!.hp;expect(openHp).toBeLessThan(100);
  vi.setSystemTime(s.signalAt+22700);await h.advance(300);expect(s.coreOpen).toBe(false);
  await fire();await h.advance(50);const rewindHp=s.players[b.id]!.hp;expect(rewindHp).toBeLessThan(openHp);
  await h.advance(200);await fire();await h.advance(50);expect(s.players[b.id]!.hp).toBe(rewindHp);
});
