import { randomBytes } from "node:crypto";
import { VERDICT } from "../aside-common.mjs";

function reason(code, detail = null) {
  return { code, detail };
}

async function replJson(repl, body, options = {}) {
  const marker = `__ASIDE_JOURNEY_${randomBytes(8).toString("hex")}__`;
  const frame = await repl.run(`console.log('${marker}'+JSON.stringify(await (async()=>{${body}})()))`, options);
  const line = frame.split("\n").find(value => value.startsWith(marker));
  if (!line) throw new Error(`Aside journey response marker missing: ${marker}`);
  return JSON.parse(line.slice(marker.length));
}

export function qualifyJourneyCase(id, observation, artifacts = []) {
  if (observation.authority !== "trusted-input" || observation.attemptComplete !== true) {
    return { id, verdict: VERDICT.UNQUALIFIED, reasons: [reason(observation.reason ?? "trusted_journey_unavailable")], observations: observation, artifacts };
  }
  if (artifacts.length === 0) {
    return { id, verdict: VERDICT.UNQUALIFIED, reasons: [reason("screenshot_unavailable")], observations: observation, artifacts };
  }
  return { id, verdict: observation.passed === true ? VERDICT.PASS : VERDICT.FAIL,
    reasons: observation.passed === true ? [] : [reason(observation.reason ?? "journey_observable_mismatch")], observations: observation, artifacts };
}

function journeyUrl(base, mode, map) {
  const url = new URL(base);
  url.searchParams.set("mode", mode);
  if (map) url.searchParams.set("map", map);
  else url.searchParams.delete("map");
  return url.href;
}

async function openOwned(context, url) {
  return replJson(context.repl, `
    const before=await listBrowserTabs();const ids=new Set(before.map(item=>item.targetId));
    await openTab(${JSON.stringify(url)});
    let viewportError=null;
    try{if(typeof page.setViewportSize==='function')await page.setViewportSize({width:${context.viewport[0]},height:${context.viewport[1]}})}catch(error){viewportError=error.name+': '+error.message}
    await page.locator('canvas').waitFor({state:'visible',timeout:30000});
    const after=await listBrowserTabs();const owned=after.filter(item=>!ids.has(item.targetId));const viewport=await page.evaluate(()=>[innerWidth,innerHeight]);
    return {targetId:owned.length===1?owned[0].targetId:null,url:page.url(),viewport,viewportError};
  `, { timeoutMs: 35_000 });
}

async function capture(context, name) {
  const sessionName = `ui-journeys-${name}.png`;
  const result = await replJson(context.repl, `
    try{await fs.mkdir('./artifacts',{recursive:true});await page.screenshot({path:'./artifacts/${sessionName}',timeout:60000});return {ok:true,bytes:(await fs.stat('./artifacts/${sessionName}')).size}}
    catch(error){return {ok:false,error:error.name+': '+error.message}}
  `, { allowError: true, timeoutMs: 60_000 });
  return result.ok ? context.copySessionArtifact(sessionName, `screenshots/${sessionName}`) : null;
}

async function closeOwned(context, opened) {
  let receipt;
  try {
    receipt = await replJson(context.repl, "const url=page?.url?.()??null;if(page)await closeTab(page);return {url,tabs:await listBrowserTabs()}", { allowError: true });
  } catch (error) {
    receipt = { error: error instanceof Error ? error.message : String(error) };
  }
  context.recordCleanup({ opened, ownedTargetId: opened?.targetId ?? null, closeReceipt: receipt });
}

async function attemptTraining(context, map) {
  const url = journeyUrl(context.url, "practice", map);
  await replJson(context.repl, `await page.goto(${JSON.stringify(url)});await page.locator('canvas').waitFor({state:'visible',timeout:30000});return {url:page.url()}`, { timeoutMs: 35_000 });
  return replJson(context.repl, `
    const read=()=>page.evaluate(()=>{const state=window.ironsight?.state?.();const me=state?.players?.[window.ironsight?.myId];const coach=document.querySelector('#trainingCoach');return {phase:state?.phase??null,alive:me?.alive??null,pos:me?{x:me.x,z:me.z}:null,step:coach?.dataset.step??null,coachHidden:coach?.hidden??true,locked:document.pointerLockElement===document.querySelector('canvas')}});
    const stages=[];let inputError=null;
    try{
      await page.locator('canvas').click();await sleep(400);stages.push({id:'lock',...(await read())});
      if(stages[0].locked){
        await page.keyboard.down('KeyW');await sleep(1000);await page.keyboard.up('KeyW');stages.push({id:'move',...(await read())});
        await page.mouse.down({button:'right'});await sleep(650);await page.mouse.up({button:'right'});stages.push({id:'aim',...(await read())});
        await page.mouse.click(640,360,{button:'left'});await sleep(500);stages.push({id:'fire',...(await read())});
        await page.keyboard.press('KeyR');await sleep(2200);stages.push({id:'reload',...(await read())});
        await page.keyboard.press('KeyQ');await sleep(500);stages.push({id:'ping',...(await read())});
        await page.keyboard.press('Escape');await sleep(250);stages.push({id:'unlock',...(await read())});
      }
    }catch(error){inputError=error.name+': '+error.message}
    const locked=stages.some(stage=>stage.locked===true);const final=stages.at(-1)??await read();
    return {authority:locked?'trusted-input':'none',attemptComplete:locked&&inputError===null,inputError,stages,final,requestedMap:${JSON.stringify(map)}};
  `, { allowError: true, timeoutMs: 15_000 });
}

