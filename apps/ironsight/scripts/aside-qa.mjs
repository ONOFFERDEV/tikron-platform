#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { access, copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  EXIT,
  INPUT_STAGES,
  VERDICT,
  buildReport,
  loadScenarioManifest,
  parseViewport,
  resolveScenarioPlan,
  validateScenarioResult,
  validateStages,
  writeReport,
} from './aside-common.mjs';
import { PersistentAsideRepl, discoverAsideExecutable } from './aside-repl.mjs';
import { sourceIdentity } from './aside-source.mjs';
export { sourceIdentity } from './aside-source.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.dirname(scriptDir);
const repoRoot = path.resolve(appRoot, '..', '..');
const manifestPath = path.join(scriptDir, 'aside-scenarios', 'manifest.json');

function usage() {
  return 'Usage: node apps/ironsight/scripts/aside-qa.mjs --url <url> --scenario <name> --output <dir> --viewport <WIDTHxHEIGHT> [--served-source-root <path>]\n       node apps/ironsight/scripts/aside-qa.mjs --audit-handlers --output <report.json>';
}

export function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (name === '--help') return { help: true };
    if (name === '--audit-handlers') { options.auditHandlers = true; continue; }
    if (!['--url', '--scenario', '--output', '--viewport', '--served-source-root'].includes(name)) throw new Error(`unknown argument: ${name}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${name}`);
    const key = name === '--served-source-root' ? 'servedSourceRoot' : name.slice(2);
    options[key] = value;
    index += 1;
  }
  if (options.auditHandlers) {
    if (!options.output) throw new Error('missing --output');
    return options;
  }
  for (const name of ['url', 'scenario', 'output', 'viewport']) if (!options[name]) throw new Error(`missing --${name}`);
  const url = new URL(options.url);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('url must use http or https');
  return { ...options, url: url.href, viewport: parseViewport(options.viewport), servedSourceRoot: options.servedSourceRoot };
}

