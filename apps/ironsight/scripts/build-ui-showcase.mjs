#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const scriptPath = fileURLToPath(import.meta.url);
const appRoot = path.dirname(path.dirname(scriptPath));
const publicRoot = path.join(appRoot, 'public');
const sources = [
  'client/ui/tokens.ts',
  'client/ui/primitives.ts',
  'client/ui/showcase.ts',
];

export class ShowcaseBuildError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ShowcaseBuildError';
  }
}

function isInside(base, candidate) {
  const relative = path.relative(base, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function parseArgs(argv) {
  if (argv.length !== 2 || argv[0] !== '--outdir' || !argv[1]) {
    throw new ShowcaseBuildError('usage: node scripts/build-ui-showcase.mjs --outdir <directory>');
  }
  return path.resolve(appRoot, argv[1]);
}

async function hashFiles(files) {
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file).update('\0').update(await readFile(path.join(appRoot, file)));
  }
  return hash.digest('hex');
}

export async function buildUiShowcase(outputDir) {
  const resolvedOutput = path.resolve(outputDir);
  if (isInside(publicRoot, resolvedOutput)) {
    throw new ShowcaseBuildError('showcase output must stay outside public/ so it cannot be deployed');
  }
  await mkdir(resolvedOutput, { recursive: true });
  const outfile = path.join(resolvedOutput, 'showcase.js');
  await build({
    bundle: true,
    format: 'iife',
    legalComments: 'none',
    minify: false,
    outfile,
    platform: 'browser',
    sourcemap: true,
    stdin: {
      contents: `import { mountUiShowcase } from './client/ui/showcase.ts';\nmountUiShowcase(document.body);`,
      loader: 'ts',
      resolveDir: appRoot,
      sourcefile: 'ui-showcase-entry.ts',
    },
    target: ['es2022'],
  });

  const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>IRONSIGHT UI primitive showcase</title>
  </head>
  <body><script src="./showcase.js"></script></body>
</html>
`;
  await writeFile(path.join(resolvedOutput, 'index.html'), html, 'utf8');

  const bundle = await readFile(outfile);
  const manifest = {
    schemaVersion: 1,
    surface: 'ui-primitives',
    delivery: 'loopback-only',
    sources,
    sourceHash: await hashFiles(sources),
    bundleHash: createHash('sha256').update(bundle).digest('hex'),
  };
  await writeFile(path.join(resolvedOutput, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

async function main() { // no-excuse-ok: catch
  try {
    const outputDir = parseArgs(process.argv.slice(2));
    const manifest = await buildUiShowcase(outputDir);
    console.log(JSON.stringify({ outputDir, ...manifest }));
    return 0;
  } catch (error) {
    if (error instanceof Error) console.error(error.message);
    else console.error('showcase build failed with a non-Error value');
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  process.exitCode = await main();
}
