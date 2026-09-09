import { afterEach, expect, it, vi } from 'vitest';
import { createTestRoom } from '@tikron/server/testing';
import { BOT_ROLES, botLabel, botRole, type BotRole } from '../src/bot-roles.js';
import { botThink, createBotBrain, type BotView } from '../src/bots.js';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema, type ArenaPlayer } from '../src/schema.js';

const view = (): BotView => ({
  self: { x: 20, y: 0, z: 10, yaw: 0, pitch: 0, crouch: false, alive: true, team: 0 },
  enemies: [{ id: 'enemy', x: 20, y: 0, z: 30, crouch: false, alive: true, team: 1 }],
  teamless: false, boxes: [], engagementRange: 40,
});
const brain = (role: BotRole) => createBotBrain({ role, seed: 1,
  waypoints: [{ x: 40, y: 10 }], aimNoiseRad: 0 });
afterEach(() => { vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers(); });

it('assigns readable stable pairs without classifying training dummies or human ids', () => {
  expect(Array.from({length: 6}, (_, i) => botRole(`bot-${i + 1}`)))
    .toEqual(['rusher','rusher','anchor','anchor','sniper','sniper']);
  expect(botRole('bot-12')).toBe('sniper');
  expect(botLabel('bot-5')).toBe('SCOUT 5');
  for (const id of ['bot-idle','bot-0','bot-01','bot-2x','human','bot-9007199254740992'])
    expect(botRole(id)).toBeUndefined();
});

it('rushers use collision navigation to close, stop at nine metres, and cannot follow unseen enemies', () => {
  const v = view(), b = brain('rusher');
  v.navigate = vi.fn(() => ({x: 25, z: 10}));
  let d = botThink(v, b, 50);
  expect(v.navigate).toHaveBeenCalledWith(v.enemies[0]);
  expect(d.move.mx).toBeCloseTo(1); expect(d.move.mz).toBeCloseTo(0);
  expect(d.fire).toBe(false); // unchanged configured acquisition delay
  v.enemies = [{...v.enemies[0]!, z: 19}];
  vi.mocked(v.navigate).mockClear(); d = botThink(v, b, 50);
  expect(v.navigate).not.toHaveBeenCalled(); expect(d.move.ads).toBeUndefined();
  v.boxes = [{min:{x:18,y:0,z:14},max:{x:22,y:3,z:16}}];
  d = botThink(v, b, 50);
  expect(b.lockId).toBeNull(); expect(d.fire).toBe(false);
  expect(v.navigate).toHaveBeenLastCalledWith({x:40,z:10}); // patrol, not hidden target
});

it('scouts settle only at distance, retain reaction delay, and must relocate after 2.5 seconds', () => {
  const v=view(), b=brain('sniper');
  let d=botThink(v,b,50);
  expect(d.move).toMatchObject({mx:0,mz:0,ads:true});expect(d.fire).toBe(false);
  for(let i=0;i<4;i++) d=botThink(v,b,50);
  expect(d.fire).toBe(true);
  b.lockMs=2450; d=botThink(v,b,50);
  expect(d.move.ads).toBeUndefined();expect(Math.hypot(d.move.mx,d.move.mz)).toBeGreaterThan(0);
  b.lockMs=3950; d=botThink(v,b,50);expect(d.move.ads).toBe(true);
  v.enemies=[{...v.enemies[0]!,z:20}];
  expect(botThink(v,b,50).move.ads).toBeUndefined();
  v.enemies=[]; d=botThink(v,b,50);
  expect(d.move.ads).toBeUndefined();expect(d.fire).toBe(false);expect(b.lockMs).toBe(0);
});

it.each(['rusher','anchor','sniper'] as const)('%s keeps DOM travel priority, perception and stationary training', role => {
  const v=view(),b=brain(role); v.objective={x:40,z:10};
  let d=botThink(v,b,50);expect(d.move.mx).toBeCloseTo(1);expect(d.move.ads).toBeUndefined();
  v.objective={x:20,z:10};b.lockMs=3000;
  d=botThink(v,b,50);expect(Math.abs(d.move.mz)).toBeLessThanOrEqual(1);
  v.showcase={role:'idle',faceYaw:Math.PI};
  d=botThink(v,b,50);expect(d.move).toMatchObject({mx:0,mz:0});expect(d.fire).toBe(false);
});

it('a scout relocating on an arrived objective strafes around that point, never the old combat lane', () => {
  const v=view(), b=brain('sniper');
  v.self.z=70;v.enemies=[{...v.enemies[0]!,z:90}];v.objective={x:20,z:70};
  b.lockId='enemy';b.lockMs=3000;
  const d=botThink(v,b,50);
  expect(d.move.ads).toBeUndefined();expect(d.move.mz).toBeGreaterThan(0);
});

it('normal twelve-seat fill equips two of each role per team and restores the chosen weapon on respawn', async () => {
  vi.useFakeTimers();vi.setSystemTime(1000000);
  const h=await createTestRoom(ArenaRoomImpl,{id:'arena-tdm',codec:ArenaSchema,sync:'throttled'});
  await h.advance(100);
  const players=h.snapshot().players;
  expect(Object.keys(players)).toHaveLength(12);
  for(const team of [0,1]) for(const role of ['rusher','anchor','sniper'] as const)
    expect(Object.entries(players).filter(([id,p])=>p.team===team&&botRole(id)===role)).toHaveLength(2);
  const runtime=h.room as unknown as {state:{players:Record<string,ArenaPlayer>};spawnInto:(p:ArenaPlayer,id:string)=>void;
    tickBots:(ms:number)=>void;inputs:Map<string,{ads?:boolean}>};
  for(const [id,p] of Object.entries(runtime.state.players)) {
    expect(p.weapon).toBe(BOT_ROLES[botRole(id)!].weapon);expect(p.hp).toBe(100);
    p.weapon=4;p.hp=1;runtime.spawnInto(p,id);
    expect(p.weapon).toBe(BOT_ROLES[botRole(id)!].weapon);expect(p.hp).toBe(100);
  }
  // A fixed-pose room fixture checks the actual intent bridge; shared handling
  // receives ADS, then releases it on visual loss. Warmup still blocks damage.
  for(const p of Object.values(runtime.state.players))p.alive=false;
  const scout=runtime.state.players['bot-5']!,enemy=runtime.state.players['bot-2']!;
  Object.assign(scout,{alive:true,x:8,y:0,z:2,yaw:Math.PI/2,pitch:0});
  Object.assign(enemy,{alive:true,x:28,y:0,z:2,yaw:Math.PI*1.5,pitch:0});
  runtime.tickBots(50);expect(runtime.inputs.get('bot-5')?.ads).toBe(true);
  expect(enemy.hp).toBe(100);
  enemy.alive=false;runtime.tickBots(50);expect(runtime.inputs.get('bot-5')?.ads).toBe(false);
});
