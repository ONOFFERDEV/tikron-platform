import assert from 'node:assert/strict';
import test from 'node:test';

import { RENDER_BUDGET_LIMITS, evaluateRenderBudget, parseRenderBudgetEvidence } from '../scripts/render-budget-policy.mjs';
import { classifyRenderCollection, runPerfRender } from '../scripts/render-budget-collector.mjs';

const HASH = 'a'.repeat(64);
const sample = (stage, overrides = {}) => ({
  stage, calls: 120, triangles: 300_000, textures: 20, textureBytes: 40 * 1024 * 1024,
  geometries: 80, programs: 24, nodes: 400, shadowTargetDraws: stage === 'bake' ? 1 : 0,
  newPrograms: 0, vfxActive: 0, ...overrides,
});
const lifecycle = () => ({
  first11: { actors: 11, skeletons: 11, boneTextures: 11, materials: 44 },
  zero: { actors: 0, skeletons: 0, boneTextures: 0, materials: 0 },
  second11: { actors: 11, skeletons: 11, boneTextures: 11, materials: 44 },
});
const cycle = (map, index) => ({
  index,
  samples: [sample('cold'), sample('bake'), sample('warm'), sample('warm'),
    sample('stress'), sample('drain'), sample('switch-out')],
  hidden: { includesWarmedMaterials: true, materials: 12, textures: 6 },
  residentOwners: ['shared', map],
  requests: [{ path: `/assets/${map}.glb`, owner: map, sha256: HASH, bytes: 1024 }],
  actorLifecycle: lifecycle(),
  context: { supported: true, events: ['lost', 'restored'], status: 'restored', drawingBuffer: [1920, 1080] },
});
const evidence = () => ({
  schemaVersion: 1,
  source: { sourceSha256: HASH, bundleSha256: HASH, manifestSha256: HASH },
  viewport: { requested: [1920, 1080], css: [1920, 1080], drawingBuffer: [1920, 1080], dpr: 1 },
  clockQuality: { domain: 'client-monotonic', monotonic: true, resolutionMs: .1,
    maxRafGapMs: 17, visibility: 'visible', deviceTimingQualified: false },
  staticAssets: { publicBytes: 50 * 1024 * 1024, maxFileBytes: 10 * 1024 * 1024,
    manifestComplete: true, hashesVerified: true },
  maps: ['arena1', 'arena2', 'arena3'].map(map => ({ map, cycles: [1, 2, 3].map(index => cycle(map, index)) })),
});
const definition = { cases: ['cold/warm/stress/bake', 'map/asset switches', 'budget overflow', 'resource leak'] };
const findCase = (result, id) => result.cases.find(entry => entry.id === id);
const codes = entry => entry.reasons.map(reason => reason.code);

test('accepts complete source-bound evidence with every raw stage and exact map cycles', () => {
  const parsed = parseRenderBudgetEvidence(evidence());
  assert.equal(parsed.maps.length, 3);
  assert.deepEqual(evaluateRenderBudget(definition, parsed).cases.map(entry => entry.verdict),
    ['PASS', 'PASS', 'PASS', 'PASS']);
});

test('rejects stale hashes, missing stages, requested-only viewport, hidden omissions and bad clocks', () => {
  const cases = [
    value => { value.source.bundleSha256 = 'bad'; },
    value => { value.maps[0].cycles[0].samples = value.maps[0].cycles[0].samples.filter(entry => entry.stage !== 'bake'); },
    value => { value.viewport.css = [1440, 900]; },
    value => { value.maps[1].cycles[1].hidden.includesWarmedMaterials = false; },
    value => { value.clockQuality.monotonic = false; },
    value => { value.viewport.drawingBuffer = [0, 0]; },
  ];
  for (const mutate of cases) {
    const value = evidence(); mutate(value);
    assert.throws(() => parseRenderBudgetEvidence(value));
  }
});

test('collector records missing dev hook and closes its owned Aside tab', async () => {
  const cleanup = [], artifacts = [];
  let calls = 0;
  const runtime = {
    replJson: async () => {
      calls += 1;
      if (calls === 1) return { url: 'about:blank' };
      if (calls === 2) return { metrics: {}, cdp: true };
      return { available: false, viewport: evidence().viewport, reason: 'render_budget_hook_missing' };
    },
    recoverStaleFetchInterception: async () => ({ supported: true, disabled: true }),
    closeOwnedTab: async () => ({ fetchDisabled: true, metricsCleared: true }),
  };
  const result = await runPerfRender({
    definition, repl: {}, source: null, url: 'http://127.0.0.1:8896', viewport: [1920, 1080],
    writeArtifact: async (path, value) => { artifacts.push({ path, value }); return { path, bytes: 1 }; },
    recordCleanup: receipt => cleanup.push(receipt),
  }, runtime);
  assert.deepEqual(result.cases.map(entry => entry.verdict),
    ['UNQUALIFIED', 'UNQUALIFIED', 'UNQUALIFIED', 'UNQUALIFIED']);
  assert.ok(result.cases.every(entry => entry.reasons[0].code === 'render_budget_hook_unavailable'));
  assert.equal(artifacts[0].path, 'render-budget-raw.json');
  assert.deepEqual(cleanup[0], { resource: 'perf-render-tab', fetchDisabled: true, metricsCleared: true });
});

