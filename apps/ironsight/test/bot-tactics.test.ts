import { afterEach, expect, it, vi } from 'vitest';
import { createTestRoom } from '@tikron/server/testing';
import { BOT_ARCHETYPES, BOT_DIFFICULTIES, botReached, botThink, combatBotArchetype, combatBotLabel,
  createBotBrain, resetBotPerception, startBotFlank, startBotPosition, type BotArchetype, type BotBrain, type BotDifficulty,
  type BotView } from '../src/bots.js';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema, type ArenaPlayer } from '../src/schema.js';
import { GAME } from '../src/game-config.js';

afterEach(() => { vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers(); });
function fixture(archetype: BotArchetype = 'support', difficulty: BotDifficulty = 'hard') {
  const brain = createBotBrain({ archetype, difficulty, seed: 6, aimNoiseRad: 0, waypoints: [{ x: 20, y: 40 }] });
  const view: BotView = {
    self: { x: 20, y: 0, z: 10, yaw: 0, pitch: 0, alive: true, crouch: false, team: 0, hp: 100 },
    enemies: [{ id: 'enemy', x: 20, y: 0, z: 30, alive: true, crouch: false, team: 1 }],
    boxes: [], teamless: false, ammo: { mag: 30, capacity: 30, reserve: 90, reloading: false },
  };
  return { brain, view };
}

it('distributes all four identities in stable pairs without reclassifying people or training dummies', () => {
  expect(Array.from({ length: 12 }, (_, i) => combatBotArchetype(`bot-${i + 1}`))).toEqual([
    'rusher', 'rusher', 'anchor', 'anchor', 'marksman', 'marksman', 'rusher', 'rusher', 'support', 'support', 'marksman', 'marksman',
  ]);
  expect(combatBotLabel('bot-9')).toBe('SUPPORT 9');
  expect(combatBotLabel('bot-5')).toBe('MARKSMAN 5');
  for (const id of ['human', 'bot-idle', 'bot-0', 'bot-01', 'bot-9007199254740992']) expect(combatBotArchetype(id)).toBeUndefined();
});

it.each(Object.keys(BOT_ARCHETYPES) as BotArchetype[])('%s scales reaction/depth, with identical seeded aim at every difficulty', archetype => {
  const looks: unknown[][] = [];
  for (const difficulty of Object.keys(BOT_DIFFICULTIES) as BotDifficulty[]) {
    const { view } = fixture(archetype, difficulty), samples = [];
    const brain = createBotBrain({ archetype, difficulty, seed: 6, waypoints: [{ x: 20, y: 40 }] });
    let firstFire: number | undefined;
    for (let ms = 0; ms <= 650; ms += 25) {
      const d = botThink(view, brain, 25); samples.push(d.look);
      if (d.fire && firstFire === undefined) firstFire = ms;
    }
    expect(firstFire).toBeGreaterThanOrEqual(brain.reactionMs);
    expect(firstFire).toBeLessThan(brain.reactionMs + 25);
    expect(brain.reactionMs).toBeLessThanOrEqual(600);
    expect(brain.reactionMs).toBeGreaterThanOrEqual(150);
    if (difficulty === 'easy') expect(firstFire).toBe(600);
    looks.push(samples);
  }
  expect(looks[0]).toEqual(looks[1]); expect(looks[1]).toEqual(looks[2]);
});

it('higher decision depth commits to a flank, while easy retains the direct patrol', () => {
  for (const difficulty of ['easy', 'hard'] as const) {
    const b = createBotBrain({ difficulty, archetype: 'rusher', seed: 1, waypoints: [{ x: 20, y: 10 }],
      flankRoute: [{ x: 10, y: 0, z: 5 }, { x: 30, y: 0, z: 5 }] });
    startBotFlank(b, { x: 10, z: 10 });
    expect(!!b.flank).toBe(difficulty === 'hard');
  }
});

