import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const args = process.argv.slice(2);
const option = (name, fallback) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : fallback; };
const flag = name => args.includes(name);
const isRecord = value => typeof value === 'object' && value !== null && !Array.isArray(value);

class BatchError extends Error {
  constructor(code, detail) { super(`${code}${detail ? `: ${detail}` : ''}`); this.name = 'BatchError'; }
}

function parseConfig(value) {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.limits) || !isRecord(value.pricing) || !isRecord(value.model) || !Array.isArray(value.assets)) throw new BatchError('invalid_config');
  if (value.limits.totalCredits !== 600 || value.limits.batchCredits !== 150 || value.limits.minimumBalance !== 300) throw new BatchError('invalid_budget_limits');
  if (value.pricing.previewCredits !== 20 || value.pricing.refine2kCredits !== 10 || value.pricing.rigCredits !== 5) throw new BatchError('invalid_pricing');
  if (value.model.aiModel !== 'meshy-7' || value.model.ultra !== false || value.model.sourceTextureResolution !== '2k') throw new BatchError('unapproved_model_options');
  return value;
}

function selectedAssets(config) {
  const only = option('--only')?.split(',').filter(Boolean);
  if (!only) return config.assets;
  const unknown = only.filter(key => !config.assets.some(asset => isRecord(asset) && asset.assetKey === key));
  if (unknown.length) throw new BatchError('unknown_asset', unknown.join(','));
  return only.map(key => config.assets.find(asset => isRecord(asset) && asset.assetKey === key));
}

function stageCredits(config, stage, count) {
  if (stage === 'preview') return config.pricing.previewCredits * count;
  if (stage === 'refine') return config.pricing.refine2kCredits * count;
  return 0;
}

function commandArguments(configPath, out, assetKey, stage) {
  const child = ['tools/meshy-generate.mjs', '--config', configPath, '--asset', assetKey, '--stage', stage, '--out', out];
  for (const name of ['--api-base', '--timeout-ms', '--decision', '--reason', '--evidence', '--operation', '--task-id', '--artifact', '--exporter-version']) {
    const value = option(name); if (value) child.push(name, value);
  }
  return child;
}

async function main() {
  const configPath = resolve(option('--config', 'config/ww1-meshy.json'));
  const config = parseConfig(JSON.parse(await readFile(configPath, 'utf8')));
  const assets = selectedAssets(config);
  const generationCredits = config.assets.length * (config.pricing.previewCredits + config.pricing.refine2kCredits);
  const rigCredits = config.assets.filter(asset => asset.optionalRig === true).length * config.pricing.rigCredits;
  const report = {
    schemaVersion: 1, assets: assets.map(asset => ({ assetKey: asset.assetKey, role: asset.role })),
    planCredits: generationCredits + rigCredits, pilotCredits: config.pilot.length * (config.pricing.previewCredits + config.pricing.refine2kCredits),
    totalCreditLimit: config.limits.totalCredits, batchCreditLimit: config.limits.batchCredits, minimumBalance: config.limits.minimumBalance,
    model: config.model, sourceKinds: { generated: assets.map(asset => asset.assetKey) },
  };
  if (flag('--dry-run')) {
    const output = `${JSON.stringify(report, null, 2)}\n`; const out = option('--out');
    if (out?.toLowerCase().endsWith('.json')) { const path = resolve(out); await mkdir(dirname(path), { recursive: true }); await writeFile(path, output); }
    console.log(output.trim()); return;
  }
  const stage = option('--stage');
  if (!stage) throw new BatchError('missing_argument', '--stage');
  if (!option('--only')) throw new BatchError('paid_or_mutating_stage_requires_only');
  const batchCredits = stageCredits(config, stage, assets.length);
  if (batchCredits > config.limits.batchCredits) throw new BatchError('batch_budget_exceeded', String(batchCredits));
  const out = resolve(option('--out', 'artifacts/ww1'));
  const results = [];
  for (const asset of assets) {
    const result = await execute(process.execPath, commandArguments(configPath, out, asset.assetKey, stage), { cwd: process.cwd(), env: process.env, windowsHide: true });
    const lines = result.stdout.trim().split(/\r?\n/); results.push(JSON.parse(lines.at(-1)));
  }
  console.log(JSON.stringify({ stage, batchCredits, results }));
}

main().catch(error => { console.error(error instanceof BatchError || error instanceof Error ? error.message : 'unexpected_batch_error'); process.exitCode = 1; });