async function runUiTraining(context) {
  let opened = null;
  try {
    opened = await openOwned(context, journeyUrl(context.url, "practice", "arena1"));
    const routeResults = [];
    const screenshots = [];
    for (const map of ["arena1", "arena2", "arena3"]) {
      const observed = await attemptTraining(context, map);
      routeResults.push(observed);
      const shot = await capture(context, `training-${map}`);
      if (shot) screenshots.push(shot);
    }
    const facts = await context.writeArtifact("traces/ui-training-observed.json", { opened, routeResults });
    const artifacts = [facts, ...screenshots];
    const trusted = routeResults.every(item => item.authority === "trusted-input" && item.attemptComplete);
    const steps = routeResults.flatMap(item => item.stages.map(stage => stage.step));
    const routesComplete = routeResults.every(item => item.stages.some(stage => stage.step === "complete"));
    const reloadObserved = steps.includes("reload") && steps.includes("ping");
    const unlockStages = routeResults.map(item => ({ before: item.stages.at(-2), after: item.stages.at(-1) }));
    const unlockObserved = unlockStages.every(item => item.before && item.after);
    const unlockSafe = unlockObserved && unlockStages.every(item => item.after.locked === false && item.after.step === item.before.step);
    const common = { authority: trusted ? "trusted-input" : "none",
      reason: trusted ? "behavior_specific_attempt_not_reached" : "pointer_lock_or_trusted_input_unavailable", routeResults };
    return {
      cases: context.definition.cases.map((id, index) => qualifyJourneyCase(id, {
        ...common,
        attemptComplete: index === 0 ? trusted && routesComplete
          : index === 1 ? trusted && reloadObserved
            : index === 3 ? trusted && unlockObserved
              : false,
        passed: index === 0 ? routesComplete
          : index === 1 ? reloadObserved && steps.indexOf("ping") > steps.indexOf("reload")
            : index === 3 ? unlockSafe
              : false,
      }, artifacts)),
      inputProvenance: trusted ? "Aside locator click, keyboard and mouse input against live practice rooms" : "Aside live-room attempt; trusted pointer lock unavailable",
      observations: { opened, routeResults },
    };
  } finally {
    await closeOwned(context, opened);
  }
}

