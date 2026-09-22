import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { VERDICT } from '../aside-common.mjs';
import { inspectFloat32Wav } from '../wav-encode.mjs';
import {
  READINESS_TIMEOUT_MS,
  closeOwnedTab,
  recoverStaleFetchInterception,
  replJson,
} from './performance.mjs';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const workletPath = path.resolve(scriptsDir, '..', 'audio-pcm-worklet.mjs');

function reason(code, detail = null) {
  return { code, detail };
}

async function runAudioLifecycle(context) {
  const { definition, repl, url, outputDir, copySessionArtifact } = context;
  const source = await readFile(workletPath, 'utf8');
  if (source.length === 0) throw new Error('audio capture worklet source is empty');
  const sourceSha256 = createHash('sha256').update(source).digest('hex');
  let opened = false, ownedTargetId = null, closeReceipt = null;
  let recovery = null, readiness = null, gesture = null, capture = null, mute = null, missing = null;
  const artifacts = [];
  try {
    const before = await replJson(repl, `return (await listBrowserTabs()).map(({targetId})=>targetId);`);
    const openedTab = await replJson(repl, `
      await openTab('about:blank');
      return (await listBrowserTabs()).map(({targetId})=>targetId);
    `);
    opened = true;
    const owned = openedTab.filter(targetId => !before.includes(targetId));
    ownedTargetId = owned.length === 1 ? owned[0] : null;
    recovery = await recoverStaleFetchInterception(repl);
    if (!recovery.disabled) throw new Error(`Fetch recovery failed: ${recovery.errors.join('; ')}`);
    await replJson(repl, `
      await page.goto(${JSON.stringify(url)});
      await page.evaluate(()=>{window.__qaAudioGestures=[];document.addEventListener('pointerdown',event=>window.__qaAudioGestures.push({trusted:event.isTrusted,at:performance.now()}),true)});
      return {url:page.url(),title:await page.title()};
    `);
    readiness = await replJson(repl, `
      await page.bringToFront();
      const started=Date.now();
      await page.locator('.deploy').click();
      let sample=null;
      while(Date.now()-started<${READINESS_TIMEOUT_MS}){
        sample=await page.evaluate(()=>({canvas:!!document.querySelector('#app > canvas'),inert:document.querySelector('#app > canvas')?.inert??null,playReady:performance.getEntriesByName('ironsight-play-ready').length>0,audio:window.__ironsightAudioCapture?.inspect?.()??null}));
        if(sample.canvas&&sample.inert===false&&sample.playReady&&sample.audio?.lifecycle?.state==='running')break;
        await sleep(500);
      }
      return {elapsedMs:Date.now()-started,timeoutMs:${READINESS_TIMEOUT_MS},sample,gestures:await page.evaluate(()=>window.__qaAudioGestures)};
    `, { timeoutMs: READINESS_TIMEOUT_MS + 15_000, allowError: true });
    gesture = {
      trusted: readiness.gestures?.some(item => item.trusted) ?? false,
      running: readiness.sample?.audio?.lifecycle?.state === 'running',
      ready: readiness.sample?.playReady === true && readiness.sample?.inert === false,
    };
    if (gesture.running && gesture.ready) {
      capture = await replJson(repl, `
        try{
        const started=await page.evaluate(async options=>window.__ironsightAudioCapture.start(options),${JSON.stringify({ source, sourceSha256, maxSeconds: 10 })});
        await sleep(500);
        await page.locator('#app > canvas').click({position:{x:120,y:120}});
        const locked=await page.evaluate(()=>document.pointerLockElement===document.querySelector('#app > canvas'));
        let input={locked,shots:[]};
        if(locked){
          await page.evaluate(()=>{window.__qaAudioShots=[];let last='';window.__qaAudioShotTimer=setInterval(()=>{const value=window.ironsight?.combatEventInfo?.(),key=JSON.stringify(value);if(key!==last){window.__qaAudioShots.push({at:performance.now(),...value});last=key}},10)});
          await page.mouse.down();await page.mouse.up();await sleep(300);await page.mouse.down();await sleep(450);await page.mouse.up();await sleep(300);
          input=await page.evaluate(()=>{clearInterval(window.__qaAudioShotTimer);return {locked:!!document.pointerLockElement,shots:window.__qaAudioShots}});
        }else await sleep(1050);
        const pending=page.waitForEvent('download',{timeout:10000}).then(download=>({download}),error=>({error:error.name+':'+error.message}));
        await page.locator('#qa-audio-export').click();
        let inspected=null;
        const exportStarted=Date.now();
        while(Date.now()-exportStarted<5000){
          inspected=await page.evaluate(()=>window.__ironsightAudioCapture.inspect());
          if(!inspected.recording)break;
          await sleep(100);
        }
        const downloadResult=await pending;
        if(!downloadResult.download)return {started,input,inspected,downloadError:downloadResult.error};
        const downloadPath=await downloadResult.download.path();
        await fs.mkdir('./artifacts',{recursive:true});
        await fs.copyFile(downloadPath,'./artifacts/live-mix.wav');
        inspected=await page.evaluate(()=>window.__ironsightAudioCapture.inspect());
        return {started,input,downloadPath,inspected};
        }catch(error){return {error:error.name+':'+error.message}}
      `, { timeoutMs: 30_000, allowError: true });
      if (capture.downloadPath) {
        const artifact = await copySessionArtifact('live-mix.wav', 'live-mix.wav');
        const localPath = path.join(outputDir, 'live-mix.wav');
        const bytes = await readFile(localPath);
        const wav = inspectFloat32Wav(bytes);
        artifacts.push({ ...artifact, sha256: createHash('sha256').update(bytes).digest('hex') });
        capture.wav = wav;
      }
      mute = await replJson(repl, `
        const before=await page.evaluate(()=>window.__ironsightAudioCapture.inspect().lifecycle.muted);
        await page.keyboard.press('KeyM');
        const toggled=await page.evaluate(()=>window.__ironsightAudioCapture.inspect().lifecycle.muted);
        await page.keyboard.press('KeyM');
        const restored=await page.evaluate(()=>window.__ironsightAudioCapture.inspect().lifecycle.muted);
        return {before,toggled,restored};
      `);
      missing = await replJson(repl, `
        return await page.evaluate(async options=>{try{await window.__ironsightAudioCapture.start(options);return {rejected:false}}catch(error){return {rejected:true,error:error.name+':'+error.message}}},${JSON.stringify({ source, sourceSha256: '0'.repeat(64), maxSeconds: 1 })});
      `, { allowError: true });
    }
    const gestureReasons = [];
    if (!gesture.trusted) gestureReasons.push(reason('trusted_gesture_missing'));
    if (!gesture.running) gestureReasons.push(reason('context_not_running'));
    if (!gesture.ready) gestureReasons.push(reason('play_not_ready', `elapsed ${readiness.elapsedMs}ms`));
    const captureReasons = [];
    if (!capture?.wav || artifacts.length === 0) {
      captureReasons.push(reason('live_capture_unavailable', capture?.inspected?.error ?? capture?.downloadError ?? capture?.error ?? null));
    }
    if (capture?.wav && (capture.wav.nonFinite > 0 || capture.wav.clipped > 0 || capture.wav.peak > .98 || capture.wav.frameCount === 0)) {
      captureReasons.push(reason('invalid_pcm', capture.wav));
    }
    const attempts = capture?.input?.shots?.map(item => item.attempt?.shotId).filter(Boolean) ?? [];
    const receipts = capture?.input?.shots?.map(item => item.result?.shotId).filter(Boolean) ?? [];
    if (!capture?.input?.locked || new Set(attempts).size < 2 || !attempts.every(shotId => receipts.includes(shotId))) {
      captureReasons.push(reason('combat_input_unavailable', 'live graph smoke captured; continuous and single-fire shotId proof requires actual pointer-lock input and matching receipts'));
    }
    const muteReasons = mute && mute.toggled !== mute.before && mute.restored === mute.before ? [] : [reason('mute_restore_unproven')];
    const hiddenReasons = [reason('hidden_lifecycle_unproven', 'no supported owned-tab background control in this run')];
    const missingReasons = missing?.rejected ? [] : [reason('missing_capture_not_rejected')];
    return {
      cases: [
        { id: definition.cases[0], verdict: gestureReasons.length ? VERDICT.UNQUALIFIED : VERDICT.PASS, reasons: gestureReasons, observations: { gesture, readiness }, artifacts: [] },
        { id: definition.cases[1], verdict: captureReasons.length ? VERDICT.UNQUALIFIED : VERDICT.PASS, reasons: captureReasons, observations: capture, artifacts },
        { id: definition.cases[2], verdict: muteReasons.length ? VERDICT.FAIL : VERDICT.PASS, reasons: muteReasons, observations: mute, artifacts: [] },
        { id: definition.cases[3], verdict: VERDICT.UNQUALIFIED, reasons: hiddenReasons, observations: capture?.inspected ?? null, artifacts: [] },
        { id: definition.cases[4], verdict: missingReasons.length ? VERDICT.FAIL : VERDICT.PASS, reasons: missingReasons, observations: missing, artifacts: [] },
      ],
      inputProvenance: 'Aside trusted deploy, keyboard, and export-button input; live game AudioContext final bus',
      observations: { sourceSha256, recovery, readiness, gesture, capture, mute, missing },
    };
  } finally {
    if (opened) closeReceipt = await closeOwnedTab(repl);
    context.recordCleanup({ opened, ownedTargetId, fetchRecovery: recovery, closeReceipt });
    if (opened && closeReceipt.fetchDisabled !== true) throw new Error(`Fetch cleanup failed: ${closeReceipt.fetchError ?? 'no confirmation'}`);
  }
}

