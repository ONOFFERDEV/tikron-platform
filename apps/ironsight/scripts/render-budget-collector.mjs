import { readFile } from 'node:fs/promises';

import { VERDICT } from './aside-common.mjs';
import { evaluateRenderBudget } from './render-budget-policy.mjs';

const MAPS = ['arena1', 'arena2', 'arena3'];
const CYCLES = [1, 2, 3];
const unavailable = (definition, code, detail = null, observations = null) => ({
  cases: definition.cases.map(id => ({
    id, verdict: VERDICT.UNQUALIFIED, reasons: [{ code, detail }], observations, artifacts: [],
  })),
  inputProvenance: 'none',
  observations,
});

export function classifyRenderCollection(definition, evidence) {
  if (!evidence) return unavailable(definition, 'render_evidence_unavailable');
  try {
    return {
      ...evaluateRenderBudget(definition, evidence),
      inputProvenance: 'Aside production renderer with injected WebGL submission diagnostics',
    };
  } catch (error) {
    return unavailable(definition, 'invalid_render_evidence', error.message, { evidence });
  }
}

function mapUrl(base, map) {
  const url = new URL(base);
  url.searchParams.set('inspect', 'map');
  url.searchParams.set('map', map);
  url.searchParams.set('shot', 'muzzle-effects-stress');
  return url.href;
}

async function diagnosticsSource() {
  const source = await readFile(new URL('./hitch-gpu-diagnostics.mjs', import.meta.url), 'utf8');
  return `window.__THREE_DEVTOOLS__=new EventTarget();window.__THREE_DEVTOOLS__.addEventListener('observe',event=>{if(event.detail?.isWebGLRenderer)window.__renderer=event.detail});${source.replace('export function installGpuDiagnostics()', 'function installGpuDiagnostics()')}\ninstallGpuDiagnostics();`;
}

export async function runPerfRender(context, runtime) {
  const { definition, repl, source, url, viewport, writeArtifact, recordCleanup } = context;
  const observations = { requestedViewport: viewport, maps: [], source: source ?? null };
  let opened = false;
  try {
    await runtime.replJson(repl, `await openTab('about:blank');return {url:page.url()};`);
    opened = true;
    observations.fetchRecovery = await runtime.recoverStaleFetchInterception(repl);
    const diagnostic = await diagnosticsSource();
    observations.preflight = await runtime.replJson(repl, `
      const requested=${JSON.stringify(viewport)};
      const metrics=await page.cdp.send('Emulation.setDeviceMetricsOverride',{width:requested[0],height:requested[1],deviceScaleFactor:1,mobile:false});
      await page.cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:${JSON.stringify(diagnostic)}});
      return {metrics,cdp:true};
    `, { timeoutMs: 30_000 });
    for (const map of MAPS) {
      const entry = { map, cycles: [] };
      observations.maps.push(entry);
      for (const cycle of CYCLES) {
        const target = mapUrl(url, map);
        const captured = await runtime.replJson(repl, `
          await page.goto(${JSON.stringify(target)});
          await page.waitForFunction(()=>window.__inspectReady===true,{timeout:150000});
          const viewport={requested:${JSON.stringify(viewport)},css:[innerWidth,innerHeight],drawingBuffer:[window.__renderer?.domElement?.width??0,window.__renderer?.domElement?.height??0],dpr:devicePixelRatio};
          const hook=window.__ironsightRenderBudget;
          if(!hook||typeof hook.runCycle!=='function')return {available:false,viewport,reason:'render_budget_hook_missing'};
          window.__hitchGpu?.start?.();
          const cycleEvidence=await hook.runCycle({map:${JSON.stringify(map)},cycle:${cycle}});
          return {available:true,viewport,cycleEvidence,gpu:window.__hitchGpu?.report?.()??null};
        `, { timeoutMs: 180_000 });
        entry.cycles.push({ index: cycle, ...captured });
        if (!captured.available) {
          observations.missingHook = { map, cycle, reason: captured.reason };
          const artifact = await writeArtifact('render-budget-raw.json', observations);
          const result = unavailable(definition, 'render_budget_hook_unavailable', captured.reason, observations);
          result.cases.forEach(item => item.artifacts.push(artifact));
          return result;
        }
      }
    }
    const evidence = assembleEvidence(source, observations);
    const artifact = await writeArtifact('render-budget-raw.json', { observations, evidence });
    const result = classifyRenderCollection(definition, evidence);
    result.cases.forEach(item => item.artifacts.push(artifact));
    result.observations = observations;
    return result;
  } catch (error) {
    observations.error = { name: error.name, message: error.message };
    const artifact = await writeArtifact('render-budget-raw.json', observations);
    const result = unavailable(definition, 'render_collection_failed', error.message, observations);
    result.cases.forEach(item => item.artifacts.push(artifact));
    return result;
  } finally {
    if (opened) {
      const cleanup = await runtime.closeOwnedTab(repl).catch(error => ({ error: error.message }));
      recordCleanup({ resource: 'perf-render-tab', ...cleanup });
    }
  }
}

function assembleEvidence(source, observations) {
  const first = observations.maps[0].cycles[0];
  return {
    schemaVersion: 1,
    source: {
      sourceSha256: source?.servedSource?.sourceTreeHash,
      bundleSha256: source?.bundleHash,
      manifestSha256: source?.assetManifestHash,
    },
    viewport: first.viewport,
    clockQuality: first.cycleEvidence.clockQuality,
    staticAssets: first.cycleEvidence.staticAssets,
    maps: observations.maps.map(entry => ({
      map: entry.map,
      cycles: entry.cycles.map(item => ({ index: item.index, ...item.cycleEvidence, gpu: item.gpu })),
    })),
  };
}
