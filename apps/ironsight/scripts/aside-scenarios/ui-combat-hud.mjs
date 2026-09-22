import { randomBytes } from 'node:crypto';
import { VERDICT } from '../aside-common.mjs';

function reason(code, detail = null) { return { code, detail }; }
function errorMessage(error) { return error instanceof Error ? `${error.name}: ${error.message}` : String(error); }

async function replJson(repl, body, options = {}) {
  const marker = `__ASIDE_COMBAT_HUD_${randomBytes(8).toString('hex')}__`;
  const frame = await repl.run(`console.log('${marker}'+JSON.stringify(await (async()=>{${body}})()))`, options);
  const line = frame.split('\n').find(value => value.startsWith(marker));
  if (!line) throw new Error(`Aside combat HUD response marker missing: ${marker}`);
  return JSON.parse(line.slice(marker.length));
}

async function capture(context, name) {
  const file = `ui-combat-hud-${name}.png`;
  const result = await replJson(context.repl, `
    try{await fs.mkdir('./artifacts',{recursive:true});try{await page.screenshot({path:'./artifacts/${file}',timeout:15000});return {ok:true,method:'raw',bytes:(await fs.stat('./artifacts/${file}')).size}}
    catch(rawError){await fs.rm('./artifacts/${file}',{force:true});const before={url:page.url(),timeOrigin:await page.evaluate(()=>performance.timeOrigin)};const dom=await snapshot(page);const image=await annotatedScreenshot(page);const bytes=Buffer.from(image.base64Image,'base64');const png=bytes.length>=24&&bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a';if(!png)return {ok:false,error:'annotated_capture_invalid_png',bytes:bytes.length};await fs.writeFile('./artifacts/${file}',bytes);const after={url:page.url(),timeOrigin:await page.evaluate(()=>performance.timeOrigin)};return {ok:before.url===after.url&&before.timeOrigin===after.timeOrigin,method:'annotated',bytes:bytes.length,pixels:[bytes.readUInt32BE(16),bytes.readUInt32BE(20)],before,after,tree:dom.tree,diff:dom.diff,rawError:rawError.name+': '+rawError.message}}}
    catch(error){return {ok:false,error:error.name+': '+error.message}}
  `, { allowError: true, timeoutMs: 50_000 });
  return result.ok ? context.copySessionArtifact(file, `screenshots/${file}`) : null;
}

function caseResult(id, passed, observations, artifacts, failureCode, capabilityCode) {
  const verdict = capabilityCode || artifacts.length === 0 ? VERDICT.UNQUALIFIED : passed ? VERDICT.PASS : VERDICT.FAIL;
  return {
    id,
    verdict,
    reasons: verdict === VERDICT.PASS ? [] : [reason(capabilityCode ?? (artifacts.length === 0 ? 'screenshot_unavailable' : failureCode))],
    observations,
    artifacts,
  };
}

