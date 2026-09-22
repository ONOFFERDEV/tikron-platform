import assert from "node:assert/strict";
import test from "node:test";
import { classifyCombatFeedback, classifyCombatFirstShot, classifyCombatReport, classifyCombatSupports,
  classifyDeploymentSurface,
  scenarioHandlers } from "../scripts/aside-scenarios/combat.mjs";

const definition = cases => ({ cases });
const codes = result => result.cases.flatMap(entry => entry.reasons.map(reason => reason.code));

test("exports every combat scenario registered by the manifest", () => {
  assert.deepEqual(Object.keys(scenarioHandlers).sort(),
    ["combat-acceptance", "combat-feedback", "combat-first-shot", "combat-supports"]);
});

test("uses the direct deployment flow readiness surface without the removed menu CTA", () => {
  assert.equal(classifyDeploymentSurface({ flowAttached: true, playReady: true, canvasInert: false }), "ready");
  assert.equal(classifyDeploymentSurface({ flowAttached: true, playReady: false, retryVisible: true }), "retry");
  assert.equal(classifyDeploymentSurface({ flowAttached: true, playReady: false, retryVisible: false }), "waiting");
});

test("keeps native pointer-lock failure unqualified with the causal error", () => {
  const result = classifyCombatFeedback(definition(["shot", "reduced", "denied", "dedup", "bearing"]), {
    pointerLock: { acquired: false, error: "WrongDocumentError: The root document is not valid" },
  }, null);
  assert.ok(result.cases.every(entry => entry.verdict === "UNQUALIFIED"));
  assert.ok(result.cases.every(entry => entry.reasons[0].detail.includes("WrongDocumentError")));
});

test("does not pass partial mode or weapon coverage", () => {
  const runs = [{ mode: "tdm", pointerLock: { acquired: true }, weapons: Array.from({ length: 4 },
    (_, weaponIndex) => ({ weaponIndex, attempt: { shotId: `s${weaponIndex}` }, result: { shotId: `s${weaponIndex}`, kind: "accepted" } })) }];
  const result = classifyCombatFirstShot(definition(["modes", "weapons", "ready", "latency"]), runs, null);
  assert.equal(result.cases[0].verdict, "UNQUALIFIED");
  assert.ok(codes(result).includes("mode_coverage_incomplete"));
  assert.ok(codes(result).includes("weapon_coverage_incomplete"));
});

test("maps absent analyzer input to unqualified instead of a fabricated pass", () => {
  const result = classifyCombatReport(definition(["full", "stages", "authority"]), null, null);
  assert.ok(result.cases.every(entry => entry.verdict === "UNQUALIFIED"));
  assert.ok(codes(result).includes("combat_trace_missing"));
});

test("keeps incomplete support warning, path, cancellation, and damage traces unqualified", () => {
  const result = classifyCombatSupports(definition(["tiers", "warning", "stale", "cancelled", "path"]), {
    pointerLock: { acquired: true }, viewport: { css: [1920, 1080], drawingBuffer: [1920, 1080] },
    support: { kind: "observation_biplane", flights: [] },
    mortar: { kind: "ww1_mortar_battery", strikes: [], readyAt: 0, serverNow: 10 },
    drone: { kind: "fixed_linear_strafe", flights: [] }, supportReview: null,
  }, null);
  assert.ok(result.cases.every(entry => entry.verdict === "UNQUALIFIED"));
  assert.deepEqual(codes(result), ["support_tiers_runtime_trace_missing",
    "mortar_warning_cover_cooldown_trace_missing", "stale_recon_rejection_trace_missing",
    "cancelled_support_trace_missing", "strafe_path_damage_trace_missing"]);
});

test("accepts complete authoritative support lifecycle traces", () => {
  const result = classifyCombatSupports(definition(["tiers", "warning", "stale", "cancelled", "path"]), {
    pointerLock: { acquired: true }, viewport: { css: [1920, 1080], drawingBuffer: [1920, 1080] },
    support: { kind: "observation_biplane", flights: [{ owner: "a" }] },
    mortar: { kind: "ww1_mortar_battery", strikes: [{ warningEndsAt: 1_000 }], readyAt: 2_000, serverNow: 1_000 },
    drone: { kind: "fixed_linear_strafe", flights: [{ lock: null, corridor: { start: {}, end: {} } }] },
    supportReview: { mortarCoverDamageRejected: true, staleReconRejected: true,
      cancelledAfterOwnerDeath: true, straightPath: true, outsideCorridorDamageRejected: true },
  }, null);
  assert.ok(result.cases.every(entry => entry.verdict === "PASS"));
});
