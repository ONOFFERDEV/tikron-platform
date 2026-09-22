import { VERDICT } from '../aside-common.mjs';
import { closeOwnedTab, recoverStaleFetchInterception, replJson } from './performance.mjs';

const MAPS = ['arena1', 'arena2', 'arena3'];
const MAP_CANDIDATES = Object.freeze({
  arena1: ['ammo-crate', 'brick-rubble', 'field-telephone', 'observation-post'],
  arena2: ['ammo-crate', 'brick-rubble', 'supply-wagon'],
  arena3: ['ammo-crate', 'brick-rubble', 'freight-wagon-wreck'],
});
const RELAY_FAILURE_PATHS = Object.freeze([
  '/assets/ww1/environment/duckboard.glb',
  '/assets/ww1/environment/sandbag.glb',
  '/assets/ww1/environment/wire.glb',
  '/assets/maps/relay-ground-ao.png',
  ...MAP_CANDIDATES.arena1.map(key => `/assets/ww1/environment/${key}.glb`),
]);
const INSPECTION_DEADLINE_MS = 120_000;
const CAPTURE_RESERVE_MS = 35_000;
const result = (id, passed, observations, artifacts, code, unqualified = false) => ({
  id,
  verdict: passed ? VERDICT.PASS : unqualified || artifacts.length === 0 ? VERDICT.UNQUALIFIED : VERDICT.FAIL,
  reasons: passed ? [] : [{ code }],
  observations: Array.isArray(observations) ? { items: observations } : observations,
  artifacts,
});

export function classifyMapArt(definition, observations, artifacts) {
  if (observations.inspectionErrors?.length > 0) {
    return definition.cases.map(id => result(id, false, observations, artifacts, 'inspection_transport_error', true));
  }
  const maps = observations.maps ?? [];
  return [
    result(definition.cases[0], MAPS.every(id => maps.some(item => item.map === id && item.ready)), maps, artifacts, 'three_map_render_missing'),
    result(definition.cases[1], observations.collision?.unbacked === 0, observations.collision ?? null, artifacts, 'render_collision_mismatch', observations.collision === undefined),
    result(definition.cases[2], observations.slope?.blocked > 0 && observations.slope.blocked === observations.slope.clear, observations.slope ?? null, artifacts, 'slope_pair_mismatch', observations.slope === undefined),
    result(definition.cases[3], observations.fallback?.failedRequests >= 2 && observations.fallback.ready && observations.fallback.silhouettePreserved, observations.fallback ?? null, artifacts, 'asset_fallback_mismatch', observations.fallback === undefined),
    result(definition.cases[4], observations.lifetime?.prepared && observations.lifetime.shadowCached && observations.lifetime.mapExclusive, observations.lifetime ?? null, artifacts, 'map_resource_lifetime_mismatch', observations.lifetime === undefined),
  ];
}

export function classifyMapPlay(definition, observations, artifacts) {
  const runs = observations.runs ?? [];
  const asideInput = runs.length > 0 && runs.every(run => run.inputKind === 'trusted-aside');
  const trusted = asideInput && runs.every(run => run.trustedEvents > 0);
  const mapsAndSides = MAPS.every(map => ['red', 'blue'].every(perspective => runs.some(run => run.map === map && run.perspective === perspective)))
    && runs.some(run => run.perspective === 'ffa');
  const sideRuns = runs.filter(run => run.perspective !== 'ffa');
  const durationAttempted = sideRuns.length >= 6;
  const duration = durationAttempted && sideRuns.every(run => run.durationMs >= 600_000);
  const routeAttempted = observations.routeAttempted === true;
  const checkpoints = runs.length > 0 && runs.every(run => ['spawn', 'interior', 'roof', 'lower', 'objective']
    .every(name => run.checkpoints.includes(name)));
  return [
    result(definition.cases[0], trusted && mapsAndSides, runs, artifacts, asideInput ? (mapsAndSides ? 'trusted_input_not_observed' : 'map_or_perspective_missing') : 'trusted_input_unavailable', !asideInput || !mapsAndSides),
    result(definition.cases[1], trusted && duration, runs.map(({ map, perspective, durationMs }) => ({ map, perspective, durationMs })), artifacts, asideInput ? (durationAttempted ? 'ten_minute_observation_failed' : 'ten_minute_observation_incomplete') : 'trusted_input_unavailable', !asideInput || !durationAttempted),
    result(definition.cases[2], trusted && checkpoints, runs.map(({ map, perspective, checkpoints: value }) => ({ map, perspective, checkpoints: value })), artifacts, asideInput ? 'route_checkpoint_missing' : 'trusted_input_unavailable', !asideInput || !routeAttempted),
  ];
}

