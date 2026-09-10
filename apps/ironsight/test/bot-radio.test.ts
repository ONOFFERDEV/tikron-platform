import { afterEach, expect, it, vi } from 'vitest';
import { createTestRoom } from '@tikron/server/testing';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema, type ArenaState } from '../src/schema.js';
import { botThink, createBotBrain, readSquadPing, type BotBrain, type BotDecision, type BotView } from '../src/bots.js';
import { BotRadio } from '../src/rooms/bot-radio.js';

afterEach(() => { vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers(); });
function fixture() {
  const radio = new BotRadio();
  const brain = createBotBrain({ seed: 1, archetype: 'support', waypoints: [{ x: 20, y: 10 }] });
  brain.clockMs = 5000;
  const view: BotView = { self: { x: 20.2, y: 0, z: 10.3, yaw: 0, pitch: 0, alive: true, crouch: false, team: 0 },
    enemies: [{ id: 'enemy', x: 20.2, y: 0, z: 30.4, alive: true, crouch: false, team: 1 }],
    boxes: [], teamless: false, engagementRange: 40 };
  const decision: BotDecision = { move: { mx: 0, mz: 0, jump: false, crouch: false, sprint: false },
    look: { yaw: 0, pitch: 0 }, fire: false };
  return { radio, brain, view, decision };
}
it('announces an accepted reload at the caller, never an unaccepted intent or remembered enemy', () => {
  const { radio, brain, view, decision } = fixture();
  decision.reload = true;
  brain.sound = { x: 55, z: 20, untilMs: 9000 };
  expect(radio.observe('bot-9', view, brain, 1000, decision)).toBeUndefined();
  const rng = vi.spyOn(brain, 'rng');
  const ping = radio.observe('bot-9', view, brain, 1050, decision, { reloading: true, fired: false });
  expect(ping).toEqual({ from: 'bot-9', kind: 'backup', radio: 'reload', x: 20, z: 10, expiresAt: 4050 });
  expect(ping).not.toHaveProperty('targetId'); expect(rng).not.toHaveBeenCalled();
  view.self.x = 25; expect(ping?.x).toBe(20);
});
it('shares airtime across tactics and contacts, yields to human pings, and never queues stale transitions', () => {
  const { radio, brain, view, decision } = fixture();
  const reload = { reloading: true, fired: false };
  expect(radio.observe('bot-9', view, brain, 1000, decision, reload)).toBeDefined();
  brain.lockId = 'enemy'; brain.lockMs = 600;
  expect(radio.observe('bot-3', view, brain, 8999, decision)).toBeUndefined();
  expect(radio.observe('bot-3', view, brain, 9000, decision)?.radio).toBe('contact');
  radio.yieldToHuman(0, 16999, 5000);
  expect(radio.observe('bot-5', view, brain, 17000, decision, reload)).toBeUndefined();
  brain.lockId = null;
  expect(radio.observe('bot-5', view, brain, 21999, decision, reload)).toBeUndefined();
  radio.observe('bot-5', view, brain, 22000, decision);
  expect(radio.observe('bot-5', view, brain, 22050, decision, reload)?.radio).toBe('reload');
  // The caller limit survives respawn, even if another life starts reloading.
  radio.observe('bot-5', view, brain, 30050, decision);
  expect(radio.observe('bot-5', view, brain, 30100, decision, reload)).toBeUndefined();
  radio.clear(); expect(radio.observe('bot-5', view, brain, 30150, decision, reload)).toBeDefined();
});
it.each(['cover', 'rear', 'range', 'dead', 'ally', 'sound', 'reaction'] as const)('does not turn %s into contact intelligence', kind => {
  const { radio, brain, view, decision } = fixture(); brain.lockId = 'enemy'; brain.lockMs = 600;
  if (kind === 'cover') view.boxes = [{ min: { x: 18, y: 0, z: 20 }, max: { x: 22, y: 3, z: 21 } }];
  if (kind === 'rear') view.self.yaw = Math.PI;
  if (kind === 'range') view.engagementRange = 10;
  if (kind === 'dead') view.enemies[0]!.alive = false;
  if (kind === 'ally') view.enemies[0]!.team = 0;
  if (kind === 'sound') { brain.lockId = null; brain.sound = { x: 20, z: 30, untilMs: 9999 }; }
  if (kind === 'reaction') brain.lockMs = 599;
  decision.tactic = 'suppress';
  expect(radio.observe('bot-9', view, brain, 1000, decision, { reloading: false, fired: true })).toBeUndefined();
});
it('suppression requires confirmed fire; retreat, flank and roof barks describe actual own actions', () => {
  const { radio, brain, view, decision } = fixture(); brain.lockId = 'enemy'; brain.lockMs = 600;
  decision.tactic = 'suppress';
  expect(radio.observe('bot-9', view, brain, 1000, decision)?.radio).toBe('contact');
  radio.clear();
  expect(radio.observe('bot-9', view, brain, 1000, decision, { fired: true, reloading: false })?.radio).toBe('suppress');
  radio.clear(); brain.lockId = null; decision.tactic = 'retreat';
  expect(radio.observe('bot-9', view, brain, 1000, decision)).toBeUndefined();
  brain.recovery = { point: { x: 20, y: 0, z: 8 }, crouch: true, reason: 'retreat', startedMs: 5000, untilMs: 6800 };
  expect(radio.observe('bot-9', view, brain, 1000, decision)?.radio).toBe('retreat');
  radio.clear(); brain.recovery = undefined; decision.tactic = undefined;
  brain.flank = { points: [{ x: 25, z: 10 }], index: 0, untilMs: 9000 }; decision.move.mz = 1;
  expect(radio.observe('bot-9', view, brain, 1000, decision)).toBeUndefined(); // paused plan is not motion
  decision.tactic = 'flank';
  expect(radio.observe('bot-9', view, brain, 1000, decision)?.radio).toBe('flank');
  radio.clear(); brain.flank = undefined; decision.tactic = 'hold';
  brain.positioning = { point: { x: 20, y: 3, z: 10 }, untilMs: 9000, holdUntilMs: 8000 };
  expect(radio.observe('bot-9', view, brain, 1000, decision)).toBeUndefined();
  view.self.y = 3;
  expect(radio.observe('bot-9', view, brain, 1000, decision)?.radio).toBe('highGround');
});
it('distinguishes walking the flank from interrupting that plan to duel a close opponent', () => {
  const { brain, view } = fixture();
  brain.flank = { points: [{ x: 30, z: 10 }], index: 0, untilMs: 9000 };
  view.enemies = [];
  expect(botThink(view, brain, 50).tactic).toBe('flank');
  view.enemies = [{ id: 'enemy', x: 20.2, y: 0, z: 13, alive: true, crouch: false, team: 1 }];
  expect(botThink(view, brain, 50).tactic).not.toBe('flank');
  expect(brain.flank).toBeDefined(); // resumes later; the radio must not mistake this for current movement
});
it.each(['ffa', 'practice', 'dead', 'identity'] as const)('does not transmit tactical barks for %s', kind => {
  const { radio, brain, view, decision } = fixture();
  if (kind === 'ffa') view.teamless = true;
  if (kind === 'practice') view.showcase = { role: 'idle', faceYaw: 0 };
  if (kind === 'dead') view.self.alive = false;
  expect(radio.observe(kind === 'identity' ? 'person' : 'bot-9', view, brain, 1000, decision,
    { reloading: true, fired: false })).toBeUndefined();
});
it('validates fixed vocabulary, safe identity, consistent markers and expiry before presentation', () => {
  const ping = { from: 'bot-9', radio: 'reload', kind: 'backup', x: 1, z: 2, expiresAt: 4000 };
  expect(readSquadPing(ping, 1000)).toEqual(ping);
  for (const change of [{ from: Symbol() }, { from: 'person' }, { radio: '__proto__' }, { radio: '<b>hello</b>' },
    { kind: 'enemy' }, { contact: true }, { x: NaN }, { expiresAt: Infinity }, { expiresAt: 1000 }, { expiresAt: 5001 }])
    expect(readSquadPing({ ...ping, ...change }, 1000)).toBeUndefined();
});

