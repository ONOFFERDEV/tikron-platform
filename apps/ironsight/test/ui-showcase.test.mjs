import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const appRoot = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const builder = path.join(appRoot, 'scripts', 'build-ui-showcase.mjs');
const shippedBundle = path.join(appRoot, 'public', 'client.js');
const publicIndex = path.join(appRoot, 'public', 'index.html');
const scenarioModule = new URL('../scripts/aside-scenarios/ui.mjs', import.meta.url);

async function optionalHash(file) {
  try {
    return createHash('sha256').update(await readFile(file)).digest('hex');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

test('builds a loopback-only primitive showcase without changing the shipped client bundle', async () => {
  // Given: an isolated output directory and the current shipped client hash.
  const output = await mkdtemp(path.join(tmpdir(), 'ironsight-ui-showcase-'));
  const before = await optionalHash(shippedBundle);

  try {
    // When: the dedicated showcase builder runs.
    const result = spawnSync(process.execPath, [builder, '--outdir', output], {
      cwd: appRoot,
      encoding: 'utf8',
    });

    // Then: it emits a real Korean showcase packet and leaves public/client.js untouched.
    assert.equal(result.status, 0, result.stderr);
    const [html, bundle, manifest] = await Promise.all([
      readFile(path.join(output, 'index.html'), 'utf8'),
      readFile(path.join(output, 'showcase.js'), 'utf8'),
      readFile(path.join(output, 'manifest.json'), 'utf8').then(JSON.parse),
    ]);
    assert.match(html, /<html lang="ko">/);
    assert.match(html, /showcase\.js/);
    assert.match(bundle, /dataset\.showcase/);
    assert.equal(manifest.surface, 'ui-primitives');
    assert.equal(manifest.delivery, 'loopback-only');
    assert.ok((await stat(path.join(output, 'showcase.js'))).size > 1_000);
    assert.equal(await optionalHash(shippedBundle), before);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test('registers every released UI scenario including the authoritative combat HUD', async () => {
  // Given: the Task 6 field-module contract.
  // When: the Task 4 UI scenario module is loaded.
  const module = await import(scenarioModule.href);

  // Then: the canonical scenario id resolves to one executable handler.
  assert.deepEqual(Object.keys(module.scenarioHandlers), ['ui-primitives', 'ui-copy', 'ui-deploy', 'ui-settings', 'ui-combat-hud']);
  assert.equal(typeof module.scenarioHandlers['ui-primitives'], 'function');
  assert.equal(typeof module.scenarioHandlers['ui-copy'], 'function');
  assert.equal(typeof module.scenarioHandlers['ui-deploy'], 'function');
  assert.equal(typeof module.scenarioHandlers['ui-settings'], 'function');
  assert.equal(typeof module.scenarioHandlers['ui-combat-hud'], 'function');
});

test('assigns independent tab and panel ids to multiple tab sets', async () => {
  const output = await mkdtemp(path.join(tmpdir(), 'ironsight-ui-tabs-'));
  const modulePath = path.join(output, 'primitives.mjs');
  class FakeElement {
    constructor(tagName) { this.tagName = tagName; this.children = []; this.attributes = new Map(); this.dataset = {}; this.className = ''; this.id = ''; }
    append(...children) { this.children.push(...children); }
    addEventListener() {}
    setAttribute(name, value) { this.attributes.set(name, value); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    querySelectorAll(selector) { return this.children.flatMap(child => [child, ...child.querySelectorAll(selector)]).filter(child => selector === '.ui-tab' && child.className === 'ui-tab'); }
  }
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: tagName => new FakeElement(tagName) };
  try {
    await build({ entryPoints: [path.join(appRoot, 'client', 'ui', 'primitives.ts')], bundle: true, format: 'esm', platform: 'browser', outfile: modulePath });
    const { createUiTabs } = await import(`${pathToFileURL(modulePath).href}?instance-proof`);
    const first = createUiTabs(['조작', '화면'], 0);
    const second = createUiTabs(['소리', '접근성'], 0);
    const firstTabs = first.querySelectorAll('.ui-tab');
    const secondTabs = second.querySelectorAll('.ui-tab');
    const allIds = [...firstTabs, ...secondTabs].map(tab => tab.id);
    assert.equal(new Set(allIds).size, allIds.length);
    for (const tab of firstTabs) assert.equal(tab.getAttribute('aria-controls')?.replace('-panel-', '-tab-'), tab.id);
    for (const tab of secondTabs) assert.equal(tab.getAttribute('aria-controls')?.replace('-panel-', '-tab-'), tab.id);
    assert.notEqual(firstTabs[0].id.split('-tab-')[0], secondTabs[0].id.split('-tab-')[0]);
  } finally {
    globalThis.document = previousDocument;
    await rm(output, { recursive: true, force: true });
  }
});

test('declares Korean as the shipped document language', async () => {
  assert.match(await readFile(publicIndex, 'utf8'), /<html lang="ko">/);
});
