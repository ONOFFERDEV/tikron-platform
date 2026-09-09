// [blueprint] — pure botThink()/createBotBrain() behavior on hand-built fixtures;
// no import of config.ts, GAME, or any weapon/team identity.
import { describe, it, expect } from "vitest";
import { alertBot, BOT_PERCEPTION, botHearsShot, botThink, createBotBrain, resetBotPerception, type BotView } from "../src/bots.js";

/**
 * bots.ts is a pure module (see its own doc comment): {@link botThink} takes the
 * world as the bot perceives it plus its own mutable brain state and a tick
 * delta, with no room import — so these tests drive it directly with a
 * hand-built {@link BotView}, no createTestRoom.
 */

function baseView(overrides: Partial<BotView> = {}): BotView {
  return {
    self: { x: 30, y: 0, z: 10, crouch: false, alive: true, team: 0, yaw: 0, pitch: 0 },
    enemies: [],
    teamless: false,
    boxes: [],
    ...overrides,
  };
}

describe("expanded arena encounters", () => {
  it("keeps travelling when a visible target is outside effective range", () => {
    const brain = createBotBrain({ seed: 1, reactionMs: 0, waypoints: [{ x: 30, y: 90 }] });
    const view = baseView({ engagementRange: 40,
      enemies: [{ id: "far", x: 30, y: 0, z: 80, crouch: false, alive: true, team: 1 }] });
    const decision = botThink(view, brain, 50);
    expect(decision.fire).toBe(false);
    expect(decision.move.mz).toBe(1);
    expect(brain.lockId).toBeNull();
  });
  it("anchors a new firefight locally instead of dragging the bot back to the legacy lane", () => {
    const brain = createBotBrain({ seed: 1, reactionMs: 0, aimNoiseRad: 0,
      waypoints: [{ x: 30, y: 90 }], strafeZ: 11 });
    const view = baseView({ engagementRange: 40,
      self: { x: 30, y: 0, z: 70, crouch: false, alive: true, team: 0, yaw: 0, pitch: 0 },
      enemies: [{ id: "near", x: 30, y: 0, z: 80, crouch: false, alive: true, team: 1 }] });
    const decision = botThink(view, brain, 50);
    expect(decision.fire).toBe(true);
    expect(decision.move.mz).toBeGreaterThan(0);
    expect(brain.engagementZ).toBe(70);
  });
});

