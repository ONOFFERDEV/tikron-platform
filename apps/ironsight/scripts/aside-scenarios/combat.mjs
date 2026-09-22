import { readFile } from "node:fs/promises";
import path from "node:path";
import { VERDICT } from "../aside-common.mjs";
import { pointerLockCapability } from "../aside-pointer-lock.mjs";
import { analyzeCombatAcceptance } from "../combat-acceptance.mjs";
import { READINESS_TIMEOUT_MS, closeOwnedTab, recoverStaleFetchInterception, replJson } from "./performance.mjs";

const reason = (code, detail = null) => ({ code, detail });
const artifactList = artifact => artifact ? [artifact] : [];
const outcome = (id, reasons, observations, artifact, unavailable = false) => ({ id,
  verdict: reasons.length ? unavailable ? VERDICT.UNQUALIFIED : VERDICT.FAIL : VERDICT.PASS,
  reasons, observations, artifacts: artifactList(artifact) });
const unavailable = (definition, code, detail, observations, artifact) => ({
  cases: definition.cases.map(id => outcome(id, [reason(code, detail)], observations, artifact, true)),
  inputProvenance: "none", observations,
});
const viewportQualified = observation => [observation?.viewport?.css, observation?.viewport?.drawingBuffer]
  .every(value => Array.isArray(value) && value[0] === 1920 && value[1] === 1080);

export function classifyDeploymentSurface(facts) {
  if (facts?.playReady === true && facts?.canvasInert === false) return "ready";
  if (facts?.flowAttached === true && facts?.retryVisible === true) return "retry";
  return "waiting";
}

export function classifyCombatFeedback(definition, observation, artifact) {
  if (!observation?.pointerLock?.acquired) return unavailable(definition, "pointer_lock_unavailable",
    observation?.pointerLock?.error ?? "native pointer lock was not acquired", observation, artifact);
  if (!viewportQualified(observation)) return unavailable(definition, "viewport_mismatch",
    JSON.stringify(observation?.viewport ?? null), observation, artifact);
  const event = observation.combat, telemetry = observation.telemetry, feedback = observation.feedback;
  const matched = event?.attempt?.shotId && event.result?.shotId === event.attempt.shotId;
  const actual = telemetry?.metrics?.actual;
  const checks = [
    [matched && actual?.validShots > 0, "authoritative_shot_timeline_missing"],
    [observation.reducedMotion?.judgmentParity === true, "reduced_motion_trace_missing"],
    [telemetry?.counts?.blocked > 0, "denied_shot_trace_missing"],
    [observation.echoDedup === true, "echo_dedup_trace_missing"],
    [observation.unknownBearing === true, "unknown_bearing_trace_missing"],
  ];
  return { cases: definition.cases.map((id, index) => {
    const [passed, code] = checks[index] ?? [false, "combat_case_unimplemented"];
    return outcome(id, passed ? [] : [reason(code)], observation, artifact, !passed);
  }), inputProvenance: "Aside native input corroborated by event.isTrusted", observations: observation };
}

export function classifyCombatFirstShot(definition, runs, artifact) {
  const lockReasons = runs.filter(run => !run?.pointerLock?.acquired).map(run =>
    reason("pointer_lock_unavailable", `${run?.mode ?? "unknown"}: ${run?.pointerLock?.error ?? "not acquired"}`));
  const viewportReasons = runs.filter(run => !viewportQualified(run)).map(run => reason("viewport_mismatch", run?.mode));
  const surfaceReasons = [...lockReasons, ...viewportReasons];
  const locked = runs.filter(run => run?.pointerLock?.acquired && viewportQualified(run));
  const modes = new Set(locked.map(run => run.mode));
  const weapons = locked.flatMap(run => run.weapons ?? []);
  const matchedWeapons = new Set(weapons.filter(item => item.attempt?.shotId
    && item.result?.shotId === item.attempt.shotId).map(item => item.weaponIndex));
  const modeReasons = [...surfaceReasons, ...(modes.size === 3 ? [] : [reason("mode_coverage_incomplete", `${modes.size}/3`)])];
  const weaponReasons = [...surfaceReasons, ...(matchedWeapons.size === 5 ? [] : [reason("weapon_coverage_incomplete", `${matchedWeapons.size}/5`)])];
  const readyReasons = locked.length === 3 && locked.every(run => run.ready === true)
    ? [] : [reason("ready_boundary_unproven")];
  const latencyReasons = locked.length === 3 && locked.every(run => run.reconnect === true
    && run.coldAsset === true && run.telemetry?.hud?.status === "ready")
    ? [] : [reason("latency_reconnect_cold_trace_incomplete")];
  const groups = [modeReasons, weaponReasons, readyReasons, latencyReasons];
  return { cases: definition.cases.map((id, index) => outcome(id, groups[index] ?? [reason("combat_case_unimplemented")],
    runs, artifact, (groups[index]?.length ?? 1) > 0)),
  inputProvenance: locked.length ? "Aside native input corroborated by event.isTrusted" : "none", observations: { runs } };
}

