import { describe, expect, it } from 'vitest';
import {
  classifyAssetFailure,
  classifyLayerRoute,
  classifyLowContrast,
  classifyMapArt,
  classifyMapPlay,
  classifyRespawnCrossfire,
  confirmFailureInjection,
  runProgressPhase,
  scenarioHandlers,
} from '../scripts/aside-scenarios/maps.mjs';
import { validateScenarioResult } from '../scripts/aside-common.mjs';

const artifacts = [{ path: 'screenshots/proof.png', bytes: 100 }];
const definitions = {
  art: { cases: ['three maps', 'render vs collision', 'slope shot pairs', 'missing asset fallback', 'bake and texture lifetime'] },
  play: { cases: ['all maps both teams and ffa', 'two10min route observations each side', 'spawn/interior/roof/lower/objective'] },
  asset: { cases: ['missing GLB/texture', 'fallback identical cover'] },
  respawn: { cases: ['all threatened spawns', 'respawn protection', 'two exits'] },
  layer: { cases: ['-3/0/+3 layer paths', 'blocked layer', 'required route without vault'] },
  contrast: { cases: ['factions/lighting/distance', 'low contrast fixture'] },
};

function replFrame(code, payload) {
  const marker = /console\.log\('([^']+)'\+JSON\.stringify/.exec(code)?.[1];
  expect(marker).toBeTruthy();
  return `${marker}${JSON.stringify(payload)}\n[ok | 1ms]`;
}