it('marksmen walk to reachable high ground, hold briefly and yield to objectives or close threats', () => {
  const {brain,view}=fixture('marksman');
  const point={x:30,y:3,z:10};
  startBotPosition(brain,point);
  view.navigate=vi.fn(()=>({x:22,y:0,z:10}));
  let d=botThink(view,brain,50);
  expect(d.tactic).toBe('position');expect(d.fire).toBe(false); // normal reaction
  expect(view.navigate).toHaveBeenCalledWith(point);
  expect(d.move.mx).toBeGreaterThan(.9); // still aiming toward the visible enemy
  Object.assign(view.self,point);
  d=botThink(view,brain,50);
  expect(d).toMatchObject({tactic:'hold',move:{mx:0,mz:0,ads:true}});
  brain.clockMs+=6000;
  botThink(view,brain,50);expect(brain.positioning).toBeUndefined();
  startBotPosition(brain,point);view.objective={x:50,y:0,z:10};
  botThink(view,brain,50);expect(brain.positioning).toBeUndefined();
  view.objective=undefined;Object.assign(view.self,{x:20,y:0,z:10});
  startBotPosition(brain,point);view.enemies=[{...view.enemies[0]!,z:13}];
  expect(botThink(view,brain,50).tactic).not.toBe('position');
  resetBotPerception(brain);expect(brain.positioning).toBeUndefined();
  const easy=fixture('marksman','easy').brain;
  startBotPosition(easy,point);expect(easy.positioning).toBeUndefined();
});

it('holds aimed support bursts with audible gaps, drops fire immediately on sight loss', () => {
  const { brain, view } = fixture();
  brain.lockId = 'enemy'; brain.lockMs = brain.reactionMs + 850;
  expect(botThink(view, brain, 25)).toMatchObject({ fire: true, tactic: 'suppress', move: { ads: true } });
  expect(botThink(view, brain, 25).fire).toBe(false);
  brain.lockMs = brain.reactionMs + 1225;
  expect(botThink(view, brain, 25).fire).toBe(true);
  view.enemies = [];
  expect(botThink(view, brain, 25).fire).toBe(false);
  expect(brain.lockId).toBeNull();
});

it('retreats before a tactical reload, crouches at waist cover, then resumes its objective', () => {
  const { brain, view } = fixture();
  view.ammo!.mag = 6; view.objective = { x: 40, y: 0, z: 10 };
  const cover = { point: { x: 18, y: 0, z: 10 }, crouch: true };
  view.findCover = vi.fn(() => cover);
  let d = botThink(view, brain, 50);
  expect(d).toMatchObject({ fire: false, reload: false, tactic: 'reload' });
  expect(d.move.mx).toBeLessThan(0); // away from the objective, toward verified cover
  expect(view.findCover).toHaveBeenCalledWith({ x: 20, y: 1.65, z: 30, untilMs: 1300 }, 3, true);
  view.self.x = 18; view.enemies = [];
  d = botThink(view, brain, 50);
  expect(d).toMatchObject({ fire: false, reload: true, move: { mx: 0, mz: 0, crouch: true } });
  view.ammo!.reloading = true;
  expect(botThink(view, brain, 50).reload).toBe(false);
  view.ammo = { ...view.ammo!, mag: 30, reserve: 66, reloading: false };
  d = botThink(view, brain, 50);
  expect(brain.recovery).toBeUndefined(); expect(d.reload).toBeUndefined();
  expect(d.move.mz * Math.sin(d.look.yaw) + d.move.mx * Math.cos(d.look.yaw)).toBeGreaterThan(.9);
});

it('empty magazines reload during the retreat, and missing cover never stalls a reload', () => {
  const { brain, view } = fixture(); view.ammo!.mag = 0;
  view.findCover = () => ({ point: { x: 18, y: 0, z: 10 }, crouch: false });
  expect(botThink(view, brain, 50)).toMatchObject({ reload: true, fire: false });
  resetBotPerception(brain); view.findCover = () => undefined;
  expect(botThink(view, brain, 50)).toMatchObject({ reload: true, fire: false });
  view.ammo!.reserve = 0;
  expect(botThink(view, brain, 50).reload).toBeUndefined();
});