export function classifyCombatReport(definition, report, artifact) {
  if (!report) return unavailable(definition, "combat_trace_missing", "combat-acceptance-input.json", null, artifact);
  const select = ids => report.cases.filter(entry => ids.includes(entry.id));
  const groups = [report.cases, select(["scenario-coverage", "stage-and-clock-integrity"]),
    select(["authoritative-feedback", "normal-reduced-parity"])];
  return { cases: definition.cases.map((id, index) => {
    const entries = groups[index] ?? [];
    const failed = entries.flatMap(entry => entry.reasons ?? []);
    const unqualified = entries.some(entry => entry.verdict === VERDICT.UNQUALIFIED);
    return outcome(id, failed, entries, artifact, unqualified);
  }), inputProvenance: report.inputProvenance, observations: { report } };
}

export function classifyCombatSupports(definition, observation, artifact) {
  if (!observation?.pointerLock?.acquired) return unavailable(definition, "pointer_lock_unavailable",
    observation?.pointerLock?.error ?? "native pointer lock was not acquired", observation, artifact);
  if (!viewportQualified(observation)) return unavailable(definition, "viewport_mismatch",
    JSON.stringify(observation?.viewport ?? null), observation, artifact);
  const support = observation.support, mortar = observation.mortar, strafe = observation.drone;
  const flights = Array.isArray(support?.flights) ? support.flights : [];
  const strikes = Array.isArray(mortar?.strikes) ? mortar.strikes : [];
  const strafes = Array.isArray(strafe?.flights) ? strafe.flights : [];
  const checks = [
    [support?.kind === "observation_biplane" && mortar?.kind === "ww1_mortar_battery"
      && strafe?.kind === "fixed_linear_strafe" && flights.length > 0 && strikes.length > 0
      && strafes.length > 0, "support_tiers_runtime_trace_missing"],
    [strikes.some(strike => Number.isFinite(strike.warningEndsAt))
      && observation.supportReview?.mortarCoverDamageRejected === true
      && Number.isFinite(mortar?.readyAt) && mortar.readyAt > mortar.serverNow,
    "mortar_warning_cover_cooldown_trace_missing"],
    [observation.supportReview?.staleReconRejected === true, "stale_recon_rejection_trace_missing"],
    [observation.supportReview?.cancelledAfterOwnerDeath === true, "cancelled_support_trace_missing"],
    [strafes.length > 0 && strafes.every(flight => flight.lock === null && flight.corridor)
      && observation.supportReview?.straightPath === true
      && observation.supportReview?.outsideCorridorDamageRejected === true,
    "strafe_path_damage_trace_missing"],
  ];
  return { cases: definition.cases.map((id, index) => {
    const [passed, code] = checks[index] ?? [false, "combat_case_unimplemented"];
    return outcome(id, passed ? [] : [reason(code)], observation, artifact, !passed);
  }), inputProvenance: "Aside native input corroborated by event.isTrusted", observations: observation };
}