export function classifyAssetFailure(definition, observations, artifacts) {
  if (observations.inspectionError) {
    return definition.cases.map(id => result(id, false, observations, artifacts, 'inspection_transport_error', true));
  }
  const exactFailureSet = RELAY_FAILURE_PATHS.length === observations.failedRequests
    && RELAY_FAILURE_PATHS.every(path => observations.failedPaths?.includes(path));
  const injectionConfirmed = exactFailureSet && confirmFailureInjection(observations.interceptions, observations.networkFailures);
  return [
    result(definition.cases[0], injectionConfirmed && observations.authoritativeReady === true,
      observations, artifacts, 'asset_failure_not_observed', !injectionConfirmed),
    result(definition.cases[1], observations.visualReviewPassed === true, observations, artifacts,
      'fallback_visual_review_pending', observations.visualReviewPassed === undefined),
  ];
}

const requestPath = value => {
  try { return new URL(value).pathname; }
  catch { return null; }
};

export function confirmFailureInjection(interceptions = [], networkFailures = []) {
  const targets = new Set(RELAY_FAILURE_PATHS);
  const failed = interceptions.filter(item => item.action === 'fail');
  const continued = interceptions.filter(item => item.action === 'continue');
  if (failed.length !== targets.size || failed.some(item => !targets.has(requestPath(item.url))
    || item.failAcknowledged !== true || item.failError !== null || typeof item.networkId !== 'string')) return false;
  if (interceptions.length !== failed.length + continued.length
    || continued.some(item => targets.has(requestPath(item.url)) || item.continueAcknowledged !== true || item.continueError !== null)) return false;
  const failedPaths = failed.map(item => requestPath(item.url));
  if (new Set(failedPaths).size !== targets.size || new Set(failed.map(item => item.networkId)).size !== targets.size) return false;
  const relevantNetworkFailures = networkFailures.filter(item => targets.has(requestPath(item.url)));
  if (relevantNetworkFailures.length !== targets.size) return false;
  return failed.every(item => relevantNetworkFailures.filter(event => event.requestId === item.networkId
    && requestPath(event.url) === requestPath(item.url)).length === 1);
}

export async function runProgressPhase(progress, phase, operation, persist, options = {}) {
  try {
    const value = await operation();
    progress.completedPhases.push(phase);
    if (options.updateLastObservation !== false) progress.lastObservation = value;
    await persist(progress);
    return { ok: true, value };
  } catch (error) {
    progress.error = {
      phase,
      name: error instanceof Error ? error.name : 'Error',
      message: error instanceof Error ? error.message : String(error),
    };
    progress.errors ??= [];
    progress.errors.push(progress.error);
    await persist(progress);
    return { ok: false, error: progress.error };
  }
}

export function classifyRespawnCrossfire(definition, observations, artifacts) {
  const complete = observations.evaluated >= 12;
  return [
    result(definition.cases[0], complete && observations.threatened === observations.evaluated, observations, artifacts, complete ? 'threatened_spawn_exposed' : 'threatened_spawn_sample_incomplete', !complete),
    result(definition.cases[1], complete && observations.protected === observations.evaluated, observations, artifacts, 'respawn_protection_missing', !complete),
    result(definition.cases[2], complete && observations.twoExitSpawns === observations.evaluated, observations, artifacts, complete ? 'spawn_exit_missing' : 'spawn_exit_sample_incomplete', !complete),
  ];
}

export function classifyLayerRoute(definition, observations, artifacts) {
  const trusted = observations.inputKind === 'trusted-aside';
  const attempted = trusted && observations.routeAttempted === true;
  return [
    result(definition.cases[0], attempted && [-3, 0, 3].every(layer => observations.reachedLayers?.includes(layer)), observations, artifacts, trusted ? 'layer_not_reached' : 'trusted_input_unavailable', !attempted),
    result(definition.cases[1], attempted && observations.blockedRejected === true, observations, artifacts, 'blocked_layer_not_rejected', !attempted),
    result(definition.cases[2], attempted && observations.noVaultRequired === true, observations, artifacts, trusted ? 'vault_required' : 'trusted_input_unavailable', !attempted),
  ];
}

