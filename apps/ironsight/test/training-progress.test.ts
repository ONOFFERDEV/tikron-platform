import { describe, expect, it } from "vitest";
import type { WeaponActionPayload } from "../client/net.js";
import { createTrainingRouteSpec } from "../client/training-coach.js";
import { TrainingProgress, type TrainingRouteSpec } from "../client/training-progress.js";
import { ARENA1 } from "../src/map/arena1.js";
import { ARENA2 } from "../src/map/arena2.js";
import { ARENA3 } from "../src/map/arena3.js";
import { MODES } from "../src/config.js";

const relay: TrainingRouteSpec = { route: "relay" };
const undertow: TrainingRouteSpec = { route: "undertow", objective: ARENA2.caps.a };
const switchyard: TrainingRouteSpec = { route: "switchyard", checkpoints: [
  { id: "rail-embankment", x: 25, z: 13, radius: 5 },
  { id: "loading-yard", x: 75, z: 51, radius: 5 },
  { id: "rail-cut", x: 75, z: 93, radius: 5 },
] };

it("derives all three routes from accepted map contracts", () => {
  expect(createTrainingRouteSpec(ARENA1)).toEqual({ route: "relay" });
  expect(createTrainingRouteSpec(ARENA2)).toEqual({ route: "undertow", objective: ARENA2.caps.a });
  const route = createTrainingRouteSpec(ARENA3);
  expect(route?.route).toBe("switchyard");
  if (route?.route !== "switchyard") return;
  expect(route.checkpoints.map(checkpoint => checkpoint.id)).toEqual(["rail-embankment", "loading-yard", "rail-cut"]);
});

function moveAndAim(progress: TrainingProgress): void {
  for (let x = 0; x <= 4; x += 1) progress.sample(true, x, 0, false, 100);
  for (let i = 0; i < 5; i += 1) progress.sample(true, 4 + i * 0.1, 0, true, 100);
}

function reloadState(serial = 7): WeaponActionPayload {
  return { id: "self", state: { weaponIndex: 0, kind: "magazine_reload", phase: "reload",
    startedAt: 1_000, phaseStartedAt: 1_000, endsAt: 2_000, serial, committed: 0, fireBuffered: false } };
}

describe("Relay training progression", () => {
  it("requires real movement, held aim, confirmed hit, committed reload, and own ping in order", () => {
    const progress = new TrainingProgress(relay);
    for (let i = 0; i < 20; i += 1) progress.sample(true, 0, 0, true, 100);
    expect(progress.step).toBe("move");
    moveAndAim(progress);
    expect(progress.step).toBe("hit");
    progress.confirmHit();
    expect(progress.step).toBe("reload");
    progress.observeAmmo({ weaponIndex: 0, mag: 20, reserve: 80 });
    progress.observeWeaponAction("self", reloadState());
    progress.observeAmmo({ weaponIndex: 0, mag: 30, reserve: 70 });
    expect(progress.step).toBe("ping");
    progress.confirmPing("ally", "self", true);
    expect(progress.step).toBe("ping");
    progress.confirmPing("self", "self", true);
    expect(progress.step).toBe("complete");
  });

  it("does not count reload start, terminal action, remote action, or cancellation before an ammo commit", () => {
    const progress = new TrainingProgress(relay);
    moveAndAim(progress);
    progress.confirmHit();
    progress.observeAmmo({ weaponIndex: 0, mag: 20, reserve: 80 });
    progress.observeWeaponAction("self", reloadState());
    progress.observeWeaponAction("self", { id: "self", state: null, weaponIndex: 0, serial: 7 });
    expect(progress.step).toBe("reload");
    progress.observeWeaponAction("self", { ...reloadState(8), id: "ally" });
    progress.observeAmmo({ weaponIndex: 0, mag: 30, reserve: 70 });
    expect(progress.step).toBe("reload");
  });

  it("accepts a server-committed pump shell even when the action later closes", () => {
    const progress = new TrainingProgress(relay);
    moveAndAim(progress);
    progress.confirmHit();
    progress.observeAmmo({ weaponIndex: 2, mag: 1, reserve: 5 });
    const action = reloadState();
    progress.observeWeaponAction("self", { ...action, state: action.state === null ? null : {
      ...action.state, weaponIndex: 2, kind: "pump_reload", phase: "reload_insert" } });
    progress.observeAmmo({ weaponIndex: 2, mag: 2, reserve: 4 });
    progress.observeWeaponAction("self", { id: "self", state: null, weaponIndex: 2, serial: 7 });
    expect(progress.step).toBe("ping");
  });

  it("derives visible reload progress from the authoritative server deadline", () => {
    const progress = new TrainingProgress(relay);
    moveAndAim(progress);
    progress.confirmHit();
    progress.observeAmmo({ weaponIndex: 0, mag: 20, reserve: 80 });
    progress.observeWeaponAction("self", reloadState());
    expect(progress.reloadProgress(1_250)).toBe(0.25);
    progress.observeWeaponAction("self", { id: "self", state: null, weaponIndex: 0, serial: 7 });
    expect(progress.reloadProgress(1_250)).toBeNull();
  });
});