async function runAudioCombat(context) {
  const { definition, repl, url, outputDir, copySessionArtifact } = context;
  const source = await readFile(workletPath, 'utf8');
  if (source.length === 0) throw new Error('audio capture worklet source is empty');
  const sourceSha256 = createHash('sha256').update(source).digest('hex');
  let opened = false, ownedTargetId = null, recovery = null, closeReceipt = null;
  let readiness = null, capture = null;
  const artifacts = [];
  try {
    const before = await replJson(repl, `return (await listBrowserTabs()).map(({targetId})=>targetId);`);
    const openedTab = await replJson(repl, `await openTab('about:blank');return (await listBrowserTabs()).map(({targetId})=>targetId);`);
    opened = true;
    const owned = openedTab.filter(targetId => !before.includes(targetId));
    ownedTargetId = owned.length === 1 ? owned[0] : null;
    recovery = await recoverStaleFetchInterception(repl);
    if (!recovery.disabled) throw new Error(`Fetch recovery failed: ${recovery.errors.join('; ')}`);
    await replJson(repl, `await page.goto(${JSON.stringify(url)});return page.url();`);
    readiness = await replJson(repl, `
      await page.bringToFront();await page.locator('.deploy').click();const started=Date.now();let sample=null;
      while(Date.now()-started<${READINESS_TIMEOUT_MS}){sample=await page.evaluate(()=>({canvas:!!document.querySelector('#app > canvas'),inert:document.querySelector('#app > canvas')?.inert??null,playReady:performance.getEntriesByName('ironsight-play-ready').length>0,audio:window.__ironsightAudioCapture?.inspect?.()??null,probe:typeof window.ironsight?.audioProbe==='function'}));if(sample.canvas&&sample.inert===false&&sample.playReady&&sample.audio?.lifecycle?.state==='running'&&sample.probe)break;await sleep(500)}
      return {elapsedMs:Date.now()-started,sample};
    `, { timeoutMs: READINESS_TIMEOUT_MS + 15_000, allowError: true });
    if (readiness.sample?.audio?.lifecycle?.state === 'running' && readiness.sample?.probe) {
      capture = await replJson(repl, `
        try{
          const started=await page.evaluate(async options=>window.__ironsightAudioCapture.start(options),${JSON.stringify({ source, sourceSha256, maxSeconds: 10 })});
          await page.locator('#app > canvas').click({position:{x:120,y:120}});const locked=await page.evaluate(()=>!!document.pointerLockElement);
          if(locked){await page.mouse.down();await page.mouse.up();await sleep(450)}
          const combat=await page.evaluate(()=>({event:window.ironsight.combatEventInfo(),feedback:window.ironsight.shotFeedbackInfo()}));
          const probe=await page.evaluate(()=>window.ironsight.audioProbe());
          const pending=page.waitForEvent('download',{timeout:10000}).then(download=>({download}),error=>({error:error.name+':'+error.message}));
          await page.locator('#qa-audio-export').click();const downloadResult=await pending;
          const inspected=await page.evaluate(()=>window.__ironsightAudioCapture.inspect());
          if(!downloadResult.download)return {started,locked,combat,probe,inspected,downloadError:downloadResult.error};
          const downloadPath=await downloadResult.download.path();await fs.mkdir('./artifacts',{recursive:true});await fs.copyFile(downloadPath,'./artifacts/live-mix.wav');
          return {started,locked,combat,probe,inspected,downloadPath};
        }catch(error){return {error:error.name+':'+error.message}}
      `, { timeoutMs: 30_000, allowError: true });
      if (capture.downloadPath) {
        const artifact = await copySessionArtifact('live-mix.wav', 'live-mix-combat.wav');
        const bytes = await readFile(path.join(outputDir, 'live-mix-combat.wav'));
        capture.wav = inspectFloat32Wav(bytes);
        artifacts.push({ ...artifact, sha256: createHash('sha256').update(bytes).digest('hex') });
      }
    }
    const weaponMixes = capture?.probe?.weaponMixes ?? [];
    const validWav = capture?.wav && capture.wav.frameCount > 0 && capture.wav.peak > 1e-5
      && capture.wav.peak <= .98 && capture.wav.nonFinite === 0 && capture.wav.clipped === 0;
    const weaponReasons = weaponMixes.length === 15 && weaponMixes.every(item => item.played && item.mix) && validWav
      ? [] : [reason('weapon_distance_capture_incomplete', { count: weaponMixes.length, wav: capture?.wav ?? null })];
    const surfaces = new Set((capture?.probe?.surfaceAuditions ?? []).map(item => item.surface));
    const surfaceReasons = surfaces.size === 5 && capture?.probe?.geometryMixes?.length === 4
      ? [] : [reason('surface_or_occlusion_probe_incomplete', { surfaces: [...surfaces], geometry: capture?.probe?.geometryMixes ?? [] })];
    const denseReasons = capture?.probe?.ordinaryPeak === 16 && capture?.probe?.threatPeak === 20 && capture?.probe?.drained === 0
      ? [] : [reason('voice_budget_or_drain_failed', capture?.probe ?? null)];
    const shotId = capture?.combat?.event?.attempt?.shotId;
    const dedupReasons = capture?.locked && shotId && capture?.combat?.event?.result?.shotId === shotId
      ? [] : [reason('authoritative_shot_timeline_unavailable', capture?.combat ?? null)];
    return {
      cases: [
        { id: definition.cases[0], verdict: weaponReasons.length ? VERDICT.FAIL : VERDICT.PASS, reasons: weaponReasons, observations: { weaponMixes, wav: capture?.wav ?? null }, artifacts },
        { id: definition.cases[1], verdict: surfaceReasons.length ? VERDICT.FAIL : VERDICT.PASS, reasons: surfaceReasons, observations: { surfaces: [...surfaces], geometryMixes: capture?.probe?.geometryMixes ?? [] }, artifacts: [] },
        { id: definition.cases[2], verdict: denseReasons.length ? VERDICT.FAIL : VERDICT.PASS, reasons: denseReasons, observations: capture?.probe ?? null, artifacts: [] },
        { id: definition.cases[3], verdict: dedupReasons.length ? VERDICT.UNQUALIFIED : VERDICT.PASS, reasons: dedupReasons, observations: capture?.combat ?? null, artifacts: [] },
      ],
      inputProvenance: 'Aside trusted deploy/canvas/fire input plus live game AudioContext final-bus capture',
      observations: { sourceSha256, readiness, capture },
    };
  } finally {
    if (opened) closeReceipt = await closeOwnedTab(repl);
    context.recordCleanup({ opened, ownedTargetId, fetchRecovery: recovery, closeReceipt });
    if (opened && closeReceipt.fetchDisabled !== true) throw new Error(`Fetch cleanup failed: ${closeReceipt.fetchError ?? 'no confirmation'}`);
  }
}

export const scenarioHandlers = Object.freeze({
  'perf-audio-lifecycle': runAudioLifecycle,
  'perf-audio-combat': runAudioCombat,
});
