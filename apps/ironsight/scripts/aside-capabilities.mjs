#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { EXIT, VERDICT } from './aside-common.mjs';
import { discoverAsideExecutable } from './aside-repl.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..', '..');

export const TARGET_DEVICE_REQUIRED_FIELDS = Object.freeze([
  'device.manufacturer', 'device.model', 'device.cpu', 'device.displayAdapters', 'device.ramBytes',
  'device.os', 'device.acPower', 'device.performanceMode', 'browser.asideVersion', 'browser.browserVersion',
  'browser.activeWebglAdapter', 'render.cssViewport', 'render.drawingBuffer', 'render.renderScale',
  'source.head', 'source.dirtyDiffHash', 'source.assetManifestHash',
]);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true, ...options });
  return { status: result.status, stdout: result.stdout?.trim() ?? '', stderr: result.stderr?.trim() ?? '', error: result.error?.message ?? null };
}

function git(args) {
  return run('git', args, { cwd: repoRoot });
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function hashTree(directory) {
  const digest = createHash('sha256');
  const walk = async current => {
    let entries;
    try { entries = await readdir(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) digest.update(path.relative(directory, full).replaceAll('\\', '/')).update('\0').update(await readFile(full));
    }
  };
  await walk(directory);
  return digest.digest('hex');
}

function windowsDevice() {
  const command = [
    "$cs=Get-CimInstance Win32_ComputerSystem;$cpu=Get-CimInstance Win32_Processor;$gpu=Get-CimInstance Win32_VideoController;$os=Get-CimInstance Win32_OperatingSystem;$bat=Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue;$scheme=(powercfg /getactivescheme | Out-String);$schemeGuid=([regex]::Match($scheme,'[0-9a-fA-F-]{36}')).Value;",
    "[pscustomobject]@{manufacturer=$cs.Manufacturer;model=$cs.Model;cpu=@($cpu.Name);displayAdapters=@($gpu|ForEach-Object{[pscustomobject]@{name=$_.Name;driver=$_.DriverVersion;ramBytes=[uint64]$_.AdapterRAM}});ramBytes=[uint64]$cs.TotalPhysicalMemory;os=\"$($os.Caption) $($os.Version)\";acPower=if($bat){-not (@($bat.BatteryStatus)|Where-Object{$_ -in 1,4,5})}else{$true};performanceMode=$schemeGuid}|ConvertTo-Json -Depth 5 -Compress",
  ].join('');
  const result = run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command]);
  if (result.status !== 0) return { error: result.stderr || result.error || 'device discovery failed' };
  return JSON.parse(result.stdout);
}

function localDevice() {
  if (process.platform === 'win32') return windowsDevice();
  return {
    manufacturer: null,
    model: null,
    cpu: os.cpus().map(item => item.model),
    displayAdapters: [],
    ramBytes: os.totalmem(),
    os: `${os.type()} ${os.release()}`,
    acPower: null,
    performanceMode: null,
  };
}

function parseArgs(argv) {
  const options = { qualificationPreflight: false };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (name === '--qualification-preflight') { options.qualificationPreflight = true; continue; }
    if (name === '--help') return { help: true };
    if (!['--output', '--target-manifest'].includes(name)) throw new Error(`unknown argument: ${name}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${name}`);
    options[name === '--output' ? 'output' : 'targetManifest'] = value;
    index += 1;
  }
  if (!options.qualificationPreflight) throw new Error('--qualification-preflight is required');
  if (!options.output) throw new Error('--output is required');
  return options;
}

function getPath(object, dotted) {
  return dotted.split('.').reduce((value, key) => value?.[key], object);
}

export async function qualificationPreflight(options) {
  const executable = await discoverAsideExecutable();
  const version = run(executable, ['--version']);
  const hostStatus = run(executable, ['host', 'status']);
  const hosts = run(executable, ['host', 'list']);
  const head = git(['rev-parse', 'HEAD']).stdout || null;
  const diff = git(['diff', '--binary', 'HEAD', '--', 'apps/ironsight']).stdout;
  const status = git(['status', '--porcelain=v1', '--', 'apps/ironsight']).stdout;
  let supplied = null;
  if (options.targetManifest) supplied = JSON.parse(await readFile(path.resolve(options.targetManifest), 'utf8'));
  const observed = supplied ?? {
    schemaVersion: 1,
    availability: 'UNQUALIFIED',
    device: localDevice(),
    browser: {
      asideVersion: version.status === 0 ? version.stdout : null,
      browserVersion: null,
      asideHostStatus: hostStatus.status === 0 ? hostStatus.stdout : null,
      remoteHosts: hosts.status === 0 ? hosts.stdout.split(/\r?\n/).filter(Boolean) : [],
      remoteHostError: hosts.status === 0 ? null : hosts.stderr || hosts.stdout || hosts.error,
      activeWebglAdapter: null,
    },
    render: { cssViewport: null, drawingBuffer: null, renderScale: null },
    source: {
      head,
      dirtyDiffHash: hash(`${diff}\0${status}`),
      assetManifestHash: await hashTree(path.join(repoRoot, 'apps', 'ironsight', 'public', 'assets')),
    },
  };
  const reasons = [];
  for (const field of TARGET_DEVICE_REQUIRED_FIELDS) {
    const value = getPath(observed, field);
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      reasons.push({ code: 'required_field_missing', field });
    }
  }
  const model = observed.device?.model?.toLowerCase?.() ?? '';
  if (!/(laptop|notebook|book|gram|thinkpad|latitude|elitebook|vivobook|zenbook|legion|omen)/.test(model)) {
    reasons.push({ code: 'target_laptop_not_identified', observed: observed.device?.model ?? null });
  }
  const activeAdapter = observed.browser?.activeWebglAdapter?.toLowerCase?.() ?? '';
  if (!activeAdapter || /(nvidia|swiftshader)/.test(activeAdapter)) {
    reasons.push({ code: 'target_igpu_not_active', observed: observed.browser?.activeWebglAdapter ?? null });
  }
  if (!options.targetManifest) reasons.push({ code: 'target_device_manifest_not_provided' });
  const verdict = reasons.length === 0 ? VERDICT.PASS : VERDICT.UNQUALIFIED;
  return {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    availability: verdict === VERDICT.PASS ? 'QUALIFIED' : 'UNQUALIFIED',
    verdict,
    exitCode: verdict === VERDICT.PASS ? EXIT.PASS : EXIT.UNQUALIFIED,
    requiredFields: TARGET_DEVICE_REQUIRED_FIELDS,
    observed,
    reasons,
  };
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log('Usage: node apps/ironsight/scripts/aside-capabilities.mjs --qualification-preflight --output <qualification.json> [--target-manifest <target-device.json>]');
      return EXIT.PASS;
    }
    const report = await qualificationPreflight(options);
    const output = path.resolve(repoRoot, options.output);
    const relative = path.relative(repoRoot, output);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('output must stay inside the repository');
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({ availability: report.availability, output: options.output, reasons: report.reasons.map(item => item.code) }));
    return report.exitCode;
  } catch (error) {
    console.error(error.message);
    return EXIT.FAIL;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) process.exitCode = await main();