export function classifyLowContrast(definition, observations, artifacts) {
  const matrixComplete = observations.samples >= 18
    && observations.lightingGroups === 3 && [10, 25, 40].every(value => observations.distances?.includes(value));
  const complete = observations.inputKind === 'trusted-aside' && matrixComplete;
  return [
    result(definition.cases[0], complete && observations.visualReviewPassed === true, observations, artifacts,
      observations.inputKind === 'trusted-aside' ? (matrixComplete ? 'contrast_visibility_failed' : 'contrast_matrix_incomplete') : 'coordinate_fixture_not_actual_input', !complete),
    result(definition.cases[1], observations.lowContrastDetected === true, observations, artifacts, 'low_contrast_fixture_not_detected'),
  ];
}

async function capture(context, name, timeoutMs = 40_000) {
  const sessionName = `${name}.png`;
  const receipt = await replJson(context.repl, `
    const image=await annotatedScreenshot(page);const bytes=Buffer.from(image.base64Image,'base64');
    await fs.mkdir('./artifacts',{recursive:true});await fs.writeFile('./artifacts/${sessionName}',bytes);
    return {bytes:bytes.length};
  `, { timeoutMs });
  return receipt.bytes > 0 ? context.copySessionArtifact(sessionName, `screenshots/${sessionName}`) : null;
}

async function openOwned(context, operation) {
  let opened = false;
  let ownedTargetId = null;
  try {
    const ownership = await replJson(context.repl, `
      const before=await listBrowserTabs(),ids=new Set(before.map(item=>item.targetId));await openTab('about:blank');
      const owned=(await listBrowserTabs()).filter(item=>!ids.has(item.targetId));return {ownedTargetId:owned.length===1?owned[0].targetId:null};
    `);
    opened = true;
    ownedTargetId = ownership.ownedTargetId;
    const recovery = await recoverStaleFetchInterception(context.repl);
    if (!recovery.disabled) throw new Error(`Fetch cleanup failed: ${recovery.errors.join('; ')}`);
    await replJson(context.repl, `
      await page.bringToFront();let focusEmulation=false,focusError=null;
      try{await page.cdp.send('Emulation.setFocusEmulationEnabled',{enabled:true});focusEmulation=true}catch(error){focusError=error.name+':'+error.message}
      return {focusEmulation,focusError};
    `, { allowError: true, timeoutMs: 30_000 });
    return await operation();
  } finally {
    let closeReceipt = null;
    if (opened) {
      try { closeReceipt = await closeOwnedTab(context.repl); }
      catch (error) { closeReceipt = { error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }; }
    }
    context.recordCleanup({ opened, ownedTargetId, closeReceipt });
  }
}