test('fails every ceiling independently, including exclusive 25 MiB files', () => {
  const cases = [
    value => { value.maps[0].cycles[0].samples[0].calls = RENDER_BUDGET_LIMITS.draws + 1; },
    value => { value.maps[0].cycles[0].samples[0].triangles = RENDER_BUDGET_LIMITS.triangles + 1; },
    value => { value.maps[0].cycles[0].samples[0].textureBytes = RENDER_BUDGET_LIMITS.textureBytes + 1; },
    value => { value.maps[0].cycles[0].samples[0].textures = RENDER_BUDGET_LIMITS.textures + 1; },
    value => { value.staticAssets.publicBytes = RENDER_BUDGET_LIMITS.publicBytes + 1; },
    value => { value.staticAssets.maxFileBytes = RENDER_BUDGET_LIMITS.maxFileBytesExclusive; },
  ];
  for (const mutate of cases) {
    const value = evidence(); mutate(value);
    assert.equal(findCase(evaluateRenderBudget(definition, value), 'budget overflow').verdict, 'FAIL');
  }
});

test('includes the shadow bake outlier even when every warm sample is below budget', () => {
  const value = evidence();
  value.maps[0].cycles[0].samples.find(entry => entry.stage === 'bake').calls = 241;
  const result = evaluateRenderBudget(definition, value);
  assert.equal(findCase(result, 'cold/warm/stress/bake').verdict, 'FAIL');
  assert.ok(codes(findCase(result, 'budget overflow')).includes('draw_budget'));
});

test('fails shader creation and shadow target draws after warm-up', () => {
  const value = evidence();
  const warm = value.maps[0].cycles[0].samples.find(entry => entry.stage === 'warm');
  warm.newPrograms = 1; warm.shadowTargetDraws = 1;
  const resource = findCase(evaluateRenderBudget(definition, value), 'resource leak');
  assert.equal(resource.verdict, 'FAIL');
  assert.ok(codes(resource).includes('shader_after_ready'));
  assert.ok(codes(resource).includes('shadow_after_ready'));
});

test('fails foreign map residency and same-map cycle growth', () => {
  const value = evidence();
  value.maps[1].cycles[1].residentOwners.push('arena1');
  value.maps[2].cycles[2].samples.find(entry => entry.stage === 'drain').textures += 1;
  const result = evaluateRenderBudget(definition, value);
  assert.ok(codes(findCase(result, 'map/asset switches')).includes('foreign_map_resident'));
  assert.ok(codes(findCase(result, 'resource leak')).includes('cycle_growth'));
});

test('fails skeleton nonreturn, VFX residue and context restore failure', () => {
  const value = evidence(), current = value.maps[0].cycles[0];
  current.actorLifecycle.zero.skeletons = 1;
  current.samples.find(entry => entry.stage === 'drain').vfxActive = 1;
  current.context.status = 'failed'; current.context.events = ['lost'];
  const resource = findCase(evaluateRenderBudget(definition, value), 'resource leak');
  assert.equal(resource.verdict, 'FAIL');
  for (const code of ['skeleton_leak', 'vfx_not_drained', 'context_restore_failed']) assert.ok(codes(resource).includes(code));
});

test('keeps an unsealed final manifest unqualified instead of passing an empty inventory', () => {
  const value = evidence(); value.staticAssets.manifestComplete = false;
  const budget = findCase(evaluateRenderBudget(definition, value), 'budget overflow');
  assert.equal(budget.verdict, 'UNQUALIFIED');
  assert.ok(codes(budget).includes('final_manifest_unsealed'));
});

test('keeps an unsupported real context-loss injection unqualified', () => {
  const value = evidence(); value.maps[0].cycles[0].context.supported = false;
  const resource = findCase(evaluateRenderBudget(definition, value), 'resource leak');
  assert.equal(resource.verdict, 'UNQUALIFIED');
  assert.ok(codes(resource).includes('context_restore_unsupported'));
});

test('collector classification never promotes absent or malformed runtime evidence', () => {
  assert.deepEqual(classifyRenderCollection(definition, null).cases.map(entry => entry.verdict),
    ['UNQUALIFIED', 'UNQUALIFIED', 'UNQUALIFIED', 'UNQUALIFIED']);
  const malformed = evidence(); malformed.source.bundleSha256 = 'wrong';
  const result = classifyRenderCollection(definition, malformed);
  assert.deepEqual(result.cases.map(entry => entry.verdict),
    ['UNQUALIFIED', 'UNQUALIFIED', 'UNQUALIFIED', 'UNQUALIFIED']);
  assert.equal(result.cases[0].reasons[0].code, 'invalid_render_evidence');
});
