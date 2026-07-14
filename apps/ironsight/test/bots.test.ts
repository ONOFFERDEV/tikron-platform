// [blueprint] — pure botThink()/createBotBrain() behavior on hand-built fixtures;
// no import of config.ts, GAME, or any weapon/team identity.
import { describe, it, expect } from "vitest";
import { botThink, createBotBrain, type BotView } from "../src/bots.js";

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

describe("botThink — dom objective", () => {
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

  it("walk: paces toward the brain's current waypoint, facing its travel direction, no crouch/sprint", () => {
    const brain = createBotBrain({
      seed: 1,
      waypoints: [{ x: 12, y: 19 }, { x: 12, y: 27 }], // home 23 ∓ amp 4
    });
    const view = baseView({
      self: { x: 12, y: 0, z: 23, crouch: false, alive: true, team: 0, yaw: 0, pitch: 0 },
      showcase: { role: "walk", faceYaw: FACE_YAW },
    });
    const decision = botThink(view, brain, 50);

    expect(decision.move.mz).toBeCloseTo(1, 5); // "forward" in its own (travel) facing frame
    expect(decision.move.mx).toBeCloseTo(0, 5);
    expect(decision.move.crouch).toBe(false);
    expect(decision.move.sprint).toBe(false);
    expect(decision.fire).toBe(false);
  });

  it("sprint: same pacing pattern as walk, but sprint=true", () => {
    const brain = createBotBrain({ seed: 1, waypoints: [{ x: 12, y: 18 }, { x: 12, y: 38 }] });
    const view = baseView({
      self: { x: 12, y: 0, z: 28, crouch: false, alive: true, team: 0, yaw: 0, pitch: 0 },
      showcase: { role: "sprint", faceYaw: FACE_YAW },
    });
    const decision = botThink(view, brain, 50);

    expect(decision.move.mz).toBeCloseTo(1, 5);
    expect(decision.move.crouch).toBe(false);
    expect(decision.move.sprint).toBe(true);
  });

  it("sneak: same pacing pattern as walk, but crouched (not sprinting)", () => {
    const brain = createBotBrain({ seed: 1, waypoints: [{ x: 12, y: 12 }, { x: 12, y: 18 }] });
    const view = baseView({
      self: { x: 12, y: 0, z: 15, crouch: false, alive: true, team: 0, yaw: 0, pitch: 0 },
      showcase: { role: "sneak", faceYaw: FACE_YAW },
    });
    const decision = botThink(view, brain, 50);

    expect(decision.move.mz).toBeCloseTo(1, 5);
    expect(decision.move.crouch).toBe(true);
    expect(decision.move.sprint).toBe(false);
  });
});