describe("botThink — dom objective", () => {
  it("follows collision navigation around a wall while keeping the real objective as its arrival target", () => {
    const brain = createBotBrain({ seed: 1, waypoints: [{ x: 0, y: 0 }] });
    const objective = { x: 30, z: 20 };
    const decision = botThink(baseView({ objective, navigate: target => {
      expect(target).toEqual(objective);
      return { x: 25, z: 10 }; // the next corner is west, though the objective is north
    } }), brain, 50);
    // Facing now turns gradually; reconstruct world movement to check the
    // same westward route independently of the current look angle.
    expect(decision.move.mz * Math.sin(decision.look.yaw) + decision.move.mx * Math.cos(decision.look.yaw)).toBeCloseTo(-1);
    expect(decision.move.mz * Math.cos(decision.look.yaw) - decision.move.mx * Math.sin(decision.look.yaw)).toBeCloseTo(0);
    expect(decision.fire).toBe(false);
  });

  it("with an objective and no visible enemy, walks straight toward it instead of patrolling", () => {
    const brain = createBotBrain({ seed: 1, waypoints: [{ x: 0, y: 0 }] }); // unused while an objective is set
    const view = baseView({ objective: { x: 30, z: 20 } }); // due "north" of self (30,10)
    const decision = botThink(view, brain, 50);

    expect(decision.fire).toBe(false);
    expect(decision.look.yaw).toBeCloseTo(0, 5); // atan2(dx=0, dz=10) === 0
    expect(decision.move.mz).toBeCloseTo(1, 5); // "forward" in its own facing frame
    expect(decision.move.mx).toBeCloseTo(0, 5);
  });

  it("without an objective (tdm/ffa), falls back to the unchanged waypoint patrol", () => {
    const brain = createBotBrain({ seed: 1, waypoints: [{ x: 30, y: 40 }] }); // due "north" too
    const view = baseView(); // no objective field at all
    const decision = botThink(view, brain, 50);

    expect(decision.fire).toBe(false);
    expect(decision.move).toEqual({ mx: 0, mz: 1, jump: false, crouch: false, sprint: false });
  });

  it("with an objective and a visible-but-distant enemy (beyond the close-threat range), still pushes toward the objective", () => {
    const brain = createBotBrain({ seed: 1, waypoints: [{ x: 0, y: 0 }] });
    const view = baseView({
      objective: { x: 30, z: 20 }, // due north of self (30,10)
      enemies: [{ id: "e1", x: 10, y: 0, z: 10, crouch: false, alive: true, team: 1 }], // 20 m west — visible, far
    });
    const decision = botThink(view, brain, 50);

    // Reconstruct the resulting world-space move direction from (mx,mz) and the
    // yaw the bot is actually facing (the AIM yaw here, not the travel yaw) —
    // mirrors arena-room.ts's integrate(). Proves travel isn't entangled with
    // combat-strafe's fixed anchor: the enemy is visible the whole time, and
    // the old (rejected) design would have engaged combat-strafe here instead.
    const { mx, mz } = decision.move;
    const yaw = decision.look.yaw;
    const wx = mz * Math.sin(yaw) + mx * Math.cos(yaw);
    const wz = mz * Math.cos(yaw) - mx * Math.sin(yaw);
    expect(wz).toBeGreaterThan(0.95); // world motion points north, toward the objective
    expect(Math.abs(wx)).toBeLessThan(0.1);
  });

  it("once within arrival range of the objective, holds there anchored on the objective's own z (not the brain's unrelated default strafeZ)", () => {
    const brain = createBotBrain({ seed: 1, waypoints: [{ x: 0, y: 0 }] }); // default strafeZ = 11
    // Objective at z=20, self already within the ~2 m arrival radius but far from
    // the brain's default strafeZ (11) — if the hold-strafe were still anchored
    // there (the rejected design), it would push hard south (mz<0) off the point.
    const view = baseView({
      self: { x: 30, y: 0, z: 19.5, crouch: false, alive: true, team: 0, yaw: 0, pitch: 0 },
      objective: { x: 30, z: 20 },
    });
    const decision = botThink(view, brain, 50);

    expect(decision.fire).toBe(false);
    expect(decision.move.mz).toBeGreaterThan(0); // pushes toward the objective's own z, not toward 11
  });
});