describe('map Aside scenario classification', () => {
  it('registers every canonical map handler', () => {
    expect(Object.keys(scenarioHandlers).sort()).toEqual([
      'map-art-collision', 'map-asset-failure', 'map-layer-route', 'map-low-contrast', 'map-play', 'map-respawn-crossfire',
    ]);
  });

  it('requires rendered evidence for all map-art gates', () => {
    const cases = classifyMapArt(definitions.art, {
      maps: ['arena1', 'arena2', 'arena3'].map(map => ({ map, ready: true })),
      collision: { unbacked: 0 }, slope: { blocked: 6, clear: 6 },
      fallback: { failedRequests: 2, ready: true, silhouettePreserved: true },
      lifetime: { prepared: true, shadowCached: true, mapExclusive: true },
    }, artifacts);
    expect(cases.every(item => item.verdict === 'PASS')).toBe(true);
    expect(() => validateScenarioResult(definitions.art, { cases })).not.toThrow();
    expect(classifyMapArt(definitions.art, {}, [])[0].verdict).toBe('UNQUALIFIED');
    expect(classifyMapArt(definitions.art, { inspectionErrors: [{ map: 'arena2', phase: 'readiness-poll-2' }] }, artifacts)
      .every(item => item.verdict === 'UNQUALIFIED' && item.reasons[0]?.code === 'inspection_transport_error')).toBe(true);
  });

  it('never promotes coordinate fixtures to actual route input', () => {
    const runs = ['arena1', 'arena2', 'arena3'].flatMap(map => ['red', 'blue'].map(perspective => ({
      map, perspective, durationMs: 600_000, trustedEvents: 10, inputKind: 'coordinate-fixture',
      checkpoints: ['spawn', 'interior', 'roof', 'lower', 'objective'],
    })));
    runs.push({ ...runs[0], perspective: 'ffa' });
    expect(classifyMapPlay(definitions.play, { runs }, artifacts).every(item => item.verdict === 'UNQUALIFIED')).toBe(true);
    const actual = runs.map(run => ({ ...run, inputKind: 'trusted-aside' }));
    expect(classifyMapPlay(definitions.play, { runs: actual, routeAttempted: true }, artifacts).every(item => item.verdict === 'PASS')).toBe(true);
    const failedRoute = actual.map(run => run.map === 'arena1' ? { ...run, checkpoints: ['spawn'] } : run);
    expect(classifyMapPlay(definitions.play, { runs: failedRoute, routeAttempted: true }, artifacts)[2].verdict).toBe('FAIL');
  });

  it('keeps failure scenarios evidence-bound', () => {
    const failedPaths = ['/assets/ww1/environment/duckboard.glb', '/assets/ww1/environment/sandbag.glb',
      '/assets/ww1/environment/wire.glb', '/assets/maps/relay-ground-ao.png',
      '/assets/ww1/environment/ammo-crate.glb', '/assets/ww1/environment/brick-rubble.glb',
      '/assets/ww1/environment/field-telephone.glb', '/assets/ww1/environment/observation-post.glb'];
    const interceptions = failedPaths.map((path, index) => ({ url: `http://127.0.0.1:8796${path}`, requestId: `fetch-${index}`,
      networkId: `network-${index}`, action: 'fail', failAcknowledged: true, failError: null }));
    const networkFailures = failedPaths.map((path, index) => ({ requestId: `network-${index}`, url: `http://127.0.0.1:8796${path}` }));
    expect(classifyAssetFailure(definitions.asset, { failedRequests: 8, failedPaths,
      interceptions, networkFailures, authoritativeReady: true, visualReviewPassed: true }, artifacts)
      .every(item => item.verdict === 'PASS')).toBe(true);
    expect(classifyAssetFailure(definitions.asset, { failedRequests: 8, failedPaths,
      authoritativeReady: true, visualReviewPassed: true }, artifacts)[0].verdict).toBe('UNQUALIFIED');
    expect(classifyAssetFailure(definitions.asset, { failedRequests: 8, failedPaths,
      authoritativeReady: true }, artifacts)[1]?.verdict).toBe('UNQUALIFIED');
    expect(classifyAssetFailure(definitions.asset, { inspectionError: { phase: 'readiness-poll-3', message: 'Aside REPL timed out' } }, artifacts)
      .every(item => item.verdict === 'UNQUALIFIED' && item.reasons[0]?.code === 'inspection_transport_error')).toBe(true);
    expect(classifyRespawnCrossfire(definitions.respawn, { threatened: 12, evaluated: 12, protected: 12, twoExitSpawns: 12 }, artifacts).every(item => item.verdict === 'PASS')).toBe(true);
    expect(classifyLayerRoute(definitions.layer, { reachedLayers: [-3, 0, 3], blockedRejected: true, noVaultRequired: true, inputKind: 'trusted-aside', routeAttempted: true }, artifacts).every(item => item.verdict === 'PASS')).toBe(true);
    expect(classifyLayerRoute(definitions.layer, { reachedLayers: [0], blockedRejected: false, noVaultRequired: false, inputKind: 'trusted-aside', routeAttempted: true }, artifacts).every(item => item.verdict === 'FAIL')).toBe(true);
    expect(classifyLowContrast(definitions.contrast, { samples: 18, lightingGroups: 3, distances: [10, 25, 40], inputKind: 'coordinate-fixture', lowContrastDetected: true }, artifacts).map(item => item.verdict)).toEqual(['UNQUALIFIED', 'PASS']);
    expect(classifyLowContrast(definitions.contrast, { samples: 18, lightingGroups: 3, distances: [10, 25, 40], inputKind: 'trusted-aside', visualReviewPassed: false, lowContrastDetected: true }, artifacts)[0].verdict).toBe('FAIL');
  });

  it('persists returned progress before a later phase timeout without accepting stale success', async () => {
    const progress = { completedPhases: [], lastObservation: null, error: null, errors: [] };
    const writes = [];
    const persist = async value => { writes.push(JSON.parse(JSON.stringify(value))); };
    const identity = await runProgressPhase(progress, 'document-identity', async () => ({
      url: 'http://127.0.0.1:8796/?inspect=map&map=arena1', timeOrigin: 42, readyState: 'complete',
    }), persist);
    const readiness = await runProgressPhase(progress, 'readiness-poll-1', async () => ({
      inspectorReady: false, progress: { phase: 'assets', loaded: 3 },
    }), persist);
    const capture = await runProgressPhase(progress, 'screenshot', async () => {
      throw new Error('Aside REPL timed out after 30000ms');
    }, persist, { updateLastObservation: false });

    expect(identity.ok).toBe(true);
    expect(readiness.ok).toBe(true);
    expect(capture).toMatchObject({ ok: false, error: { phase: 'screenshot', name: 'Error', message: 'Aside REPL timed out after 30000ms' } });
    expect(writes).toHaveLength(3);
    expect(writes[1].lastObservation).toEqual({ inspectorReady: false, progress: { phase: 'assets', loaded: 3 } });
    expect(writes[2].lastObservation).toEqual(writes[1].lastObservation);
    expect(writes[2].completedPhases).toEqual(['document-identity', 'readiness-poll-1']);
    expect(writes[2].errors).toEqual([{ phase: 'screenshot', name: 'Error', message: 'Aside REPL timed out after 30000ms' }]);
  });

  it('returns a valid UNQUALIFIED map-art result when navigation fails before resources exist', async () => {
    const written = [];
    const cleanups = [];
    const repl = {
      isUsable: () => true,
      run: async code => {
        if (code.includes('await page.goto(')) throw new Error('NavigationError: connection closed');
        if (code.includes('const before=await listBrowserTabs()')) return replFrame(code, { ownedTargetId: 'owned-map-tab' });
        if (code.includes("page.cdp.send('Fetch.disable')") && code.includes('return {supported:true'))
          return replFrame(code, { supported: true, disabled: true });
        if (code.includes('Emulation.setFocusEmulationEnabled')) return replFrame(code, { focusEmulation: true, focusError: null });
        if (code.includes('const ownedUrl=page?.url')) return replFrame(code, { ownedUrl: 'about:blank', fetchDisabled: true, tabs: [] });
        throw new Error(`unexpected REPL command: ${code.slice(0, 80)}`);
      },
    };
    const output = await scenarioHandlers['map-art-collision']({
      definition: definitions.art,
      url: 'http://127.0.0.1:8796/',
      repl,
      writeArtifact: async (path, value) => { written.push({ path, value: JSON.parse(JSON.stringify(value)) }); return { path, bytes: 1 }; },
      copySessionArtifact: async () => { throw new Error('capture must not run'); },
      recordCleanup: receipt => cleanups.push(receipt),
    });

    expect(() => validateScenarioResult(definitions.art, output)).not.toThrow();
    expect(output.cases.every(item => item.verdict === 'UNQUALIFIED'
      && item.reasons[0]?.code === 'inspection_transport_error')).toBe(true);
    expect(output.observations.inspectionErrors).toHaveLength(3);
    expect(output.observations.maps.every(map => map.ready === false && map.candidateUrls.length === 0)).toBe(true);
    expect(written.filter(item => item.path.startsWith('traces/map-progress/'))).toHaveLength(3);
    expect(cleanups).toHaveLength(1);
  });

  it('requires acknowledged failures and Network.loadingFailed evidence without unsupported listener teardown', async () => {
    const failedPaths = ['/assets/ww1/environment/duckboard.glb', '/assets/ww1/environment/sandbag.glb',
      '/assets/ww1/environment/wire.glb', '/assets/maps/relay-ground-ao.png',
      '/assets/ww1/environment/ammo-crate.glb', '/assets/ww1/environment/brick-rubble.glb',
      '/assets/ww1/environment/field-telephone.glb', '/assets/ww1/environment/observation-post.glb'];
    const interceptions = failedPaths.map((path, index) => ({ url: `http://127.0.0.1:8796${path}`, requestId: `fetch-${index}`,
      networkId: `network-${index}`, action: 'fail', failAcknowledged: true, failError: null }));
    const networkFailures = failedPaths.map((path, index) => ({ requestId: `network-${index}`,
      url: `http://127.0.0.1:8796${path}`, errorText: 'net::ERR_FAILED', canceled: false, type: 'Other' }));
    let currentUrl = 'about:blank';
    let timeOrigin = 1;
    const repl = {
      isUsable: () => true,
      run: async (code) => {
        expect(code).not.toContain('page.cdp.off(');
        if (code.includes('const before=await listBrowserTabs()')) return replFrame(code, { ownedTargetId: 'owned-map-tab' });
        if (code.includes("return {supported:true,disabled:true}")) return replFrame(code, { supported: true, disabled: true });
        if (code.includes('Emulation.setFocusEmulationEnabled')) return replFrame(code, { focusEmulation: false, focusError: 'unsupported' });
        if (code.includes('let navigationError=null')) {
          const encoded = /page\.goto\(("[^"]+")\)/.exec(code)?.[1];
          expect(encoded).toBeTruthy();
          const beforeTimeOrigin = timeOrigin;
          currentUrl = JSON.parse(encoded);
          timeOrigin += 1;
          return replFrame(code, { beforeTimeOrigin, navigatedUrl: currentUrl, navigationError: null });
        }
        if (code.includes('readyState:document.readyState')) return replFrame(code, {
          url: currentUrl, timeOrigin, readyState: 'complete', domMarker: 100, visibilityState: 'visible', hasFocus: false,
        });
        if (code.includes('renderSurfaceReady:')) return replFrame(code, {
          ready: true, inspectorReady: true, report: { preparation: { durationMs: 5 } }, progress: { phase: 'sampling', frameCount: 1 },
          canvas: { width: 1440, height: 900, visibility: 'visible' },
          identity: { url: currentUrl, timeOrigin, domMarker: 100, visibilityState: 'visible', hasFocus: false },
          resources: currentUrl.includes('debugBoxes=1') ? [] : failedPaths.map(path => path.replace('/assets/maps/relay-ground-ao.png', '/assets/ww1/environment/observation-post.glb')),
          renderSurfaceReady: true,
        });
        if (code.includes('annotatedScreenshot(page)')) return replFrame(code, { bytes: 100 });
        if (code.includes('globalThis.__mapQaIntercepts=[]')) return replFrame(code, { fetchEnabled: true, networkEnabled: true });
        if (code.includes('return {interceptions:')) return replFrame(code, {
          interceptions, networkFailures, fetchDisabled: true, fetchDisableError: null,
          networkDisabled: true, networkDisableError: null, listenerStateRetained: true,
        });
        if (code.includes('const ownedUrl=page?.url')) return replFrame(code, { ownedUrl: currentUrl, fetchDisabled: true, tabs: [] });
        throw new Error(`unexpected REPL command: ${code.slice(0, 80)}`);
      },
    };
    const output = await scenarioHandlers['map-asset-failure']({
      definition: definitions.asset, url: 'http://127.0.0.1:8796/', repl,
      writeArtifact: async path => ({ path, bytes: 1 }),
      copySessionArtifact: async (_session, path) => ({ path, bytes: 100 }),
      recordCleanup() {},
    });

    expect(() => validateScenarioResult(definitions.asset, output)).not.toThrow();
    expect(output.cases.map(item => item.verdict)).toEqual(['PASS', 'UNQUALIFIED']);
    expect(output.observations).toMatchObject({ failedRequests: 8, fetchDisabled: true, fetchDisableError: null,
      networkDisabled: true, listenerStateRetained: true });
    expect(output.observations.interceptions.every(item => item.failAcknowledged)).toBe(true);
    expect(output.observations.networkFailedPaths.sort()).toEqual(failedPaths.sort());
  });

  it('rejects unrelated same-path Network failures and continuation errors', () => {
    const paths = ['/assets/ww1/environment/duckboard.glb', '/assets/ww1/environment/sandbag.glb',
      '/assets/ww1/environment/wire.glb', '/assets/maps/relay-ground-ao.png',
      '/assets/ww1/environment/ammo-crate.glb', '/assets/ww1/environment/brick-rubble.glb',
      '/assets/ww1/environment/field-telephone.glb', '/assets/ww1/environment/observation-post.glb'];
    const failed = paths.map((path, index) => ({ url: `http://local${path}`, requestId: `fetch-${index}`,
      networkId: `network-${index}`, action: 'fail', failAcknowledged: true, failError: null }));
    const matched = paths.map((path, index) => ({ requestId: `network-${index}`, url: `http://local${path}` }));
    expect(confirmFailureInjection(failed, matched)).toBe(true);
    expect(confirmFailureInjection(failed, matched.map((event, index) => ({ ...event, requestId: `unrelated-${index}` })))).toBe(false);
    expect(confirmFailureInjection([...failed, { url: 'http://local/assets/ww1/environment/future.glb', requestId: 'extra',
      networkId: 'extra-network', action: 'continue', continueAcknowledged: true, continueError: null }], matched)).toBe(true);
    expect(confirmFailureInjection([...failed, { url: 'http://local/assets/ww1/environment/future.glb', requestId: 'extra',
      networkId: 'extra-network', action: 'continue', continueAcknowledged: false, continueError: 'continue failed' }], matched)).toBe(false);
  });
});
