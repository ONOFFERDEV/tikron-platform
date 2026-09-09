import { afterEach, expect, it, vi } from 'vitest';
import { DomOrders, type DomAlly } from '../src/dom-orders.js';
import { ARENA2 } from '../src/map/arena2.js';
import { createTestRoom } from '@tikron/server/testing';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema, type ArenaPlayer } from '../src/schema.js';
import { GroundNavigator } from '../src/map/navigation.js';

const map = {caps:{a:{x:0,y:0,z:0},b:{x:50,y:0,z:0},c:{x:100,y:0,z:0}}};
const neutral = {a:100,b:100,c:100};
const roster = (team=0):DomAlly[] => Array.from({length:6},(_,i)=>({id:`bot-${team}-${i}`,x:team?100:0,z:0,team,alive:true,bot:true,available:true}));
const counts = (orders:DomOrders,people:DomAlly[]) => [0,50,100].map(x=>people.filter(p=>orders.target(p.id)?.x===x).length);
afterEach(()=>{vi.restoreAllMocks();vi.clearAllTimers();vi.useRealTimers();});

it('splits six allies into three pairs before they arrive, independently for both teams',()=>{
  const orders=new DomOrders(map),red=roster(),blue=roster(1);
  orders.update(1000,neutral,[...red,...blue]);
  expect(counts(orders,red)).toEqual([2,2,2]);expect(counts(orders,blue)).toEqual([2,2,2]);
  const targets=red.map(p=>orders.target(p.id));
  red.forEach(p=>p.x=99);orders.update(11000,neutral,[...red,...blue]);
  expect(red.map(p=>orders.target(p.id))).toEqual(targets); // commitment prevents proximity thrash
});

it('releases surplus defenders on capture and counts human presence without commanding humans',()=>{
  const orders=new DomOrders(map),bots=roster();
  orders.update(1000,neutral,bots);
  orders.update(1100,{...neutral,a:200},bots);expect(counts(orders,bots)).toEqual([1,3,2]);
  const human={...bots[0]!,id:'human',bot:false};
  orders.update(2200,{...neutral,a:200},[...bots.slice(1),human]);
  expect(orders.target('human')).toBeUndefined();expect(counts(orders,bots.slice(1))[0]).toBe(0);
  expect(counts(orders,bots.slice(1)).reduce((a,b)=>a+b,0)).toBe(5);
});

it('drops dead, departed and gallery orders immediately; reset and all-owned defence stay defined',()=>{
  const orders=new DomOrders(map),bots=roster();orders.update(1000,neutral,bots);
  bots[0]!.alive=false;bots[1]!.available=false;bots.pop();orders.update(1010,neutral,bots);
  expect(orders.target('bot-0-0')).toBeUndefined();expect(orders.target('bot-0-1')).toBeUndefined();
  expect(orders.target('bot-0-5')).toBeUndefined();
  orders.clear();bots.forEach(p=>expect(orders.target(p.id)).toBeUndefined());
  orders.update(0,{a:200,b:200,c:200},roster());expect(counts(orders,roster())).toEqual([2,2,2]);
  orders.update(10,neutral,[]);expect(counts(orders,roster())).toEqual([0,0,0]);
});

it('chooses the nearer authored anchor and never emits an unreachable raw cap centre',()=>{
  const orders=new DomOrders({...map,capWaypoints:{a:[{x:2,y:0,z:0},{x:-2,y:0,z:0}]}});
  const bot={...roster()[0]!,x:-3};orders.update(0,neutral,[bot]);expect(orders.target(bot.id)).toEqual({x:-2,z:0});
  const nav=new GroundNavigator(ARENA2),real=new DomOrders(ARENA2),bots=roster();
  real.update(0,neutral,bots);
  for(const bot of bots) {
    const goal=real.target(bot.id)!;let at={x:3,z:39};
    for(let i=0;i<3000&&Math.hypot(at.x-goal.x,at.z-goal.z)>.8;i++) {
      const p=nav.next(at,goal),d=Math.hypot(p.x-at.x,p.z-at.z);
      if(d>0)at={x:at.x+(p.x-at.x)*Math.min(.3,d)/d,z:at.z+(p.z-at.z)*Math.min(.3,d)/d};
    }
    expect(Math.hypot(at.x-goal.x,at.z-goal.z)).toBeLessThan(.8);
  }
});

it('feeds normal DOM bot movement and yields to the gallery without changing TDM objectives',async()=>{
  vi.useFakeTimers();vi.setSystemTime(1000000);vi.spyOn(console,'log').mockImplementation(()=>{});
  for(const mode of ['dom','tdm']) {
    const h=await createTestRoom(ArenaRoomImpl,{id:`arena-${mode}`,codec:ArenaSchema,sync:'throttled'});
    await h.advance(250);
    const room=h.room as unknown as {botView(id:string,p:ArenaPlayer):{objective?:{x:number;z:number};objectiveWatch?:{x:number;z:number}};
      corePush:{target(id:string,open:boolean):{x:number;z:number}|undefined}};
    const players=Object.entries(h.snapshot().players);
    expect(players).toHaveLength(12);
    if(mode==='dom') {
      const goals=players.filter(([,p])=>p.team===0).map(([id,p])=>JSON.stringify(room.botView(id,p).objective));
      expect(new Set(goals).size).toBe(3);
      const first=players[0]!;
      for(const [id,p] of players) {
        const watch=room.botView(id,p).objectiveWatch!;
        expect(watch.x).toBe(p.team===0?147:3);
        expect(watch.z).toBe(49);
      }
      const override=vi.spyOn(room.corePush,'target').mockReturnValue({x:65,z:50});
      expect(room.botView(first[0],first[1]).objective).toEqual({x:65,z:50});
      expect(room.botView(first[0],first[1]).objectiveWatch).toBeUndefined();override.mockRestore();
    } else for(const [id,p] of players) {
      expect(room.botView(id,p).objective).toBeUndefined();
      expect(room.botView(id,p).objectiveWatch).toBeUndefined();
    }
    vi.clearAllTimers();
  }
});