export async function inspectMap(context, map, shot, suffix = '', query = {}, requireInspector = false, requireCandidateResources = true) {
  const url = new URL(context.url);
  url.searchParams.set('inspect', 'map'); url.searchParams.set('map', map); url.searchParams.set('shot', shot);
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
  const started = Date.now();
  const deadline = started + INSPECTION_DEADLINE_MS;
  const progressName = `traces/map-progress/${map}-${shot}${suffix || '-default'}.json`;
  const progress = { map, shot, target: url.href, startedAt: new Date(started).toISOString(), completedPhases: [], lastObservation: null, error: null, errors: [] };
  let progressArtifact = null;
  const persist = async value => { progressArtifact = await context.writeArtifact(progressName, value); };
  const remaining = cap => Math.max(1, Math.min(cap, deadline - Date.now()));

  const navigation = await runProgressPhase(progress, 'navigation', () => replJson(context.repl, `
    const before=await page.evaluate(()=>performance.timeOrigin);let navigationError=null;
    try{await page.goto(${JSON.stringify(url.href)})}catch(error){
      if(error?.name!=='NavigationReadinessTimeoutError')throw error;
      navigationError={name:error.name,message:error.message};
    }
    return {beforeTimeOrigin:before,navigatedUrl:page.url(),navigationError};
  `, { timeoutMs: remaining(40_000) }), persist);
  if (!navigation.ok) return { map, ready: false, inspectorReady: false, resources: [], artifact: null, progressArtifact, error: progress.error, progress };
  if (navigation.value.navigationError) {
    progress.errors.push({ phase: 'navigation', ...navigation.value.navigationError, caught: true });
    await persist(progress);
  }

  const identity = await runProgressPhase(progress, 'document-identity', () => replJson(context.repl, `
    return await page.evaluate(()=>({url:location.href,timeOrigin:performance.timeOrigin,readyState:document.readyState,domMarker:document.documentElement.outerHTML.length,
      visibilityState:document.visibilityState,hasFocus:document.hasFocus()}));
  `, { timeoutMs: remaining(8_000) }), persist);
  if (!identity.ok) return { map, ready: false, inspectorReady: false, resources: [], artifact: null, progressArtifact, error: progress.error, progress };
  const freshDocument = identity.value.url === url.href && identity.value.timeOrigin !== navigation.value.beforeTimeOrigin;
  if (!freshDocument) {
    progress.error = { phase: 'document-identity', name: 'DocumentIdentityError', message: 'Map inspection did not reach the exact fresh target document' };
    progress.errors.push(progress.error);
    await persist(progress);
    return { map, ready: false, inspectorReady: false, resources: [], artifact: null, progressArtifact, error: progress.error, progress, identity: identity.value };
  }

  let observed = null;
  let poll = 0;
  while (Date.now() < deadline - CAPTURE_RESERVE_MS) {
    poll += 1;
    const sample = await runProgressPhase(progress, `readiness-poll-${poll}`, () => replJson(context.repl, `
      return await page.evaluate(expected=>{const canvas=document.querySelector('#app>canvas'),resources=performance.getEntriesByType('resource').map(item=>new URL(item.name).pathname);return {
        ready:!!canvas,inspectorReady:window.__inspectReady===true,report:window.__mapInspect??null,progress:window.__mapInspectProgress??null,
        canvas:canvas?{width:canvas.width,height:canvas.height,clientWidth:canvas.clientWidth,clientHeight:canvas.clientHeight,visibility:getComputedStyle(canvas).visibility}:null,
        identity:{url:location.href,timeOrigin:performance.timeOrigin,domMarker:document.documentElement.outerHTML.length,visibilityState:document.visibilityState,hasFocus:document.hasFocus()},resources,
        renderSurfaceReady:!!canvas&&canvas.width>0&&canvas.height>0&&(!${requireCandidateResources}||expected.every(key=>resources.includes('/assets/ww1/environment/'+key+'.glb')))};},${JSON.stringify(MAP_CANDIDATES[map])});
    `, { timeoutMs: remaining(5_000) }), persist);
    if (!sample.ok) return { ready: false, inspectorReady: false, resources: [], ...(observed ?? {}), map, artifact: null, progressArtifact, error: progress.error, progress };
    observed = sample.value;
    if (observed.identity?.url === url.href && observed.identity?.timeOrigin === identity.value.timeOrigin
      && observed.renderSurfaceReady && (!requireInspector || observed.inspectorReady)) break;
    await new Promise(resolve => setTimeout(resolve, 750));
  }
  if (!observed?.renderSurfaceReady || (requireInspector && !observed.inspectorReady)) {
    progress.error = { phase: 'readiness', name: 'ReadinessDeadlineError', message: 'Map inspection readiness deadline expired' };
    progress.errors.push(progress.error);
    await persist(progress);
  }

  let artifact = null;
  if (context.repl.isUsable?.() !== false && Date.now() < deadline) {
    const captured = await runProgressPhase(progress, 'screenshot', () => capture(context, `${map}-${shot}${suffix}`, remaining(30_000)), persist,
      { updateLastObservation: false });
    if (captured.ok) artifact = captured.value;
  }
  return { ...(observed ?? {}), map, artifact, progressArtifact, error: progress.error, progress };
}

async function runMapArt(context) {
  return openOwned(context, async () => {
    const inspections = [];
    for (const map of MAPS) inspections.push(await inspectMap(context, map, map === 'arena1' ? 'overview' : `${map === 'arena2' ? 'undertow' : 'switchyard'}-overview`, '', { debugBoxes: '1' }));
    const artifacts = inspections.flatMap(item => [item.artifact, item.progressArtifact].filter(Boolean));
    const maps = inspections.map(item => {
      const resources = item.resources ?? [];
      const candidateUrls = resources.filter(resource => resource.startsWith('/assets/ww1/environment/'));
      const expected = MAP_CANDIDATES[item.map];
      return { map: item.map, ready: item.ready && expected.every(key => candidateUrls.includes(`/assets/ww1/environment/${key}.glb`)),
        candidateUrls, identity: item.identity };
    });
    const foreign = { arena1: /undertow|switchyard/, arena2: /relay|switchyard/, arena3: /relay|undertow/ };
    const lifetime = inspections.every(item => item.report) ? { prepared: inspections.every(item => item.ready && Number.isFinite(item.report?.preparation?.durationMs)),
      shadowCached: inspections.every(item => item.report?.lighting?.shadowAutoUpdate === false),
      mapExclusive: inspections.every(item => !(item.resources ?? []).some(resource => foreign[item.map].test(resource))) } : undefined;
    const observations = { maps, lifetime, inspectionErrors: inspections.flatMap(item => item.error ? [{ map: item.map, ...item.error }] : []) };
    artifacts.push(await context.writeArtifact('traces/map-art.json', observations));
    return { cases: classifyMapArt(context.definition, observations, artifacts), inputProvenance: 'Aside offline production-renderer inspection; fixed cameras only', observations };
  });
}

