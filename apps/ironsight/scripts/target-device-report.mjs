#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const PASS = 'PASS';
const FAIL = 'FAIL';
const UNQUALIFIED = 'UNQUALIFIED';
const FRAME_LIMITS = Object.freeze({
  medianFps: 59,
  frameP95Ms: 20,
  frameP99Ms: 25,
  gapsOver50Ratio: .001,
  stallsOver150: 0,
});

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const reason = (code, detail = null) => ({ code, detail });
const column = (reasons, observations, missing = false) => ({
  verdict: reasons.length === 0 ? PASS : missing ? UNQUALIFIED : FAIL,
  reasons,
  observations: observations ?? null,
});

function hardwareColumn(input) {
  if (!record(input)) return column([reason('target_device_missing')], null, true);
  const observed = input.observed;
  if (!record(observed) || !record(observed.device) || !record(observed.browser)
    || !record(observed.render) || !record(observed.source)) {
    return column([reason('target_device_manifest_incomplete')], input, true);
  }
  const reasons = [];
  const required = [
    observed.device.manufacturer, observed.device.model, observed.device.cpu,
    observed.device.displayAdapters, observed.device.ramBytes, observed.device.os,
    observed.device.acPower, observed.device.performanceMode, observed.browser.asideVersion,
    observed.browser.browserVersion, observed.browser.activeWebglAdapter,
    observed.render.cssViewport, observed.render.drawingBuffer, observed.render.renderScale,
    observed.source.head, observed.source.dirtyDiffHash, observed.source.assetManifestHash,
  ];
  if (required.some(value => value === null || value === undefined || value === ''
    || Array.isArray(value) && value.length === 0)) reasons.push(reason('target_device_manifest_incomplete'));
  const model = typeof observed.device.model === 'string' ? observed.device.model.toLowerCase() : '';
  if (!/(laptop|notebook|book|gram|thinkpad|latitude|elitebook|vivobook|zenbook|legion|omen)/.test(model)) {
    reasons.push(reason('target_laptop_not_identified', observed.device.model ?? null));
  }
  const active = typeof observed.browser.activeWebglAdapter === 'string'
    ? observed.browser.activeWebglAdapter.toLowerCase() : '';
  const adapters = Array.isArray(observed.device.displayAdapters) ? observed.device.displayAdapters : [];
  const activeIntegrated = adapters.some(adapter => record(adapter) && adapter.integrated === true
    && typeof adapter.name === 'string' && active.includes(adapter.name.toLowerCase()));
  if (!activeIntegrated || /(nvidia|geforce|rtx|gtx|swiftshader|software)/.test(active)) {
    reasons.push(reason('target_igpu_not_active', observed.browser.activeWebglAdapter ?? null));
  }
  if (input.availability !== 'QUALIFIED') reasons.push(reason('target_session_unqualified', input.availability ?? null));
  return column(reasons, input, true);
}

function frameColumn(sample, minimumDurationMs, finalWindow = false) {
  if (!record(sample)) return column([reason('frame_evidence_missing')], null, true);
  const reasons = [];
  if (!finite(sample.durationMs) || sample.durationMs < minimumDurationMs) reasons.push(reason('duration_short', sample.durationMs ?? null));
  if (finalWindow && (!finite(sample.finalWindowMs) || sample.finalWindowMs < 180_000)) {
    reasons.push(reason('final_window_short', sample.finalWindowMs ?? null));
  }
  for (const [key, limit] of Object.entries(FRAME_LIMITS)) {
    const value = sample[key];
    if (!finite(value)) reasons.push(reason('frame_metric_missing', key));
    else if (key === 'medianFps' ? value < limit : value > limit) reasons.push(reason(key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`), value));
  }
  return column(reasons, sample, reasons.some(item => item.code === 'frame_metric_missing'));
}

function routesColumn(routes, pointerLock) {
  if (!record(routes)) return column([reason('route_evidence_missing')], null, true);
  const reasons = [];
  if (pointerLock !== true) reasons.push(reason('pointer_lock_missing'));
  const maps = Array.isArray(routes.maps) ? new Set(routes.maps) : new Set();
  if (!['arena1', 'arena2', 'arena3'].every(map => maps.has(map))) reasons.push(reason('three_maps_incomplete'));
  if (!Number.isSafeInteger(routes.tdmFfaPairs) || routes.tdmFfaPairs < 5) reasons.push(reason('tdm_ffa_pairs_incomplete'));
  if (routes.dom !== true) reasons.push(reason('dom_incomplete'));
  if (routes.practice !== true) reasons.push(reason('practice_incomplete'));
  return column(reasons, routes, false);
}

export function evaluateTargetDeviceReport(input) {
  if (!record(input) || input.schemaVersion !== 1 || input.scenario !== 'perf-target') {
    return { schemaVersion: 1, verdict: UNQUALIFIED, exitCode: 2,
      columns: { targetDevice: column([reason('target_report_invalid')], input, true) } };
  }
  const performance = record(input.targetPerformance) ? input.targetPerformance : {};
  const columns = {
    targetDevice: hardwareColumn(input.targetDevice),
    renderScale: column(performance.renderScale === 1 ? [] : [reason('render_scale_not_one', performance.renderScale ?? null)],
      { renderScale: performance.renderScale ?? null }, performance.renderScale === undefined),
    warm: frameColumn(performance.warm, 180_000),
    thermal: frameColumn(performance.thermal, 1_200_000, true),
    routes: routesColumn(performance.routes, performance.pointerLock),
  };
  const verdicts = Object.values(columns).map(entry => entry.verdict);
  const verdict = verdicts.includes(FAIL) ? FAIL : verdicts.includes(UNQUALIFIED) ? UNQUALIFIED : PASS;
  return { schemaVersion: 1, verdict, exitCode: verdict === PASS ? 0 : verdict === FAIL ? 1 : 2, columns };
}

async function main() {
  const [inputName, outputFlag, outputName] = process.argv.slice(2);
  if (!inputName || outputFlag && outputFlag !== '--out' || outputFlag === '--out' && !outputName) {
    console.error('Usage: node scripts/target-device-report.mjs <perf-target-report.json> [--out <summary.json>]');
    return 1;
  }
  const inputPath = path.resolve(inputName);
  const result = evaluateTargetDeviceReport(JSON.parse(await readFile(inputPath, 'utf8')));
  const outputPath = path.resolve(outputName ?? path.join(path.dirname(inputPath), 'target-device-summary.json'));
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ verdict: result.verdict, output: outputPath }));
  return result.exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  try { process.exitCode = await main(); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