describe("botThink — practice showcase bots", () => {
  const FACE_YAW = -Math.PI / 2;

  it("idle: stationary, holds its fixed facing, ignores a visible nearby enemy", () => {
    const brain = createBotBrain({ seed: 1, waypoints: [{ x: 12, y: 6 }] }); // unused (stationary)
    const view = baseView({
      self: { x: 12, y: 0, z: 6, crouch: false, alive: true, team: 0, yaw: 1.23, pitch: -0.4 },
      enemies: [{ id: "e1", x: 15, y: 0, z: 6, crouch: false, alive: true, team: 1 }], // 3 m away — would normally be engaged
      teamless: true,
      showcase: { role: "idle", faceYaw: FACE_YAW },
    });
    const decision = botThink(view, brain, 50);

    expect(decision.move).toEqual({ mx: 0, mz: 0, jump: false, crouch: false, sprint: false });
    expect(decision.fire).toBe(false);
    expect(decision.look).toEqual({ yaw: FACE_YAW, pitch: 0 }); // fixed facing, not the enemy
  });

  it("crouch: stationary but crouched", () => {
    const brain = createBotBrain({ seed: 1, waypoints: [{ x: 12, y: 10 }] });
    const view = baseView({
      self: { x: 12, y: 0, z: 10, crouch: false, alive: true, team: 0, yaw: 0, pitch: 0 },
      showcase: { role: "crouch", faceYaw: FACE_YAW },
    });
    const decision = botThink(view, brain, 50);

    expect(decision.move).toEqual({ mx: 0, mz: 0, jump: false, crouch: true, sprint: false });
    expect(decision.look).toEqual({ yaw: FACE_YAW, pitch: 0 });
  });

  // Since the 2026-07-23 stand-still change, EVERY showcase role holds its
  // position (target dummies first) — walk/sprint stand upright, sneak keeps
  // the crouched pose, and none of them steers toward waypoints anymore.
  it("walk: stands still facing the player, no crouch/sprint", () => {
    const brain = createBotBrain({ seed: 1, waypoints: [{ x: 12, y: 19 }, { x: 12, y: 27 }] });
    const view = baseView({
      self: { x: 12, y: 0, z: 23, crouch: false, alive: true, team: 0, yaw: 0, pitch: 0 },
      showcase: { role: "walk", faceYaw: FACE_YAW },
    });
    const decision = botThink(view, brain, 50);

    expect(decision.move.mz).toBe(0);
    expect(decision.move.mx).toBe(0);
    expect(decision.move.crouch).toBe(false);
    expect(decision.move.sprint).toBe(false);
    expect(decision.look?.yaw).toBe(FACE_YAW);
    expect(decision.fire).toBe(false);
  });

  it("sprint: stands still too - the role no longer sprints anywhere", () => {
    const brain = createBotBrain({ seed: 1, waypoints: [{ x: 12, y: 18 }, { x: 12, y: 38 }] });
    const view = baseView({
      self: { x: 12, y: 0, z: 28, crouch: false, alive: true, team: 0, yaw: 0, pitch: 0 },
      showcase: { role: "sprint", faceYaw: FACE_YAW },
    });
    const decision = botThink(view, brain, 50);

    expect(decision.move.mz).toBe(0);
    expect(decision.move.crouch).toBe(false);
    expect(decision.move.sprint).toBe(false);
  });

  it("sneak: stands still but keeps the crouched pose", () => {
    const brain = createBotBrain({ seed: 1, waypoints: [{ x: 12, y: 12 }, { x: 12, y: 18 }] });
    const view = baseView({
      self: { x: 12, y: 0, z: 15, crouch: false, alive: true, team: 0, yaw: 0, pitch: 0 },
      showcase: { role: "sneak", faceYaw: FACE_YAW },
    });
    const decision = botThink(view, brain, 50);

    expect(decision.move.mz).toBe(0);
    expect(decision.move.crouch).toBe(true);
    expect(decision.move.sprint).toBe(false);
  });
});

it('turns toward heard rear gunfire over time and cannot shoot through the acquisition turn', () => {
  const brain = createBotBrain({ seed: 1, waypoints: [{ x: 30, y: 40 }], reactionMs: 0, aimNoiseRad: 0 });
  const view = baseView({ enemies: [{ id: 'rear', x: 30, y: 0, z: 0, crouch: false, alive: true, team: 1 }] });
  alertBot(brain, view.enemies[0]!);
  const first = botThink(view, brain, 50);
  expect(Math.abs(first.look.yaw)).toBeLessThanOrEqual(0.301);
  expect(first.fire).toBe(false);
  let decision = first;
  for (let i = 0; i < 15; i++) {
    view.self.yaw = decision.look.yaw; view.self.pitch = decision.look.pitch;
    decision = botThink(view, brain, 50);
  }
  expect(decision.look.yaw).toBeCloseTo(Math.PI, 4);
  expect(decision.fire).toBe(true);
});

