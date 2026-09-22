import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { VERDICT, classifyCapabilities, validateStages } from '../aside-common.mjs';
import { pointerLockCapability } from '../aside-pointer-lock.mjs';
import { runPerfRender } from '../render-budget-collector.mjs';
import { evaluateTargetDeviceReport } from '../target-device-report.mjs';
import { classifyServerLog, readPerfSnapshot } from '../../tools/ironsight-load-options.mjs';
import { aggregatePerfSnapshots, evaluateStatsCoverage, scenarioChecks, verifyManifestFiles } from '../../tools/ironsight-load.mjs';

export const READINESS_TIMEOUT_MS = 95_000;

function reason(code, detail = null) {
  return { code, detail };
}

export async function replJson(repl, body, options = {}) {
  const token = randomBytes(8).toString('hex');
  const marker = `__ASIDE_JSON_${token}__`;
  const frame = await repl.run(
    `console.log('${marker}'+JSON.stringify(await (async()=>{${body}})()))`,
    options,
  );
  const line = frame.split('\n').find(value => value.startsWith(marker));
  if (!line && /(?:^|\n)\[error \||(?:^|\n)(?:Error|TypeError|ReferenceError):/.test(frame)) {
    throw new Error(`Aside REPL command failed before response marker:\n${frame}`);
  }
  if (!line) throw new Error(`Aside REPL response marker missing: ${marker}`);
  return JSON.parse(line.slice(marker.length));
}

export function classifyReadinessStage(sample) {
  if (sample.canvas && sample.inert === false && sample.marks.playReady) return 'play-ready';
  if (sample.marks.uiEnd) return 'compositor-complete';
  if (sample.marks.uiStart) return 'compositor';
  if (sample.canvas) return 'scene-or-assets';
  return 'network-or-scene';
}

export async function recoverStaleFetchInterception(repl, options = {}) {
  const attemptLimit = options.attemptLimit ?? 2;
  const errors = [];
  for (let attempt = 1; attempt <= attemptLimit; attempt += 1) {
    try {
      const result = await replJson(repl, `
        if(typeof page?.cdp?.send!=='function')return {supported:false,disabled:false,error:'Aside page CDP unavailable'};
        try{await page.cdp.send('Fetch.disable');return {supported:true,disabled:true}}
        catch(error){return {supported:true,disabled:false,error:error.name+':'+error.message}}
      `, { allowError: true, timeoutMs: 30_000 });
      if (result.disabled) return { ...result, attempts: attempt, errors };
      errors.push(result.error ?? 'Fetch.disable did not confirm cleanup');
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { supported: null, disabled: false, attempts: attemptLimit, errors };
}

export async function closeOwnedTab(repl) {
  return replJson(repl, `
    const ownedUrl=page?.url?.()??null;
    let fetchDisabled=null,fetchError=null;
    if(typeof page?.cdp?.send==='function'){try{await page.cdp.send('Fetch.disable');fetchDisabled=true}catch(error){fetchDisabled=false;fetchError=error.name+':'+error.message}}
    let metricsCleared=null;
    let metricsError=null;
    if(typeof page?.cdp?.send==='function'){try{await page.cdp.send('Emulation.clearDeviceMetricsOverride');metricsCleared=true}catch(error){metricsCleared=false;metricsError=error.name+':'+error.message}}
    if(page) await closeTab(page);
    return {ownedUrl,fetchDisabled,fetchError,metricsCleared,metricsError,tabs:(await listBrowserTabs()).map(({targetId,active,focusedWindow})=>({targetId,active,focusedWindow}))};
  `, { allowError: true, timeoutMs: 30_000 });
}

async function runPerfInput(context) {
  const { definition, repl, url, viewport, copySessionArtifact } = context;
  let opened = false;
  let ownership = null;
  let facts = null;
  let input = null;
  let closeReceipt = null;
  let fetchRecovery = null;
  const startedAt = new Date().toISOString();
  try {
    const before = await replJson(repl, `
      return (await listBrowserTabs()).map(({targetId,active,focusedWindow})=>({targetId,active,focusedWindow}));
    `);
    const beforeIds = new Set(before.map(item => item.targetId));
    const openedPage = await replJson(repl, `
      await openTab('about:blank');
      return {url:page.url(),title:await page.title(),tabs:(await listBrowserTabs()).map(item=>({targetId:item.targetId,active:item.active,focusedWindow:item.focusedWindow}))};
    `);
    opened = true;
    const ownedTabs = openedPage.tabs.filter(item => !beforeIds.has(item.targetId));
    ownership = { before, opened: openedPage, ownedTargetId: ownedTabs.length === 1 ? ownedTabs[0].targetId : null };
    fetchRecovery = await recoverStaleFetchInterception(repl);
    if (!fetchRecovery.disabled) throw new Error(`Fetch interception recovery failed: ${fetchRecovery.errors.join('; ')}`);
    const navigation = await replJson(repl, `
      await page.goto(${JSON.stringify(url)});
      return {url:page.url(),title:await page.title()};
    `, { timeoutMs: 30_000 });
    ownership.opened = { ...ownership.opened, ...navigation };

    const viewportControl = await replJson(repl, `
      const supported=typeof page?.cdp?.send==='function';
      if(!supported)return {supported:false,kind:null};
      try{
        await page.cdp.send('Emulation.setDeviceMetricsOverride',{width:${viewport[0]},height:${viewport[1]},deviceScaleFactor:1,mobile:false,screenWidth:${viewport[0]},screenHeight:${viewport[1]}});
        const measured=await page.evaluate(()=>({css:[innerWidth,innerHeight],screen:[screen.width,screen.height],dpr:devicePixelRatio}));
        return {supported:true,applied:true,kind:'aside-page-cdp-emulation',measured};
      }catch(error){return {supported:true,applied:false,kind:'aside-page-cdp-emulation',error:error.name+':'+error.message}}
    `, { allowError: true, timeoutMs: 30_000 });

    const menuSnapshot = await replJson(repl, `
      const snap=await snapshot(page,{interactive:true});
      return {tree:snap.tree};
    `);
    const deployment = await replJson(repl, `
      try{
        await page.bringToFront();
        await page.locator('.deploy').click();
        await page.locator('#app > canvas').waitFor({state:'visible',timeout:30000});
        const waitStarted=Date.now(),stages=[];
        let ready=null,lastStage=null;
        while(Date.now()-waitStarted<${READINESS_TIMEOUT_MS}){
          ready=await page.evaluate(()=>{const canvas=document.querySelector('#app > canvas'),has=name=>performance.getEntriesByName(name).length>0;return {canvas:!!canvas,inert:canvas?.inert??null,marks:{uiStart:has('ironsight-ui-prepare-start'),uiEnd:has('ironsight-ui-prepare-end'),playReady:has('ironsight-play-ready')},prompt:document.querySelector('#hud')?.textContent??null}});
          const stage=ready.canvas&&ready.inert===false&&ready.marks.playReady?'play-ready':ready.marks.uiEnd?'compositor-complete':ready.marks.uiStart?'compositor':ready.canvas?'scene-or-assets':'network-or-scene';
          if(stage!==lastStage){stages.push({stage,elapsedMs:Date.now()-waitStarted});lastStage=stage}
          if(stage==='play-ready')break;
          await sleep(500);
        }
        const elapsedMs=Date.now()-waitStarted;
        const snap=await snapshot(page,{interactive:true});
        const ok=!!ready?.canvas&&ready.inert===false&&ready.marks.playReady;
        return {ok,ready,stages,elapsedMs,timeoutMs:${READINESS_TIMEOUT_MS},diff:snap.diff,error:ok?null:'readiness timeout'};
      }catch(error){return {ok:false,error:error.name+':'+error.message}}
    `, { allowError: true, timeoutMs: READINESS_TIMEOUT_MS + 15_000 });
    facts = await replJson(repl, `
      return await page.evaluate(()=>{
        const canvas=document.querySelector('#app > canvas');
        const gl=canvas?.getContext('webgl2')??canvas?.getContext('webgl')??null;
        window.__ironsightAsideProbe={events:[],generation:(window.__ironsightAsideProbe?.generation??0)+1};
        const push=(event)=>window.__ironsightAsideProbe.events.push({at:performance.now(),...event});
        const remember=event=>{window.__ironsightAsideProbe.lastEvent={kind:event.type,trusted:event.isTrusted,userActive:navigator.userActivation?.isActive??false,focus:document.hasFocus(),visibility:document.visibilityState,targetTag:event.target?.tagName??null,targetId:event.target?.id??null,at:performance.now()};push(window.__ironsightAsideProbe.lastEvent)};
        document.addEventListener('mousedown',remember,true);
        document.addEventListener('click',remember,true);
        document.addEventListener('pointerlockchange',()=>push({kind:'pointerlockchange',locked:document.pointerLockElement===canvas}));
        document.addEventListener('pointerlockerror',()=>push({kind:'pointerlockerror'}));
        document.addEventListener('mousemove',event=>{if(event.movementX||event.movementY)push({kind:'mousemove',x:event.movementX,y:event.movementY})});
        document.addEventListener('keydown',event=>push({kind:'keydown',code:event.code,trusted:event.isTrusted}),true);
        const css=[innerWidth,innerHeight],drawingBuffer=gl?[gl.drawingBufferWidth,gl.drawingBufferHeight]:canvas?[canvas.width,canvas.height]:[0,0];
        const debug=gl?.getExtension('WEBGL_debug_renderer_info')??null;
        const rect=canvas?.getBoundingClientRect();
        const hitPoints=[];
        if(canvas&&rect){for(const fx of [.5,.25,.75,.1,.9])for(const fy of [.5,.25,.75,.1,.9]){const x=rect.left+rect.width*fx,y=rect.top+rect.height*fy;if(document.elementFromPoint(x,y)===canvas)hitPoints.push({x,y})}}
        if(canvas&&typeof canvas.requestPointerLock==='function'){
          const nativeRequest=canvas.requestPointerLock.bind(canvas);
          canvas.requestPointerLock=(...args)=>{
            const request={at:performance.now(),event:window.__ironsightAsideProbe.lastEvent??null,isConnected:canvas.isConnected,ownerIsDocument:canvas.ownerDocument===document,contains:document.contains(canvas),argsCount:args.length};
            window.__ironsightAsideProbe.request=request;
            try{const result=nativeRequest(...args);Promise.resolve(result).then(()=>{request.resolved=true},error=>{request.rejected=error.name+':'+error.message});return result}
            catch(error){request.throwError=error.name+':'+error.message;throw error}
          };
        }
        const controlButton=document.querySelector('#deployment-flow .deployment-flow__actions button:not([hidden])');
        return {hasCanvas:!!canvas,canvasInert:canvas?.inert??null,canvasConnected:canvas?.isConnected??false,canvasOwnerIsDocument:canvas?.ownerDocument===document,canvasContained:canvas?document.contains(canvas):false,hitPoints,controlButtonVisible:!!controlButton,pointerLockSupported:!!canvas&&typeof canvas.requestPointerLock==='function',topIsSelf:top===self,frameElement:frameElement?.tagName??null,sandbox:document.documentElement.getAttribute('sandbox'),secure:isSecureContext,focus:document.hasFocus(),visibility:document.visibilityState,userActivation:{active:navigator.userActivation?.isActive??false,ever:navigator.userActivation?.hasBeenActive??false},css,drawingBuffer,renderScale:css[0]>0&&css[1]>0?[drawingBuffer[0]/css[0],drawingBuffer[1]/css[1]]:null,dpr:devicePixelRatio,screen:[screen.width,screen.height],renderer:gl?gl.getParameter(gl.RENDERER):null,unmaskedRenderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null,userAgent:navigator.userAgent,appProbe:typeof window.__ironsightQa==='object'};
      });
    `);
    if (deployment.ok && facts.hasCanvas && (facts.controlButtonVisible || facts.hitPoints.length > 0)) {
      const acquisition = facts.controlButtonVisible
        ? `await page.locator('#deployment-flow .deployment-flow__actions button:not([hidden])').click()`
        : `await page.mouse.click(${facts.hitPoints[0]?.x ?? 0},${facts.hitPoints[0]?.y ?? 0})`;
      input = await replJson(repl, `
        await page.bringToFront();
        ${acquisition};
        await sleep(250);
        return await page.evaluate(()=>({acquisitionSurface:${facts.controlButtonVisible ? "'control-button'" : "'canvas'"},locked:!!document.pointerLockElement,lockTag:document.pointerLockElement?.tagName??null,request:window.__ironsightAsideProbe.request??null,events:window.__ironsightAsideProbe.events,activation:{active:navigator.userActivation?.isActive??false,ever:navigator.userActivation?.hasBeenActive??false},app:window.__ironsightQa?.read?.()??null}));
      `, { allowError: true, timeoutMs: 30_000 });
    }

    let sustained = null;
    if (input?.locked) {
      sustained = await replJson(repl, `
        const sample=async label=>({label,at:Date.now(),locked:!!(await page.evaluate(()=>document.pointerLockElement)),app:await page.evaluate(()=>window.__ironsightQa?.read?.()??null)});
        const timeline=[await sample('t0')];
        await page.mouse.move(500,300);await page.keyboard.down('KeyW');await page.keyboard.up('KeyW');await page.mouse.down();await page.mouse.up();await page.keyboard.press('KeyR');
        await sleep(10000);timeline.push(await sample('t10'));await page.mouse.move(600,350);await sleep(10000);timeline.push(await sample('t20'));
        await page.keyboard.press('Escape');const afterEscape=await sample('escape');
        await page.locator('#app > canvas').click({position:{x:100,y:100}});const afterResume=await sample('resume');
        return {timeline,afterEscape,afterResume,events:await page.evaluate(()=>window.__ironsightAsideProbe.events),telemetry:await page.evaluate(()=>window.__ironsightQa?.drainTelemetry?.()??null),telemetryCsv:await page.evaluate(()=>window.__ironsightQa?.telemetryCsv?.()??null)};
      `, { timeoutMs: 30_000 });
    }

    const capture = await replJson(repl, `
      try{const image=await annotatedScreenshot(page);const bytes=Buffer.from(image.base64Image,'base64');await fs.mkdir('./artifacts',{recursive:true});await fs.writeFile('./artifacts/perf-input-annotated.png',bytes);return {ok:true,bytes:bytes.length,pixels:bytes.length>=24?[bytes.readUInt32BE(16),bytes.readUInt32BE(20)]:null}}catch(error){return {ok:false,error:error.name+':'+error.message}}
    `, { allowError: true, timeoutMs: 40_000 });
    if (capture.ok) await copySessionArtifact('perf-input-annotated.png', 'screenshots/perf-input-annotated.png');

    const pointerLock = pointerLockCapability(facts, input);
    const capabilities = classifyCapabilities({
      session: { persistent: true, alive: true },
      pointerLock: { ...pointerLock, acquired: sustained?.timeline?.every(item => item.locked) ?? false },
      viewport: { requested: viewport, css: facts.css, drawingBuffer: facts.drawingBuffer },
      capture: { annotatedScreenshot: capture.ok, rawScreenshot: false },
    });
    const sessionReasons = [];
    if (!ownership.ownedTargetId) sessionReasons.push(reason('owned_target_ambiguous'));
    const lockReasons = capabilities.reasons.filter(item => item.code === 'pointer_lock_unavailable');
    if (!deployment.ok) lockReasons.push(reason('deployment_not_ready', deployment.error));
    const actionReasons = [];
    if (!sustained) actionReasons.push(reason('pointer_lock_required'));
    if (!facts.appProbe) actionReasons.push(reason('app_probe_unavailable'));
    const telemetry = sustained?.telemetry;
    if (telemetry) actionReasons.push(...validateStages(context.inputStages, telemetry).issues);
    const cases = [
      { id: definition.cases[0], verdict: sessionReasons.length ? VERDICT.FAIL : VERDICT.PASS, reasons: sessionReasons, observations: ownership, artifacts: [] },
      { id: definition.cases[1], verdict: lockReasons.length ? VERDICT.UNQUALIFIED : VERDICT.PASS, reasons: lockReasons, observations: sustained?.timeline ?? input, artifacts: [] },
      { id: definition.cases[2], verdict: actionReasons.length ? VERDICT.UNQUALIFIED : VERDICT.PASS, reasons: actionReasons, observations: sustained, artifacts: [] },
      { id: definition.cases[3], verdict: capabilities.reasons.length ? VERDICT.PASS : VERDICT.UNQUALIFIED, reasons: capabilities.reasons.length ? [] : [reason('failure_branch_not_exercised')], observations: capabilities, artifacts: [] },
    ];
    return { cases, inputProvenance: pointerLock.trusted ? 'Aside trusted locator/mouse/keyboard APIs' : 'none', observations: { startedAt, fetchRecovery, viewportControl, menuSnapshot, deployment, facts, input, sustained, capabilities, capture } };
  } finally {
    if (opened) closeReceipt = await closeOwnedTab(repl);
    context.recordCleanup({ opened, ownedTargetId: ownership?.ownedTargetId ?? null, closeReceipt });
    if (opened && closeReceipt.fetchDisabled !== true) throw new Error(`Fetch cleanup failed: ${closeReceipt.fetchError ?? 'no confirmation'}`);
  }
}

export function classifyLatencyTelemetry(definition, telemetry) {
  const unavailable = code => ({ code, detail: null });
  const actual = telemetry?.metrics?.actual;
  const actualReasons = [];
  if (!telemetry) actualReasons.push(unavailable('telemetry_unavailable'));
  else {
    if (telemetry?.hud?.status !== 'ready') actualReasons.push(unavailable('trusted_input_unavailable'));
    if ((actual?.validShots ?? 0) < 100) actualReasons.push({ code: 'insufficient_valid_samples', detail: `${actual?.validShots ?? 0}/100` });
    if ((actual?.validAdsTransitions ?? 0) < 100) actualReasons.push({ code: 'insufficient_ads_samples', detail: `${actual?.validAdsTransitions ?? 0}/100` });
    const requiredPairs = ['predictedMs', 'rttMs', 'serverResolveMs', 'audioScheduleMs'];
    const missingPairs = requiredPairs.filter(key => (actual?.[key]?.count ?? 0) < (actual?.validShots ?? 0));
    if ((actual?.confirmationMs?.count ?? 0) < 1) missingPairs.push('confirmationMs');
    if (missingPairs.length) actualReasons.push({ code: 'missing_stage_samples', detail: missingPairs.join(',') });
  }
  const staleReasons = telemetry?.counts?.stale > 0 && telemetry?.counts?.invalid > 0
    ? [] : [unavailable('stale_missing_injection_unproven')];
  const mixedReasons = telemetry?.clockPairs?.crossClockSubtraction === false
    ? [] : [unavailable('clock_domain_separation_unproven')];
  const lateReasons = telemetry?.rejectedConfirmations?.actual > 0
    ? [] : [unavailable('late_confirmation_injection_unproven')];
  const result = (id, reasons, observations) => ({
    id,
    verdict: reasons.length ? VERDICT.UNQUALIFIED : VERDICT.PASS,
    reasons,
    observations,
    artifacts: [],
  });
  return [
    result(definition.cases[0], actualReasons, { metrics: actual ?? null, hud: telemetry?.hud ?? null }),
    result(definition.cases[1], staleReasons, telemetry?.counts ?? null),
    result(definition.cases[2], mixedReasons, telemetry?.clockPairs ?? null),
    result(definition.cases[3], lateReasons, telemetry?.rejectedConfirmations ?? null),
  ];
}

async function runPerfInputLatency(context) {
  const base = await runPerfInput(context);
  const telemetry = base.observations?.sustained?.telemetry ?? null;
  const telemetryCsv = base.observations?.sustained?.telemetryCsv ?? null;
  const artifacts = [];
  if (telemetry) artifacts.push(await context.writeArtifact('combat-telemetry.json', telemetry));
  if (telemetryCsv) artifacts.push(await context.writeArtifact('combat-telemetry.csv', telemetryCsv));
  const cases = classifyLatencyTelemetry(context.definition, telemetry);
  cases[0].artifacts = artifacts;
  return {
    cases,
    inputProvenance: telemetry?.inputProvenance?.actualRequires
      ? 'Aside trusted input with in-app isTrusted provenance'
      : 'none',
    observations: { perfInput: base.observations, telemetry },
  };
}

const missingRun = (id, detail) => ({
  id, verdict: VERDICT.UNQUALIFIED, reasons: [reason('actual_run_missing', detail)],
  observations: null, artifacts: [],
});

const HASH = /^[0-9a-f]{64}$/;
const HEAD = /^[0-9a-f]{40}$/;
const integer = value => Number.isSafeInteger(value) && value >= 0;
const loopbackOrigin = value => {
  try { const url = new URL(value); return ['localhost', '127.0.0.1', '::1'].includes(url.hostname) ? url.origin : null; }
  catch { return null; }
};

function inspectCapacityRun(run, expectedScenario, expectedSourceManifestSha256, now, logArtifact, sourceManifestVerification) {
  const invalid = code => ({ boundaryValid: false, failures: [code], checks: null });
  if (!run || typeof run !== 'object') return invalid('actual_run_missing');
  if (run.schemaVersion !== 2 || run.runKind !== 'live' || !expectedSourceManifestSha256) return invalid('untrusted_report_boundary');
  const identity = run.runIdentity, runtime = run.serverRuntime, origin = loopbackOrigin(run.target?.origin);
  if (!identity || typeof identity !== 'object' || typeof identity.runId !== 'string' || identity.runId.length < 16
    || identity.evidenceKind !== 'actual-loopback-websocket' || !HEAD.test(identity.sourceHead)
    || !HASH.test(identity.sourceManifestSha256) || identity.sourceManifestSha256 !== expectedSourceManifestSha256
    || identity.origin !== origin || run.target?.loopback !== true || run.target?.sharedDeployment !== false
    || run.scenario !== expectedScenario) return invalid('run_identity_mismatch');
  const source = run.source, preflight = source?.preflight, postflight = source?.postflight;
  if (!sourceManifestVerification || !source || source.manifestSha256 !== identity.sourceManifestSha256
    || source.stageRoot !== sourceManifestVerification.stageRoot || source.fileCount !== sourceManifestVerification.fileCount
    || preflight?.stageRoot !== sourceManifestVerification.stageRoot || postflight?.stageRoot !== sourceManifestVerification.stageRoot
    || preflight?.fileCount !== sourceManifestVerification.fileCount || postflight?.fileCount !== sourceManifestVerification.fileCount
    || !Array.isArray(preflight?.mismatches) || preflight.mismatches.length !== 0
    || !Array.isArray(postflight?.mismatches) || postflight.mismatches.length !== 0) return invalid('source_files_unverified');
  const started = Date.parse(identity.startedAt), finished = Date.parse(identity.finishedAt);
  if (!Number.isFinite(started) || !Number.isFinite(finished) || finished < started
    || now - finished < 0 || now - finished > 24 * 60 * 60 * 1000
    || Math.abs((finished - started) - run.durationMs) > 5_000) return invalid('stale_or_invalid_run_time');
  if (!runtime || runtime.available !== true || runtime.runId !== identity.runId || runtime.origin !== origin
    || runtime.sourceManifestSha256 !== identity.sourceManifestSha256 || !HASH.test(runtime.capturedSha256)
    || typeof runtime.logArtifact !== 'string' || !HASH.test(runtime.logArtifactSha256)
    || !integer(runtime.captureStartByte) || !integer(runtime.captureEndByte) || !integer(runtime.capturedBytes)
    || runtime.captureEndByte - runtime.captureStartByte !== runtime.capturedBytes || runtime.capturedBytes === 0
    || runtime.startupReady !== true || runtime.healthReady !== true || !integer(runtime.matchmakeRequests)
    || !integer(runtime.websocketUpgrades) || !integer(runtime.simulationBacklogWarnings)) return invalid('server_log_identity_mismatch');
  if (!Buffer.isBuffer(logArtifact) || logArtifact.length !== runtime.captureEndByte
    || createHash('sha256').update(logArtifact).digest('hex') !== runtime.logArtifactSha256) return invalid('server_log_artifact_missing');
  const duringLog = logArtifact.subarray(runtime.captureStartByte, runtime.captureEndByte);
  if (duringLog.length !== runtime.capturedBytes || createHash('sha256').update(duringLog).digest('hex') !== runtime.capturedSha256) return invalid('server_log_content_mismatch');
  const recomputedLog = classifyServerLog({ before: logArtifact.subarray(0, runtime.captureStartByte).toString('utf8'),
    during: duringLog.toString('utf8'), expectedOrigin: origin, expectedRequests: run.requestedClients });
  if (!recomputedLog.available || recomputedLog.startupReady !== runtime.startupReady
    || recomputedLog.healthReady !== runtime.healthReady || recomputedLog.matchmakeRequests !== runtime.matchmakeRequests
    || recomputedLog.websocketUpgrades !== runtime.websocketUpgrades
    || recomputedLog.simulationBacklogWarnings !== runtime.simulationBacklogWarnings) return invalid('server_log_records_mismatch');
  if (!Array.isArray(run.perSocket) || run.perSocket.length === 0 || run.actualSockets !== run.perSocket.length) return invalid('raw_socket_records_missing');
  const records = run.perSocket;
  const validRecord = record => record && typeof record === 'object' && integer(record.index)
    && ['initial', 'reconnect'].includes(record.connectionKind) && typeof record.session === 'string'
    && integer(record.openedAt) && (record.joinedAt === null || integer(record.joinedAt))
    && integer(record.closedAt) && integer(record.closeCode) && integer(record.finalBufferedBytes)
    && record.sent && ['move', 'fire', 'reload', 'objective', 'stats', 'time'].every(key => integer(record.sent[key]))
    && record.stateFrames && ['received', 'applied', 'dropped', 'reordered'].every(key => integer(record.stateFrames[key]))
    && Array.isArray(record.errors) && record.errors.every(value => typeof value === 'string')
    && Array.isArray(record.peerLeftAt) && record.peerLeftAt.every(integer) && Array.isArray(record.perfSnapshots);
  if (!records.every(validRecord)) return invalid('invalid_raw_socket_record');
  const initial = records.filter(record => record.connectionKind === 'initial');
  const reconnects = records.filter(record => record.connectionKind === 'reconnect');
  const events = records.flatMap(record => [{ at: record.openedAt, delta: 1 }, { at: record.closedAt, delta: -1 }])
    .sort((left, right) => left.at - right.at || right.delta - left.delta);
  let concurrent = 0, peak = 0; for (const event of events) { concurrent += event.delta; peak = Math.max(peak, concurrent); }
  const joined = records.filter(record => record.joinedAt !== null).length;
  const closed = records.filter(record => record.closedAt !== null).length;
  const normalizedRecords = records.map(record => ({ ...record, perfSnapshots: record.perfSnapshots.map(readPerfSnapshot) }));
  if (normalizedRecords.some(record => record.perfSnapshots.some(snapshot => snapshot === null))) return invalid('invalid_stats_snapshot');
  const stats = aggregatePerfSnapshots(normalizedRecords), drops = stats?.drops;
  const dropKeys = ['rateLimited', 'staleSeq', 'oversizedBatch', 'unknownType', 'relayRateLimited', 'relayOversized', 'relayBadTarget'];
  if (run.requestedClients !== initial.length || run.joined !== joined || run.closed !== closed
    || run.peakConcurrentSockets !== peak || !stats || !drops || !dropKeys.every(key => integer(drops[key]))) return invalid('derived_values_mismatch');
  if (JSON.stringify(run.aggregate?.server) !== JSON.stringify(stats)) return invalid('server_stats_missing_or_contradictory');
  const statsCoverage = evaluateStatsCoverage(stats, run.measurement);
  if (JSON.stringify(run.aggregate?.statsCoverage) !== JSON.stringify(statsCoverage)) return invalid('stats_coverage_contradictory');
  const serverDrops = dropKeys.reduce((sum, key) => sum + drops[key], 0);
  if (run.aggregate.serverDrops !== serverDrops || run.aggregate.serverErrors !== stats.errors
    || run.aggregate.clientErrors !== records.reduce((sum, record) => sum + record.errors.length, 0)
    || runtime.matchmakeRequests < initial.length || runtime.websocketUpgrades < initial.length) return invalid('derived_values_mismatch');
  const checks = { ...scenarioChecks({ scenario: expectedScenario, seconds: identity.requestedDurationSeconds,
    clients: run.requestedClients, stateReorderRate: run.impairment?.reorderRate ?? 0 }, records, joined, stats, run.measurement),
    noSimulationBacklog: runtime.simulationBacklogWarnings === 0 };
  return { boundaryValid: true, failures: Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name), checks };
}

export function classifyNetworkCapacity(definition, runs, evidence = {}) {
  const now = evidence.now ?? Date.now(), sourceHash = evidence.sourceManifestSha256;
  const classify = (id, run, scenario) => {
    const inspection = inspectCapacityRun(run, scenario, sourceHash, now, evidence.logArtifacts?.[scenario], evidence.sourceManifestVerification);
    if (!inspection.boundaryValid) return { ...missingRun(id, inspection.failures.join(',')), observations: run ?? null };
    return { id, verdict: inspection.failures.length ? VERDICT.FAIL : VERDICT.PASS,
      reasons: inspection.failures.map(check => reason('capacity_check_failed', check)), observations: run, artifacts: [] };
  };
  const reconnect = classify(definition.cases[3], runs?.disconnect, 'disconnect');
  if (reconnect.verdict === VERDICT.PASS) {
    const expiry = inspectCapacityRun(runs?.expiry, 'expiry', sourceHash, now, evidence.logArtifacts?.expiry, evidence.sourceManifestVerification);
    if (!expiry.boundaryValid) { reconnect.verdict = VERDICT.UNQUALIFIED; reconnect.reasons.push(reason('actual_run_missing', expiry.failures.join(','))); }
    else if (expiry.failures.length) { reconnect.verdict = VERDICT.FAIL; reconnect.reasons.push(...expiry.failures.map(check => reason('capacity_check_failed', `expiry:${check}`))); }
    else reconnect.observations = { disconnect: runs.disconnect, expiry: runs.expiry };
  }
  return [
    classify(definition.cases[0], runs?.normal, 'normal'),
    classify(definition.cases[1], runs?.impairment, 'impairment'),
    classify(definition.cases[2], runs?.roomCap, 'room-cap'),
    reconnect,
  ];
}

async function optionalJson(filePath) {
  try { return JSON.parse(await readFile(filePath, 'utf8')); }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

async function runPerfNetwork(context) {
  const names = { normal: 'capacity-normal.json', impairment: 'capacity-impairment.json',
    roomCap: 'capacity-room-cap.json', disconnect: 'capacity-disconnect.json', expiry: 'capacity-expiry.json' };
  const runs = {};
  for (const [key, name] of Object.entries(names)) runs[key] = await optionalJson(path.join(context.outputDir, name));
  let sourceManifestSha256 = null, sourceManifestVerification = null;
  try {
    const manifestBytes = await readFile(path.join(context.outputDir, 'server-stage-manifest.json'));
    const manifest = JSON.parse(manifestBytes.toString('utf8'));
    if (manifest?.schemaVersion === 2 && HEAD.test(manifest.head) && Array.isArray(manifest.files)
      && manifest.files.length > 0 && manifest.files.every(file => typeof file?.path === 'string' && HASH.test(file.sha256))) {
      sourceManifestSha256 = createHash('sha256').update(manifestBytes).digest('hex');
      try { sourceManifestVerification = await verifyManifestFiles(manifest); } catch { sourceManifestVerification = null; }
    }
  }
  catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
  const logArtifacts = {};
  for (const [key, run] of Object.entries(runs)) {
    if (!run?.serverRuntime?.logArtifact || path.basename(run.serverRuntime.logArtifact) !== run.serverRuntime.logArtifact) continue;
    try { logArtifacts[run.scenario] = await readFile(path.join(context.outputDir, run.serverRuntime.logArtifact)); }
    catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
  }
  return { cases: classifyNetworkCapacity(context.definition, runs, { sourceManifestSha256, sourceManifestVerification, logArtifacts }), inputProvenance: 'real loopback WebSocket CLI reports',
    observations: { runs, sharedDeploymentUsed: false } };
}

async function runPerfTarget(context) {
  const input = await optionalJson(path.join(context.outputDir, 'target-device-input.json'));
  const summary = evaluateTargetDeviceReport(input);
  const refusal = evaluateTargetDeviceReport({ schemaVersion: 1, scenario: 'perf-target' });
  const artifact = await context.writeArtifact('target-device-summary.json', summary);
  const select = (id, entry) => ({ id, verdict: entry?.verdict ?? VERDICT.UNQUALIFIED,
    reasons: entry?.reasons ?? [reason('target_evidence_missing')], observations: entry?.observations ?? null,
    artifacts: [artifact] });
  return { cases: [
    select(context.definition.cases[0], summary.columns.targetDevice),
    select(context.definition.cases[1], summary.columns.renderScale),
    select(context.definition.cases[2], summary.columns.warm),
    select(context.definition.cases[3], summary.columns.thermal),
    { id: context.definition.cases[4], verdict: refusal.verdict === VERDICT.UNQUALIFIED ? VERDICT.PASS : VERDICT.FAIL,
      reasons: refusal.verdict === VERDICT.UNQUALIFIED ? [] : [reason('missing_hardware_refusal_failed')],
      observations: refusal, artifacts: [artifact] },
  ], inputProvenance: 'target-device manifest plus Aside measurements', observations: { input, summary, refusal } };
}

export const scenarioHandlers = Object.freeze({
  'perf-input': runPerfInput,
  'perf-input-latency': runPerfInputLatency,
  'perf-render': context => runPerfRender(context, { replJson, recoverStaleFetchInterception, closeOwnedTab }),
  'perf-network': runPerfNetwork,
  'perf-target': runPerfTarget,
});
