import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateTargetDeviceReport } from '../scripts/target-device-report.mjs';

const hardware = adapter => ({
  availability: 'QUALIFIED',
  observed: {
    device: {
      manufacturer: 'Framework', model: 'Laptop 13', cpu: ['Intel Core Ultra 5'],
      displayAdapters: [{ name: adapter, driver: '32.0.1', integrated: true }], ramBytes: 16 * 1024 ** 3,
      os: 'Windows 11', acPower: true, performanceMode: 'performance',
    },
    browser: { asideVersion: '1.0.0', browserVersion: 'Chromium 140', activeWebglAdapter: adapter },
    render: { cssViewport: [1920, 1080], drawingBuffer: [1920, 1080], renderScale: 1 },
    source: { head: 'a'.repeat(40), dirtyDiffHash: 'b'.repeat(64), assetManifestHash: 'c'.repeat(64) },
  },
});

const frames = durationMs => ({
  durationMs, medianFps: 60, frameP95Ms: 18, frameP99Ms: 22,
  gapsOver50Ratio: .0005, stallsOver150: 0,
});

const report = adapter => ({
  schemaVersion: 1,
  scenario: 'perf-target',
  targetDevice: hardware(adapter),
  targetPerformance: {
    renderScale: 1,
    warm: frames(180_000),
    thermal: { ...frames(1_200_000), finalWindowMs: 180_000 },
    routes: { maps: ['arena1', 'arena2', 'arena3'], tdmFfaPairs: 5, dom: true, practice: true },
    pointerLock: true,
  },
});

test('qualifies a complete named laptop iGPU run at the target thresholds', () => {
  const result = evaluateTargetDeviceReport(report('Intel Arc Graphics'));
  assert.equal(result.verdict, 'PASS');
  assert.deepEqual(result.columns.targetDevice.reasons, []);
});

test('keeps absent hardware evidence unqualified', () => {
  const result = evaluateTargetDeviceReport({ schemaVersion: 1, scenario: 'perf-target' });
  assert.equal(result.verdict, 'UNQUALIFIED');
  assert.ok(result.columns.targetDevice.reasons.some(item => item.code === 'target_device_missing'));
});

test('rejects desktop dGPU and SwiftShader substitution for the target laptop iGPU', () => {
  for (const adapter of ['NVIDIA GeForce RTX 5070', 'Google SwiftShader']) {
    const result = evaluateTargetDeviceReport(report(adapter));
    assert.equal(result.verdict, 'UNQUALIFIED');
    assert.ok(result.columns.targetDevice.reasons.some(item => item.code === 'target_igpu_not_active'));
  }
});

test('fails measured performance below a frame threshold without erasing the raw sample', () => {
  const input = report('Intel Arc Graphics');
  input.targetPerformance.warm.frameP99Ms = 30;
  const result = evaluateTargetDeviceReport(input);
  assert.equal(result.verdict, 'FAIL');
  assert.equal(result.columns.warm.observations.frameP99Ms, 30);
  assert.ok(result.columns.warm.reasons.some(item => item.code === 'frame_p99_ms'));
});
