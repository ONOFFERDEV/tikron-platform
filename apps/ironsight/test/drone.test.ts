import { afterEach, expect, it, vi } from 'vitest';
import { createTestRoom } from '@tikron/server/testing';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema, type ArenaPlayer, type ArenaState } from '../src/schema.js';
import { DRONE, DroneSupport, type DroneView } from '../src/drone.js';
import type { SupportView } from '../src/air-support.js';
import type { Box } from '../src/physics.js';

const p=(team=0,x=6):ArenaPlayer=>({x,y:0,z:11,yaw:Math.PI/2,pitch:0,hp:100,alive:true,prot:false,team,crouch:false,k:0,d:0,weapon:0,nades:2,reloadEnd:0});
const state=():ArenaState=>({players:{owner:p(),enemy:p(1,16),ally:p(0,30)},seed:1,redScore:0,blueScore:0,phase:'live',mode:0,matchEndMs:1e9,signalAt:0,coreOpen:false,warmupEndMs:0,capA:100,capB:100,capC:100});
const bounds={width:150,depth:100,ceiling:16}, targets=new Map([['enemy',{}]]);
const wall:Box={min:{x:11,y:0,z:10},max:{x:12,y:5,z:12}};
const tick=(d:DroneSupport,s:ArenaState,t:number,boxes:readonly Box[]=[])=>d.tick(s,t,boxes,bounds,targets);
const launch=(d:DroneSupport,s:ArenaState)=>{d.earn('owner',7,s);tick(d,s,1000);};
it('earns seven, has 900ms frozen locks and single current damage, with no catch-up volley after a stalled tick',()=>{
  const d=new DroneSupport(),s=state();
  for(const count of [3,5,6,8])d.earn('owner',count,s);
  expect(tick(d,s,1000).changed).toBe(false);launch(d,s);
  expect(d.view('owner',s,[]).flights[0]).toMatchObject({x:10,y:3.2,z:8,startedAt:1000,endsAt:13000});
  tick(d,s,1600);const lock=d.view('enemy',s,[]).flights[0]!.lock!;
  expect(lock.fireAt).toBe(2500);expect(tick(d,s,2499).shots).toHaveLength(0);
  expect(tick(d,s,2500).shots[0]?.victim).toBe('enemy');expect(tick(d,s,2500).shots).toHaveLength(0);
  tick(d,s,3400);expect(tick(d,s,9000).shots).toHaveLength(0);
  expect(d.view('owner',s,[]).flights[0]!.lock?.fireAt).toBe(9900);
  expect(tick(d,s,9900).shots).toHaveLength(1);tick(d,s,13000);expect(d.view('owner',s,[]).flights).toEqual([]);
});
it('dodging, protection, owner tether, owner LOS and newly closed cover defeat damage; hidden locks are not public radar',()=>{
  const d=new DroneSupport(),s=state();launch(d,s);tick(d,s,1600);
  s.players.enemy!.z+=1;expect(d.view('enemy',s,[]).flights[0]!.lock!.point.z).toBe(11);
  expect(tick(d,s,2500).shots[0]?.victim).toBeNull();
  s.players.enemy!.z=11;tick(d,s,3400);expect(tick(d,s,4300,[wall]).shots.every(shot=>shot.victim===null)).toBe(true);
  tick(d,s,5200,[wall]);expect(d.view('owner',s,[]).flights[0]!.lock).toBeNull();
  tick(d,s,7000);s.players.enemy!.prot=true;expect(tick(d,s,7900).shots[0]?.victim).toBeNull();
  s.players.enemy!.prot=false;s.players.owner!.x=70;tick(d,s,8800);expect(d.view('owner',s,[]).flights[0]!.lock).toBeNull();
  s.players.owner!.x=6;tick(d,s,10600);
  s.players.ally!.x=60;expect(d.view('ally',s,[]).flights[0]!.lock).toBeNull();
  s.players.ally!.x=6;expect(d.view('ally',s,[wall]).flights[0]!.lock).toBeNull();
  // Drone can see over this waist wall, but its operator cannot.
  const waist={min:{x:7,y:0,z:10},max:{x:7.5,y:1.25,z:12}};
  expect(tick(d,s,11500,[waist]).shots[0]?.victim).toBeNull();
});
it('clear sky gates launch; one shared 60s airspace, death/seat/round cleanup, private bot-only practice and FFA exclusion',()=>{
  const d=new DroneSupport(),s=state(),roof={min:{x:0,y:4,z:0},max:{x:14,y:5,z:18}};
  d.earn('owner',7,s);tick(d,s,1000,[roof]);expect(d.view('owner',s,[]).queued).toBe(true);
  tick(d,s,1000);d.earn('ally',7,s);tick(d,s,1100);expect(d.view('ally',s,[]).queued).toBe(true);
  d.forget('owner');expect(d.view('enemy',s,[]).flights).toEqual([]);
  tick(d,s,60999);expect(d.view('ally',s,[]).queued).toBe(true);tick(d,s,61000);expect(d.view('ally',s,[]).queued).toBe(false);
  s.players.ally!.alive=false;tick(d,s,61100);expect(d.view('enemy',s,[]).flights).toEqual([]);
  s.phase='ended';tick(d,s,62000);s.phase='live';s.mode=1;d.earn('owner',7,s);tick(d,s,63000);expect(d.view('owner',s,[]).flights).toEqual([]);
  s.mode=3;launch(d,s);expect(d.view('ally',s,[]).flights).toEqual([]);
  // A nearby second human is excluded even when closer than a training bot.
  s.players.ally=p(1,10);tick(d,s,1600);expect(tick(d,s,2500).shots[0]?.victim).toBe('enemy');
  delete s.players.owner;tick(d,s,2600);expect(d.view('enemy',s,[]).flights).toEqual([]);
});
it('tries another clear shoulder when the preferred launch is blocked, without passing through geometry',()=>{
  const d=new DroneSupport(),s=state();d.earn('owner',7,s);
  tick(d,s,1000,[{min:{x:9,y:4,z:7},max:{x:11,y:5,z:9}}]);
  expect(d.view('owner',s,[]).flights[0]).toMatchObject({x:10,y:3.2,z:14});
});

