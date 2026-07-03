import { describe, it, expect } from "vitest";
import {
  decayOffset,
  applyCorrection,
  smoothAxis,
  smoothAngle,
  followCamera,
  RenderPredictor,
  EntitySmoother,
} from "./render.js";
import { resolveMovement, validateMovement, type MotionProfile, type Vec2 } from "@tikron/sim";

const PROFILE: MotionProfile = {
  maxSpeed: 500,
  tolerance: 1.15,
  stepMs: 50,
  world: 3000,
  sendHeadroom: 1.1,
};

describe("smoothing primitives (camera / entity easing)", () => {
  it("eases toward the target without overshooting", () => {
    // One 16 ms frame at τ = 60 ms closes 1 - exp(-16/60) ≈ 23.5% of the gap.
    const next = smoothAxis(0, 100, 16, 60, 300);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(100);
    expect(next).toBeCloseTo(100 * (1 - Math.exp(-16 / 60)), 6);
  });

  it("is frame-rate independent: two half-steps ≈ one full step", () => {
    const oneStep = smoothAxis(0, 100, 32, 60, 300);
    const half = smoothAxis(0, 100, 16, 60, 300);
    const twoHalves = smoothAxis(half, 100, 16, 60, 300);
    expect(twoHalves).toBeCloseTo(oneStep, 6);
  });

  it("absorbs a reconcile nudge instead of jumping the full distance", () => {
    // A 25 u reconcile step (one unacked input at max speed) must move the camera
    // far less than 25 u in a single frame — that attenuation is the anti-shake.
    const moved = smoothAxis(0, 25, 16, 60, 300) - 0;
    expect(moved).toBeLessThan(25 * 0.3);
  });

  it("teleports when the gap reaches the snap distance (respawn / big correction)", () => {
    expect(smoothAxis(0, 300, 16, 60, 300)).toBe(300);
    expect(smoothAxis(0, 5000, 16, 60, 300)).toBe(5000);
  });

  it("smoothAngle rotates the short way across the ±π wrap", () => {
    // From +170° toward −170° is a +20° short arc (crossing π), not −340° the long way.
    const from = (170 * Math.PI) / 180;
    const to = (-170 * Math.PI) / 180;
    const next = smoothAngle(from, to, 16, 100, Math.PI);
    // A short-arc step nudges the angle *up* past +π (wrapping), never down toward 0.
    expect(next).toBeGreaterThan(from);
  });

  it("smoothAngle eases along the shortest arc without overshoot", () => {
    const next = smoothAngle(0, 1, 16, 100, Math.PI);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(1);
    expect(next).toBeCloseTo(1 * (1 - Math.exp(-16 / 100)), 6);
  });

  it("followCamera eases both axes and leaves the input untouched", () => {
    const cam = { x: 0, y: 0 };
    const next = followCamera(cam, 100, 200, 16, 60, 300);
    expect(cam).toEqual({ x: 0, y: 0 });
    expect(next.x).toBeCloseTo(smoothAxis(0, 100, 16, 60, 300), 6);
    expect(next.y).toBeCloseTo(smoothAxis(0, 200, 16, 60, 300), 6);
  });
});

describe("correction offset (server reconcile absorption)", () => {
  it("decays the offset toward zero, frame-rate independently", () => {
    const one = decayOffset({ x: 100, y: 0 }, 32, 100);
    const half = decayOffset({ x: 100, y: 0 }, 16, 100);
    const twoHalves = decayOffset(half, 16, 100);
    expect(one.x).toBeCloseTo(twoHalves.x, 6);
    expect(one.x).toBeLessThan(100);
    expect(one.x).toBeGreaterThan(0);
  });

  it("converges: repeated decay drives the offset to ~zero", () => {
    let off = { x: 40, y: -30 };
    for (let i = 0; i < 40; i++) off = decayOffset(off, 16, 100);
    expect(Math.hypot(off.x, off.y)).toBeLessThan(0.5);
  });

  it("absorbs a small correction without moving the rendered position", () => {
    // render = continuous + offset must be unchanged; continuous adopts authoritative.
    const continuous = { x: 0, y: 0 };
    const offset = { x: 10, y: 0 };
    const renderBefore = { x: continuous.x + offset.x, y: continuous.y + offset.y };
    const r = applyCorrection(continuous, offset, { x: 5, y: 0 }, 300);
    expect(r.continuous).toEqual({ x: 5, y: 0 });
    expect(r.continuous.x + r.offset.x).toBeCloseTo(renderBefore.x, 9);
    expect(r.continuous.y + r.offset.y).toBeCloseTo(renderBefore.y, 9);
  });

  it("snaps (clears offset) when the error reaches the teleport threshold", () => {
    const r = applyCorrection({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 400, y: 0 }, 300);
    expect(r.continuous).toEqual({ x: 400, y: 0 });
    expect(r.offset).toEqual({ x: 0, y: 0 });
  });
});

