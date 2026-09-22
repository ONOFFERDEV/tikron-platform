import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const CONTRACT_FILES = [
  'client/main.ts',
  'client/audio.ts',
  'client/audio-mix.ts',
  'client/settings.ts',
  'client/scene.ts',
  'client/net.ts',
];
const RUNNER_TOOL_FILES = [
  'scripts/aside-qa.mjs',
  'scripts/aside-repl.mjs',
  'scripts/aside-pointer-lock.mjs',
  'scripts/aside-source.mjs',
  'scripts/aside-scenarios/manifest.json',
  'scripts/aside-scenarios/ui-journeys.mjs',
  'scripts/render-budget-policy.mjs',
  'scripts/render-budget-collector.mjs',
  'scripts/hitch-gpu-diagnostics.mjs',
  'scripts/aside-scenarios/performance.mjs',
  'scripts/aside-scenarios/audio.mjs',
  'scripts/audio-pcm-worklet.mjs',
  'scripts/wav-encode.mjs',
];
const SERVED_CONTENT_PATHS = [
  'client',
  'config',
  'src',
  'public',
  'package.json',
  'wrangler.next.jsonc',
  'tsconfig.json',
  'tsconfig.client.json',
];

function runGit(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

async function fileRecord(root, relative, required = false) {
  const filePath = path.join(root, relative);
  try {
    const data = await readFile(filePath);
    return { path: relative.replaceAll('\\', '/'), bytes: data.byteLength, sha256: createHash('sha256').update(data).digest('hex') };
  } catch (error) {
    if (required) throw new Error(`served source is missing ${relative}: ${error.message}`);
    return null;
  }
}

async function hashTree(directory) {
  const hash = createHash('sha256');
  const walk = async current => {
    let entries;
    try { entries = await readdir(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(current, entry.name);
      const relative = path.relative(directory, full).replaceAll('\\', '/');
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) hash.update(relative).update('\0').update(await readFile(full));
    }
  };
  await walk(directory);
  return hash.digest('hex');
}

async function hashServedContent(root) {
  const hash = createHash('sha256');
  const add = async full => {
    let entry;
    try { entry = await stat(full); } catch { return; }
    if (entry.isDirectory()) {
      const children = await readdir(full, { withFileTypes: true });
      for (const child of children.sort((a, b) => a.name.localeCompare(b.name))) {
        if (child.isSymbolicLink()) continue;
        await add(path.join(full, child.name));
      }
      return;
    }
    if (!entry.isFile()) return;
    const relative = path.relative(root, full).replaceAll('\\', '/');
    hash.update(relative).update('\0').update(await readFile(full));
  };
  for (const relative of SERVED_CONTENT_PATHS) await add(path.join(root, relative));
  return hash.digest('hex');
}

export async function sourceIdentity(options = {}) {
  const runnerAppRoot = path.resolve(options.runnerAppRoot);
  const runnerRepoRoot = options.runnerRepoRoot
    ? path.resolve(options.runnerRepoRoot)
    : path.resolve(runnerAppRoot, '..', '..');
  const explicit = options.servedSourceRoot !== undefined;
  const servedSourceRoot = path.resolve(options.servedSourceRoot ?? runnerAppRoot);
  const bundle = await fileRecord(servedSourceRoot, 'public/client.js', explicit);
  const sourceFiles = {};
  for (const relative of CONTRACT_FILES) {
    const record = await fileRecord(servedSourceRoot, relative);
    if (record) sourceFiles[relative] = record;
  }
  const diff = runGit(['diff', '--binary', 'HEAD', '--', 'apps/ironsight'], runnerRepoRoot) ?? '';
  const status = runGit(['status', '--porcelain=v1', '--', 'apps/ironsight'], runnerRepoRoot) ?? '';
  const runnerFiles = {};
  for (const relative of RUNNER_TOOL_FILES) {
    const record = await fileRecord(runnerAppRoot, relative);
    if (record) runnerFiles[relative] = record;
  }
  const runner = {
    root: runnerAppRoot,
    head: runGit(['rev-parse', 'HEAD'], runnerRepoRoot),
    dirtyDiffHash: createHash('sha256').update(diff).update('\0').update(status).digest('hex'),
    files: runnerFiles,
  };
  const served = {
    root: servedSourceRoot,
    explicit,
    bundle,
    sourceFiles,
    sourceTreeHash: await hashServedContent(servedSourceRoot),
    assetManifestHash: await hashTree(path.join(servedSourceRoot, 'public', 'assets')),
  };
  return {
    head: runner.head,
    dirtyDiffHash: runner.dirtyDiffHash,
    assetManifestHash: served.assetManifestHash,
    bundleHash: bundle?.sha256 ?? null,
    runnerSource: runner,
    servedSource: served,
  };
}
