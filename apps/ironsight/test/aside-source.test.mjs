import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { parseArgs, sourceIdentity } from '../scripts/aside-qa.mjs';

test('served snapshot provenance cannot silently use the runner working-tree bundle', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'aside-source-'));
  const runnerAppRoot = path.join(directory, 'runner', 'apps', 'ironsight');
  const servedSourceRoot = path.join(directory, 'served');
  try {
    await mkdir(path.join(runnerAppRoot, 'public', 'assets'), { recursive: true });
    await mkdir(path.join(servedSourceRoot, 'public', 'assets'), { recursive: true });
    await mkdir(path.join(servedSourceRoot, 'client'), { recursive: true });
    await writeFile(path.join(runnerAppRoot, 'public', 'client.js'), 'runner-bundle');
    await writeFile(path.join(servedSourceRoot, 'public', 'client.js'), 'served-bundle');
    await writeFile(path.join(servedSourceRoot, 'client', 'main.ts'), 'served-source');

    const source = await sourceIdentity({ runnerAppRoot, servedSourceRoot });
    const expected = createHash('sha256').update('served-bundle').digest('hex');
    const wrong = createHash('sha256').update('runner-bundle').digest('hex');

    assert.equal(source.bundleHash, expected);
    assert.notEqual(source.bundleHash, wrong);
    assert.equal(source.servedSource.explicit, true);
    assert.equal(source.servedSource.root, path.resolve(servedSourceRoot));
    assert.equal(source.servedSource.sourceFiles['client/main.ts'].sha256, createHash('sha256').update('served-source').digest('hex'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('CLI accepts an explicit served snapshot root', () => {
  const parsed = parseArgs([
    '--url', 'http://127.0.0.1:8896',
    '--scenario', 'perf-input',
    '--output', '.omo/evidence/ww1/task-06/provenance-fixture',
    '--viewport', '1920x1080',
    '--served-source-root', 'D:/snapshot/ironsight',
  ]);
  assert.equal(parsed.servedSourceRoot, 'D:/snapshot/ironsight');
});

test('served content identity ignores Wrangler runtime state but changes with source', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'aside-content-'));
  const runnerAppRoot = path.join(directory, 'runner', 'apps', 'ironsight');
  const servedSourceRoot = path.join(directory, 'served');
  try {
    await mkdir(path.join(runnerAppRoot, 'public'), { recursive: true });
    await mkdir(path.join(servedSourceRoot, 'client'), { recursive: true });
    await mkdir(path.join(servedSourceRoot, 'public', 'assets'), { recursive: true });
    await mkdir(path.join(servedSourceRoot, '.wrangler', 'state'), { recursive: true });
    await writeFile(path.join(servedSourceRoot, 'public', 'client.js'), 'bundle');
    await writeFile(path.join(servedSourceRoot, 'public', 'assets', 'sound.bin'), 'asset');
    await writeFile(path.join(servedSourceRoot, 'client', 'main.ts'), 'source-a');
    await writeFile(path.join(servedSourceRoot, 'wrangler.next.jsonc'), '{}');

    const before = await sourceIdentity({ runnerAppRoot, servedSourceRoot });
    await writeFile(path.join(servedSourceRoot, '.wrangler', 'state', 'runtime.bin'), 'mutable-runtime');
    const runtimeChanged = await sourceIdentity({ runnerAppRoot, servedSourceRoot });
    assert.equal(runtimeChanged.servedSource.sourceTreeHash, before.servedSource.sourceTreeHash);

    await writeFile(path.join(servedSourceRoot, 'client', 'main.ts'), 'source-b');
    const sourceChanged = await sourceIdentity({ runnerAppRoot, servedSourceRoot });
    assert.notEqual(sourceChanged.servedSource.sourceTreeHash, before.servedSource.sourceTreeHash);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
