import { VERDICT } from '../aside-common.mjs';
import { READINESS_TIMEOUT_MS, closeOwnedTab, recoverStaleFetchInterception, replJson } from './performance.mjs';

export const WEAPON_ACTION_INSPECTIONS = Object.freeze([
  { weapon: 0, shot: 'automatic-reload-in', action: 'reload', sample: .58 },
  { weapon: 1, shot: 'trench-reload-in', action: 'reload', sample: .58 },
  { weapon: 2, shot: 'shotgun-shell-insert', action: 'reload', sample: .58 },
  { weapon: 2, shot: 'shotgun-pump-cycle', action: 'cycle', sample: .5 },
  { weapon: 3, shot: 'rifle-bolt-lift', action: 'cycle', sample: .1 },
  { weapon: 3, shot: 'rifle-bolt-pull', action: 'cycle', sample: .3 },
  { weapon: 3, shot: 'rifle-bolt-return', action: 'cycle', sample: .65 },
  { weapon: 3, shot: 'rifle-bolt-lock', action: 'cycle', sample: .9 },
  { weapon: 4, shot: 'pistol-magazine-insert', action: 'reload', sample: .58 },
]);
const reason = (code, detail = null) => ({ code, detail });
const result = (id, passed, observations, artifacts, code, unavailable = false) => ({
  id,
  verdict: passed ? VERDICT.PASS : unavailable ? VERDICT.UNQUALIFIED : VERDICT.FAIL,
  reasons: passed ? [] : [reason(code)],
  observations,
  artifacts,
});

export function classifyWeapon(definition, observation) {
  const samples = observation.samples ?? [];
  const artifacts = samples.flatMap(sample => sample.artifact ? [sample.artifact] : []);
  const five = [0, 1, 2, 3, 4].every(index => samples.some(sample => sample.weapon === index && sample.ready));
  const sockets = five && samples.every(sample => sample.report?.framing?.sourceMuzzleError !== null
    && sample.report.framing.sourceMuzzleError <= .001 && sample.report.framing.weaponPixels > 0);
  const actualAds = observation.actualAds?.pointerLock?.acquired === true
    && observation.actualAds.trusted === true && observation.actualAds.report?.adsProgress > 0;
  const fallback = observation.missingMesh?.ready === true && observation.missingMesh?.report?.weaponPixels > 0;
  return {
    cases: [
      result(definition.cases[0], five, samples, artifacts, 'five_slot_capture_incomplete'),
      result(definition.cases[1], sockets, samples.map(sample => sample.report?.framing ?? null), artifacts, 'socket_or_bounds_mismatch'),
      result(definition.cases[2], actualAds, observation.actualAds ?? null, artifacts, 'actual_ads_unavailable', !observation.actualAds?.pointerLock?.acquired),
      result(definition.cases[3], fallback, observation.missingMesh ?? null, artifacts, 'missing_mesh_injection_unavailable', observation.missingMesh === null),
    ],
    inputProvenance: actualAds ? 'Aside native input corroborated by event.isTrusted' : 'deterministic inspector; no actual ADS claim',
    observations: observation,
  };
}

export function classifyWeaponActions(definition, observation) {
  const pointer = observation.pointerLock;
  if (!pointer?.acquired) return {
    cases: definition.cases.map(id => result(id, false, observation, observation.artifacts ?? [], 'pointer_lock_unavailable', true)),
    inputProvenance: 'none', observations: observation,
  };
  const timelines = observation.timelines ?? [];
  const five = [0, 1, 2, 3, 4].every(index => timelines.some(item => item.weapon === index
    && item.trusted && item.phases.some(phase => phase !== 'idle')));
  const lifecycle = observation.lifecycle?.switchReset === true && observation.lifecycle?.deathReset === true
    && observation.lifecycle?.reconnectResumed === true && observation.lifecycle?.lateEchoRejected === true;
  const deadline = observation.deadline?.earlyReadyRejected === true;
  return {
    cases: [
      result(definition.cases[0], five, timelines, observation.artifacts ?? [], 'five_action_timelines_incomplete'),
      result(definition.cases[1], lifecycle, observation.lifecycle ?? null, observation.artifacts ?? [], 'action_lifecycle_incomplete', observation.lifecycle === null),
      result(definition.cases[2], deadline, observation.deadline ?? null, observation.artifacts ?? [], 'ready_at_injection_unavailable', observation.deadline === null),
    ],
    inputProvenance: timelines.some(item => item.trusted) ? 'Aside native input corroborated by event.isTrusted' : 'none',
    observations: observation,
  };
}

