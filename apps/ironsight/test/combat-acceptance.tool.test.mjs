import assert from "node:assert/strict";
import test from "node:test";
import { analyzeCombatAcceptance, parseCombatAcceptanceText } from "../scripts/combat-acceptance.mjs";

const HASH = "a".repeat(64);
const MODES = ["tdm", "ffa", "dom"];
const STAGES = ["input", "handler", "predicted_commit", "send", "server_receive",
  "resolve", "receipt", "confirmed_paint", "audio_schedule"];
const AT = { input: 0, handler: 1, send: 2, predicted_commit: 3, audio_schedule: 4,
  receipt: 5, confirmed_paint: 6, server_receive: 100, resolve: 101 };
const metric = () => ({ count: 1, p50: 8, p95: 8, p99: 8 });
const telemetry = () => ({ schemaVersion: 1, stages: [...STAGES], counts: { blocked: 0,
  duplicate: 0, invalid: 0, stale: 0, ignoredConfirmation: 0 },
clockPairs: { crossClockSubtraction: false }, hud: { status: "ready", validSamples: 1 },
metrics: { actual: { validShots: 1, validAdsTransitions: 1, predictedMs: metric(),
  rttMs: metric(), confirmationMs: metric(), audioScheduleMs: metric(), serverResolveMs: metric() },
  synthetic: { validShots: 0 } },
events: STAGES.map(stage => ({ id: "shot:1", stage, at: AT[stage],
  clock: stage === "server_receive" || stage === "resolve" ? "server-wall" : "client-monotonic",
  ...(stage === "input" ? { provenance: { source: "trusted-device", trusted: true } } : {}) })) });
const sample = (mode, weaponIndex, reducedMotion) => ({ id: `${mode}-${weaponIndex}-${reducedMotion}`,
  mode, weaponIndex, reducedMotion, complete: true, url: `http://127.0.0.1:8896/?mode=${mode}`,
  movement: { matchedErrorM: 0.005 },
  feedback: { falseHits: 0, falseKills: 0, duplicateShots: 0, droppedValidEdges: 0,
    judgments: ["accepted", "confirmed_hit"] }, telemetry: telemetry() });
const evidence = () => ({ schemaVersion: 1, source: { sourceSha256: HASH, bundleSha256: HASH },
  capture: { url: "http://127.0.0.1:8896/?mode=tdm", requestedViewport: [1920, 1080],
    cssViewport: [1920, 1080], drawingBuffer: [1920, 1080], refreshHz: 60,
    pointerLock: true, actualInput: true, inputVideo: "combat.webm" },
  runs: MODES.flatMap(mode => Array.from({ length: 5 }, (_, weapon) =>
    [sample(mode, weapon, false), sample(mode, weapon, true)]).flat()) });
const codes = report => report.cases.flatMap(entry => entry.reasons.map(reason => reason.code));

test("accepts complete 3-mode, 5-weapon, normal/reduced actual-input traces", () => {
  const report = analyzeCombatAcceptance(evidence());
  assert.equal(report.verdict, "PASS"); assert.equal(report.exitCode, 0);
});

test("fails missing stages and mixed clock domains", () => {
  const missing = evidence(); missing.runs[0].telemetry.events.pop();
  assert.ok(codes(analyzeCombatAcceptance(missing)).includes("missing_stage"));
  const mixed = evidence(); mixed.runs[0].telemetry.events[4].clock = "client-monotonic";
  assert.ok(codes(analyzeCombatAcceptance(mixed)).includes("mixed_clock"));
  const reversed = evidence(); reversed.runs[0].telemetry.events[3].at = 20;
  assert.ok(codes(analyzeCombatAcceptance(reversed)).includes("clock_reversed"));
});

test("fails false confirmations and duplicate or dropped firing edges", () => {
  for (const [field, code] of [["falseHits", "false_hit"], ["falseKills", "false_kill"],
    ["duplicateShots", "duplicate_fire"], ["droppedValidEdges", "dropped_valid_edge"]]) {
    const value = evidence(); value.runs[0].feedback[field] = 1;
    assert.ok(codes(analyzeCombatAcceptance(value)).includes(code));
  }
});

test("fails incomplete scenario coverage and normal/reduced judgment drift", () => {
  const incomplete = evidence(); incomplete.runs.pop();
  assert.ok(codes(analyzeCombatAcceptance(incomplete)).includes("missing_run"));
  const drift = evidence(); drift.runs.find(run => run.reducedMotion).feedback.judgments = ["accepted"];
  assert.ok(codes(analyzeCombatAcceptance(drift)).includes("judgment_mismatch"));
});

test("fails latency beyond one render interval plus 5 ms and movement error above 1 cm", () => {
  const late = evidence(); late.runs[0].telemetry.metrics.actual.predictedMs.p95 = 22;
  assert.ok(codes(analyzeCombatAcceptance(late)).includes("predicted_latency"));
  const movement = evidence(); movement.runs[0].movement.matchedErrorM = 0.0101;
  assert.ok(codes(analyzeCombatAcceptance(movement)).includes("movement_error"));
});

test("keeps synthetic or missing actual input unqualified", () => {
  const value = evidence(); value.capture.actualInput = false; value.capture.pointerLock = false;
  const report = analyzeCombatAcceptance(value);
  assert.equal(report.verdict, "UNQUALIFIED"); assert.equal(report.exitCode, 2);
});

test("rejects mixed synthetic metrics even when actual metrics are complete", () => {
  const value = evidence();
  for (const run of value.runs) run.telemetry.metrics.synthetic.validShots = 100;
  const report = analyzeCombatAcceptance(value);
  assert.equal(report.verdict, "UNQUALIFIED"); assert.equal(report.exitCode, 2);
  assert.ok(codes(report).includes("synthetic_telemetry_present"));
});

test("rejects a synthetic input event mixed into trusted-device evidence", () => {
  const value = evidence();
  value.runs[0].telemetry.events.push({ id: "synthetic:1", stage: "input", at: 0,
    clock: "client-monotonic", provenance: { source: "synthetic", trusted: false } });
  const report = analyzeCombatAcceptance(value);
  assert.equal(report.verdict, "UNQUALIFIED");
  assert.ok(codes(report).includes("synthetic_provenance_present"));
});

test("never promotes a contract fixture to actual-input acceptance", () => {
  const value = evidence(); value.fixture = true;
  const report = analyzeCombatAcceptance(value);
  assert.equal(report.verdict, "UNQUALIFIED");
  assert.ok(codes(report).includes("fixture_input"));
});

test("does not misclassify a repeated confirmation stage as duplicate firing", () => {
  const value = evidence(); value.runs[0].telemetry.counts.duplicate = 1;
  assert.equal(analyzeCombatAcceptance(value).verdict, "PASS");
});

test("requires one real confirmation without pretending every accepted shot must hit", () => {
  const value = evidence(); const actual = value.runs[0].telemetry.metrics.actual;
  actual.validShots = 2;
  for (const key of ["predictedMs", "rttMs", "audioScheduleMs", "serverResolveMs"]) actual[key].count = 2;
  assert.equal(analyzeCombatAcceptance(value).verdict, "PASS");
});

test("accepts a UTF-8 BOM from Windows evidence writers", () => {
  assert.deepEqual(parseCombatAcceptanceText(`\uFEFF${JSON.stringify({ schemaVersion: 1 })}`), { schemaVersion: 1 });
});