export async function runUiCombatHud(context) {
  let opened = false;
  let ownedTargetId = null;
  const observations = {};
  const failures = {};
  try {
    const target = new URL(context.url);
    target.searchParams.set('mode', 'dom');
    const ownership = await replJson(context.repl, `
      const before=await listBrowserTabs();const ids=new Set(before.map(item=>item.targetId));
      await openTab(${JSON.stringify(target.href)});const owned=(await listBrowserTabs()).filter(item=>!ids.has(item.targetId));
      await page.locator('canvas').first().waitFor({state:'visible',timeout:90000});
      return {targetId:owned.length===1?owned[0].targetId:null,viewport:[await page.evaluate(()=>innerWidth),await page.evaluate(()=>innerHeight)]};
    `, { timeoutMs: 100_000 });
    opened = true; ownedTargetId = ownership.targetId; observations.ownership = ownership;

    let preparationShot = null;
    try {
      observations.preparation = await replJson(context.repl, `
        const flow=page.locator('#deployment-flow');await flow.waitFor({state:'visible',timeout:30000});
        return await page.evaluate(()=>{const stage=document.querySelector('#deployment-flow .deployment-flow__stage');const text=stage?.hidden?'':stage?.textContent?.trim()??'';return {text,visible:Boolean(text),internalIdVisible:/^[a-z]+(?:-[a-z]+)+$/.test(text)}});
      `, { timeoutMs: 35_000 });
      preparationShot = await capture(context, 'preparation-label');
    } catch (error) { failures.preparation = errorMessage(error); }

    try {
      observations.input = await replJson(context.repl, `
        const canvas=page.locator('canvas').first();
        const flow=page.locator('#deployment-flow');
        await flow.waitFor({state:'visible',timeout:90000});
        await canvas.click({position:{x:320,y:220}});
        await new Promise(resolve=>setTimeout(resolve,500));
        const locked=await page.evaluate(()=>document.pointerLockElement instanceof HTMLCanvasElement);
        if(locked){
          for(let i=0;i<8;i++){await page.mouse.move(460+i*45,330+(i%3)*24);await page.mouse.down();await page.mouse.up();await new Promise(resolve=>setTimeout(resolve,95))}
          await page.keyboard.press('KeyR');await new Promise(resolve=>setTimeout(resolve,500));
        }
        return await page.evaluate(value=>({locked:value,flow:document.querySelector('#deployment-flow')?.dataset.flow??null}),locked);
      `, { timeoutMs: 100_000 });
    } catch (error) { failures.input = errorMessage(error); }

    try {
      observations.hud = await replJson(context.repl, `
        await new Promise(resolve=>setTimeout(resolve,1200));
        return await page.evaluate(()=>{
          const events=[...document.querySelectorAll('#combatEventLog li')].map(node=>({kind:node.dataset.kind,text:node.textContent??''}));
          const objectives=[...document.querySelectorAll('#combatObjectives li')].map(node=>({owner:node.dataset.owner,text:node.textContent??'',border:getComputedStyle(node).borderTopColor}));
          const reload=document.querySelector('#combatReload');const telemetry=document.querySelector('#combatTelemetry');
          return {events,objectives,reload:{hidden:reload?.hidden??true,text:reload?.textContent??''},telemetry:{text:telemetry?.textContent??'',ready:telemetry?.dataset.ready??null},fontSize:getComputedStyle(document.querySelector('#authoritativeCombatHud')).fontSize,overflow:document.documentElement.scrollWidth>innerWidth};
        });
      `);
    } catch (error) { failures.hud = errorMessage(error); }

    try {
      observations.settings = await replJson(context.repl, `
        if(await page.evaluate(()=>document.pointerLockElement!==null))await page.keyboard.press('Escape');
        await page.locator('#quitConfirm').waitFor({state:'visible',timeout:5000});
        await page.locator('#quitConfirm .row button').nth(1).click();
        await page.locator('#settingsPanel').waitFor({state:'visible'});
        await page.locator('#settingsPanel [role=tab]').first().focus();
        await page.locator('#settingsPanel [data-setting=enemy-highlight]').selectOption('violet');
        await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');
        const selected=await page.locator('#settingsPanel [role=tab][aria-selected=true]').textContent();
        const value=await page.locator('#settingsPanel [data-setting=enemy-highlight]').inputValue();
        return {selected,value};
      `, { allowError: true });
    } catch (error) { failures.settings = errorMessage(error); }

    const screenshot = await capture(context, 'actual');
    const facts = await context.writeArtifact('traces/ui-combat-hud-observed.json', { observations, failures });
    const artifacts = [facts, ...(preparationShot ? [preparationShot] : []), ...(screenshot ? [screenshot] : [])];
    const viewportQualified = observations.ownership?.viewport?.[0] === context.viewport[0] && observations.ownership?.viewport?.[1] === context.viewport[1];
    const capability = observations.input?.locked ? (viewportQualified ? null : 'requested_viewport_unavailable') : 'actual_pointer_lock_unavailable';
    const events = observations.hud?.events ?? [];
    const kinds = new Set(events.map(event => event.kind));
    const shotHitReloadObjective = kinds.has('shot-accepted') && (kinds.has('confirmed-hit') || kinds.has('confirmed-kill')) && observations.hud?.objectives?.length === 3;
    const denial = kinds.has('shot-blocked') && events.length <= 4 && new Set(events.map(event => `${event.kind}/${event.text}`)).size === events.length;
    const colours = observations.settings?.value === 'violet' && observations.hud?.objectives?.every(item => item.owner && item.text && item.border);
    const bounded = events.length <= 4 && observations.hud?.fontSize === '14px' && !observations.hud?.overflow;
    return {
      cases: [
        caseResult(context.definition.cases[0], shotHitReloadObjective, observations.hud ?? {}, artifacts, 'authoritative_combat_sequence_mismatch', capability),
        caseResult(context.definition.cases[1], denial, { events }, artifacts, 'denied_or_duplicate_event_mismatch', capability),
        caseResult(context.definition.cases[2], colours, { settings: observations.settings, objectives: observations.hud?.objectives }, artifacts, 'colour_and_label_mismatch', capability),
        caseResult(context.definition.cases[3], bounded, { eventCount: events.length, fontSize: observations.hud?.fontSize, overflow: observations.hud?.overflow }, artifacts, 'combat_log_bound_mismatch', capability),
      ],
      inputProvenance: 'Actual Aside locator clicks, pointer-lock acquisition, trusted mouse movement/fire, keyboard reload, Escape/menu navigation, and settings control input. No server event or pointer-lock state is synthesized.',
      observations: { observations, failures, requestedViewport: context.viewport, viewportQualified },
    };
  } finally {
    let closeReceipt = null;
    if (opened) {
      try { closeReceipt = await replJson(context.repl, `const url=page?.url?.()??null;if(page)await closeTab(page);return {url,tabs:await listBrowserTabs()}`, { allowError: true, timeoutMs: 30_000 }); }
      catch (error) { closeReceipt = { error: errorMessage(error) }; }
    }
    context.recordCleanup({ opened, ownedTargetId, closeReceipt });
  }
}