async function captureMode(context, mode, label) {
  let opened = false, ownedTargetId = null, recovery = null, closeReceipt = null;
  const runUrl = new URL(context.url); runUrl.searchParams.set("mode", mode); runUrl.searchParams.set("movement-review", "1");
  try {
    const before = await replJson(context.repl, "return (await listBrowserTabs()).map(({targetId})=>targetId);");
    const tabs = await replJson(context.repl, "await openTab('about:blank');return (await listBrowserTabs()).map(({targetId})=>targetId);");
    opened = true; const owned = tabs.filter(id => !before.includes(id)); ownedTargetId = owned.length === 1 ? owned[0] : null;
    recovery = await recoverStaleFetchInterception(context.repl);
    if (!recovery.disabled) throw new Error(`Fetch recovery failed: ${recovery.errors.join("; ")}`);
    await replJson(context.repl, `
      await page.goto(${JSON.stringify(runUrl.href)});
      if(typeof page.setViewportSize==='function')await page.setViewportSize({width:${context.viewport[0]},height:${context.viewport[1]}});
      await page.evaluate(()=>{window.__combatAsideEvents=[];window.__combatAsideLastEvent=null;for(const type of ['mousedown','mouseup','keydown','pointerlockchange','pointerlockerror'])document.addEventListener(type,event=>{const value={kind:type,trusted:event.isTrusted,at:performance.now(),code:event.code??null};window.__combatAsideEvents.push(value);window.__combatAsideLastEvent=value},true);const canvas=document.querySelector('#app > canvas');if(canvas&&typeof canvas.requestPointerLock==='function'){const nativeRequest=canvas.requestPointerLock.bind(canvas);canvas.requestPointerLock=(...args)=>{const request={event:window.__combatAsideLastEvent,throwError:null,rejected:null,resolved:false};window.__combatAsidePointerRequest=request;try{const result=nativeRequest(...args);Promise.resolve(result).then(()=>{request.resolved=true},error=>{request.rejected=error.name+': '+error.message});return result}catch(error){request.throwError=error.name+': '+error.message;throw error}}}});
      return {url:page.url()};
    `);
    const readiness = await replJson(context.repl, `
      await page.bringToFront();await page.locator('#deployment-flow').waitFor({state:'attached',timeout:${READINESS_TIMEOUT_MS}});
      const started=Date.now();let ready=null,retried=false;
      while(Date.now()-started<${READINESS_TIMEOUT_MS}){ready=await page.evaluate(()=>({flowAttached:!!document.querySelector('#deployment-flow'),canvas:!!document.querySelector('#app > canvas'),canvasInert:document.querySelector('#app > canvas')?.inert??null,playReady:performance.getEntriesByName('ironsight-play-ready').length>0,retryVisible:!!document.querySelector('#deployment-flow .deployment-flow__actions button:not([hidden])')}));if(ready.playReady&&ready.canvasInert===false)break;if(ready.retryVisible&&!retried){await page.locator('#deployment-flow .deployment-flow__actions button:not([hidden])').first().click();retried=true}await sleep(500)}
      return {ready,retried,elapsedMs:Date.now()-started};
    `, { timeoutMs: READINESS_TIMEOUT_MS + 15_000, allowError: true });
    const interaction = await replJson(context.repl, `
      const canvas=page.locator('#app > canvas');let clickError=null;
      try{await canvas.click({position:{x:120,y:120}});await sleep(250)}catch(error){clickError=error.name+': '+error.message}
      const pointer=await page.evaluate(()=>({supported:typeof document.querySelector('#app > canvas')?.requestPointerLock==='function',locked:document.pointerLockElement===document.querySelector('#app > canvas'),events:window.__combatAsideEvents,request:window.__combatAsidePointerRequest??null,clickError}));
      const weapons=[];
      if(pointer.locked){for(let weaponIndex=0;weaponIndex<5;weaponIndex+=1){await page.keyboard.press('Digit'+(weaponIndex+1));await sleep(1200);await page.mouse.down();await page.mouse.up();await sleep(1200);weapons.push({weaponIndex,...await page.evaluate(()=>window.ironsight?.combatEventInfo?.()??{})})}}
      const viewport=await page.evaluate(()=>{const canvas=document.querySelector('#app > canvas'),gl=canvas?.getContext('webgl2')??canvas?.getContext('webgl')??null;return {css:[innerWidth,innerHeight],drawingBuffer:gl?[gl.drawingBufferWidth,gl.drawingBufferHeight]:[canvas?.width??0,canvas?.height??0]}});
      return {pointer,viewport,weapons,combat:await page.evaluate(()=>window.ironsight?.combatEventInfo?.()??null),feedback:await page.evaluate(()=>window.ironsight?.shotFeedbackInfo?.()??null),combatReview:await page.evaluate(()=>window.ironsight?.combatReview?.()??[]),telemetry:await page.evaluate(()=>window.__ironsightQa?.drainTelemetry?.()??null),movement:await page.evaluate(()=>window.ironsight?.movementReview?.()??[]),support:await page.evaluate(()=>window.ironsight?.supportInfo?.()??null),mortar:await page.evaluate(()=>window.ironsight?.mortarInfo?.()??null),drone:await page.evaluate(()=>window.ironsight?.droneInfo?.()??null),supportReview:await page.evaluate(()=>window.ironsight?.supportReview?.()??null)};
    `, { timeoutMs: 20_000, allowError: true });
    const shotName = `combat-${label}-${mode}.png`;
    const capture = await replJson(context.repl, `try{const image=await annotatedScreenshot(page);const bytes=Buffer.from(image.base64Image,'base64');await fs.mkdir('./artifacts',{recursive:true});await fs.writeFile('./artifacts/${shotName}',bytes);return {ok:true,bytes:bytes.length}}catch(error){return {ok:false,error:error.name+': '+error.message}}`, { allowError: true, timeoutMs: 40_000 });
    const artifact = capture.ok ? await context.copySessionArtifact(shotName, `screenshots/${shotName}`) : null;
    const pointerLock = pointerLockCapability({ pointerLockSupported: interaction.pointer?.supported === true }, interaction.pointer);
    if (!pointerLock.error && interaction.pointer?.clickError) pointerLock.error = interaction.pointer.clickError;
    if (!ownedTargetId) { pointerLock.acquired = false; pointerLock.error = "owned_target_ambiguous"; }
    return { mode, url: runUrl.href, ready: readiness.ready?.playReady === true,
      pointerLock,
      weapons: interaction.weapons, combat: interaction.combat, feedback: interaction.feedback,
      combatReview: interaction.combatReview, viewport: interaction.viewport,
      telemetry: interaction.telemetry, movement: interaction.movement,
      support: interaction.support, mortar: interaction.mortar, drone: interaction.drone,
      supportReview: interaction.supportReview, reconnect: false, coldAsset: false, artifact };
  } finally {
    if (opened) closeReceipt = await closeOwnedTab(context.repl);
    context.recordCleanup({ label, mode, opened, ownedTargetId, recovery, closeReceipt });
  }
}

