import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const VERDICT = Object.freeze({ PASS: 'PASS', FAIL: 'FAIL', UNQUALIFIED: 'UNQUALIFIED' });
export const EXIT = Object.freeze({ PASS: 0, FAIL: 1, UNQUALIFIED: 2 });
export const INPUT_STAGES = Object.freeze([
  'input',
  'handler',
  'predicted_commit',
  'send',
  'server_receive',
  'resolve',
  'receipt',
  'confirmed_paint',
  'audio_schedule',
]);

export function validateManifest(input) {
  if (!input || input.schemaVersion !== 1 || !Array.isArray(input.scenarios)) {
    throw new Error('manifest must use schemaVersion 1 and contain scenarios');
  }
  const aliases = input.aliases ?? {};
  const ids = new Set();
  for (const item of input.scenarios) {
    if (!item?.id || typeof item.id !== 'string') throw new Error('scenario id is required');
    if (ids.has(item.id)) throw new Error(`duplicate scenario id: ${item.id}`);
    ids.add(item.id);
    if (!Number.isInteger(item.ownerTask)) throw new Error(`scenario ${item.id} has invalid ownerTask`);
    if (typeof item.module !== 'string' || !item.module.endsWith('.mjs')) {
      throw new Error(`scenario ${item.id} has invalid module`);
    }
    if (!Array.isArray(item.cases) || item.cases.length === 0) throw new Error(`scenario ${item.id} has no cases`);
    if (item.cases.some(value => typeof value !== 'string' || value.length === 0)) {
      throw new Error(`scenario ${item.id} has an invalid case`);
    }
    if (!Array.isArray(item.compose)) throw new Error(`scenario ${item.id} has invalid composition`);
  }
  for (const item of input.scenarios) {
    for (const dependency of item.compose) {
      if (!ids.has(dependency)) throw new Error(`scenario ${item.id} composes unknown scenario: ${dependency}`);
    }
  }
  for (const [alias, target] of Object.entries(aliases)) {
    if (!alias || typeof target !== 'string' || !ids.has(target)) {
      throw new Error(`alias ${alias || '<empty>'} targets unknown scenario: ${target}`);
    }
    if (ids.has(alias)) throw new Error(`alias conflicts with scenario id: ${alias}`);
  }

  const byId = new Map(input.scenarios.map(item => [item.id, item]));
  const checked = new Set();
  const visit = (id, trail) => {
    const cycleAt = trail.indexOf(id);
    if (cycleAt >= 0) throw new Error(`scenario composition cycle: ${[...trail.slice(cycleAt), id].join(' -> ')}`);
    if (checked.has(id)) return;
    const item = byId.get(id);
    for (const dependency of item.compose) visit(dependency, [...trail, id]);
    checked.add(id);
  };
  for (const id of ids) visit(id, []);
  return { ...input, aliases, scenarios: input.scenarios.map(item => ({ ...item })) };
}

export async function loadScenarioManifest(resource) {
  const text = await readFile(resource, 'utf8');
  return validateManifest(JSON.parse(text));
}

export function resolveScenarioPlan(manifest, requested) {
  const target = manifest.aliases[requested] ?? requested;
  const byId = new Map(manifest.scenarios.map(item => [item.id, item]));
  if (!byId.has(target)) throw new Error(`unknown scenario: ${requested}`);
  const emitted = new Set();
  const plan = [];
  const append = id => {
    if (emitted.has(id)) return;
    const item = byId.get(id);
    for (const dependency of item.compose) append(dependency);
    emitted.add(id);
    plan.push(item);
  };
  append(target);
  return plan;
}

export function validateScenarioResult(definition, result) {
  if (!result || !Array.isArray(result.cases)) throw new Error(`scenario ${definition.id} returned no cases`);
  const expected = new Set(definition.cases);
  const seen = new Set();
  for (const item of result.cases) {
    if (!item || typeof item !== 'object') throw new Error(`scenario ${definition.id} returned an invalid case`);
    if (!expected.has(item.id)) throw new Error(`scenario ${definition.id} returned unknown case: ${item.id}`);
    if (seen.has(item.id)) throw new Error(`scenario ${definition.id} returned duplicate case: ${item.id}`);
    if (!Object.values(VERDICT).includes(item.verdict)) {
      throw new Error(`scenario ${definition.id} case ${item.id} has invalid verdict: ${item.verdict}`);
    }
    if (!Array.isArray(item.reasons)) throw new Error(`scenario ${definition.id} case ${item.id} has invalid reasons`);
    if (!Array.isArray(item.artifacts)) throw new Error(`scenario ${definition.id} case ${item.id} has invalid artifacts`);
    if (!Object.hasOwn(item, 'observations')) throw new Error(`scenario ${definition.id} case ${item.id} has no observations`);
    if (item.observations !== null && (typeof item.observations !== 'object' || Array.isArray(item.observations))) {
      throw new Error(`scenario ${definition.id} case ${item.id} has invalid observations`);
    }
    if (item.reasons.some(entry => !entry || typeof entry.code !== 'string' || entry.code.length === 0)) {
      throw new Error(`scenario ${definition.id} case ${item.id} has an invalid reason`);
    }
    if (item.artifacts.some(entry => !entry || typeof entry.path !== 'string' || entry.path.length === 0)) {
      throw new Error(`scenario ${definition.id} case ${item.id} has an invalid artifact`);
    }
    if (item.verdict === VERDICT.PASS && item.reasons.length) {
      throw new Error(`scenario ${definition.id} case ${item.id} passed with reasons`);
    }
    if (item.verdict !== VERDICT.PASS && item.reasons.length === 0) {
      throw new Error(`scenario ${definition.id} case ${item.id} has no failure reason`);
    }
    seen.add(item.id);
  }
  const missing = definition.cases.filter(id => !seen.has(id));
  if (missing.length) throw new Error(`scenario ${definition.id} missing cases: ${missing.join(', ')}`);
  return result;
}