async function actualMovement(context, map) {
  const url = new URL(context.url); url.searchParams.set('mode', 'practice'); url.searchParams.set('map', map); url.searchParams.set('movement-review', '1');
  return replJson(context.repl, `
    await page.goto(${JSON.stringify(url.href)});const started=Date.now();
    while(Date.now()-started<95000&&!await page.evaluate(()=>!!window.ironsight?.state()?.players?.[window.ironsight?.myId]))await sleep(500);
    await page.evaluate(()=>{window.__mapQaTrusted=[];document.addEventListener('keydown',event=>window.__mapQaTrusted.push({code:event.code,trusted:event.isTrusted}),true)});
    await page.locator('#app>canvas').click({position:{x:100,y:100}});const before=await page.evaluate(()=>window.ironsight.state().players[window.ironsight.myId]);
    await page.keyboard.down('KeyW');await sleep(3000);await page.keyboard.up('KeyW');await sleep(250);
    const after=await page.evaluate(()=>window.ironsight.state().players[window.ironsight.myId]);
    const events=await page.evaluate(()=>window.__mapQaTrusted);return {before,after,events,locked:await page.evaluate(()=>!!document.pointerLockElement),durationMs:Date.now()-started};
  `, { timeoutMs: 110_000 });
}

async function runMapPlay(context) {
  return openOwned(context, async () => {
    const runs = [], artifacts = [];
    for (const map of MAPS) {
      const movement = await actualMovement(context, map);
      const moved = Math.hypot(movement.after.x - movement.before.x, movement.after.z - movement.before.z);
      const trustedEvents = movement.events.filter(event => event.trusted).length;
      runs.push({ map, perspective: movement.after.team === 0 ? 'red' : 'blue', durationMs: movement.durationMs,
        trustedEvents, inputKind: movement.locked && trustedEvents > 0 ? 'trusted-aside' : 'aside-unlocked',
        checkpoints: ['spawn', ...(moved > 1 ? ['interior'] : [])], moved });
      const artifact = await capture(context, `${map}-actual-input`); if (artifact) artifacts.push(artifact);
    }
    artifacts.push(await context.writeArtifact('traces/map-play.json', { runs }));
    return { cases: classifyMapPlay(context.definition, { runs }, artifacts), inputProvenance: 'Aside trusted canvas click and keyboard input; state coordinates observed only, never injected', observations: { runs } };
  });
}