describe('flank and counter perception', () => {
  const brainFor = () => createBotBrain({ seed: 58, waypoints: [{x:30,y:40}], aimNoiseRad:0, reactionMs:150 });
  const enemy = (id:string, x:number, z:number) => ({ id,x,y:0,z,crouch:false,alive:true,team:1 });
  it('leaves a silent rear flank unseen, including at close range; FFA still treats equal teams as hostile', () => {
    const brain=brainFor(), view=baseView({enemies:[enemy('rear',30,8)]});
    for(let i=0;i<40;i++) {
      const d=botThink(view,brain,50); view.self.yaw=d.look.yaw;
      expect(d.fire).toBe(false); expect(brain.lockId).toBeNull();
    }
    view.teamless=true;view.enemies=[{...enemy('front',30,20),team:0}];
    for(let i=0;i<4;i++)botThink(view,brain,50);
    expect(brain.lockId).toBe('front');expect(brain.lockMs).toBe(150);
  });
  it('uses a 120-degree acquisition cone, 160-degree tracking cone and resets reaction after losing sight', () => {
    const brain=brainFor(),view=baseView();
    const at=(degrees:number)=>enemy('target',30+10*Math.sin(degrees*Math.PI/180),10+10*Math.cos(degrees*Math.PI/180));
    view.enemies=[at(61)];botThink(view,brain,50);expect(brain.lockId).toBeNull();
    view.enemies=[at(59)];botThink(view,brain,50);expect(brain.lockId).toBe('target');
    view.enemies=[at(79)];botThink(view,brain,50);expect(brain.lockMs).toBe(50);
    view.enemies=[at(81)];botThink(view,brain,50);expect(brain.lockId).toBeNull();
    view.enemies=[at(0)];expect(botThink(view,brain,50).fire).toBe(false);expect(brain.lockMs).toBe(0);
  });
  it('copies and expires a sound location, never tracks a hidden moving source or grants a shot through cover', () => {
    const brain=brainFor(),source={x:30,z:0};alertBot(brain,source);source.x=99;
    expect(brain.sound?.x).toBe(30);
    const view=baseView({enemies:[enemy('rear',30,0)],boxes:[{min:{x:20,y:0,z:4},max:{x:40,y:4,z:5}}]});
    for(let i=0;i<24;i++) {const d=botThink(view,brain,50);view.self.yaw=d.look.yaw;
      expect(d.fire).toBe(false);expect(brain.lockId).toBeNull();}
    expect(brain.sound).toBeDefined();botThink(view,brain,50);expect(brain.sound).toBeUndefined();
  });
  it('hears open gunfire within 28m, through cover only within 10m, never beyond range', () => {
    const self=baseView().self, wall=[{min:{x:20,y:0,z:14},max:{x:40,y:4,z:15}}];
    const source=(z:number)=>({x:30,y:1.65,z});
    expect(botHearsShot(self,source(38),[])).toBe(true);
    expect(botHearsShot(self,source(38.01),[])).toBe(false);
    expect(botHearsShot(self,source(20),wall)).toBe(true);
    expect(botHearsShot(self,source(20.01),wall)).toBe(false);
  });
  it('rate bounds sound refresh, lets confirmed damage override it, and forgets the prior life', () => {
    const brain=brainFor();alertBot(brain,{x:1,z:2});alertBot(brain,{x:3,z:4});
    expect(brain.sound?.x).toBe(1);alertBot(brain,{x:3,z:4},true);expect(brain.sound?.x).toBe(3);
    brain.clockMs+=BOT_PERCEPTION.soundRefreshMs;alertBot(brain,{x:5,z:6});expect(brain.sound?.x).toBe(5);
    brain.lockId='old';brain.lockMs=900;brain.engagementZ=10;resetBotPerception(brain);
    expect(brain.sound).toBeUndefined();expect(brain.lockId).toBeNull();expect(brain.lockMs).toBe(0);
    expect(brain.engagementZ).toBeUndefined();expect(brain.nextSoundMs).toBe(0);
  });
  it('keeps objective travel while investigating, and practice dummies ignore the same alert', () => {
    const brain=brainFor(),view=baseView({objective:{x:30,z:25}});alertBot(brain,{x:30,z:0});
    const d=botThink(view,brain,50);
    expect(d.fire).toBe(false);expect(d.move.mz*Math.cos(d.look.yaw)-d.move.mx*Math.sin(d.look.yaw)).toBeCloseTo(1);
    const practice=botThink({...view,showcase:{role:'idle',faceYaw:0}},brain,50);
    expect(practice.look.yaw).toBe(0);expect(practice.move.mx).toBe(0);expect(practice.move.mz).toBe(0);
    expect(practice.fire).toBe(false);
  });
});