/**
 * A minimal authoritative server for round-trip tests: measures each move's delta
 * from the client's send clock exactly like the shooter room (clamped to
 * [½ tick, 2 ticks], monotonic reference) and resolves it without freezing.
 */
function miniServer(spawn: Vec2, profile: MotionProfile) {
  let pos = { x: spawn.x, y: spawn.y };
  let lastAt: number | null = null;
  let rejects = 0;
  return {
    get pos() {
      return pos;
    },
    get rejects() {
      return rejects;
    },
    /** Process one move; returns the correction payload when rejected, else null. */
    move(target: Vec2, atMs: number): Vec2 | null {
      const deltaMs =
        lastAt === null
          ? profile.stepMs
          : Math.min(Math.max(atMs - lastAt, profile.stepMs * 0.5), profile.stepMs * 2);
      lastAt = lastAt === null ? atMs : Math.max(lastAt, atMs);
      const res = resolveMovement(pos, target, profile, deltaMs);
      pos = res.position;
      if (res.rejected) {
        rejects += 1;
        return { x: pos.x, y: pos.y };
      }
      return null;
    },
  };
}

describe("RenderPredictor (local player)", () => {
  const spawn = { x: 1000, y: 1000 };

  function seeded(): RenderPredictor {
    const p = RenderPredictor.fromProfile({ x: 1500, y: 1500 }, PROFILE);
    p.reconcile(spawn); // first authoritative frame: unconditional snap onto the spawn
    return p;
  }

  it("first reconcile adopts the spawn unconditionally (placeholder seed)", () => {
    const p = RenderPredictor.fromProfile({ x: 1500, y: 1500 }, PROFILE);
    // 707u gap — but even a sub-snap gap must be adopted on the first frame.
    const q = RenderPredictor.fromProfile({ x: 1010, y: 1000 }, PROFILE);
    p.reconcile(spawn);
    q.reconcile(spawn);
    expect(p.renderPosition).toEqual(spawn);
    expect(q.renderPosition).toEqual(spawn);
    // The send clamp was reset: the first send passes the spawn through unclamped.
    expect(p.sendPosition(0)).toEqual(spawn);
  });

  it("frame() integrates uniformly and holds still while dead (alive gate)", () => {
    const p = seeded();
    const a = p.frame(1, 0, 16);
    expect(a.x).toBeCloseTo(spawn.x + 8, 9); // 500 u/s × 16 ms
    p.alive = false;
    const b = p.frame(1, 0, 16);
    expect(b.x).toBeCloseTo(a.x, 9); // dead: a held key must not dead-reckon
  });

  it("frame() clamps a tab-out dt to maxFrameMs", () => {
    const p = seeded();
    const a = p.frame(1, 0, 5000);
    expect(a.x).toBeCloseTo(spawn.x + 25, 9); // one 50 ms tick, not 2500u
  });

  it("rubber-band regression: every send in a jittery full-speed run is accepted (I1)", () => {
    // Random-ish frame dts (drops, late timers, a tab-out) at sustained full speed;
    // every sendPosition() output must be accepted by the server simulated at the
    // same profile — zero false-positive rejections, by contract.
    const p = seeded();
    const server = miniServer(spawn, PROFILE);
    const frameDts = [16, 16, 33, 70, 16, 8, 120, 16, 16, 50, 5, 90, 16, 16];
    let now = 0;
    let f = 0;
    for (let send = 0; send < 40; send++) {
      // 1–3 frames between sends, uneven send spacing (late setInterval).
      const frames = 1 + (send % 3);
      let gap = 0;
      for (let i = 0; i < frames; i++) {
        const dt = frameDts[f++ % frameDts.length]!;
        gap += dt;
        p.frame(1, 0.3, dt);
      }
      now += gap;
      const sent = p.sendPosition(now);
      const correction = server.move(sent, now);
      expect(correction).toBeNull();
    }
    expect(server.rejects).toBe(0);
  });

  it("correct() keeps the render continuous and rebases the send reference (I2)", () => {
    const p = seeded();
    p.frame(1, 0, 40);
    const before = p.renderPosition;
    const auth = { x: spawn.x + 5, y: spawn.y }; // server sits 15u behind the render
    p.correct(auth);
    // No visible jump: continuous+offset is unchanged at the instant of correction...
    const after = p.frame(0, 0, 0.0001);
    expect(after.x).toBeCloseTo(before.x, 3);
    expect(after.y).toBeCloseTo(before.y, 3);
    // ...and the next send is budgeted from the AUTHORITATIVE position, so it is
    // within the server budget measured from there (no cascade).
    const sent = p.sendPosition(50);
    expect(validateMovement(auth, sent, PROFILE, PROFILE.stepMs).rejected).toBe(false);
  });

  it("chained-rejection regression: a dropped-move burst causes at most one reject (I2+I3)", () => {
    const p = seeded();
    const server = miniServer(spawn, PROFILE);
    let now = 0;
    let corrections = 0;
    let renderDipMax = 0;
    let prevRender = p.renderPosition.x;
    for (let send = 1; send <= 30; send++) {
      // Steady 50 ms cadence at full speed.
      for (let i = 0; i < 3; i++) p.frame(1, 0, 50 / 3);
      now += 50;
      const sent = p.sendPosition(now);
      // Drop sends #5 and #6 entirely (rate-limit drop): the server never sees them,
      // so send #7 arrives carrying ~3 ticks of distance against a 2-tick budget.
      if (send !== 5 && send !== 6) {
        const correction = server.move(sent, now);
        if (correction) {
          corrections += 1;
          p.correct(correction);
        }
      }
      const r = p.frame(0, 0, 0.0001).x;
      renderDipMax = Math.max(renderDipMax, prevRender - r);
      prevRender = r;
    }
    expect(corrections).toBe(1); // the burst converges after ONE rejection
    expect(server.rejects).toBe(1);
    // The view never lurched backward: corrections are eased, not snapped.
    expect(renderDipMax).toBeLessThan(1);
    // And the wire re-converged onto the server's authoritative path.
    expect(Math.abs(server.pos.x - p.renderPosition.x)).toBeLessThan(60);
  });

  it("reconcile() ignores small RTT gaps and snaps big teleports (with send-clamp reset)", () => {
    const p = seeded();
    p.frame(1, 0, 40); // render runs 20u ahead of the (lagging) echo
    const ahead = p.renderPosition;
    p.reconcile({ x: spawn.x + 2, y: spawn.y }); // small gap: pure RTT lag — ignored
    expect(p.renderPosition).toEqual(ahead);
    const tele = { x: spawn.x + 800, y: spawn.y };
    p.reconcile(tele); // ≥ snapDistance: genuine teleport — cut straight
    expect(p.renderPosition).toEqual(tele);
    // The send reference was reset, so the next send passes the new position through.
    expect(p.sendPosition(0)).toEqual(tele);
  });

  it("respawn (dead→alive) snaps even within the snap radius and resets the clamp", () => {
    const p = seeded();
    p.alive = false;
    p.frame(1, 0, 100); // held key while dead: no motion
    p.alive = true; // the alive setter arms the respawn snap
    const spawn2 = { x: spawn.x + 120, y: spawn.y }; // respawn 120u away — inside the 300u radius
    p.reconcile(spawn2);
    expect(p.renderPosition).toEqual(spawn2); // snapped, not eased from the corpse
    expect(p.sendPosition(0)).toEqual(spawn2); // and the corpse position is never sent again
  });

  it("reset() force-places and lets the next send pass through", () => {
    const p = seeded();
    p.frame(1, 1, 30);
    p.reset({ x: 2, y: 3 });
    expect(p.renderPosition).toEqual({ x: 2, y: 3 });
    expect(p.sendPosition(123456)).toEqual({ x: 2, y: 3 });
  });

  it("world bounds clamp the integrated position", () => {
    const p = RenderPredictor.fromProfile({ x: 1, y: 1 }, PROFILE);
    p.reconcile({ x: 1, y: 1 });
    for (let i = 0; i < 10; i++) p.frame(-1, -1, 50);
    expect(p.renderPosition).toEqual({ x: 0, y: 0 }); // never past [0, world]
  });
});

