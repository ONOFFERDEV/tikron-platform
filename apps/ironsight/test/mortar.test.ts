import { afterEach, expect, it, vi } from 'vitest';
import { createTestRoom } from '@tikron/server/testing';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema, type ArenaPlayer, type ArenaState } from '../src/schema.js';
import { MORTAR, MortarSupport, mortarTarget, type MortarView } from '../src/mortar.js';
import type { SupportView } from '../src/air-support.js';
import type { Box } from '../src/physics.js';

const p = (team = 0): ArenaPlayer => ({ x: 6, y: 0, z: 11, yaw: Math.PI / 2, pitch: -.1, hp: 100,
  alive: true, prot: false, team, crouch: false, k: 0, d: 0, weapon: 0, nades: 2, reloadEnd: 0 });
const state = (): ArenaState => ({ players: { owner:p(), ally:p(), enemy:p(1) }, mode:0, phase:'live', seed:1,
  redScore:0,blueScore:0,signalAt:0,coreOpen:false,matchEndMs:1e9,capA:100,capB:100,capC:100 });
const point = { x: 16, y: .12, z: 11 }, bounds = { width:150, depth:100, ceiling:16 };
const wall: Box = { min:{x:10,y:0,z:10},max:{x:11,y:3,z:12} };
it('designates only visible open ground at 8-60m; rejects walls, roofed tunnels, sky, nonfinite and out-of-bounds aim', () => {
  const player = p(), aim = Math.atan2(-1.65, 10);
  expect(mortarTarget(player, Math.PI/2, aim, [], bounds)).toEqual(point);
  expect(mortarTarget(player, Math.PI/2, aim, [wall], bounds)).toBeNull();
  const roof = { min:{x:14,y:3,z:10},max:{x:18,y:4,z:12} };
  expect(mortarTarget(player, Math.PI/2, aim, [roof], bounds)).toBeNull();
  for (const pitch of [NaN, Infinity, 0, .1, -Math.PI/2, Math.atan2(-1.65,61)])
    expect(mortarTarget(player, Math.PI/2, pitch, [], bounds)).toBeNull();
  expect(mortarTarget(player, -Math.PI/2, aim, [], bounds)).toBeNull();
});

it('earns only five, caps shared battery, announces 3s before exactly three impacts, and skips delayed damage', () => {
  const a = new MortarSupport(), s = state();
  for (const n of [3,4,6]) a.earn('owner', n, s);
  expect(a.call('owner',s,1000,point)).toBe(false);
  a.earn('owner',5,s); expect(a.call('owner',s,1000,point)).toBe(true);
  expect(a.view('enemy',s).strikes).toEqual(a.view('owner',s).strikes);
  a.earn('ally',5,s); expect(a.call('ally',s,2000,point)).toBe(false);
  expect(a.tick(s,3999).impacts).toHaveLength(0);
  for (const time of [4000,4650,5300]) { expect(a.tick(s,time).impacts).toHaveLength(1); expect(a.tick(s,time).impacts).toHaveLength(0); }
  a.tick(s,6900); expect(a.view('owner',s).strikes).toHaveLength(0);
  expect(a.call('ally',s,45999,point)).toBe(false); expect(a.call('ally',s,46000,point)).toBe(true);
  expect(a.tick(s,50300).impacts).toHaveLength(1); expect(a.tick(s,50400).impacts).toHaveLength(0);
  expect(a.view('owner',s).available).toBe(false);
});

it('death/seat loss cancels charges and remaining shells; shared cooldown survives, practice private, FFA disabled, round reset clears', () => {
  const a = new MortarSupport(), s = state(); a.earn('owner',5,s); a.call('owner',s,1000,point);
  a.forget('owner'); expect(a.tick(s,4000).impacts).toHaveLength(0);
  a.earn('ally',5,s); expect(a.call('ally',s,4000,point)).toBe(false);
  s.players.ally!.alive=false; a.tick(s,4001); s.players.ally!.alive=true;
  expect(a.view('ally',s).available).toBe(false);
  s.phase='ended'; a.tick(s,4002); s.phase='live'; a.earn('ally',5,s);
  expect(a.call('ally',s,4003,point)).toBe(true);
  a.clear(); s.mode=1; a.earn('owner',5,s); expect(a.call('owner',s,5000,point)).toBe(false);
  s.mode=3; a.earn('owner',5,s); a.call('owner',s,6000,point);
  expect(a.view('ally',s).strikes).toEqual([]); expect(a.view('owner',s).strikes).toHaveLength(1);
  delete s.players.owner; expect(a.tick(s,9000).impacts).toHaveLength(0);
});

class MortarRoom extends ArenaRoomImpl {
  protected override fillToPlayers=0;
  protected override startInWarmup=false;
  protected override spawnProtectMs=0;
  protected override respawnMs=3000;
}
afterEach(() => { vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers(); });
const latest = <T>(c:{frames():Record<string,unknown>[]},type:string) => c.frames().filter(f=>f.type===type).at(-1)?.payload as T;

