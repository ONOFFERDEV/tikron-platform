import { describe, expect, it } from "vitest";
import type { ShotFeedbackEvent } from "../client/shot-feedback.js";
import type { WeaponActionState } from "../src/weapon-action.js";
import { CombatHud, COMBAT_HUD_IMPORTANT_TEXT_PX, objectiveHudStates } from "../client/ui/combat-hud.js";
import { combatHudViewModel } from "../client/ui/combat-hud-view.js";

const accepted = (shotId: string): Extract<ShotFeedbackEvent, { readonly kind: "accepted" }> => ({ kind: "accepted", shotId });
const blocked = (shotId: string, reason: Extract<ShotFeedbackEvent, { readonly kind: "blocked" }>["reason"]): Extract<ShotFeedbackEvent, { readonly kind: "blocked" }> => ({ kind: "blocked", shotId, reason });
const hit = (shotId: string): Extract<ShotFeedbackEvent, { readonly kind: "confirmed_hit" }> => ({ kind: "confirmed_hit", shotId, victim: "enemy", part: "body", damage: 30 });
const kill = (shotId: string): Extract<ShotFeedbackEvent, { readonly kind: "confirmed_kill" }> => ({ kind: "confirmed_kill", shotId, victim: "enemy", part: "head" });
const reload = (phase: WeaponActionState["phase"]): WeaponActionState => ({
  weaponIndex: 0, kind: "magazine_reload", phase, startedAt: 100, phaseStartedAt: 100, endsAt: 1000,
  serial: 1, committed: 0, fireBuffered: false,
});

describe("authoritative combat HUD", () => {
  it("Given an accepted server shot, When hit and kill confirmations arrive once, Then it presents only those authoritative confirmations", () => {
    const hud = new CombatHud();
    hud.receiveShot(hit("self:1:1"));
    hud.receiveShot(accepted("self:1:1"));
    hud.receiveShot(hit("self:1:1"));
    hud.receiveShot(kill("self:1:1"));
    hud.receiveShot(hit("self:1:1"));

    expect(hud.snapshot().events.map(event => event.kind)).toEqual(["shot-accepted", "confirmed-hit", "confirmed-kill"]);
  });

  it("Given blocked, delayed, and duplicate authority, When it reaches the HUD, Then false or repeated feedback is suppressed", () => {
    const hud = new CombatHud();
    hud.receiveShot(blocked("self:1:2", "cadence"));
    hud.receiveShot(blocked("self:1:3", "duplicate"));
    hud.receiveShot(accepted("self:1:4"));
    hud.receiveShot(accepted("self:1:4"));
    hud.receiveShot(hit("self:1:2"));

    expect(hud.snapshot().events.map(event => event.kind)).toEqual(["shot-blocked", "shot-accepted"]);
  });

  it("Given an accepted reload, When its authoritative stage clears, Then the HUD marks an interruption without changing ammunition", () => {
    const hud = new CombatHud();
    hud.receiveReload(reload("reload"));
    hud.receiveReload(reload("reload_end"));
    expect(hud.snapshot().reload).toEqual({ status: "active", phase: "reload_end", serial: 1 });
    hud.receiveReload(null);

    expect(hud.snapshot().reload).toEqual({ status: "interrupted", phase: null, serial: null });
    expect(hud.snapshot().events.map(event => event.kind)).toEqual(["reload-started", "reload-interrupted"]);
  });

  it("Given objective changes and more than four authoritative events, When the HUD snapshots, Then it retains the latest four in server order", () => {
    const hud = new CombatHud();
    hud.receiveObjective({ id: "A", owner: "neutral", status: "contested" });
    hud.receiveShot(accepted("self:1:1"));
    hud.receiveShot(hit("self:1:1"));
    hud.receiveShot(kill("self:1:1"));
    hud.receiveObjective({ id: "A", owner: "friendly", status: "stable" });

    expect(hud.snapshot().objectives).toEqual([{ id: "A", owner: "friendly", status: "stable" }]);
    expect(hud.snapshot().events).toHaveLength(4);
    expect(hud.snapshot().events.map(event => event.kind)).toEqual(["shot-accepted", "confirmed-hit", "confirmed-kill", "objective"]);
  });

  it("Given E32 has no valid device sample, When telemetry is rendered, Then latency stays unavailable; ready telemetry carries only validity metadata", () => {
    const hud = new CombatHud();
    hud.setLatency({ status: "unavailable", validSamples: 0, clockUncertaintyMs: 1 });
    expect(hud.snapshot().latency).toEqual({ status: "unavailable", validSamples: 0, clockUncertaintyMs: 1 });
    hud.setLatency({ status: "ready", validSamples: 2, clockUncertaintyMs: 1.5 });

    expect(hud.snapshot().latency).toEqual({ status: "ready", validSamples: 2, clockUncertaintyMs: 1.5 });
    expect(COMBAT_HUD_IMPORTANT_TEXT_PX).toBe(14);
  });

  it("Given authoritative combat state, When it is projected for the DOM, Then visible labels preserve order and expose no invented latency", () => {
    const hud = new CombatHud();
    hud.receiveShot(accepted("self:1:9"));
    hud.receiveShot(hit("self:1:9"));
    hud.receiveReload(reload("reload"));
    hud.receiveObjective({ id: "B", owner: "enemy", status: "contested" });

    expect(combatHudViewModel(hud.snapshot())).toEqual({
      events: ["발사 확인", "명중 확인: enemy", "재장전 시작", "거점 B: 경합"],
      objectives: [{ id: "B", label: "적군 · 경합", owner: "enemy" }],
      reload: "재장전 · 진행 중",
      telemetry: "입력 지연 · 측정 전",
      telemetryReady: false,
    });
  });

  it("Given stale round state, When the HUD resets, Then no event, objective, reload, or telemetry state leaks into the next round", () => {
    const hud = new CombatHud();
    hud.receiveShot(accepted("self:1:10"));
    hud.receiveReload(reload("reload"));
    hud.receiveObjective({ id: "A", owner: "friendly", status: "stable" });
    hud.setLatency({ status: "ready", validSamples: 4, clockUncertaintyMs: 1 });

    hud.reset();

    expect(hud.snapshot()).toEqual({
      events: [], objectives: [], reload: { status: "idle", phase: null, serial: null },
      latency: { status: "unavailable", validSamples: 0, clockUncertaintyMs: 0 },
    });
  });

  it("Given authoritative domination capture values, When projected for the local team, Then ownership and capture progress are derived without client guesses", () => {
    expect(objectiveHudStates(2, [200, 25, 100], 0)).toEqual([
      { id: "A", owner: "friendly", status: "stable" },
      { id: "B", owner: "enemy", status: "capturing" },
      { id: "C", owner: "neutral", status: "stable" },
    ]);
    expect(objectiveHudStates(0, [200, 0, 100], 0)).toEqual([]);
  });
});
