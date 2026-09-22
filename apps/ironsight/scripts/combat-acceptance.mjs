import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { writeReport } from "./aside-common.mjs";

export const COMBAT_MODES = Object.freeze(["tdm", "ffa", "dom"]);
export const COMBAT_STAGES = Object.freeze(["input", "handler", "predicted_commit", "send",
  "server_receive", "resolve", "receipt", "confirmed_paint", "audio_schedule"]);
const LOCAL_STAGES = new Set(["input", "handler", "predicted_commit", "send", "receipt", "confirmed_paint", "audio_schedule"]);
const SERVER_STAGES = new Set(["server_receive", "resolve"]);
const LOCAL_ORDER = ["input", "handler", "send", "predicted_commit", "audio_schedule", "receipt", "confirmed_paint"];
const SERVER_ORDER = ["server_receive", "resolve"];
const HASH = /^[a-f0-9]{64}$/i;
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
const finite = value => typeof value === "number" && Number.isFinite(value);
const reason = (code, detail) => detail === undefined ? { code } : { code, detail };
const result = (id, reasons, observations, verdict = reasons.length ? "FAIL" : "PASS") =>
  ({ id, verdict, reasons, observations, artifacts: [] });

function validateEnvelope(input) {
  if (!record(input) || input.schemaVersion !== 1 || !record(input.source)
    || !HASH.test(input.source.sourceSha256 ?? "") || !HASH.test(input.source.bundleSha256 ?? "")
    || !record(input.capture) || !Array.isArray(input.runs)) throw new Error("invalid_combat_acceptance_input");
  return input;
}

function captureCase(capture) {
  const issues = [];
  if (capture.actualInput !== true) issues.push(reason("actual_input_unavailable"));
  if (capture.pointerLock !== true) issues.push(reason("pointer_lock_unavailable"));
  for (const key of ["requestedViewport", "cssViewport", "drawingBuffer"]) {
    if (!Array.isArray(capture[key]) || capture[key][0] !== 1920 || capture[key][1] !== 1080) issues.push(reason("viewport_mismatch", key));
  }
  if (!finite(capture.refreshHz) || capture.refreshHz <= 0) issues.push(reason("refresh_rate_unavailable"));
  if (typeof capture.inputVideo !== "string" || capture.inputVideo.length === 0) issues.push(reason("input_video_missing"));
  return result("actual-input-capture", issues, { refreshHz: capture.refreshHz ?? null }, issues.length ? "UNQUALIFIED" : "PASS");
}

function expectedKeys() {
  return COMBAT_MODES.flatMap(mode => Array.from({ length: 5 }, (_, weapon) =>
    [`${mode}:${weapon}:normal`, `${mode}:${weapon}:reduced`]).flat());
}

function runKey(run) { return `${run.mode}:${run.weaponIndex}:${run.reducedMotion ? "reduced" : "normal"}`; }

function coverageCase(runs) {
  const issues = [], seen = new Set();
  for (const run of runs) {
    if (!record(run) || !COMBAT_MODES.includes(run.mode) || !Number.isInteger(run.weaponIndex)
      || run.weaponIndex < 0 || run.weaponIndex > 4 || typeof run.reducedMotion !== "boolean" || run.complete !== true
      || typeof run.url !== "string" || !run.url.includes(`mode=${run.mode}`)) {
      issues.push(reason("incomplete_run", run?.id)); continue;
    }
    const key = runKey(run);
    if (seen.has(key)) issues.push(reason("duplicate_run", key));
    seen.add(key);
  }
  for (const key of expectedKeys()) if (!seen.has(key)) issues.push(reason("missing_run", key));
  return result("scenario-coverage", issues, { expectedRuns: 30, observedRuns: runs.length });
}

function stageCase(runs) {
  const issues = [];
  for (const run of runs) {
    const telemetry = run.telemetry;
    if (!record(telemetry) || telemetry.schemaVersion !== 1 || !Array.isArray(telemetry.events)) {
      issues.push(reason("invalid_telemetry", run.id)); continue;
    }
    if (JSON.stringify(telemetry.stages) !== JSON.stringify(COMBAT_STAGES)) issues.push(reason("stage_vocabulary", run.id));
    const names = new Set(telemetry.events.map(event => event?.stage));
    for (const stage of COMBAT_STAGES) if (!names.has(stage)) issues.push(reason("missing_stage", `${run.id}/${stage}`));
    for (const event of telemetry.events) {
      if (!record(event) || !finite(event.at)) { issues.push(reason("invalid_stage", run.id)); continue; }
      const expectedClock = LOCAL_STAGES.has(event.stage) ? "client-monotonic" : SERVER_STAGES.has(event.stage) ? "server-wall" : null;
      if (expectedClock !== null && event.clock !== expectedClock) issues.push(reason("mixed_clock", `${run.id}/${event.stage}`));
    }
    const inputs = telemetry.events.filter(event => event?.stage === "input");
    if (!inputs.some(event => event.provenance?.source === "trusted-device" && event.provenance?.trusted === true)) {
      issues.push(reason("untrusted_input_stage", run.id));
    }
    const byId = new Map();
    for (const event of telemetry.events) {
      const events = byId.get(event?.id) ?? []; events.push(event); byId.set(event?.id, events);
    }
    for (const events of byId.values()) for (const order of [LOCAL_ORDER, SERVER_ORDER]) {
      let previous = -Infinity;
      for (const stage of order) {
        const event = events.find(candidate => candidate?.stage === stage);
        if (event && event.at < previous) { issues.push(reason("clock_reversed", `${run.id}/${stage}`)); break; }
        if (event) previous = event.at;
      }
    }
    if (telemetry.clockPairs?.crossClockSubtraction !== false) issues.push(reason("cross_clock_subtraction", run.id));
    for (const counter of ["invalid", "stale", "ignoredConfirmation"]) {
      if ((telemetry.counts?.[counter] ?? 0) > 0) issues.push(reason(`${counter}_trace`, run.id));
    }
    const actual = telemetry.metrics?.actual;
    if (!record(actual) || actual.validShots < 1 || actual.validAdsTransitions < 1
      || ["predictedMs", "rttMs", "audioScheduleMs", "serverResolveMs"]
        .some(metric => actual[metric]?.count !== actual.validShots)
      || (actual.confirmationMs?.count ?? 0) < 1) issues.push(reason("missing_stage_samples", run.id));
  }
  return result("stage-and-clock-integrity", issues, { stageVocabulary: COMBAT_STAGES });
}