it('room transmits accepted reload barks only to living nearby allies and strips forged metadata', async () => {
  vi.useFakeTimers(); vi.setSystemTime(1000000);
  class Round extends ArenaRoomImpl { protected override startInWarmup = false; }
  const h = await createTestRoom(Round, { id: 'arena-tdm', codec: ArenaSchema, sync: 'throttled' });
  const near = await h.connect(), enemy = await h.connect(), far = await h.connect(), dead = await h.connect();
  const r = h.room as unknown as { state: ArenaState; botBrains: Map<string, BotBrain>; botContacts: BotRadio;
    tickBots: (ms: number) => void; botFire: (id: string) => void;
    magByW: Map<string, number[]>; reloadUntil: Map<string, number> };
  await h.advance(100);
  for (const p of Object.values(r.state.players)) p.alive = false;
  Object.assign(r.state.players[near.id]!, { alive: true, team: 0, x: 10, y: 0, z: 2 });
  Object.assign(r.state.players[enemy.id]!, { alive: true, team: 1, x: 10, y: 0, z: 2 });
  Object.assign(r.state.players[far.id]!, { alive: true, team: 0, x: 100, y: 0, z: 2 });
  Object.assign(r.state.players[dead.id]!, { alive: false, team: 0, x: 10, y: 0, z: 2 });
  const id = [...r.botBrains.keys()][0]!, brain = r.botBrains.get(id)!;
  Object.assign(r.state.players[id]!, { alive: true, team: 0, x: 8, y: 0, z: 2, yaw: 0, weapon: 0 });
  brain.clockMs = 5000; brain.positioning = undefined; brain.lockId = null;
  r.magByW.get(id)![0] = 0;
  const radios = (c: typeof near) => c.frames().filter(f => f.type === 'teamPing' && (f.payload as { radio?: string })?.radio);
  r.tickBots(50); await h.advance(0);
  expect(r.reloadUntil.get(id)).toBeGreaterThan(Date.now());
  expect(radios(near).at(-1)?.payload).toMatchObject({ from: id, kind: 'backup', radio: 'reload', x: 8, z: 2 });
  expect(radios(enemy)).toHaveLength(0); expect(radios(far)).toHaveLength(0); expect(radios(dead)).toHaveLength(0);
  // The shot must still count when wall time advances during hit validation.
  // Date.now equality after the handler used to lose this accepted discharge.
  Object.assign(r.state.players[id]!, { yaw: Math.PI / 2, pitch: 0 });
  Object.assign(r.state.players[enemy.id]!, { x: 28, z: 2 });
  r.reloadUntil.delete(id); r.magByW.get(id)![0] = 30;
  brain.lockId = enemy.id; brain.lockMs = 1000; brain.recovery = undefined;
  const fire = r.botFire.bind(r);
  vi.spyOn(r, 'botFire').mockImplementation(bot => { fire(bot); vi.setSystemTime(Date.now() + 1); });
  const observe = vi.spyOn(r.botContacts, 'observe');
  r.tickBots(50);
  expect(r.magByW.get(id)![0]).toBe(29);
  expect(observe.mock.calls.find(args => args[0] === id)?.[5]?.fired).toBe(true);
  vi.spyOn(r, 'tickBots').mockImplementation(() => {});
  await near.send('ping', { yaw: 0, pitch: -.5, from: id, radio: 'suppress', contact: true }); await h.advance(50);
  const manual = near.frames().filter(f => f.type === 'teamPing').at(-1)?.payload;
  expect(manual).toMatchObject({ from: near.id }); expect(manual).not.toHaveProperty('radio');
  expect(manual).not.toHaveProperty('contact');
});