describe("EntitySmoother (remote entities)", () => {
  it("snaps the first observation (no glide-in from nowhere)", () => {
    const s = new EntitySmoother();
    expect(s.update("a", { x: 700, y: 80, angle: 1.2 }, 16)).toEqual({ x: 700, y: 80, angle: 1.2 });
  });

  it("eases subsequent updates and converges on a stationary target", () => {
    const s = new EntitySmoother();
    s.update("a", { x: 0, y: 0, angle: 0 }, 16);
    const one = s.update("a", { x: 30, y: 0, angle: 0.5 }, 16);
    expect(one.x).toBeGreaterThan(0);
    expect(one.x).toBeLessThan(30); // eased, not popped
    let last = one;
    for (let i = 0; i < 60; i++) last = s.update("a", { x: 30, y: 0, angle: 0.5 }, 16);
    expect(last.x).toBeCloseTo(30, 1);
    expect(last.angle).toBeCloseTo(0.5, 2);
  });

  it("smooths the angle along the shortest arc", () => {
    const s = new EntitySmoother();
    const from = (170 * Math.PI) / 180;
    s.update("a", { x: 0, y: 0, angle: from }, 16);
    const next = s.update("a", { x: 0, y: 0, angle: (-170 * Math.PI) / 180 }, 16);
    expect(next.angle).toBeGreaterThan(from); // wraps up past +π, never the long way round
  });

  it("holds the last angle when the target omits it", () => {
    const s = new EntitySmoother();
    s.update("a", { x: 0, y: 0, angle: 1 }, 16);
    expect(s.update("a", { x: 0, y: 0 }, 16).angle).toBeCloseTo(1, 9);
  });

  it("snaps a respawn-sized jump instead of gliding across the map", () => {
    const s = new EntitySmoother();
    s.update("a", { x: 0, y: 0, angle: 0 }, 16);
    expect(s.update("a", { x: 900, y: 0, angle: 0 }, 16).x).toBe(900);
  });

  it("prune() forgets unseen entities so an AOI re-entry snaps in fresh", () => {
    const s = new EntitySmoother();
    s.update("a", { x: 0, y: 0, angle: 0 }, 16);
    s.update("b", { x: 10, y: 0, angle: 0 }, 16);
    s.prune(new Set(["b"])); // "a" left the view
    // Re-entering 200u away (below snapDistance) must SNAP, not glide from the stale 0.
    expect(s.update("a", { x: 200, y: 0, angle: 0 }, 16)).toEqual({ x: 200, y: 0, angle: 0 });
    // "b" survived the prune and still eases.
    expect(s.update("b", { x: 40, y: 0, angle: 0 }, 16).x).toBeLessThan(40);
  });
});

describe("RenderPredictor constrain", () => {
  it("applies the constraint after every frame integration", () => {
    // Wall at x=100: clamp x below it (the "server rule" both sides share).
    const p = new RenderPredictor(
      { x: 90, y: 0 },
      { maxSpeed: 100, stepMs: 50, constrain: (v) => ({ x: Math.min(v.x, 100), y: v.y }) },
    );
    p.reconcile({ x: 90, y: 0 }); // seed
    // Push right for 1 tick repeatedly: 100 u/s × 50 ms = 5 u per frame.
    for (let i = 0; i < 10; i++) p.frame(1, 0, 50);
    expect(p.renderPosition.x).toBeLessThanOrEqual(100);
    // And it stays there — no error accumulation past the wall.
    p.frame(1, 0, 50);
    expect(p.renderPosition.x).toBeLessThanOrEqual(100);
  });

  it("does not constrain when the option is omitted (back-compat)", () => {
    const p = new RenderPredictor({ x: 90, y: 0 }, { maxSpeed: 100, stepMs: 50 });
    p.reconcile({ x: 90, y: 0 });
    for (let i = 0; i < 10; i++) p.frame(1, 0, 50);
    expect(p.renderPosition.x).toBeGreaterThan(100);
  });
});