export function parseViewport(value) {
  const match = /^(\d+)x(\d+)$/.exec(value ?? '');
  if (!match) throw new Error(`invalid viewport: ${value}`);
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width < 1 || height < 1) throw new Error(`invalid viewport: ${value}`);
  return [width, height];
}

export function classifyCapabilities(capabilities) {
  const reasons = [];
  if (!capabilities.session?.persistent || !capabilities.session?.alive) {
    reasons.push({ code: 'persistent_session_unavailable' });
  }
  if (!capabilities.pointerLock?.supported || !capabilities.pointerLock?.acquired) {
    reasons.push({ code: 'pointer_lock_unavailable', detail: capabilities.pointerLock?.error ?? null });
  }
  const requested = capabilities.viewport?.requested ?? [];
  const css = capabilities.viewport?.css ?? [];
  const drawingBuffer = capabilities.viewport?.drawingBuffer ?? [];
  if (requested[0] !== css[0] || requested[1] !== css[1]) {
    reasons.push({ code: 'viewport_mismatch', requested, observed: css });
  }
  if (requested[0] !== drawingBuffer[0] || requested[1] !== drawingBuffer[1]) {
    reasons.push({ code: 'drawing_buffer_mismatch', requested, observed: drawingBuffer });
  }
  if (!capabilities.capture?.annotatedScreenshot) {
    reasons.push({ code: 'capture_unavailable' });
  }
  const verdict = reasons.length === 0 ? VERDICT.PASS : VERDICT.UNQUALIFIED;
  return { verdict, exitCode: verdict === VERDICT.PASS ? EXIT.PASS : EXIT.UNQUALIFIED, reasons };
}

export function validateStages(expected, observed, options = {}) {
  const issues = [];
  const byName = new Map(observed.map(item => [item.name, item]));
  const missing = expected.filter(name => !byName.has(name));
  if (missing.length) issues.push({ code: 'missing_stage', stages: missing });
  const now = options.now ?? Date.now();
  const staleAfterMs = options.staleAfterMs ?? 30_000;
  const stale = observed.filter(item => Number.isFinite(item.at) && now - item.at > staleAfterMs).map(item => item.name);
  if (stale.length) issues.push({ code: 'stale_stage', stages: stale });
  for (let index = 1; index < expected.length; index += 1) {
    const before = byName.get(expected[index - 1]);
    const after = byName.get(expected[index]);
    if (before && after && Number.isFinite(before.at) && Number.isFinite(after.at) && after.at < before.at) {
      issues.push({ code: 'clock_reversed', before: before.name, after: after.name });
      break;
    }
  }
  return { verdict: issues.length ? VERDICT.FAIL : VERDICT.PASS, issues };
}

export function validateSnapshotRef({ generation, currentGeneration, sessionAlive }) {
  const issues = [];
  if (!sessionAlive) issues.push({ code: 'session_ended' });
  if (generation !== currentGeneration) {
    issues.push({ code: 'stale_snapshot_ref', generation, currentGeneration });
  }
  return { verdict: issues.length ? VERDICT.FAIL : VERDICT.PASS, issues };
}

function reportVerdict(cases) {
  if (cases.some(item => item.verdict === VERDICT.FAIL)) return VERDICT.FAIL;
  if (cases.some(item => item.verdict === VERDICT.UNQUALIFIED)) return VERDICT.UNQUALIFIED;
  return VERDICT.PASS;
}

export function buildReport(input) {
  const cases = input.cases ?? [];
  const verdict = reportVerdict(cases);
  return {
    schemaVersion: 1,
    scenario: input.scenario,
    seed: input.seed ?? null,
    startedAt: input.startedAt ?? null,
    finishedAt: input.finishedAt ?? new Date().toISOString(),
    source: input.source ?? null,
    browser: input.browser ?? null,
    inputProvenance: input.inputProvenance ?? 'none',
    cases,
    verdict,
    exitCode: verdict === VERDICT.PASS ? EXIT.PASS : verdict === VERDICT.FAIL ? EXIT.FAIL : EXIT.UNQUALIFIED,
  };
}

export async function writeReport(reportPath, report) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  const temporary = `${reportPath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await rename(temporary, reportPath);
}

export async function sha256File(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex');
}