async function runCombatFeedback(context) {
  const run = await captureMode(context, "tdm", "feedback");
  const raw = await context.writeArtifact("combat-feedback-raw.json", run);
  return classifyCombatFeedback(context.definition, run, run.artifact ?? raw);
}

async function runCombatFirstShot(context) {
  const runs = [];
  for (const mode of ["tdm", "ffa", "dom"]) runs.push(await captureMode(context, mode, "first-shot"));
  const raw = await context.writeArtifact("combat-first-shot-raw.json", runs);
  return classifyCombatFirstShot(context.definition, runs, raw);
}

async function runCombatAcceptance(context) {
  const inputPath = path.join(context.outputDir, "combat-acceptance-input.json");
  let report = null;
  try { report = analyzeCombatAcceptance(JSON.parse((await readFile(inputPath, "utf8")).replace(/^\uFEFF/, ""))); }
  catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error; }
  const artifact = report ? await context.writeArtifact("combat-acceptance-analysis.json", report) : null;
  return classifyCombatReport(context.definition, report, artifact);
}

async function runCombatSupports(context) {
  const run = await captureMode(context, "tdm", "supports");
  const raw = await context.writeArtifact("combat-supports-raw.json", run);
  return classifyCombatSupports(context.definition, run, run.artifact ?? raw);
}

export const scenarioHandlers = Object.freeze({
  "combat-feedback": runCombatFeedback,
  "combat-first-shot": runCombatFirstShot,
  "combat-acceptance": runCombatAcceptance,
  "combat-supports": runCombatSupports,
});
