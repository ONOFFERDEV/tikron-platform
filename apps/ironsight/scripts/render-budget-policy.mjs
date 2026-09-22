export const RENDER_BUDGET_LIMITS = Object.freeze({
  publicBytes: 60 * 1024 * 1024,
  maxFileBytesExclusive: 25 * 1024 * 1024,
  draws: 240,
  triangles: 500_000,
  textureBytes: 64 * 1024 * 1024,
  textures: 32,
});

const MAPS = ['arena1', 'arena2', 'arena3'];
const STAGES = ['cold', 'bake', 'warm', 'stress', 'drain', 'switch-out'];
const METRICS = ['calls', 'triangles', 'textures', 'textureBytes', 'geometries', 'programs',
  'nodes', 'shadowTargetDraws', 'newPrograms', 'vfxActive'];
const HASH = /^[a-f0-9]{64}$/i;
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const tuple = (value, length) => Array.isArray(value) && value.length === length && value.every(finite);
const positiveTuple = (value, length) => tuple(value, length) && value.every(entry => entry > 0);
const invalid = (code, detail) => { throw new Error(`${code}${detail ? `: ${detail}` : ''}`); };

export function parseRenderBudgetEvidence(value) {
  if (!record(value) || value.schemaVersion !== 1) invalid('invalid_schema');
  if (!record(value.source) || ['sourceSha256', 'bundleSha256', 'manifestSha256']
    .some(key => !HASH.test(value.source[key] ?? ''))) invalid('invalid_source_binding');
  const viewport = value.viewport;
  if (!record(viewport) || !positiveTuple(viewport.requested, 2) || !positiveTuple(viewport.css, 2)
    || !positiveTuple(viewport.drawingBuffer, 2) || !finite(viewport.dpr) || viewport.dpr === 0
    || viewport.requested.some((entry, index) => entry !== viewport.css[index]
      || entry !== viewport.drawingBuffer[index])) invalid('viewport_unqualified');
  const clock = value.clockQuality;
  if (!record(clock) || clock.domain !== 'client-monotonic' || clock.monotonic !== true
    || !finite(clock.resolutionMs) || !finite(clock.maxRafGapMs) || clock.visibility !== 'visible'
    || clock.deviceTimingQualified !== false) invalid('clock_quality_unqualified');
  const assets = value.staticAssets;
  if (!record(assets) || !finite(assets.publicBytes) || !finite(assets.maxFileBytes)
    || typeof assets.manifestComplete !== 'boolean' || typeof assets.hashesVerified !== 'boolean') {
    invalid('invalid_static_assets');
  }
  if (!Array.isArray(value.maps) || value.maps.length !== MAPS.length
    || MAPS.some((map, index) => value.maps[index]?.map !== map)) invalid('invalid_map_inventory');
  for (const mapEntry of value.maps) {
    if (!Array.isArray(mapEntry.cycles) || mapEntry.cycles.length !== 3
      || mapEntry.cycles.some((cycle, index) => cycle.index !== index + 1)) invalid('invalid_map_cycles', mapEntry.map);
    for (const cycle of mapEntry.cycles) validateCycle(mapEntry.map, cycle);
  }
  return value;
}

function validateCycle(map, cycle) {
  if (!Array.isArray(cycle.samples) || STAGES.some(stage => !cycle.samples.some(sample => sample.stage === stage))) {
    invalid('missing_stage', `${map}/${cycle.index}`);
  }
  for (const sample of cycle.samples) {
    if (!record(sample) || !STAGES.includes(sample.stage) || METRICS.some(key => !finite(sample[key]))) {
      invalid('invalid_sample', `${map}/${cycle.index}`);
    }
  }
  if (!record(cycle.hidden) || cycle.hidden.includesWarmedMaterials !== true
    || !finite(cycle.hidden.materials) || !finite(cycle.hidden.textures)) invalid('hidden_accounting_missing');
  if (!Array.isArray(cycle.residentOwners) || !Array.isArray(cycle.requests)) invalid('invalid_residency');
  for (const request of cycle.requests) if (!record(request) || typeof request.path !== 'string'
    || typeof request.owner !== 'string' || !HASH.test(request.sha256 ?? '') || !finite(request.bytes)) invalid('invalid_request');
  const life = cycle.actorLifecycle;
  for (const key of ['first11', 'zero', 'second11']) {
    if (!record(life?.[key]) || ['actors', 'skeletons', 'boneTextures', 'materials']
      .some(metric => !finite(life[key][metric]))) invalid('invalid_actor_lifecycle');
  }
  const context = cycle.context;
  if (!record(context) || typeof context.supported !== 'boolean' || !Array.isArray(context.events)
    || typeof context.status !== 'string' || !positiveTuple(context.drawingBuffer, 2)) invalid('invalid_context_evidence');
}

const reason = (code, detail) => ({ code, detail });
const result = (id, issues, observations, unqualified = false) => ({
  id,
  verdict: issues.length ? (unqualified || issues.every(issue => issue.code.endsWith('_unsupported')) ? 'UNQUALIFIED' : 'FAIL') : 'PASS',
  reasons: issues,
  observations,
  artifacts: [],
});
const drain = cycle => cycle.samples.find(sample => sample.stage === 'drain');