function syntheticCase(runs) {
  const issues = [];
  for (const run of runs) {
    const synthetic = run.telemetry?.metrics?.synthetic;
    if (record(synthetic) && Object.values(synthetic).some(metric =>
      finite(metric) ? metric > 0 : record(metric) && finite(metric.count) && metric.count > 0)) {
      issues.push(reason("synthetic_telemetry_present", run.id));
    }
    if (run.telemetry?.events?.some(event => event?.stage === "input" && event.provenance
      && (event.provenance.source !== "trusted-device" || event.provenance.trusted !== true))) {
      issues.push(reason("synthetic_provenance_present", run.id));
    }
  }
  return result("synthetic-telemetry", issues, {}, issues.length ? "UNQUALIFIED" : "PASS");
}

function timingCase(runs, refreshHz) {
  const issues = [], ceiling = finite(refreshHz) && refreshHz > 0 ? 1000 / refreshHz + 5 : 0;
  for (const run of runs) {
    const predicted = run.telemetry?.metrics?.actual?.predictedMs?.p95;
    if (!finite(predicted) || predicted > ceiling) issues.push(reason("predicted_latency", run.id));
    if (!finite(run.movement?.matchedErrorM) || run.movement.matchedErrorM > 0.01) issues.push(reason("movement_error", run.id));
  }
  return result("latency-and-movement", issues, { predictedCeilingMs: ceiling, movementCeilingM: 0.01 });
}

function authorityCase(runs) {
  const issues = [];
  for (const run of runs) {
    const feedback = run.feedback ?? {};
    for (const [field, code] of [["falseHits", "false_hit"], ["falseKills", "false_kill"],
      ["duplicateShots", "duplicate_fire"], ["droppedValidEdges", "dropped_valid_edge"]]) {
      if ((feedback[field] ?? 0) > 0) issues.push(reason(code, run.id));
    }
  }
  return result("authoritative-feedback", issues, { falseHitKillBudget: 0, droppedEdgeBudget: 0 });
}

function parityCase(runs) {
  const issues = [], byKey = new Map(runs.map(run => [runKey(run), run]));
  for (const mode of COMBAT_MODES) for (let weapon = 0; weapon < 5; weapon += 1) {
    const normal = byKey.get(`${mode}:${weapon}:normal`), reduced = byKey.get(`${mode}:${weapon}:reduced`);
    if (normal && reduced && JSON.stringify(normal.feedback?.judgments) !== JSON.stringify(reduced.feedback?.judgments)) {
      issues.push(reason("judgment_mismatch", `${mode}:${weapon}`));
    }
  }
  return result("normal-reduced-parity", issues, { comparedPairs: 15 });
}

export function analyzeCombatAcceptance(value) {
  const input = validateEnvelope(value);
  const fixtureAuthenticity = input.fixture === true
    ? result("evidence-authenticity", [reason("fixture_input")], {}, "UNQUALIFIED")
    : result("evidence-authenticity", [], { sourceBound: true });
  const cases = [fixtureAuthenticity, syntheticCase(input.runs), captureCase(input.capture), coverageCase(input.runs), stageCase(input.runs),
    timingCase(input.runs, input.capture.refreshHz), authorityCase(input.runs), parityCase(input.runs)];
  const verdict = cases.some(item => item.verdict === "FAIL") ? "FAIL"
    : cases.some(item => item.verdict === "UNQUALIFIED") ? "UNQUALIFIED" : "PASS";
  return { schemaVersion: 1, scenario: "combat-acceptance", source: input.source,
    inputProvenance: input.capture.actualInput ? "trusted-device" : "unqualified",
    cases, verdict, exitCode: verdict === "PASS" ? 0 : verdict === "FAIL" ? 1 : 2 };
}

export function parseCombatAcceptanceText(text) {
  return JSON.parse(text.replace(/^\uFEFF/, ""));
}

async function main() {
  const inputIndex = process.argv.indexOf("--input"), outputIndex = process.argv.indexOf("--out");
  const inputPath = process.argv[inputIndex + 1], outputPath = process.argv[outputIndex + 1];
  if (inputIndex < 0 || outputIndex < 0 || !inputPath || !outputPath) throw new Error("usage: combat-acceptance --input <trace.json> --out <report.json>");
  const report = analyzeCombatAcceptance(parseCombatAcceptanceText(await readFile(inputPath, "utf8")));
  await writeReport(outputPath, report); process.exitCode = report.exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