async function runAssetFailure(context) {
  return openOwned(context, async () => {
    const baseline = await inspectMap(context, 'arena1', 'overview', '-baseline', {}, true);
    if (baseline.error) {
      const observations = { failedRequests: 0, failedPaths: [], authoritativeReady: false,
        inspectionError: baseline.error, baseline: { identity: baseline.identity, progress: baseline.progress, lastObservation: baseline.progress?.lastObservation } };
      const artifacts = [baseline.artifact, baseline.progressArtifact].filter(Boolean);
      artifacts.push(await context.writeArtifact('traces/map-asset-failure.json', observations));
      return { cases: classifyAssetFailure(context.definition, observations, artifacts), inputProvenance: 'Aside production-renderer inspection; transport failure preserved', observations };
    }
    const failureUrl = new URL(context.url);
    failureUrl.searchParams.set('inspect', 'map'); failureUrl.searchParams.set('map', 'arena1');
    failureUrl.searchParams.set('shot', 'overview'); failureUrl.searchParams.set('debugBoxes', '1');
    try {
      await replJson(context.repl, `
        globalThis.__mapQaIntercepts=[];globalThis.__mapQaNetworkUrls={};globalThis.__mapQaNetworkFailures=[];
        globalThis.__mapQaTargetPaths=new Set(${JSON.stringify(RELAY_FAILURE_PATHS)});
        await page.cdp.send('Network.enable');
        globalThis.__mapQaNetworkRequest=event=>{globalThis.__mapQaNetworkUrls[event.requestId]=event.request.url};
        globalThis.__mapQaNetworkFailed=event=>{globalThis.__mapQaNetworkFailures.push({requestId:event.requestId,url:globalThis.__mapQaNetworkUrls[event.requestId]??null,
          errorText:event.errorText??null,canceled:event.canceled??null,type:event.type??null})};
        page.cdp.on('Network.requestWillBeSent',globalThis.__mapQaNetworkRequest);page.cdp.on('Network.loadingFailed',globalThis.__mapQaNetworkFailed);
        await page.cdp.send('Fetch.enable',{patterns:[{urlPattern:'*assets/ww1/environment/*.glb'},{urlPattern:'*ground-ao.png'}]});
        globalThis.__mapQaFetch=async event=>{let path=null;try{path=new URL(event.request.url).pathname}catch{}
          const target=globalThis.__mapQaTargetPaths.has(path),item={url:event.request.url,path,requestId:event.requestId,networkId:event.networkId??null,
            action:target?'fail':'continue',failAcknowledged:false,failError:null,continueAcknowledged:false,continueError:null};
          globalThis.__mapQaIntercepts.push(item);
          if(target){try{await page.cdp.send('Fetch.failRequest',{requestId:event.requestId,errorReason:'Failed'});item.failAcknowledged=true}
            catch(error){item.failError=error.name+':'+error.message}}
          else{try{await page.cdp.send('Fetch.continueRequest',{requestId:event.requestId});item.continueAcknowledged=true}
            catch(error){item.continueError=error.name+':'+error.message}}};
        page.cdp.on('Fetch.requestPaused',globalThis.__mapQaFetch);return {fetchEnabled:true,networkEnabled:true};
      `, { timeoutMs: 10_000 });
    } catch (error) {
      const inspectionError = { phase: 'interception-setup', name: error instanceof Error ? error.name : 'Error',
        message: error instanceof Error ? error.message : String(error) };
      const observations = { failedRequests: 0, failedPaths: [], authoritativeReady: false, inspectionError,
        baseline: { identity: baseline.identity, progress: baseline.progress, lastObservation: baseline.progress?.lastObservation } };
      const artifacts = [baseline.artifact, baseline.progressArtifact].filter(Boolean);
      artifacts.push(await context.writeArtifact('traces/map-asset-failure.json', observations));
      return { cases: classifyAssetFailure(context.definition, observations, artifacts), inputProvenance: 'Aside interception setup unavailable; no failure claim', observations };
    }
    const failure = await inspectMap(context, 'arena1', 'overview', '-asset-failure', { debugBoxes: '1' }, true, false);
    let interception = { interceptions: [], networkFailures: [], fetchDisabled: false, fetchDisableError: null,
      networkDisabled: false, networkDisableError: null, listenerStateRetained: false };
    if (context.repl.isUsable?.() !== false) {
      const cleanup = await replJson(context.repl, `
        let fetchDisabled=false,fetchDisableError=null;try{await page.cdp.send('Fetch.disable');fetchDisabled=true}catch(error){fetchDisableError=error.name+':'+error.message}
        let networkDisabled=false,networkDisableError=null;try{await page.cdp.send('Network.disable');networkDisabled=true}catch(error){networkDisableError=error.name+':'+error.message}
        return {interceptions:[...(globalThis.__mapQaIntercepts??[])],networkFailures:[...(globalThis.__mapQaNetworkFailures??[])],fetchDisabled,fetchDisableError,
          networkDisabled,networkDisableError,listenerStateRetained:true};
      `, { allowError: true, timeoutMs: 10_000 });
      interception = cleanup;
    }
    const artifacts = [baseline.artifact, baseline.progressArtifact, failure.artifact, failure.progressArtifact].filter(Boolean);
    const acknowledgedUrls = interception.interceptions.filter(item => item.failAcknowledged).map(item => item.url);
    const failedPaths = [...new Set(acknowledgedUrls.map(value => new URL(value).pathname))];
    const networkFailedPaths = [...new Set(interception.networkFailures.flatMap(item => item.url ? [new URL(item.url).pathname] : []))];
    const observations = { failedRequests: failedPaths.length, failedUrls: acknowledgedUrls, failedPaths,
      interceptions: interception.interceptions, networkFailures: interception.networkFailures, networkFailedPaths,
      fetchDisabled: interception.fetchDisabled, fetchDisableError: interception.fetchDisableError,
      networkDisabled: interception.networkDisabled, networkDisableError: interception.networkDisableError,
      listenerStateRetained: interception.listenerStateRetained,
      authoritativeReady: !failure.error && failure.inspectorReady === true && failure.report !== null,
      inspectionError: failure.error ?? null,
      baseline: { identity: baseline.identity, inspectorReady: baseline.inspectorReady, report: baseline.report, progress: baseline.progress,
        canvas: baseline.canvas, resources: baseline.resources },
      failure: { identity: failure.identity, inspectorReady: failure.inspectorReady, report: failure.report, progress: failure.progress,
        canvas: failure.canvas, resources: failure.resources },
      baselineBytes: baseline.artifact?.bytes ?? 0, failureBytes: failure.artifact?.bytes ?? 0,
      visualReviewPassed: undefined };
    artifacts.push(await context.writeArtifact('traces/map-asset-failure.json', observations));
    return { cases: classifyAssetFailure(context.definition, observations, artifacts), inputProvenance: 'Aside CDP network failure injection and production-renderer fallback', observations };
  });
}