export function evaluateRenderBudget(definition, input) {
  const evidence = parseRenderBudgetEvidence(input);
  if (!record(definition) || !Array.isArray(definition.cases) || definition.cases.length !== 4) invalid('invalid_definition');
  const stageIssues = [], mapIssues = [], budgetIssues = [], resourceIssues = [];
  const peaks = { calls: 0, triangles: 0, textures: 0, textureBytes: 0 };
  for (const mapEntry of evidence.maps) {
    for (const cycle of mapEntry.cycles) {
      for (const sample of cycle.samples) {
        for (const key of Object.keys(peaks)) peaks[key] = Math.max(peaks[key], sample[key]);
        if (sample.calls > RENDER_BUDGET_LIMITS.draws) budgetIssues.push(reason('draw_budget', location(mapEntry, cycle, sample)));
        if (sample.triangles > RENDER_BUDGET_LIMITS.triangles) budgetIssues.push(reason('triangle_budget', location(mapEntry, cycle, sample)));
        if (sample.textureBytes > RENDER_BUDGET_LIMITS.textureBytes) budgetIssues.push(reason('texture_bytes_budget', location(mapEntry, cycle, sample)));
        if (sample.textures > RENDER_BUDGET_LIMITS.textures) budgetIssues.push(reason('texture_count_budget', location(mapEntry, cycle, sample)));
        if ((sample.stage === 'warm' || sample.stage === 'stress') && sample.newPrograms > 0) {
          resourceIssues.push(reason('shader_after_ready', location(mapEntry, cycle, sample)));
        }
        if ((sample.stage === 'warm' || sample.stage === 'stress') && sample.shadowTargetDraws > 0) {
          resourceIssues.push(reason('shadow_after_ready', location(mapEntry, cycle, sample)));
        }
        if (sample.stage === 'drain' && sample.vfxActive > 0) resourceIssues.push(reason('vfx_not_drained', location(mapEntry, cycle, sample)));
      }
      const allowed = new Set(['shared', mapEntry.map]);
      if (cycle.residentOwners.some(owner => !allowed.has(owner)) || cycle.requests.some(request => !allowed.has(request.owner))) {
        mapIssues.push(reason('foreign_map_resident', `${mapEntry.map}/${cycle.index}`));
      }
      actorIssues(cycle.actorLifecycle, resourceIssues, `${mapEntry.map}/${cycle.index}`);
      if (!cycle.context.supported) resourceIssues.push(reason('context_restore_unsupported', `${mapEntry.map}/${cycle.index}`));
      else if (cycle.context.status !== 'restored' || !['lost', 'restored'].every(event => cycle.context.events.includes(event))
        || cycle.context.drawingBuffer.some((entry, index) => entry !== evidence.viewport.drawingBuffer[index])) {
        resourceIssues.push(reason('context_restore_failed', `${mapEntry.map}/${cycle.index}`));
      }
    }
    const first = drain(mapEntry.cycles[0]), last = drain(mapEntry.cycles[2]);
    for (const key of ['textures', 'textureBytes', 'geometries', 'programs', 'nodes']) {
      if (last[key] > first[key]) resourceIssues.push(reason('cycle_growth', `${mapEntry.map}/${key}:${first[key]}->${last[key]}`));
    }
  }
  if (evidence.staticAssets.publicBytes > RENDER_BUDGET_LIMITS.publicBytes) budgetIssues.push(reason('public_bytes_budget'));
  if (evidence.staticAssets.maxFileBytes >= RENDER_BUDGET_LIMITS.maxFileBytesExclusive) budgetIssues.push(reason('file_bytes_budget'));
  if (!evidence.staticAssets.hashesVerified) budgetIssues.push(reason('request_hash_mismatch'));
  stageIssues.push(...budgetIssues.filter(issue => issue.detail),
    ...resourceIssues.filter(issue => issue.code === 'shader_after_ready' || issue.code === 'shadow_after_ready'));
  const unsealed = !evidence.staticAssets.manifestComplete;
  const assetIssues = unsealed ? [...budgetIssues, reason('final_manifest_unsealed')] : budgetIssues;
  return { cases: [
    result(definition.cases[0], stageIssues, { peaks, rawSamples: true }),
    result(definition.cases[1], mapIssues, { maps: MAPS, cycles: 3 }),
    result(definition.cases[2], assetIssues, { limits: RENDER_BUDGET_LIMITS, peaks }, unsealed && budgetIssues.length === 0),
    result(definition.cases[3], resourceIssues, { hiddenAccounting: true, contextInjection: true }),
  ], observations: { source: evidence.source, viewport: evidence.viewport, clockQuality: evidence.clockQuality } };
}

function location(mapEntry, cycle, sample) { return `${mapEntry.map}/${cycle.index}/${sample.stage}`; }
function actorIssues(life, issues, at) {
  if (life.first11.actors !== 11 || life.zero.actors !== 0 || life.second11.actors !== 11
    || life.zero.skeletons !== 0 || life.zero.boneTextures !== 0) issues.push(reason('skeleton_leak', at));
  for (const key of ['skeletons', 'boneTextures', 'materials']) {
    if (life.second11[key] > life.first11[key]) issues.push(reason('actor_cycle_growth', `${at}/${key}`));
  }
}