describe("Undertow objective rehearsal", () => {
  it("requires real approach movement and a continuous server-rule-duration hold", () => {
    const progress = new TrainingProgress(undertow);
    const goal = ARENA2.caps.a;
    progress.sample(true, goal.x, goal.z, false, 100);
    expect(progress.step).toBe("reach-objective");
    for (let x = goal.x - 10; x <= goal.x - 5; x += 1) progress.sample(true, x, goal.z, false, 100);
    progress.sample(true, goal.x, goal.z, false, 100);
    expect(progress.heldMs).toBe(0);
    progress.sample(true, goal.x - 0.1, goal.z, false, 50);
    expect(progress.step).toBe("hold-objective");
    const required = 100_000 / MODES.dom.capturePerSec;
    for (let elapsed = 0; elapsed < required; elapsed += 50) {
      progress.sample(true, goal.x, goal.z, false, Math.min(50, required - elapsed));
    }
    expect(progress.step).toBe("complete");
  });

  it("resets an unfinished hold after leaving, losing control, or a stalled frame", () => {
    const progress = new TrainingProgress(undertow);
    const goal = ARENA2.caps.a;
    for (let x = goal.x - 6; x <= goal.x - 1; x += 1) progress.sample(true, x, goal.z, false, 100);
    progress.sample(true, goal.x, goal.z, false, 100);
    const heldBeforeStall = progress.heldMs;
    progress.sample(true, goal.x, goal.z, false, 1_000);
    expect(progress.heldMs - heldBeforeStall).toBe(100);
    progress.sample(true, goal.x + MODES.dom.captureRadius + 0.01, goal.z, false, 50);
    expect(progress.heldMs).toBe(0);
    progress.sample(true, goal.x, goal.z, false, 50);
    progress.sample(false, goal.x, goal.z, false, 50);
    expect(progress.heldMs).toBe(0);
  });
});

describe("Switchyard route exploration", () => {
  it("visits the three accepted route checkpoints in order through real displacement", () => {
    const progress = new TrainingProgress(switchyard);
    expect(progress.step).toBe("reach-rail-embankment");
    progress.sample(true, 20, 13, false, 50);
    for (let x = 21; x <= 25; x += 1) progress.sample(true, x, 13, false, 50);
    expect(progress.step).toBe("reach-loading-yard");
    for (let x = 26; x <= 75; x += 1) progress.sample(true, x, 51, false, 50);
    expect(progress.step).toBe("reach-rail-cut");
    for (let z = 52; z <= 93; z += 1) progress.sample(true, 75, z, false, 50);
    expect(progress.step).toBe("complete");
  });

  it("rejects teleports and does not advance while control is inactive", () => {
    const progress = new TrainingProgress(switchyard);
    progress.sample(true, 0, 0, false, 50);
    progress.sample(true, 25, 13, false, 50);
    progress.sample(false, 24, 13, false, 50);
    expect(progress.step).toBe("reach-rail-embankment");
  });
});