const unavailableCases = (definition, observations, code) => ({
  cases: definition.cases.map(id => result(id, false, observations, [], code, true)),
  inputProvenance: 'none', observations,
});

async function openOwned(context, label, run) {
  let opened = false;
  let ownedTargetId = null;
  let recovery = null;
  try {
    const before = await replJson(context.repl, 'return (await listBrowserTabs()).map(({targetId})=>targetId);');
    const tabs = await replJson(context.repl, "await openTab('about:blank');return (await listBrowserTabs()).map(({targetId})=>targetId);");
    opened = true;
    const owned = tabs.filter(id => !before.includes(id));
    ownedTargetId = owned.length === 1 ? owned[0] : null;
    recovery = await recoverStaleFetchInterception(context.repl);
    return await run(recovery);
  } finally {
    const closeReceipt = opened ? await closeOwnedTab(context.repl) : null;
    context.recordCleanup({ label, opened, ownedTargetId, recovery, closeReceipt });
  }
}

async function screenshot(context, name) {
  const capture = await replJson(context.repl, `
    const binding=async()=>page.evaluate(()=>({href:location.href,timeOrigin:performance.timeOrigin}));
    try{
      await fs.mkdir('./artifacts',{recursive:true});
      const before=await binding();
      try{
        await page.screenshot({path:'./artifacts/${name}',timeout:60000});
        const bytes=await fs.readFile('./artifacts/${name}');const after=await binding();
        const png=bytes.length>=24&&bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a';
        return {ok:png&&before.href===after.href&&before.timeOrigin===after.timeOrigin,method:'raw',bytes:bytes.length,before,after};
      }catch(rawError){
        await fs.rm('./artifacts/${name}',{force:true});
        const image=await annotatedScreenshot(page);const bytes=Buffer.from(image.base64Image,'base64');
        const png=bytes.length>=24&&bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a';
        if(!png)return {ok:false,error:'annotated_capture_invalid_png',bytes:bytes.length};
        await fs.writeFile('./artifacts/${name}',bytes);const after=await binding();
        return {ok:before.href===after.href&&before.timeOrigin===after.timeOrigin,method:'annotated',bytes:bytes.length,before,after,rawError:rawError.name+': '+rawError.message};
      }
    }catch(error){return {ok:false,error:error.name+': '+error.message}}`, { allowError: true, timeoutMs: 75_000 });
  return capture.ok ? context.copySessionArtifact(name, `screenshots/${name}`) : null;
}

async function inspectWeapon(context, weapon) {
  return openOwned(context, `weapon-${weapon}`, async () => {
    const url = new URL(context.url);
    url.searchParams.set('inspect', 'weapon');
    url.searchParams.set('weapon', String(weapon));
    url.searchParams.set('shot', `slot-${weapon}-baseline`);
    const navigation = await replJson(context.repl, `const priorTimeOrigin=await page.evaluate(()=>performance.timeOrigin);let navigationError=null;try{await page.goto(${JSON.stringify(url.href)})}catch(error){if(error?.name!=='NavigationReadinessTimeoutError')throw error;navigationError=error.name+':'+error.message}
      if(typeof page.setViewportSize==='function')await page.setViewportSize({width:${context.viewport[0]},height:${context.viewport[1]}});
      const started=Date.now();while(Date.now()-started<${READINESS_TIMEOUT_MS}&&!await page.evaluate(()=>window.__inspectReady===true))await sleep(250);
      const documentIdentity=await page.evaluate(()=>({href:location.href,timeOrigin:performance.timeOrigin,readyState:document.readyState}));return {ready:await page.evaluate(()=>window.__inspectReady===true),navigationError,url:page.url(),urlMatches:page.url()===${JSON.stringify(url.href)}&&documentIdentity.href===${JSON.stringify(url.href)},freshDocument:documentIdentity.timeOrigin!==priorTimeOrigin,documentIdentity};`, { timeoutMs: READINESS_TIMEOUT_MS + 10_000 });
    const report = await replJson(context.repl, 'return await page.evaluate(()=>window.__mapInspect??null);');
    const artifact = await screenshot(context, `weapon-${weapon}-baseline.png`);
    return { weapon, ready: navigation.ready && navigation.urlMatches && navigation.freshDocument && report !== null, navigation, report, artifact };
  });
}

