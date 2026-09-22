import { describe, expect, it } from "vitest";
import type { ServerHit, ServerKill, ServerShotResult, ShotAttempt } from "../src/combat-events.js";
import { ShotFeedback } from "../client/shot-feedback.js";

const attempt = (shotId: string, at = 10): ShotAttempt => ({
  kind: "attempt", shotId, weaponIndex: 2, localMonoAt: at, rawAim: { yaw: 0, pitch: 0 },
});
const accepted = (shotId: string): ServerShotResult => ({
  kind: "accepted", shotId, acceptedAt: 20, ammo: { mag: 4, reserve: 10 }, recoil: { slot: 2, count: 1, at: 20 },
});
const blocked = (shotId: string): ServerShotResult => ({
  kind: "blocked", shotId, reason: "cadence", retryMs: 30,
  ammo: { mag: 5, reserve: 10 }, recoil: { slot: 2, count: 0, at: 20 },
});
const hit = (shotId: string): ServerHit => ({ shotId, victim: "enemy", damage: 30, part: "body" });
const kill = (shotId: string): ServerKill => ({ shotId, killer: "self", victim: "enemy", part: "head" });

describe("authoritative shot feedback", () => {
  it("emits one predicted attempt and ignores its self echo", () => {
    const feedback = new ShotFeedback({ connectionId: "self", reducedMotion: false });
    expect(feedback.attempt(attempt("self:1:1"))).toMatchObject({ kind: "predicted", recoilScale: 1 });
    expect(feedback.attempt(attempt("self:1:1"))).toBeNull();
    expect(feedback.shotEcho({ shotId: "self:1:1", from: "self" })).toBeNull();
    expect(feedback.shotEcho({ shotId: "remote:1:1", from: "remote" })).toEqual({
      kind: "remote_shot", shotId: "remote:1:1", from: "remote",
    });
    expect(feedback.shotEcho({ shotId: "remote:1:1", from: "remote" })).toBeNull();
  });

  it("allows accepted/blocked once and never confirms a blocked or unknown shot", () => {
    const feedback = new ShotFeedback({ connectionId: "self", reducedMotion: false });
    feedback.attempt(attempt("self:1:1")); feedback.attempt(attempt("self:1:2"));
    expect(feedback.result(accepted("self:1:1"))).toEqual([{ kind: "accepted", shotId: "self:1:1" }]);
    expect(feedback.result(accepted("self:1:1"))).toEqual([]);
    expect(feedback.result(blocked("self:1:2"))).toEqual([{ kind: "blocked", shotId: "self:1:2", reason: "cadence" }]);
    expect(feedback.hit(hit("self:1:2"))).toEqual([]);
    expect(feedback.kill(kill("self:1:9"))).toEqual([]);
  });

  it("holds out-of-order confirmations until acceptance and deduplicates late events", () => {
    const feedback = new ShotFeedback({ connectionId: "self", reducedMotion: false });
    feedback.attempt(attempt("self:1:1"));
    expect(feedback.hit(hit("self:1:1"))).toEqual([]);
    expect(feedback.kill(kill("self:1:1"))).toEqual([]);
    expect(feedback.result(accepted("self:1:1"))).toEqual([
      { kind: "accepted", shotId: "self:1:1" },
      { kind: "confirmed_hit", shotId: "self:1:1", victim: "enemy", part: "body", damage: 30 },
      { kind: "confirmed_kill", shotId: "self:1:1", victim: "enemy", part: "head" },
    ]);
    expect(feedback.hit(hit("self:1:1"))).toEqual([]);
    expect(feedback.kill(kill("self:1:1"))).toEqual([]);
  });

  it("bounds retained shot state and rejects evicted late authority", () => {
    const feedback = new ShotFeedback({ connectionId: "self", reducedMotion: false, capacity: 2 });
    for (let i = 1; i <= 3; i += 1) feedback.attempt(attempt(`self:1:${i}`));
    expect(feedback.result(accepted("self:1:1"))).toEqual([]);
    expect(feedback.inspect().retained).toBe(2);
  });

  it("reduces cosmetic recoil only and preserves the raw aim contract", () => {
    const normal = new ShotFeedback({ connectionId: "self", reducedMotion: false });
    const reduced = new ShotFeedback({ connectionId: "self", reducedMotion: true });
    const shot = attempt("self:1:1");
    expect(normal.attempt(shot)).toMatchObject({ recoilScale: 1, rawAim: shot.rawAim });
    expect(reduced.attempt(shot)).toMatchObject({ recoilScale: 0.35, rawAim: shot.rawAim });
    normal.setReducedMotion(true);
    expect(normal.attempt(attempt("self:1:2"))).toMatchObject({ recoilScale: 0.35 });
  });

  it("records the authoritative attempt-to-confirmation timeline", () => {
    const feedback = new ShotFeedback({ connectionId: "self", reducedMotion: false });
    const timeline = [
      feedback.attempt(attempt("self:1:1")),
      ...feedback.result(accepted("self:1:1")),
      ...feedback.hit(hit("self:1:1")),
      ...feedback.kill(kill("self:1:1")),
    ];
    expect(timeline.map(event => event?.kind)).toEqual(["predicted", "accepted", "confirmed_hit", "confirmed_kill"]);
    console.log(JSON.stringify({ tag: "shotFeedbackAuthoritativeTimeline", timeline }));
  });
});