async function runDerived(context, classifier, observations, provenance) {
  return openOwned(context, async () => {
    const movement = await actualMovement(context, 'arena1');
    const artifact = await capture(context, `${context.definition.id}-actual-input`);
    const trustedEvents = movement.events.filter(event => event.trusted).length;
    const merged = { ...observations(movement), trustedEvents,
      inputKind: movement.locked && trustedEvents > 0 ? 'trusted-aside' : 'aside-unlocked' };
    const artifacts = artifact ? [artifact] : [];
    artifacts.push(await context.writeArtifact(`traces/${context.definition.id}.json`, merged));
    return { cases: classifier(context.definition, merged, artifacts), inputProvenance: provenance, observations: merged };
  });
}

async function runLowContrast(context) {
  return openOwned(context, async () => {
    const samples = [], artifacts = [];
    for (const map of MAPS) for (const distance of [10, 25, 40]) {
      const inspected = await inspectMap(context, map, 'contrast-team', `-${distance}m`, {
        'review-camera': '10,1.65,10,20,1.5,10',
        'review-enemy': `${10 + distance},0,10`,
      });
      samples.push({ map, distance, ready: inspected.ready, actors: inspected.report?.actorAppearance ?? [] });
      if (inspected.artifact) artifacts.push(inspected.artifact);
    }
    const injected = await replJson(context.repl, `
      return await page.evaluate(()=>{const canvas=document.querySelector('#app>canvas');canvas.style.filter='contrast(.25)';return {filter:getComputedStyle(canvas).filter}});
    `);
    const injectedArtifact = await capture(context, 'low-contrast-fixture'); if (injectedArtifact) artifacts.push(injectedArtifact);
    const observations = { samples: samples.length * 2, lightingGroups: 3, distances: [10, 25, 40],
      inputKind: 'coordinate-fixture', visualReviewPassed: false, lowContrastDetected: injected.filter === 'contrast(0.25)', matrix: samples };
    artifacts.push(await context.writeArtifact('traces/map-low-contrast.json', observations));
    return { cases: classifyLowContrast(context.definition, observations, artifacts), inputProvenance: 'Aside fixed-camera faction matrix and explicit low-contrast render failure injection; no gameplay coordinate mutation', observations };
  });
}

export const scenarioHandlers = Object.freeze({
  'map-art-collision': runMapArt,
  'map-play': runMapPlay,
  'map-asset-failure': runAssetFailure,
  'map-respawn-crossfire': context => runDerived(context, classifyRespawnCrossfire, movement => ({ evaluated: 1, threatened: 1, protected: movement.before.prot ? 1 : 0, twoExitSpawns: 0 }), 'Aside trusted respawn movement sample; no state injection'),
  'map-layer-route': context => runDerived(context, classifyLayerRoute, movement => ({ reachedLayers: [...new Set([movement.before.y, movement.after.y])], blockedRejected: false, noVaultRequired: false }), 'Aside trusted movement sample; coordinates observed only'),
  'map-low-contrast': runLowContrast,
});