async function inspectWeaponAction(context, inspection) {
  return openOwned(context, `weapon-action-${inspection.weapon}-${inspection.shot}`, async () => {
    const url = new URL(context.url);
    url.searchParams.set('inspect', 'weapon');
    url.searchParams.set('weapon', String(inspection.weapon));
    url.searchParams.set('shot', inspection.shot);
    url.searchParams.set('action', inspection.action);
    url.searchParams.set('sample', String(inspection.sample));
    const navigation = await replJson(context.repl, `const priorTimeOrigin=await page.evaluate(()=>performance.timeOrigin);let navigationError=null;try{await page.goto(${JSON.stringify(url.href)})}catch(error){if(error?.name!=='NavigationReadinessTimeoutError')throw error;navigationError=error.name+':'+error.message}
      if(typeof page.setViewportSize==='function')await page.setViewportSize({width:${context.viewport[0]},height:${context.viewport[1]}});
      const started=Date.now();while(Date.now()-started<${READINESS_TIMEOUT_MS}&&!await page.evaluate(()=>window.__inspectReady===true))await sleep(250);
      const documentIdentity=await page.evaluate(()=>({href:location.href,timeOrigin:performance.timeOrigin,readyState:document.readyState}));return {ready:await page.evaluate(()=>window.__inspectReady===true),navigationError,url:page.url(),urlMatches:page.url()===${JSON.stringify(url.href)}&&documentIdentity.href===${JSON.stringify(url.href)},freshDocument:documentIdentity.timeOrigin!==priorTimeOrigin,documentIdentity};`, { timeoutMs: READINESS_TIMEOUT_MS + 10_000 });
    const report = await replJson(context.repl, 'return await page.evaluate(()=>window.__mapInspect??null);');
    const artifact = await screenshot(context, `weapon-action-${inspection.weapon}-${inspection.shot}.png`);
    return { ...inspection, ready: navigation.ready && navigation.urlMatches && navigation.freshDocument && report !== null, navigation, report, artifact };
  });
}

async function captureInspectorActions(context) {
  const states = [];
  for (const inspection of WEAPON_ACTION_INSPECTIONS)
    states.push(await inspectWeaponAction(context, inspection));
  return states;
}
async function runWeapon(context) {
  const samples = [];
  for (let weapon = 0; weapon < 5; weapon++) samples.push(await inspectWeapon(context, weapon));
  const observation = { samples, actualAds: null, missingMesh: null };
  await context.writeArtifact('art-weapon-raw.json', observation);
  return classifyWeapon(context.definition, observation);
}

async function runWeaponActions(context) {
  const inspectorStates = await captureInspectorActions(context);
  const artifacts = inspectorStates.flatMap(state => state.artifact ? [state.artifact] : []);
  const observation = {
    pointerLock: { acquired: false, skipped: true, error: 'known WrongDocumentError capability' },
    timelines: [], lifecycle: null, deadline: null, inspectorStates, artifacts,
  };
  await context.writeArtifact('art-weapon-actions-raw.json', observation);
  return classifyWeaponActions(context.definition, observation);
}

async function runCharacter(context) {
  return unavailableCases(context.definition, { inspector: 'inspect=rig', limitation: 'team selector, LOD and failure injection absent' }, 'character_probe_surface_incomplete');
}

async function runCharacterPoses(context) {
  return unavailableCases(context.definition, { inspector: 'inspect=rig', limitation: 'death/reload/AOI and faction selectors absent' }, 'character_pose_surface_incomplete');
}

async function runArtScene(context) {
  return unavailableCases(context.definition, { limitation: 'final matrix requires accepted task 8/9/19/20 assets and failure seams' }, 'final_art_dependencies_unaccepted');
}

export const scenarioHandlers = Object.freeze({
  'art-weapon': runWeapon,
  'art-character': runCharacter,
  'art-weapon-actions': runWeaponActions,
  'art-character-poses': runCharacterPoses,
  'art-scene': runArtScene,
});