async function asideVersion(executable) {
  const result = spawnSync(executable, ['--version'], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

function within(base, candidate) {
  const relative = path.relative(base, candidate);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function missingImplementation(definition, detail) {
  return {
    cases: definition.cases.map(id => ({
      id,
      verdict: VERDICT.UNQUALIFIED,
      reasons: [{ code: 'scenario_not_implemented', detail }],
      observations: null,
      artifacts: [],
    })),
    inputProvenance: 'none',
  };
}

async function loadHandler(definition) {
  const modulePath = path.resolve(repoRoot, definition.module);
  if (!within(repoRoot, modulePath)) throw new Error(`scenario module escapes repository: ${definition.module}`);
  try {
    await access(modulePath);
  } catch { return null; }
  const loaded = await import(`${pathToFileURL(modulePath).href}?qa=${Date.now()}`);
  return loaded.scenarioHandlers?.[definition.id] ?? null;
}

export async function auditScenarioHandlers(manifest, loader = loadHandler) {
  const missing = [];
  for (const definition of manifest.scenarios) {
    try {
      const handler = await loader(definition);
      if (typeof handler !== 'function') missing.push({ id: definition.id, module: definition.module, code: 'handler_missing' });
    } catch (error) {
      missing.push({ id: definition.id, module: definition.module, code: 'module_load_failed', detail: error instanceof Error ? `${error.name}:${error.message}` : String(error) });
    }
  }
  return {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    total: manifest.scenarios.length,
    implemented: manifest.scenarios.length - missing.length,
    missing,
    verdict: missing.length === 0 ? VERDICT.PASS : VERDICT.FAIL,
    exitCode: missing.length === 0 ? EXIT.PASS : EXIT.FAIL,
  };
}

async function runHandlerAudit(output) {
  const outputPath = path.resolve(repoRoot, output);
  if (!within(repoRoot, outputPath)) throw new Error('output must stay inside the repository');
  const report = await auditScenarioHandlers(await loadScenarioManifest(manifestPath));
  await writeReport(outputPath, report);
  return report;
}

export async function run(options) {
  const outputDir = path.resolve(repoRoot, options.output);
  if (!within(repoRoot, outputDir)) throw new Error('output must stay inside the repository');
  await mkdir(outputDir, { recursive: true });
  const startedAt = new Date().toISOString();
  const manifest = await loadScenarioManifest(manifestPath);
  const plan = resolveScenarioPlan(manifest, options.scenario);
  const source = await sourceIdentity({
    runnerAppRoot: appRoot,
    runnerRepoRoot: repoRoot,
    servedSourceRoot: options.servedSourceRoot ? path.resolve(repoRoot, options.servedSourceRoot) : undefined,
  });
  const executable = await discoverAsideExecutable();
  const browser = { asideExecutable: executable, asideVersion: await asideVersion(executable), sessionDir: null };
  const cleanup = [];
  const scenarioResults = [];
  const replSessions = [];
  let repl = null;

  const getRepl = async () => {
    if (repl?.isUsable()) return repl;
    if (repl) {
      const previousSessionDir = repl.sessionDir;
      const reason = repl.poisonError?.message ?? 'Aside REPL session ended';
      await repl.close();
      cleanup.push({ scenario: 'runner', action: 'repl-session-reset', previousSessionDir, reason });
    }
    repl = new PersistentAsideRepl({ executable });
    const startup = await repl.start();
    replSessions.push(repl);
    browser.sessionDir ??= startup.sessionDir;
    return repl;
  };

  try {
    for (const definition of plan) {
      const handler = await loadHandler(definition);
      let result;
      if (!handler) {
        result = missingImplementation(definition, definition.module);
      } else {
        try {
          const activeRepl = await getRepl();
          const copySessionArtifact = async (sessionName, destinationName) => {
            const sessionBase = path.resolve(activeRepl.sessionDir, 'artifacts');
            const sourcePath = path.resolve(sessionBase, sessionName);
            const destinationPath = path.resolve(outputDir, destinationName);
            if (!within(sessionBase, sourcePath) || !within(outputDir, destinationPath)) throw new Error('artifact path escaped its owner directory');
            await mkdir(path.dirname(destinationPath), { recursive: true });
            await copyFile(sourcePath, destinationPath);
            return { path: path.relative(repoRoot, destinationPath).replaceAll('\\', '/'), bytes: (await stat(destinationPath)).size };
          };
          const writeArtifact = async (destinationName, value) => {
            const destinationPath = path.resolve(outputDir, destinationName);
            if (!within(outputDir, destinationPath)) throw new Error('artifact path escaped its owner directory');
            await mkdir(path.dirname(destinationPath), { recursive: true });
            const content = typeof value === 'string' || value instanceof Uint8Array ? value : `${JSON.stringify(value, null, 2)}\n`;
            await writeFile(destinationPath, content);
            return { path: path.relative(repoRoot, destinationPath).replaceAll('\\', '/'), bytes: (await stat(destinationPath)).size };
          };
          result = await handler({
            definition,
            source,
            url: options.url,
            viewport: options.viewport,
            outputDir,
            repl: activeRepl,
            sessionDir: activeRepl.sessionDir,
            inputStages: INPUT_STAGES,
            validateStages,
            copySessionArtifact,
            writeArtifact,
            completedScenarios: scenarioResults.map(({ definition: completedDefinition, result: completedResult }) => ({
              id: completedDefinition.id,
              cases: completedResult.cases,
              inputProvenance: completedResult.inputProvenance,
            })),
            recordCleanup: receipt => cleanup.push({ scenario: definition.id, ...receipt }),
          });
          validateScenarioResult(definition, result);
        } catch (error) {
          result = {
            cases: definition.cases.map(id => ({ id, verdict: VERDICT.FAIL, reasons: [{ code: 'scenario_execution_error', detail: error.message }], observations: null, artifacts: [] })),
            inputProvenance: 'none',
            error: { name: error.name, message: error.message, stack: error.stack },
          };
        }
      }
      scenarioResults.push({ definition, result });
      const tracePath = path.join(outputDir, 'traces', `${definition.id}.json`);
      await mkdir(path.dirname(tracePath), { recursive: true });
      await writeFile(tracePath, `${JSON.stringify(result.observations ?? { error: result.error ?? null }, null, 2)}\n`, 'utf8');
    }
  } finally {
    await repl?.close();
  }

  const cases = scenarioResults.flatMap(({ definition, result }) => result.cases.map(item => ({ ...item, id: `${definition.id}/${item.id}` })));
  const report = buildReport({
    scenario: options.scenario,
    startedAt,
    source,
    browser,
    inputProvenance: scenarioResults.map(item => item.result.inputProvenance).filter(value => value && value !== 'none').join('; ') || 'none',
    cases,
  });
  report.request = { url: options.url, viewport: options.viewport, resolvedScenarios: plan.map(item => item.id) };
  report.cleanup = cleanup;
  await writeReport(path.join(outputDir, 'report.json'), report);
  await writeFile(path.join(outputDir, 'commands.txt'), `${process.execPath} ${process.argv.slice(1).join(' ')}\n`, 'utf8');
  await writeFile(path.join(outputDir, 'console.json'), `${JSON.stringify(replSessions.flatMap(session => session.transcript), null, 2)}\n`, 'utf8');
  return report;
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
    if (options.help) { console.log(usage()); return EXIT.PASS; }
    if (options.auditHandlers) {
      const report = await runHandlerAudit(options.output);
      console.log(JSON.stringify({ verdict: report.verdict, implemented: report.implemented, total: report.total, missing: report.missing, report: options.output }));
      return report.exitCode;
    }
    const report = await run(options);
    console.log(JSON.stringify({ scenario: report.scenario, verdict: report.verdict, report: path.join(options.output, 'report.json') }));
    return report.exitCode;
  } catch (error) {
    console.error(error.message);
    console.error(usage());
    return EXIT.FAIL;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