it('real room rejects forged rewards/coordinates and earns by fire; cover, protection, allies and nonrecursive scoring survive the barrage', async () => {
  vi.useFakeTimers(); vi.setSystemTime(1000000);
  const h = await createTestRoom(MortarRoom,{id:'arena-tdm',codec:ArenaSchema});
  const red=await h.connect(), blue=await h.connect(), ally=await h.connect(), covered=await h.connect(), spare=await h.connect(), shield=await h.connect();
  const s=(h.room as unknown as {state:ArenaState}).state;
  for (const id of Object.keys(s.players)) Object.assign(s.players[id]!,{x:45,z:11,prot:false});
  Object.assign(s.players[red.id]!,p()); Object.assign(s.players[blue.id]!,{...p(1),x:16});
  await red.send('mortar',{yaw:Math.PI/2,pitch:Math.atan2(-1.65,10),count:5,point,damage:99999});
  await h.advance(50); await red.send('syncView',{}); await h.advance(50);
  expect(latest<MortarView>(red,'mortar').strikes).toHaveLength(0);
  for(let kill=0;kill<5;kill++) {
    Object.assign(s.players[red.id]!,{x:6,y:0,z:11,yaw:Math.PI/2,pitch:Math.atan2(1-1.65,10),prot:false});
    Object.assign(s.players[blue.id]!,{x:16,y:0,z:11,hp:100,alive:true,prot:false});
    await h.advance(350);
    if(kill===4){await red.send('reload',{});await h.advance(2300);}
    for(let shot=0;shot<4;shot++){await red.send('fire',{});await h.advance(110);}
    expect(s.players[red.id]!.k).toBe(kill+1);
    await h.advance(3100);
  }
  expect(latest<MortarView>(red,'mortar').available).toBe(true);
  // Prove position/radius/deadline fields never become authority.
  const aim={yaw:Math.PI/2,pitch:Math.atan2(-1.65,10)};
  await red.send('mortar',{...aim,x:99,z:99,damage:9999,startedAt:0}); await h.advance(50);
  const strike=latest<MortarView>(red,'mortar').strikes[0]!; expect(strike).toMatchObject(point);
  expect(strike.startedAt).toBeGreaterThan(1000000);
  await red.send('mortar',aim); await h.advance(50); expect(latest<MortarView>(red,'mortar').strikes).toHaveLength(1);
  Object.assign(s.players[blue.id]!,{x:16,y:0,z:11,hp:100,alive:true,prot:false});
  Object.assign(s.players[ally.id]!,{x:16,y:0,z:11,hp:100,alive:true,prot:false});
  Object.assign(s.players[shield.id]!,{x:17,y:0,z:11,hp:100,alive:true,prot:true});
  // Runtime fixture wall inserted through the collision provider, not render geometry.
  const room=h.room as unknown as {coreCollision:{hits(open:boolean):readonly Box[]}};
  const old=room.coreCollision.hits.bind(room.coreCollision);
  vi.spyOn(room.coreCollision,'hits').mockImplementation(open=>[...old(open),{min:{x:16,y:0,z:12},max:{x:18,y:3,z:12.5}}]);
  Object.assign(s.players[covered.id]!,{x:17,y:0,z:13,hp:100,alive:true,prot:false});
  await h.advance(Math.max(0,strike.startedAt+MORTAR.warningMs-Date.now()-50));
  expect(s.players[blue.id]!.hp).toBe(100);
  await h.advance(100);
  expect(s.players[blue.id]!.alive).toBe(false);
  expect(s.players[red.id]!.k).toBe(6); expect(s.redScore).toBe(6);
  expect(latest<SupportView>(red,'support').count).toBe(5);
  for(const c of [ally,covered,shield]) expect(s.players[c.id]!.hp).toBe(100);
  await red.send('syncView',{});await h.advance(50);
  expect(latest<MortarView>(red,'mortar').available).toBe(false);
});

it('impact rechecks newly closed cover, includes self damage, and cancels a departing operator immediately', async()=>{
  vi.useFakeTimers();vi.setSystemTime(1000000);
  const h=await createTestRoom(MortarRoom,{id:'arena-tdm',codec:ArenaSchema});
  const red=await h.connect(),blue=await h.connect();
  const room=h.room as unknown as {state:ArenaState;mortarSupport:MortarSupport;
    coreCollision:{hits(open:boolean):readonly Box[]};explodeMortar(s:import('../src/mortar.js').MortarStrike):void;
    onSeatExpired(c:unknown):void};
  const s=room.state;Object.assign(s.players[red.id]!,p());Object.assign(s.players[blue.id]!,{...p(1),x:16});
  room.mortarSupport.earn(red.id,5,s);room.mortarSupport.call(red.id,s,Date.now(),point);
  const strike=room.mortarSupport.view(red.id,s).strikes[0]!;
  const old=room.coreCollision.hits.bind(room.coreCollision);
  const spy=vi.spyOn(room.coreCollision,'hits').mockImplementation(open=>[...old(open),{min:{x:14,y:3,z:10},max:{x:18,y:4,z:12}}]);
  room.explodeMortar(strike);expect(s.players[blue.id]!.hp).toBe(100);
  spy.mockRestore();Object.assign(s.players[red.id]!,{x:16});room.explodeMortar(strike);
  expect(s.players[red.id]!.alive).toBe(false);expect(room.mortarSupport.view(blue.id,s).strikes).toEqual([]);
  Object.assign(s.players[red.id]!,p());room.mortarSupport.clear();room.mortarSupport.earn(red.id,5,s);
  room.mortarSupport.call(red.id,s,Date.now(),point);room.onSeatExpired({id:red.id});
  expect(latest<MortarView>(blue,'mortar').strikes).toEqual([]);
});