it('shutdown catch-up is one small score award for a trailing enemy team, never for allies, expired flights, FFA or training',()=>{
  for(const mode of [0,2,3,1]) {
    const d=new DroneSupport(),s=state();s.mode=mode;s.redScore=mode===2?30:10;launch(d,s);
    expect(d.shutdown('owner','ally',s,2000)).toBe(0);
    expect(d.shutdown('owner','enemy',s,2000)).toBe(mode===0?1:mode===2?5:0);
    expect(d.shutdown('owner','enemy',s,2000)).toBe(0);
  }
  const d=new DroneSupport(),s=state();s.redScore=4;launch(d,s);
  expect(d.shutdown('owner','enemy',s,2000)).toBe(0);
  d.clear();launch(d,s);s.redScore=20;expect(d.shutdown('owner','enemy',s,13000)).toBe(0);
});
class DroneRoom extends ArenaRoomImpl {
  protected override fillToPlayers=0;
  protected override startInWarmup=false;
  protected override spawnProtectMs=0;
}
afterEach(()=>{vi.restoreAllMocks();vi.clearAllTimers();vi.useRealTimers();});
const latest=<T>(c:{frames():Record<string,unknown>[]},type:string)=>c.frames().filter(f=>f.type===type).at(-1)?.payload as T;
it('real fire earns seven; forged messages cannot earn or aim a sentry, and sentry eliminations score without advancing support',async()=>{
  vi.useFakeTimers();vi.setSystemTime(1000000);
  const h=await createTestRoom(DroneRoom,{id:'arena-tdm',codec:ArenaSchema});const red=await h.connect(),blue=await h.connect();
  const s=(h.room as unknown as {state:ArenaState}).state;
  await red.send('drone',{count:7,x:16,damage:99999,target:blue.id});await red.send('syncView',{});await h.advance(50);
  expect(latest<DroneView>(red,'drone').flights).toEqual([]);
  for(let kill=0;kill<7;kill++) {
    Object.assign(s.players[red.id]!,{...p(),k:kill});Object.assign(s.players[blue.id]!,p(1,16));
    s.players[red.id]!.pitch=Math.atan2(1-1.65,10);
    if(kill===4){await red.send('reload',{});await h.advance(2300);}
    await h.advance(350);
    for(let shot=0;shot<4;shot++){await red.send('fire',{});await h.advance(110);}
    expect(s.players[red.id]!.k).toBe(kill+1);
    if(kill<6)await h.advance(3100);
  }
  const flight=latest<DroneView>(red,'drone').flights[0]!;expect(flight.owner).toBe(red.id);
  // Restore the normal target after the scheduled respawn; no fake reward call.
  await h.advance(3100);Object.assign(s.players[blue.id]!,p(1,16));
  await h.advance(5600);
  expect(s.players[blue.id]!.alive).toBe(false);expect(s.players[red.id]!.k).toBe(8);expect(s.redScore).toBe(8);
  expect(latest<SupportView>(red,'support').count).toBe(7);
  expect(latest<{part:string}>(red,'kill').part).toBe('drone');
  await red.send('syncView',{});await h.advance(50);expect(latest<DroneView>(red,'drone').flights[0]!.endsAt).toBe(flight.endsAt);
});
it('real room applies and announces catch-up once, then immediately cancels the dead/departing operator',async()=>{
  vi.useFakeTimers();vi.setSystemTime(1000000);
  const h=await createTestRoom(DroneRoom,{id:'arena-tdm',codec:ArenaSchema});const red=await h.connect(),blue=await h.connect();
  const room=h.room as unknown as {state:ArenaState;droneSupport:DroneSupport;applyDamage(id:string,damage:number,killer:string,part:string):void;onSeatExpired(c:unknown):void};
  const s=room.state;Object.assign(s.players[red.id]!,p());Object.assign(s.players[blue.id]!,p(1,16));s.redScore=10;
  room.droneSupport.earn(red.id,7,s);await h.advance(50);room.applyDamage(red.id,100,blue.id,'body');
  expect(s.blueScore).toBe(2);expect(latest<{bonus:number}>(blue,'droneRally')).toEqual({bonus:1});
  expect(latest<DroneView>(blue,'drone').flights).toEqual([]);
  room.droneSupport.clear();Object.assign(s.players[red.id]!,p());room.droneSupport.earn(red.id,7,s);await h.advance(50);
  room.onSeatExpired({id:red.id});expect(latest<DroneView>(blue,'drone').flights).toEqual([]);
});
