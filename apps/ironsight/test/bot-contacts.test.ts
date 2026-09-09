import { afterEach, expect, it, vi } from 'vitest';
import { createTestRoom } from '@tikron/server/testing';
import { BOT_CONTACT, BotContacts } from '../src/bot-contacts.js';
import { botThink, createBotBrain, type BotBrain, type BotView } from '../src/bots.js';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema, type ArenaState } from '../src/schema.js';
import { contactText } from '../client/contact-presentation.js';

afterEach(() => { vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers(); });
function fixture() {
  const brain = createBotBrain({seed:1,role:'anchor',waypoints:[{x:20,y:10}]});
  const view: BotView = { self:{x:20,y:0,z:10,yaw:0,pitch:0,crouch:false,alive:true,team:0},
    enemies:[{id:'enemy',x:20.2,y:0,z:30.4,crouch:false,alive:true,team:1}],
    boxes:[],teamless:false,engagementRange:40 };
  const radio = new BotContacts();
  return {brain,view,radio};
}

it('requires sustained actual sight, emits one coarse frozen location and never consumes aim randomness', () => {
  const {brain,view,radio} = fixture();
  for (let i=0;i<12;i++) { botThink(view,brain,50); expect(radio.observe('bot-3',view,brain,1000+i*50)).toBeUndefined(); }
  botThink(view,brain,50);
  const rng = vi.spyOn(brain,'rng');
  const ping = radio.observe('bot-3',view,brain,1600);
  expect(ping).toEqual({from:'bot-3',kind:'enemy',contact:true,x:20,z:30,expiresAt:4600});
  view.enemies=[{...view.enemies[0]!,x:22}]; expect(ping?.x).toBe(20);
  expect(ping).not.toHaveProperty('targetId'); expect(rng).not.toHaveBeenCalled();
});

it.each(['cover','rear','range','dead','ally','sound','ffa','practice'] as const)('cannot report %s as visual intelligence', kind => {
  const {brain,view,radio}=fixture(); brain.lockId='enemy';brain.lockMs=600;
  if(kind==='cover')view.boxes=[{min:{x:18,y:0,z:20},max:{x:22,y:3,z:21}}];
  if(kind==='rear')view.self.yaw=Math.PI;
  if(kind==='range')view.engagementRange=10;
  if(kind==='dead')view.enemies=[{...view.enemies[0]!,alive:false}];
  if(kind==='ally')view.enemies=[{...view.enemies[0]!,team:0}];
  if(kind==='sound'){brain.lockId=null;brain.sound={x:20,z:30,untilMs:9999};}
  if(kind==='ffa')view.teamless=true;
  if(kind==='practice')view.showcase={role:'idle',faceYaw:0};
  expect(radio.observe('bot-3',view,brain,1000)).toBeUndefined();
});

it('shares team air time, limits each caller across lives, yields to people and resets only at round boundaries', () => {
  const {brain,view,radio}=fixture();brain.lockId='enemy';brain.lockMs=600;
  expect(radio.observe('bot-3',view,brain,1000)).toBeDefined();
  expect(radio.observe('bot-5',view,brain,8999)).toBeUndefined();
  expect(radio.observe('bot-3',view,brain,9000)).toBeUndefined();
  expect(radio.observe('bot-5',view,brain,9000)).toBeDefined();
  radio.yieldToHuman(0,16999,5000);
  expect(radio.observe('bot-3',view,brain,17000)).toBeUndefined();
  expect(radio.observe('bot-3',view,brain,21999)).toBeDefined();
  radio.clear();expect(radio.observe('bot-3',view,brain,22000)).toBeDefined();
});

class ContactArena extends ArenaRoomImpl {
  protected override startInWarmup=false;
}
it('real room routes only to living nearby allies, excludes nonteam/inactive modes and prevents a forged bot report', async () => {
  vi.useFakeTimers();vi.setSystemTime(1000000);
  const h=await createTestRoom(ContactArena,{id:'arena-tdm',codec:ArenaSchema,sync:'throttled'});
  const near=await h.connect(),enemy=await h.connect(),far=await h.connect(),dead=await h.connect();
  const r=h.room as unknown as {state:ArenaState;botBrains:Map<string,BotBrain>;botContacts:BotContacts;
    tickBots:(ms:number)=>void;botFire:(id:string)=>void};
  await h.advance(100);
  vi.spyOn(r,'botFire').mockImplementation(()=>{}); // keep fixed sight fixture alive
  for(const p of Object.values(r.state.players))p.alive=false;
  Object.assign(r.state.players[near.id]!,{alive:true,team:0,x:10,y:0,z:2});
  Object.assign(r.state.players[far.id]!,{alive:true,team:0,x:100,y:0,z:2});
  Object.assign(r.state.players[dead.id]!,{alive:false,team:0,x:10,y:0,z:2});
  Object.assign(r.state.players[enemy.id]!,{alive:true,team:1,x:28,y:0,z:2});
  const id=[...r.botBrains.keys()][0]!,b=r.botBrains.get(id)!;
  Object.assign(r.state.players[id]!,{alive:true,team:0,x:8,y:0,z:2,yaw:Math.PI/2,pitch:0});
  const frames=(c:typeof near)=>c.frames().filter(f=>f.type==='teamPing'&&(f.payload as {contact?:true})?.contact);
  for (const mode of [1,3,0,2]) {
    r.botContacts.clear();r.state.mode=mode;b.lockId=enemy.id;b.lockMs=600;
    r.tickBots(50);await h.advance(0);
    expect(frames(near)).toHaveLength(mode===0?1:mode===2?2:0);
  }
  expect(frames(enemy)).toHaveLength(0);expect(frames(far)).toHaveLength(0);expect(frames(dead)).toHaveLength(0);
  for(const phase of ['warmup','ended'] as const) {
    r.botContacts.clear();r.state.phase=phase;r.tickBots(50);await h.advance(0);
    expect(frames(near)).toHaveLength(2);
  }
  r.state.phase='live';r.state.mode=0;
  vi.spyOn(r,'tickBots').mockImplementation(()=>{});
  await near.send('ping',{yaw:0,pitch:-.5,from:id,contact:true,kind:'enemy'});await h.advance(50);
  const manual=near.frames().filter(f=>f.type==='teamPing').at(-1)!.payload;
  expect(manual).toMatchObject({from:near.id});expect(manual).not.toHaveProperty('contact');
});

it('describes the snapshot direction under wrapped yaw and retains an explicit age', () => {
  const ping={from:'bot-5',kind:'enemy' as const,contact:true as const,x:0,z:20,expiresAt:4000};
  const me={x:0,z:0};
  expect(contactText(ping,me,0,'FREIGHT',2000)).toContain('SCOUT 5 / CONTACT\nFREIGHT / AHEAD / 20 m\nLAST SEEN 1.0 s AGO');
  expect(contactText(ping,me,Math.PI,'FREIGHT',2000)).toContain('BEHIND');
  expect(contactText(ping,me,Math.PI/2,'FREIGHT',2000)).toContain('LEFT');
  expect(contactText(ping,me,-Math.PI/2+Math.PI*4,'FREIGHT',2000)).toContain('RIGHT');
  expect(BOT_CONTACT.lifetimeMs).toBeLessThan(BOT_CONTACT.teamCooldownMs);
});