it('injury retreat has a deadline/cooldown and cannot use a hidden enemy as a live destination', () => {
  const { brain, view } = fixture('anchor'); view.self.hp = 30;
  view.findCover = vi.fn(() => ({ point: { x: 18, y: 0, z: 10 }, crouch: false }));
  expect(botThink(view, brain, 50).tactic).toBe('retreat');
  view.enemies = [{ ...view.enemies[0]!, x: 100, z: 100 }];
  for (let i = 0; i < 38; i++) expect(botThink(view, brain, 50).fire).toBe(false);
  expect(brain.recovery).toBeUndefined(); expect(brain.recentThreat).toBeUndefined();
  expect(view.findCover).toHaveBeenCalledTimes(1);
  resetBotPerception(brain);
  expect(brain.recovery).toBeUndefined(); expect(brain.nextRetreatMs).toBe(0);
});

it('preserves height through route steering and cannot finish a roof waypoint from downstairs', () => {
  const { brain, view } = fixture('rusher'); view.enemies = [];
  const roof = { x: 20, y: 3, z: 10 };
  view.objective = roof; view.navigate = vi.fn(() => ({ x: 22, y: 0, z: 10 }));
  expect(botReached(view.self, roof)).toBe(false);
  const d = botThink(view, brain, 50);
  expect(view.navigate).toHaveBeenCalledWith(roof);
  expect(Math.hypot(d.move.mx, d.move.mz)).toBeGreaterThan(.9);
  view.self.y = 3; expect(botReached(view.self, roof)).toBe(true);
});

it.each(['easy', 'hard'] as const)('room %s bots retain normal HP, weapons, reload delay and reserve cost', async difficulty => {
  vi.useFakeTimers(); vi.setSystemTime(1000000);
  class TestArena extends ArenaRoomImpl { protected override botDifficulty = difficulty; }
  const h = await createTestRoom(TestArena, { id: 'arena-tdm', codec: ArenaSchema, sync: 'throttled' });
  await h.advance(100);
  const r = h.room as unknown as { state: { players: Record<string, ArenaPlayer> }; botBrains: Map<string, BotBrain>;
    botView: (id: string, p: ArenaPlayer) => BotView; tickBots: (ms: number) => void;
    magByW: Map<string, number[]>; reserveByW: Map<string, number[]> };
  for (const team of [0, 1]) for (const role of Object.keys(BOT_ARCHETYPES) as BotArchetype[])
    expect(Object.entries(r.state.players).filter(([id, p]) => p.team === team && r.botBrains.get(id)?.archetype === role))
      .toHaveLength(role === 'rusher' || role === 'marksman' ? 2 : 1);
  for (const [id, p] of Object.entries(r.state.players)) {
    expect(p.hp).toBe(100); expect(p.weapon).toBe(BOT_ARCHETYPES[combatBotArchetype(id)!].weapon);
    expect(r.botBrains.get(id)?.difficulty).toBe(difficulty); p.alive = false;
  }
  const id = 'bot-9', p = r.state.players[id]!;
  Object.assign(p, { alive: true, x: 20, y: 0, z: 10 });
  r.magByW.get(id)![0] = 0;
  const reserve = r.reserveByW.get(id)![0]!;
  const baseView = r.botView.bind(r);
  vi.spyOn(r, 'botView').mockImplementation((bot, player) => ({ ...baseView(bot, player), enemies: [] }));
  r.tickBots(50);
  expect(p.reloadEnd).toBe(Date.now() + GAME.weapons[0]!.reloadMs);
  expect(r.magByW.get(id)![0]).toBe(0);
  vi.spyOn(r, 'tickBots').mockImplementation(() => {});
  await h.advance(GAME.weapons[0]!.reloadMs - 50); expect(r.magByW.get(id)![0]).toBe(0);
  await h.advance(50);
  expect(r.magByW.get(id)![0]).toBe(GAME.weapons[0]!.mag);
  expect(r.reserveByW.get(id)![0]).toBe(reserve - GAME.weapons[0]!.mag);
  expect(p.hp).toBe(100);
});