async function runUiResults(context) {
  let opened = null;
  try {
    opened = await openOwned(context, journeyUrl(context.url, "tdm", null));
    const observed = await replJson(context.repl, `
      const read=()=>page.evaluate(()=>{const state=window.ironsight?.state?.();const me=state?.players?.[window.ironsight?.myId];const overlay=document.querySelector('#overlay');return {phase:state?.phase??null,alive:me?.alive??null,locked:document.pointerLockElement===document.querySelector('canvas'),overlay:overlay?.dataset.kind??null,resultOpen:document.querySelector('.result-view')?.dataset.open??null,voteDisabled:document.querySelector('[data-action="restart"]')?.disabled??null,nextState:document.querySelector('[data-next-round]')?.dataset.state??null}});
      const samples=[];let inputError=null;let networkRecovery=null;
      try{await page.locator('canvas').click();await sleep(400);samples.push(await read());
        if(samples[0].locked){
          for(let i=0;i<30;i+=1){await sleep(1000);samples.push(await read());if(samples.at(-1).phase==='ended')break}
          if(typeof page?.cdp?.send==='function'){
            await page.cdp.send('Network.enable');await page.cdp.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await sleep(800);const offline=await read();
            await page.cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});await sleep(2500);networkRecovery={offline,online:await read()};
          }
        }
      }catch(error){inputError=error.name+': '+error.message}
      const locked=samples.some(sample=>sample.locked);const ended=samples.some(sample=>sample.phase==='ended');const dead=samples.some(sample=>sample.alive===false);const aliveAfterDeath=dead&&samples.slice(samples.findIndex(sample=>sample.alive===false)+1).some(sample=>sample.alive===true);
      return {authority:locked?'trusted-input':'none',attemptComplete:locked&&inputError===null,inputError,samples,networkRecovery,ended,dead,aliveAfterDeath};
    `, { allowError: true, timeoutMs: 40_000 });
    const shot = await capture(context, "results-final");
    const facts = await context.writeArtifact("traces/ui-results-observed.json", { opened, observed });
    const artifacts = [facts, ...(shot ? [shot] : [])];
    const resultVisible = observed.samples.some(sample => sample.resultOpen === "true");
    const common = { authority: observed.authority,
      reason: observed.authority === "trusted-input" ? "natural_authoritative_event_not_observed" : "pointer_lock_or_trusted_input_unavailable" };
    return {
      cases: context.definition.cases.map((id, index) => qualifyJourneyCase(id, {
        ...common,
        attemptComplete: index === 0 ? observed.attemptComplete && observed.dead
          : index === 1 ? observed.attemptComplete && observed.ended
            : index === 3 ? observed.attemptComplete && observed.networkRecovery !== null
              : false,
        passed: index === 0 ? observed.dead && observed.aliveAfterDeath
          : index === 1 ? observed.ended && resultVisible
            : index === 3 ? observed.networkRecovery?.offline?.locked === false && observed.networkRecovery?.online?.phase !== null
              : false,
        observed,
      }, artifacts)),
      inputProvenance: observed.authority === "trusted-input" ? "Aside click plus live room observation and CDP network interruption" : "Aside live-room attempt; trusted pointer lock unavailable",
      observations: { opened, observed },
    };
  } finally {
    await closeOwned(context, opened);
  }
}

export function summarizeJourneyComposition(completedScenarios, requiredIds) {
  const completed = new Map(completedScenarios.map(item => [item.id, item]));
  const selected = requiredIds.map(id => completed.get(id)).filter(Boolean);
  const cases = selected.flatMap(item => item.cases);
  const artifacts = [...new Map(cases.flatMap(item => item.artifacts).map(item => [item.path, item])).values()];
  const missing = requiredIds.filter(id => !completed.has(id));
  const failed = cases.filter(item => item.verdict === VERDICT.FAIL).map(item => item.id);
  const unqualified = cases.filter(item => item.verdict === VERDICT.UNQUALIFIED).map(item => item.id);
  const liveJourneys = ["ui-training", "ui-results"].every(id => {
    const item = completed.get(id);
    return item && item.cases.every(entry => entry.verdict === VERDICT.PASS) && /Aside|trusted|actual/i.test(item.inputProvenance ?? "");
  });
  const audio = completed.get("perf-audio-combat");
  const liveAudio = Boolean(audio && audio.cases.every(item => item.verdict === VERDICT.PASS)
    && /live|AudioContext|Aside/i.test(audio.inputProvenance ?? "")
    && audio.cases.flatMap(item => item.artifacts).some(item => item.path.endsWith(".wav") && item.bytes > 0));
  return { missing, failed, unqualified, artifacts, liveJourneys, liveAudio, caseCount: cases.length };
}

async function runFinalPlayerJourney(context) {
  const required = context.definition.compose ?? [];
  const summary = summarizeJourneyComposition(context.completedScenarios ?? [], required);
  const complete = summary.missing.length === 0 && summary.unqualified.length === 0;
  const observations = { authority: summary.liveJourneys ? "trusted-input" : "none", attemptComplete: complete && summary.liveJourneys,
    passed: summary.failed.length === 0, reason: summary.missing.length ? "composed_scenario_missing"
      : summary.unqualified.length ? "composed_scenario_unqualified" : "composed_scenario_failed", summary };
  const audioObservation = { authority: summary.liveAudio ? "trusted-input" : "none", attemptComplete: summary.liveAudio,
    passed: summary.liveAudio, reason: "live_digital_audio_capture_unavailable", summary };
  const facts = await context.writeArtifact("traces/final-player-journey-composition.json", summary);
  const artifacts = [facts, ...summary.artifacts];
  return {
    cases: [
      qualifyJourneyCase(context.definition.cases[0], observations, artifacts),
      qualifyJourneyCase(context.definition.cases[1], observations, artifacts),
      qualifyJourneyCase(context.definition.cases[2], audioObservation, artifacts),
    ],
    inputProvenance: summary.liveJourneys
      ? "Validated composition of completed Aside scenarios; no replayed inspector state"
      : "Composition incomplete or contains unqualified real-input scenarios",
    observations: summary,
  };
}

export const scenarioHandlers = Object.freeze({
  "ui-training": runUiTraining,
  "ui-results": runUiResults,
  "final-player-journey": runFinalPlayerJourney,
});
