import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { VERDICT } from '../aside-common.mjs';
import { buildUiShowcase } from '../build-ui-showcase.mjs';
import { runUiCombatHud } from './ui-combat-hud.mjs';
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
function reason(code, detail = null) {
  return { code, detail };
}

function errorMessage(error) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

async function replJson(repl, body, options = {}) {
  const token = randomBytes(8).toString('hex');
  const marker = `__ASIDE_UI_JSON_${token}__`;
  const frame = await repl.run(
    `console.log('${marker}'+JSON.stringify(await (async()=>{${body}})()))`,
    options,
  );
  const line = frame.split('\n').find(value => value.startsWith(marker));
  if (!line) throw new Error(`Aside UI response marker missing: ${marker}`);
  return JSON.parse(line.slice(marker.length));
}

async function screenshot(context, name, surface = 'ui-primitives') {
  const sessionName = `${surface}-${name}.png`;
  const captured = await replJson(context.repl, `
    try{
      await fs.mkdir('./artifacts',{recursive:true});
      try{
        await page.screenshot({path:'./artifacts/${sessionName}',timeout:15000});
        return {ok:true,method:'raw',bytes:(await fs.stat('./artifacts/${sessionName}')).size};
      }catch(rawError){
        await fs.rm('./artifacts/${sessionName}',{force:true});
        const before={url:page.url(),timeOrigin:await page.evaluate(()=>performance.timeOrigin)};
        const dom=await snapshot(page);const image=await annotatedScreenshot(page);const bytes=Buffer.from(image.base64Image,'base64');
        const png=bytes.length>=24&&bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a';
        if(!png)return {ok:false,error:'annotated_capture_invalid_png',bytes:bytes.length};
        await fs.writeFile('./artifacts/${sessionName}',bytes);
        const after={url:page.url(),timeOrigin:await page.evaluate(()=>performance.timeOrigin)};
        return {ok:before.url===after.url&&before.timeOrigin===after.timeOrigin,method:'annotated',bytes:bytes.length,pixels:[bytes.readUInt32BE(16),bytes.readUInt32BE(20)],before,after,tree:dom.tree,diff:dom.diff,rawError:rawError.name+': '+rawError.message};
      }
    }catch(error){return {ok:false,error:error.name+': '+error.message}}
  `, { allowError: true, timeoutMs: 50_000 });
  if (!captured.ok) return { captured, artifact: null };
  return {
    captured,
    artifact: await context.copySessionArtifact(sessionName, `screenshots/${sessionName}`),
  };
}

async function closeOwnedTab(repl) {
  return replJson(repl, `
    const ownedUrl=page?.url?.()??null;
    let fetchDisabled=null;let fetchError=null;let cacheRestored=null;let cacheError=null;
    if(typeof page?.cdp?.send==='function'){
      try{await page.cdp.send('Fetch.disable');fetchDisabled=true}
      catch(error){fetchDisabled=false;fetchError=error.name+': '+error.message}
      try{await page.cdp.send('Network.setCacheDisabled',{cacheDisabled:false});cacheRestored=true}
      catch(error){cacheRestored=false;cacheError=error.name+': '+error.message}
    }
    if(globalThis.__uiDeployFetchHandler&&typeof page?.cdp?.off==='function')page.cdp.off('Fetch.requestPaused',globalThis.__uiDeployFetchHandler);
    delete globalThis.__uiDeployFetchHandler;delete globalThis.__uiDeployFetchFailures;
    if(page) await closeTab(page);
    return {ownedUrl,fetchDisabled,fetchError,cacheRestored,cacheError,tabs:await listBrowserTabs()};
  `, { allowError: true, timeoutMs: 30_000 });
}

async function installShowcase(context, bundle) {
  const encoded = bundle.toString('base64');
  const fontCacheToken = randomBytes(8).toString('hex');
  return replJson(context.repl, `
    const before=await listBrowserTabs();
    const beforeIds=new Set(before.map(item=>item.targetId));
    await openTab('about:blank');
    let fontRoute=false;let fontRouteError=null;
    try{
      if(typeof page?.cdp?.send!=='function')throw new Error('Aside page CDP unavailable');
      await page.cdp.send('Fetch.enable',{patterns:[{urlPattern:'*assets/ui/fonts/*',requestStage:'Request'}]});
      await page.goto(${JSON.stringify(context.url)});fontRoute=true;
    }catch(error){fontRouteError=error.name+': '+error.message}
    const source=Buffer.from('${encoded}','base64').toString('utf8').replaceAll('.ttf")','.ttf?ui-font-failure=${fontCacheToken}")');
    let setupError=null;
    try{await page.evaluate(code=>{document.body.replaceChildren();new Function(code)()},source);await page.locator('#uiShowcase').waitFor({state:'visible',timeout:30000})}catch(error){setupError=error.name+': '+error.message}
    const tabs=await listBrowserTabs();
    const owned=tabs.filter(item=>!beforeIds.has(item.targetId));
    return {before,tabs,ownedTargetId:owned.length===1?owned[0].targetId:null,fontRoute,fontRouteError,setupError,url:page.url()};
  `, { timeoutMs: 35_000 });
}

async function inspectAllStates(context) {
  return replJson(context.repl, `
    const base=page.locator('.ui-button[data-state="default"]').first();
    await base.focus();
    const focus=await base.evaluate(node=>{const s=getComputedStyle(node);return {outlineWidth:s.outlineWidth,outlineColor:s.outlineColor,fontSize:s.fontSize,minHeight:s.minHeight}});
    const rest=await base.evaluate(node=>{const s=getComputedStyle(node);return {backgroundColor:s.backgroundColor,borderColor:s.borderColor}});
    await base.hover();
    await sleep(60);
    const midpoint=await base.evaluate(node=>{const s=getComputedStyle(node);return {backgroundColor:s.backgroundColor,borderColor:s.borderColor}});
    await sleep(120);
    const hover=await base.evaluate(node=>{const s=getComputedStyle(node);return {backgroundColor:s.backgroundColor,borderColor:s.borderColor}});
    const box=await base.boundingBox();let nativeHover=null;let nativeHoverError=null;
    try{
      if(!box||typeof page?.cdp?.send!=='function')throw new Error('native pointer dispatch unavailable');
      await page.cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:box.x+box.width/2,y:box.y+box.height/2});await sleep(180);
      nativeHover=await base.evaluate(node=>{const s=getComputedStyle(node);return {matches:node.matches(':hover'),hoverPath:[...document.querySelectorAll(':hover')].map(item=>item.id||item.className||item.tagName),backgroundColor:s.backgroundColor,borderColor:s.borderColor}});
    }catch(error){nativeHoverError=error.name+': '+error.message}
    const dom=await page.evaluate(()=>{
      const root=document.querySelector('#uiShowcase');
      const states=[...document.querySelectorAll('.ui-button')].map(node=>({state:node.dataset.state,tone:node.dataset.tone,disabled:node.disabled,busy:node.getAttribute('aria-busy'),pressed:node.getAttribute('aria-pressed')}));
      const required=['default','pressed','selected','disabled','loading'];
      const present=new Set(states.map(item=>item.state));
      const keyStates=new Set([...document.querySelectorAll('.ui-keycap')].map(node=>node.dataset.state));
      const fieldStates=new Set([...document.querySelectorAll('.ui-field')].map(node=>node.dataset.state));
      const statusTones=new Set([...document.querySelectorAll('.ui-status-row')].map(node=>node.dataset.tone));
      const legendTones=new Set([...document.querySelectorAll('.ui-map-legend__item')].map(node=>node.dataset.tone));
      const requiredComponents=keyStates.size===5&&['default','valid','error','saving','save-failed','disabled'].every(value=>fieldStates.has(value))&&['default','success','warning','error'].every(value=>statusTones.has(value))&&['ally','enemy','neutral'].every(value=>legendTones.has(value))&&!!document.querySelector('.ui-tab[aria-selected="true"]')&&!!document.querySelector('.ui-tab:disabled')&&!!document.querySelector('.ui-scroll-modal__body')&&!!document.querySelector('.ui-scroll-modal__footer');
      const scrollBody=document.querySelector('[data-showcase-region="scroll-body"]'); const overflowElements=[...document.querySelectorAll('#uiShowcase *')].filter(node=>node.scrollWidth>node.clientWidth+1).map(node=>{const r=node.getBoundingClientRect();const cs=getComputedStyle(node);return {className:node.className,tag:node.tagName,text:node.textContent?.slice(0,40),scrollWidth:node.scrollWidth,clientWidth:node.clientWidth,rect:[r.left,r.right,r.width],grid:cs.gridTemplateColumns,minWidth:cs.minWidth,width:cs.width}}).slice(0,12);
      return {lang:document.documentElement.lang,root:!!root,states,keyStates:[...keyStates],fieldStates:[...fieldStates],statusTones:[...statusTones],legendTones:[...legendTones],requiredPresent:required.every(value=>present.has(value)),requiredComponents,styleCount:document.querySelectorAll('#ironsight-ui-tokens').length,footer:!!document.querySelector('[data-showcase-region="fixed-footer"]'),scrollBody:!!scrollBody,horizontalOverflow:document.documentElement.scrollWidth>innerWidth||scrollBody?.scrollWidth>scrollBody?.clientWidth,overflowMetrics:{document:[document.documentElement.scrollWidth,innerWidth],body:scrollBody?[scrollBody.scrollWidth,scrollBody.clientWidth]:null,elements:overflowElements}};
    });
    const snap=await snapshot(page,{interactive:true});
    return {focus,motion:{rest,midpoint,settled:hover},hover,nativeHover,nativeHoverError,dom,snapshotTree:snap.tree};
  `);
}

async function inspectFontFailure(context) {
  return replJson(context.repl, `
    await page.locator('[data-showcase-action="font-fallback"]').click();
    await sleep(200);
    return await page.evaluate(()=>{
      const root=document.querySelector('#uiShowcase');
      const stress=document.querySelector('[data-showcase-stress="korean-long-text"]');
      const style=stress?getComputedStyle(stress):null;
      const faces=[...document.fonts].filter(face=>face.family.includes('Noto Sans KR')||face.family.includes('Barlow Condensed')).map(face=>({family:face.family,status:face.status,weight:face.weight}));
      return {fallbackEnabled:root?.dataset.fontFallback==='true',notoCheck:document.fonts.check('16px "Noto Sans KR"','가나다'),barlowCheck:document.fonts.check('24px "Barlow Condensed"','IRONSIGHT'),faces,ownedFacesLoaded:faces.some(face=>face.status==='loaded'),fontFamily:style?.fontFamily??null,horizontalOverflow:document.documentElement.scrollWidth>innerWidth||document.querySelector('[data-showcase-region="scroll-body"]')?.scrollWidth>document.querySelector('[data-showcase-region="scroll-body"]')?.clientWidth};
    });
  `);
}

async function inspectLongText(context) {
  return replJson(context.repl, `
    await page.evaluate(()=>{document.querySelector('#uiShowcase').dataset.longCapture='true';document.querySelector('[data-showcase-region="scroll-body"]').scrollTop=0});
    await sleep(160);
    return await page.evaluate(()=>{
      const stress=document.querySelector('[data-showcase-stress="korean-long-text"]');
      const footer=document.querySelector('[data-showcase-region="fixed-footer"]');
      const stressRect=stress?.getBoundingClientRect()??null;
      const fixedFooterRect=footer?.getBoundingClientRect()??null;
      const rect=stressRect?{top:stressRect.top,right:stressRect.right,bottom:stressRect.bottom,left:stressRect.left,width:stressRect.width,height:stressRect.height}:null;
      const footerRect=fixedFooterRect?{top:fixedFooterRect.top,right:fixedFooterRect.right,bottom:fixedFooterRect.bottom,left:fixedFooterRect.left,width:fixedFooterRect.width,height:fixedFooterRect.height}:null;
      return {text:stress?.textContent??'',rect,footerRect,footerVisible:!!footerRect&&footerRect.top<innerHeight&&footerRect.bottom<=innerHeight,horizontalOverflow:document.documentElement.scrollWidth>innerWidth||document.querySelector('[data-showcase-region="scroll-body"]')?.scrollWidth>document.querySelector('[data-showcase-region="scroll-body"]')?.clientWidth};
    });
  `);
}

async function inspectScrollModal(context) {
  return replJson(context.repl, `
    await page.locator('[data-showcase-action="open-modal"]').click();
    const body=page.locator('[data-showcase-region="scroll-body"]');
    await body.evaluate(node=>{node.scrollTop=node.scrollHeight});
    await sleep(200);
    return await page.evaluate(()=>{
      const modal=document.querySelector('.ui-scroll-modal');
      const header=modal?.querySelector('.ui-scroll-modal__header')?.getBoundingClientRect();
      const footer=modal?.querySelector('.ui-scroll-modal__footer')?.getBoundingClientRect();
      const modalRect=modal?.getBoundingClientRect();
      return {visible:!!modalRect&&modalRect.top<innerHeight&&modalRect.bottom>0,headerVisible:!!header&&header.top>=0&&header.bottom<=innerHeight,footerVisible:!!footer&&footer.top>=0&&footer.bottom<=innerHeight,bodyScrollable:!!modal&&modal.querySelector('.ui-scroll-modal__body').scrollHeight>=modal.querySelector('.ui-scroll-modal__body').clientHeight};
    });
  `);
}

async function inspectBrowserZoom(context) {
  return replJson(context.repl, `
    const before=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,scale:visualViewport?.scale??1}));
    let shortcutError=null;
    try{for(let i=0;i<5;i+=1)await page.keyboard.press('Control++');await sleep(500)}catch(error){shortcutError=error.name+': '+error.message}
    const after=await page.evaluate(()=>{const footer=document.querySelector('[data-showcase-region="fixed-footer"]')?.getBoundingClientRect();return {width:innerWidth,height:innerHeight,dpr:devicePixelRatio,scale:visualViewport?.scale??1,horizontalOverflow:document.documentElement.scrollWidth>innerWidth,footerVisible:!!footer&&footer.top<innerHeight&&footer.bottom<=innerHeight}});
    let resetError=null;
    try{await page.keyboard.press('Control+0');await sleep(300)}catch(error){resetError=error.name+': '+error.message}
    return {before,after,ratio:before.width/after.width,shortcutError,resetError};
  `, { allowError: true, timeoutMs: 30_000 });
}

async function inspectSmallMenu(context) {
  return replJson(context.repl, `
    const supported=typeof page.setViewportSize==='function';
    let error=null;
    if(supported){try{await page.setViewportSize({width:375,height:812});await sleep(300)}catch(cause){error=cause.name+': '+cause.message}}
    const observed=await page.evaluate(()=>{const footer=document.querySelector('[data-showcase-region="fixed-footer"]')?.getBoundingClientRect();return {css:[innerWidth,innerHeight],horizontalOverflow:document.documentElement.scrollWidth>innerWidth,footerVisible:!!footer&&footer.top<innerHeight&&footer.bottom<=innerHeight}});
    return {supported,error,observed};
  `, { allowError: true, timeoutMs: 30_000 });
}

function caseResult(id, passed, observations, artifact, failureCode, unqualified = false) {
  const artifacts = artifact ? [artifact] : [];
  if (passed && artifact) return { id, verdict: VERDICT.PASS, reasons: [], observations, artifacts };
  const code = artifact ? failureCode : 'screenshot_unavailable';
  return { id, verdict: unqualified || !artifact ? VERDICT.UNQUALIFIED : VERDICT.FAIL, reasons: [reason(code)], observations, artifacts };
}

async function runUiPrimitives(context) {
  const buildDir = path.join(context.outputDir, 'showcase-build');
  const manifest = await buildUiShowcase(buildDir);
  const bundle = await readFile(path.join(buildDir, 'showcase.js'));
  let opened = false;
  let ownership = null;
  const observations = { manifest };
  try {
    ownership = await installShowcase(context, bundle);
    opened = true;
    observations.ownership = ownership;
    if (ownership.setupError) throw new Error(`showcase setup failed: ${ownership.setupError}`);

    const allStates = await inspectAllStates(context);
    const allStatesShot = await screenshot(context, 'all-states');
    observations.allStates = allStates;

    const fontFailure = await inspectFontFailure(context);
    const fontShot = await screenshot(context, 'font-fallback');
    observations.fontFailure = fontFailure;

    const longText = await inspectLongText(context);
    const longTextShot = await screenshot(context, 'korean-long-text');
    observations.longText = longText;
    await replJson(context.repl, `return await page.evaluate(()=>{document.querySelector('#uiShowcase')?.removeAttribute('data-long-capture');return {restored:true}})`);

    const modal = await inspectScrollModal(context);
    const modalShot = await screenshot(context, 'scroll-modal');
    observations.modal = modal;
    const modalLifecycle = await replJson(context.repl, `await page.evaluate(()=>document.querySelector('#uiShowcase')?.removeAttribute('data-modal-capture'));await page.locator('[data-ui-modal-close]').click();return await page.evaluate(()=>({hidden:document.querySelector('.ui-scroll-modal')?.hidden===true,focusRestored:document.activeElement===document.querySelector('[data-showcase-action="open-modal"]')}))`);
    observations.modalLifecycle = modalLifecycle;

    const zoom = await inspectBrowserZoom(context);
    const zoomArtifact = zoom.ratio >= 1.9
      ? (await screenshot(context, 'zoom-200')).artifact
      : await context.writeArtifact('traces/ui-primitives-zoom-unavailable.json', zoom);
    observations.zoom = zoom;

    const small = await inspectSmallMenu(context);
    const smallArtifact = small.supported && !small.error
      ? (await screenshot(context, 'small-menu')).artifact
      : await context.writeArtifact('traces/ui-primitives-small-viewport-unavailable.json', small);
    observations.small = small;

    const factsArtifact = await context.writeArtifact('traces/ui-primitives-computed.json', observations);
    const commonArtifacts = [factsArtifact];
    const cases = [
      caseResult(context.definition.cases[0], allStates.dom.root && allStates.dom.requiredPresent && allStates.dom.requiredComponents && allStates.dom.styleCount === 1 && allStates.focus.outlineWidth === '2px' && allStates.nativeHover?.matches && allStates.nativeHover.backgroundColor === 'rgb(43, 52, 45)' && allStates.nativeHover.borderColor === 'rgb(233, 203, 143)' && !allStates.dom.horizontalOverflow, allStates, allStatesShot.artifact, allStates.nativeHoverError ? 'native_hover_unavailable' : 'control_state_mismatch', Boolean(allStates.nativeHoverError)),
      caseResult(context.definition.cases[1], ownership.fontRoute && fontFailure.fallbackEnabled && fontFailure.faces.length === 3 && !fontFailure.ownedFacesLoaded && fontFailure.fontFamily.includes('Malgun Gothic') && !fontFailure.horizontalOverflow, fontFailure, fontShot.artifact, 'font_failure_layout_mismatch', !ownership.fontRoute),
      caseResult(context.definition.cases[2], longText.text.length > 80 && longText.footerVisible && !longText.horizontalOverflow, longText, longTextShot.artifact, 'korean_content_overflow'),
      caseResult(context.definition.cases[3], zoom.ratio >= 1.9 && zoom.after.footerVisible && !zoom.after.horizontalOverflow, zoom, zoomArtifact, 'browser_zoom_unavailable', zoom.ratio < 1.9),
      caseResult(context.definition.cases[4], small.supported && !small.error && small.observed.css[0] === 375 && small.observed.footerVisible && !small.observed.horizontalOverflow, small, smallArtifact, 'small_viewport_unavailable', !small.supported || Boolean(small.error)),
    ];
    if (modalShot.artifact) cases[0].artifacts.push(modalShot.artifact);
    if (!(modal.visible && modal.headerVisible && modal.footerVisible && modal.bodyScrollable && modalLifecycle.hidden && modalLifecycle.focusRestored)) {
      cases[0].verdict = VERDICT.FAIL;
      cases[0].reasons = [reason('scroll_modal_visibility_mismatch')];
    }
    for (const item of cases) item.artifacts.push(...commonArtifacts);
    return { cases, inputProvenance: 'Aside locator, keyboard, page viewport feature detection, DOM and computed-style inspection', observations };
  } finally {
    let closeReceipt = null;
    if (opened) {
      try { closeReceipt = await closeOwnedTab(context.repl); }
      catch (error) { closeReceipt = { error: errorMessage(error) }; }
    }
    context.recordCleanup({ opened, ownedTargetId: ownership?.ownedTargetId ?? null, closeReceipt });
  }
}

async function runUiCopy(context) {
  let opened = false;
  let ownedTargetId = null;
  const observations = {};
  try {
    const ownership = await replJson(context.repl, `
      const before=await listBrowserTabs();
      const beforeIds=new Set(before.map(item=>item.targetId));
      await openTab(${JSON.stringify(context.url)});
      await page.locator('#modeMenu').waitFor({state:'visible',timeout:30000});
      const tabs=await listBrowserTabs();
      const owned=tabs.filter(item=>!beforeIds.has(item.targetId));
      return {ownedTargetId:owned.length===1?owned[0].targetId:null,url:page.url()};
    `, { timeoutMs: 35_000 });
    opened = true;
    ownedTargetId = ownership.ownedTargetId;
    observations.ownership = ownership;

    const dom = await replJson(context.repl, `
      return await page.evaluate(()=>{
        const modeLabels=[...document.querySelectorAll('.playlist .ko')].map(node=>node.textContent?.trim()??'');
        const mapNames=[...document.querySelectorAll('.siteCard > span')].map(node=>node.childNodes[0]?.textContent?.trim()??'');
        const visibleText=document.querySelector('#modeMenu')?.textContent??'';
        const expectedModes=['팀 데스매치','개인전','거점 점령','연습 모드'];
        const expectedMaps=['통신 참호선','운하 교두보','전선 보급역'];
        const codepoints=values=>values.map(value=>[...value].map(character=>character.codePointAt(0)));
        return {lang:document.documentElement.lang,viewport:[innerWidth,innerHeight],modeCodepoints:codepoints(modeLabels),mapCodepoints:codepoints(mapNames),modeLabelsMatched:expectedModes.every(label=>modeLabels.includes(label)),mapNamesMatched:expectedMaps.every(label=>mapNames.includes(label)),visibleTermsMatched:[...expectedModes,...expectedMaps].every(label=>visibleText.includes(label)),hasHangul:/[가-힣]/.test(visibleText),hasHorizontalOverflow:document.documentElement.scrollWidth>innerWidth};
      });
    `);
    observations.dom = dom;
    const shot = await screenshot(context, 'copy', 'ui-copy');
    observations.capture = shot.captured;
    const factsArtifact = await context.writeArtifact('traces/ui-copy-observed.json', observations);
    const artifacts = [factsArtifact, ...(shot.artifact ? [shot.artifact] : [])];
    const modesAndMaps = dom.modeLabelsMatched && dom.mapNamesMatched;
    const koreanTerms = dom.lang === 'ko' && dom.visibleTermsMatched && dom.hasHangul && !dom.hasHorizontalOverflow;
    const resultBuild = await build({
      bundle: true,
      format: 'iife',
      legalComments: 'none',
      minify: false,
      platform: 'browser',
      target: ['es2022'],
      write: false,
      stdin: {
        contents: `
          import { Hud } from './client/hud.ts';
          import { SettingsStore } from './client/settings.ts';
          const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
          const hud = new Hud(new SettingsStore(storage));
          hud.showMatchEnd('draw', 0, 0, 0, 0, true, {
            won: false,
            rows: [
              { name: '\\u0000\\u202e', k: 0, d: 0, team: 0, isMe: false },
              { name: "<의무병 & 'A'>", k: 2, d: 1, team: 0, isMe: false },
              { name: '가'.repeat(80), k: 1, d: 2, team: 0, isMe: false },
            ],
          });
          document.body.dataset.uiCopyResultFixture = 'production-hud';
        `,
        loader: 'ts',
        resolveDir: appRoot,
        sourcefile: 'ui-copy-result-entry.ts',
      },
    });
    const resultSource = Buffer.from(resultBuild.outputFiles[0].contents).toString('base64');
    const resultDom = await replJson(context.repl, `
      const source=Buffer.from('${resultSource}','base64').toString('utf8');
      await page.evaluate(code=>{document.body.replaceChildren();new Function(code)()},source);
      await page.locator('#overlay[data-kind="end"]').waitFor({state:'visible',timeout:30000});
      return await page.evaluate(()=>{
        const cells=[...document.querySelectorAll('.result-view tbody tr td:first-child')];
        const names=cells.map(cell=>cell.textContent??'');
        const unknown='이름 없는 전투원';
        const special="<의무병 & 'A'>";
        const compact='가'.repeat(24)+'…';
        const specialCell=cells.find(cell=>cell.textContent===special);
        return {fixture:document.body.dataset.uiCopyResultFixture,unknownPresent:names.includes(unknown),specialTextPresent:names.includes(special),specialEscaped:Boolean(specialCell)&&specialCell.children.length===0&&specialCell.innerHTML.includes('&lt;')&&specialCell.innerHTML.includes('&amp;')&&specialCell.innerHTML.includes('&gt;'),compactPresent:names.includes(compact),rowCount:names.length,horizontalOverflow:document.documentElement.scrollWidth>innerWidth};
      });
    `, { timeoutMs: 35_000 });
    observations.resultFixture = resultDom;
    const resultShot = await screenshot(context, 'result-names', 'ui-copy');
    const resultArtifact = await context.writeArtifact('traces/ui-copy-result-fixture.json', resultDom);
    const resultArtifacts = [resultArtifact, ...(resultShot.artifact ? [resultShot.artifact] : [])];
    const missingNamePassed = resultDom.fixture === 'production-hud' && resultDom.unknownPresent && resultDom.rowCount === 3 && !resultDom.horizontalOverflow;
    const escapingPassed = resultDom.specialTextPresent && resultDom.specialEscaped && resultDom.compactPresent && !resultDom.horizontalOverflow;
    return {
      cases: [
        { id: context.definition.cases[0], verdict: modesAndMaps && shot.artifact ? VERDICT.PASS : shot.artifact ? VERDICT.FAIL : VERDICT.UNQUALIFIED, reasons: modesAndMaps && shot.artifact ? [] : [reason(shot.artifact ? 'copy_term_mismatch' : 'screenshot_unavailable')], observations: { modeLabelsMatched: dom.modeLabelsMatched, mapNamesMatched: dom.mapNamesMatched, modeCodepoints: dom.modeCodepoints, mapCodepoints: dom.mapCodepoints }, artifacts },
        { id: context.definition.cases[1], verdict: koreanTerms && shot.artifact ? VERDICT.PASS : shot.artifact ? VERDICT.FAIL : VERDICT.UNQUALIFIED, reasons: koreanTerms && shot.artifact ? [] : [reason(shot.artifact ? 'korean_document_mismatch' : 'screenshot_unavailable')], observations: { lang: dom.lang, viewport: dom.viewport, visibleTermsMatched: dom.visibleTermsMatched, hasHangul: dom.hasHangul, hasHorizontalOverflow: dom.hasHorizontalOverflow }, artifacts },
        { id: context.definition.cases[2], verdict: missingNamePassed && resultShot.artifact ? VERDICT.PASS : resultShot.artifact ? VERDICT.FAIL : VERDICT.UNQUALIFIED, reasons: missingNamePassed && resultShot.artifact ? [] : [reason(resultShot.artifact ? 'missing_name_presentation_mismatch' : 'screenshot_unavailable')], observations: resultDom, artifacts: resultArtifacts },
        { id: context.definition.cases[3], verdict: escapingPassed && resultShot.artifact ? VERDICT.PASS : resultShot.artifact ? VERDICT.FAIL : VERDICT.UNQUALIFIED, reasons: escapingPassed && resultShot.artifact ? [] : [reason(resultShot.artifact ? 'escaping_presentation_mismatch' : 'screenshot_unavailable')], observations: resultDom, artifacts: resultArtifacts },
      ],
      inputProvenance: 'Actual loopback deployment menu DOM plus production Hud.showMatchEnd mounted with a typed presentation-only ResultRoster fixture; no live match/server authority claimed',
      observations,
    };
  } finally {
    let closeReceipt = null;
    if (opened) {
      try { closeReceipt = await closeOwnedTab(context.repl); }
      catch (error) { closeReceipt = { error: errorMessage(error) }; }
    }
    context.recordCleanup({ opened, ownedTargetId, closeReceipt });
  }
}

async function runUiDeploy(context) {
  let opened = false;
  let ownedTargetId = null;
  const observations = {};
  const artifacts = {};
  const failures = {};
  try {
    const ownership = await replJson(context.repl, `
      const before=await listBrowserTabs();
      const beforeIds=new Set(before.map(item=>item.targetId));
      await openTab('about:blank');
      let fetchRecovery=null;
      try{await page.cdp.send('Fetch.disable');fetchRecovery={disabled:true}}catch(error){fetchRecovery={disabled:false,error:error.name+': '+error.message}}
      await page.goto(${JSON.stringify(context.url)});
      await page.locator('#modeMenu').waitFor({state:'visible',timeout:30000});
      const tabs=await listBrowserTabs();const owned=tabs.filter(item=>!beforeIds.has(item.targetId));
      return {ownedTargetId:owned.length===1?owned[0].targetId:null,fetchRecovery,url:page.url()};
    `, { timeoutMs: 40_000 });
    opened = true; ownedTargetId = ownership.ownedTargetId; observations.ownership = ownership;

    try {
      observations.selection = await replJson(context.repl, `
        const modeResults=[];
        for(const id of ['tdm','ffa','dom','practice']){
          const button=page.locator('.playlist[data-mode="'+id+'"]');await button.click();
          modeResults.push(await page.evaluate(id=>({id,pressed:document.querySelector('.playlist[data-mode="'+id+'"]')?.getAttribute('aria-pressed')??null,flow:document.querySelector('#modeMenu')?.dataset.flow??null}),id));
        }
        const siteResults=[];
        for(const id of ['arena1','arena2','arena3']){
          const button=page.locator('.siteCard[data-map="'+id+'"]');await button.click();
          siteResults.push(await page.evaluate(id=>({id,pressed:document.querySelector('.siteCard[data-map="'+id+'"]')?.getAttribute('aria-pressed')??null,vista:document.querySelector('#modeMenu .vista')?.dataset.site??null}),id));
        }
        return await page.evaluate(({modeResults,siteResults})=>{const c=document.querySelector('.deploy')?.getBoundingClientRect();return {modeResults,siteResults,viewport:[innerWidth,innerHeight],deployVisible:!!c&&c.top>=0&&c.bottom<=innerHeight&&!document.querySelector('.deploy')?.disabled,horizontalOverflow:document.documentElement.scrollWidth>innerWidth}}, {modeResults,siteResults});
      `);
      artifacts.selection = (await screenshot(context, 'selection', 'ui-deploy')).artifact;
    } catch (error) { failures.selection = errorMessage(error); }

    try {
      observations.asset404 = await replJson(context.repl, `
        const injectedUrl='/assets/ui-deploy-intentional-missing.webp';
        await page.evaluate(url=>{const probe=new Image();probe.hidden=true;probe.dataset.uiDeployAssetProbe='pending';probe.addEventListener('error',()=>{probe.dataset.uiDeployAssetProbe='error'},{once:true});probe.src=url;document.body.append(probe)},injectedUrl);
        await sleep(400);
        const dom=await page.evaluate(url=>{const root=document.querySelector('#modeMenu'),cta=document.querySelector('.deploy')?.getBoundingClientRect(),probe=document.querySelector('[data-ui-deploy-asset-probe]');const style=root?getComputedStyle(root):null;const resource=performance.getEntriesByName(new URL(url,location.href).href).at(-1);return {injectedUrl:url,errorEvent:probe?.dataset.uiDeployAssetProbe==='error',requestSettled:probe instanceof HTMLImageElement&&probe.complete,naturalWidth:probe instanceof HTMLImageElement?probe.naturalWidth:null,responseStatus:resource&&'responseStatus'in resource?resource.responseStatus:null,menuVisible:!!root,ctaVisible:!!cta&&cta.top>=0&&cta.bottom<=innerHeight,backing:style?.backgroundColor??null,horizontalOverflow:document.documentElement.scrollWidth>innerWidth}},injectedUrl);
        return dom;
      `, { allowError: true, timeoutMs: 30_000 });
      artifacts.asset404 = (await screenshot(context, 'asset404', 'ui-deploy')).artifact;
    } catch (error) { failures.asset404 = errorMessage(error); }
    observations.asset404Cleanup = await replJson(context.repl, `let disabled=false,error=null;try{await page.cdp.send('Fetch.disable');disabled=true}catch(cause){error=cause.name+': '+cause.message}if(globalThis.__uiDeployFetchHandler&&typeof page?.cdp?.off==='function')page.cdp.off('Fetch.requestPaused',globalThis.__uiDeployFetchHandler);delete globalThis.__uiDeployFetchHandler;delete globalThis.__uiDeployFetchFailures;return {disabled,error}`, { allowError: true });

    const directUrl = new URL(context.url); directUrl.searchParams.set('mode', 'practice'); directUrl.searchParams.set('map', 'arena3');
    try {
      observations.direct = await replJson(context.repl, `
        await page.goto(${JSON.stringify(directUrl.href)});
        const stages=[];const started=Date.now();let sample=null;
        while(Date.now()-started<95000){
          sample=await page.evaluate(()=>({canvas:!!document.querySelector('#app > canvas'),inert:document.querySelector('#app > canvas')?.inert??null,ready:performance.getEntriesByName('ironsight-play-ready').length>0,flow:document.querySelector('#deployment-flow')?.dataset.flow??null,menu:!!document.querySelector('#modeMenu'),viewport:[innerWidth,innerHeight]}));
          const signature=JSON.stringify(sample);if(stages.at(-1)?.signature!==signature)stages.push({at:Date.now()-started,signature,sample});
          if(sample.ready&&sample.inert===false)break;await sleep(500);
        }
        return {url:page.url(),sample,stages,elapsedMs:Date.now()-started,canvasCount:await page.evaluate(()=>document.querySelectorAll('#app > canvas').length)};
      `, { timeoutMs: 105_000 });
      artifacts.direct = (await screenshot(context, 'direct-ready', 'ui-deploy')).artifact;
    } catch (error) { failures.direct = errorMessage(error); }

    try {
      observations.lock = await replJson(context.repl, `
        const button=page.locator('#deployment-flow .deployment-flow__actions button').first();
        const before=await page.evaluate(()=>({lock:document.pointerLockElement?.tagName??null,flow:document.querySelector('#deployment-flow')?.dataset.flow??null}));
        await button.click();await sleep(500);
        const after=await page.evaluate(()=>({lock:document.pointerLockElement?.tagName??null,flow:document.querySelector('#deployment-flow')?.dataset.flow??null,title:document.querySelector('#deployment-flow h1')?.textContent??null,retryVisible:!!document.querySelector('#deployment-flow .deployment-flow__actions button:not([hidden])')}));
        await button.click();await sleep(300);
        const retry=await page.evaluate(()=>({lock:document.pointerLockElement?.tagName??null,flow:document.querySelector('#deployment-flow')?.dataset.flow??null}));
        return {before,after,retry};
      `, { allowError: true, timeoutMs: 30_000 });
      artifacts.lock = (await screenshot(context, 'lock-rejection', 'ui-deploy')).artifact;
    } catch (error) { failures.lock = errorMessage(error); }

    try {
      observations.retry = await replJson(context.repl, `
        await page.goto(${JSON.stringify(directUrl.href)});
        const started=Date.now();let sample=null;
        while(Date.now()-started<95000){sample=await page.evaluate(()=>({ready:performance.getEntriesByName('ironsight-play-ready').length>0,inert:document.querySelector('#app > canvas')?.inert??null,flow:document.querySelector('#deployment-flow')?.dataset.flow??null}));if(sample.ready&&sample.inert===false)break;await sleep(500)}
        return {sample,elapsedMs:Date.now()-started,url:page.url(),canvasCount:await page.evaluate(()=>document.querySelectorAll('#app > canvas').length)};
      `, { timeoutMs: 105_000 });
      artifacts.retry = (await screenshot(context, 'retry-ready', 'ui-deploy')).artifact;
    } catch (error) { failures.retry = errorMessage(error); }

    const facts = await context.writeArtifact('traces/ui-deploy-observed.json', { observations, failures });
    const selection = observations.selection;
    const direct = observations.direct;
    const lock = observations.lock;
    const retry = observations.retry;
    const asset404 = observations.asset404;
    const viewportQualified = selection?.viewport?.[0] === context.viewport[0] && selection?.viewport?.[1] === context.viewport[1];
    const selectionPassed = selection?.modeResults?.every(item => item.pressed === 'true' && item.flow === 'menu') && selection?.siteResults?.every(item => item.pressed === 'true' && item.vista === item.id) && selection.deployVisible && !selection.horizontalOverflow;
    const readyPassed = direct?.sample?.ready && direct.sample.inert === false && retry?.sample?.ready && retry.sample.inert === false && direct.canvasCount === 1 && retry.canvasCount === 1;
    const assetPassed = asset404?.errorEvent && asset404.requestSettled && asset404.naturalWidth === 0 && asset404.menuVisible && asset404.ctaVisible && asset404.backing !== 'rgba(0, 0, 0, 0)' && !asset404.horizontalOverflow && observations.asset404Cleanup?.disabled;
    const lockPassed = lock?.before?.lock === null && lock?.after?.lock === null && lock?.after?.flow === 'control-required' && lock.after.retryVisible && lock?.retry?.flow === 'control-required';
    const directPassed = direct?.url === directUrl.href && !direct?.sample?.menu && direct?.sample?.ready && direct.sample.inert === false;
    const withFacts = artifact => [facts, ...(artifact ? [artifact] : [])];
    const result = (index, passed, observed, artifact, code, failure) => ({
      id: context.definition.cases[index],
      verdict: !artifact ? VERDICT.UNQUALIFIED : !passed ? VERDICT.FAIL : viewportQualified ? VERDICT.PASS : VERDICT.UNQUALIFIED,
      reasons: artifact && passed && viewportQualified ? [] : [reason(!artifact ? 'screenshot_unavailable' : !passed ? code : 'requested_viewport_unavailable')],
      observations: observed ?? { available: false, error: failure ?? 'observation unavailable' },
      artifacts: withFacts(artifact),
    });
    return {
      cases: [
        result(0, selectionPassed, selection, artifacts.selection, 'deployment_selection_mismatch', failures.selection),
        result(1, readyPassed, { first: direct ?? null, retry: retry ?? null }, artifacts.retry, 'deployment_readiness_retry_mismatch', failures.direct ?? failures.retry),
        result(2, assetPassed, asset404, artifacts.asset404, 'asset_failure_fallback_mismatch', failures.asset404),
        result(3, lockPassed, lock, artifacts.lock, 'lock_rejection_recovery_mismatch', failures.lock),
        result(4, directPassed, direct, artifacts.direct, 'direct_url_destination_mismatch', failures.direct),
      ],
      inputProvenance: 'Actual loopback menu selections, direct navigation, repeated deployment, a real missing image request, and trusted Aside locator clicks; pointer lock is never synthesized',
      observations: { observations, failures, requestedViewport: context.viewport, viewportQualified },
    };
  } finally {
    let closeReceipt = null;
    if (opened) {
      try { closeReceipt = await closeOwnedTab(context.repl); }
      catch (error) { closeReceipt = { error: errorMessage(error) }; }
    }
    context.recordCleanup({ opened, ownedTargetId, closeReceipt });
  }
}

async function runUiSettings(context) {
  let opened = false;
  let ownedTargetId = null;
  const observations = {};
  const artifacts = {};
  const captures = {};
  const failures = {};
  const stepUrl = step => { const url = new URL(context.url); url.searchParams.set('ui-settings-step', step); return url.href; };
  try {
    const ownership = await replJson(context.repl, `
      const before=await listBrowserTabs();const beforeIds=new Set(before.map(item=>item.targetId));
      await openTab(${JSON.stringify(context.url)});await page.locator('#modeMenu').waitFor({state:'visible',timeout:30000});
      const owned=(await listBrowserTabs()).filter(item=>!beforeIds.has(item.targetId));
      return {ownedTargetId:owned.length===1?owned[0].targetId:null,url:page.url(),viewport:[await page.evaluate(()=>innerWidth),await page.evaluate(()=>innerHeight)]};
    `, { timeoutMs: 40_000 });
    opened = true; ownedTargetId = ownership.ownedTargetId; observations.ownership = ownership;

    try {
      observations.menu = await replJson(context.repl, `
        await page.locator('#modeMenu .settingsBtn').click();await page.locator('body > #settingsPanel').waitFor({state:'visible'});
        const before=await page.locator('body > #settingsPanel [data-setting="sensitivity"]').inputValue();
        await page.locator('body > #settingsPanel [data-setting="sensitivity"]').fill('1.35');
        const edited=await page.evaluate(()=>{const panel=document.querySelector('body > #settingsPanel');return {value:panel?.querySelector('[data-setting="sensitivity"]')?.value,status:panel?.querySelector('.settings-status')?.textContent,menuHidden:getComputedStyle(document.querySelector('#modeMenu')).display==='none'}});
        return {before,edited,dialogRole:await page.locator('body > #settingsPanel').getAttribute('role')};
      `);
      artifacts.menu = (await screenshot(context, 'menu-edit', 'ui-settings')).artifact;
    } catch (error) { failures.menu = errorMessage(error); }

    try {
      observations.lastRow = await replJson(context.repl, `
        await page.locator('body > #settingsPanel [role=tab]').nth(1).click();
        const last=page.locator('body > #settingsPanel .bind-row').last();await last.scrollIntoViewIfNeeded();
        return await page.evaluate(()=>{const panel=document.querySelector('body > #settingsPanel'),row=panel?.querySelector('.bind-row:last-child')?.getBoundingClientRect(),footer=panel?.querySelector('.settings-footer')?.getBoundingClientRect(),body=panel?.querySelector('.settings-body');return {row:row&&{top:row.top,bottom:row.bottom},footer:footer&&{top:footer.top,bottom:footer.bottom},footerVisible:!!footer&&footer.top>=0&&footer.bottom<=innerHeight,bodyScrolls:!!body&&body.scrollHeight>body.clientHeight,horizontalOverflow:document.documentElement.scrollWidth>innerWidth}});
      `);
      const capture = await screenshot(context, 'last-row', 'ui-settings'); artifacts.lastRow = capture.artifact; captures.lastRow = capture.captured;
    } catch (error) { failures.lastRow = errorMessage(error); }

    try {
      observations.persist = await replJson(context.repl, `
        await page.locator('body > #settingsPanel .settings-footer .ui-button[data-tone="accent"]').click();
        await page.goto(${JSON.stringify(stepUrl('persist'))});await page.locator('#modeMenu').waitFor({state:'visible',timeout:30000});await page.locator('#modeMenu .settingsBtn').click();await page.locator('body > #settingsPanel').waitFor({state:'visible'});
        return await page.evaluate(()=>({value:document.querySelector('body > #settingsPanel [data-setting="sensitivity"]')?.value,stored:JSON.parse(localStorage.getItem('ironsight.settings.v1')||'null')?.sensitivity,lang:document.documentElement.lang}));
      `);
      const capture = await screenshot(context, 'persisted', 'ui-settings'); artifacts.persist = capture.artifact; captures.persist = capture.captured;
    } catch (error) { failures.persist = errorMessage(error); }

    try {
      observations.conflict = await replJson(context.repl, `
        await page.goto(${JSON.stringify(stepUrl('conflict'))});await page.locator('#modeMenu').waitFor({state:'visible',timeout:30000});await page.locator('#modeMenu .settingsBtn').click();await page.locator('body > #settingsPanel').waitFor({state:'visible'});
        await page.locator('body > #settingsPanel [role=tab]').nth(1).click();
        await page.locator('body > #settingsPanel .bind-row').nth(9).locator('button').first().click();
        await page.keyboard.press('KeyR');
        return {ping:await page.locator('body > #settingsPanel .bind-row').nth(9).locator('button').first().textContent(),reload:await page.locator('body > #settingsPanel .bind-row').nth(7).locator('button').first().textContent(),capturing:await page.locator('body > #settingsPanel [data-capturing="true"]').count()>0};
      `);
      artifacts.conflict = (await screenshot(context, 'key-conflict', 'ui-settings')).artifact;
    } catch (error) { failures.conflict = errorMessage(error); }

    try {
      observations.storage = await replJson(context.repl, `
        await page.goto(${JSON.stringify(stepUrl('storage-failure'))});await page.locator('#modeMenu').waitFor({state:'visible',timeout:30000});await page.locator('#modeMenu .settingsBtn').click();await page.locator('body > #settingsPanel').waitFor({state:'visible'});
        await page.evaluate(()=>{globalThis.__uiNativeStorageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('intentional QA quota failure','QuotaExceededError')}});
        const input=page.locator('body > #settingsPanel [data-setting="sensitivity"]');await input.fill('1.55');
        const failure=await page.evaluate(()=>{const panel=document.querySelector('body > #settingsPanel');return {status:panel?.querySelector('.settings-status')?.textContent,state:panel?.querySelector('.settings-status')?.dataset.state,value:panel?.querySelector('[data-setting="sensitivity"]')?.value}});
        await page.evaluate(()=>{Storage.prototype.setItem=globalThis.__uiNativeStorageSet;delete globalThis.__uiNativeStorageSet;localStorage.setItem('ironsight.settings.v1','{')});
        await page.goto(${JSON.stringify(stepUrl('corrupt-recovery'))});await page.locator('#modeMenu').waitFor({state:'visible',timeout:30000});await page.locator('#modeMenu .settingsBtn').click();await page.locator('body > #settingsPanel').waitFor({state:'visible'});
        const corruptRecovery=await page.evaluate(()=>{const panel=document.querySelector('body > #settingsPanel');return {value:panel?.querySelector('[data-setting="sensitivity"]')?.value,status:panel?.querySelector('.settings-status')?.textContent}});
        return {failure,corruptRecovery};
      `, { allowError: true });
      artifacts.storage = (await screenshot(context, 'storage-failure', 'ui-settings')).artifact;
    } catch (error) { failures.storage = errorMessage(error); }

    try {
      observations.inGame = await replJson(context.repl, `
        const url=new URL(${JSON.stringify(context.url)});url.searchParams.set('mode','tdm');url.searchParams.delete('ui-settings-step');
        await page.goto(url.href);await page.locator('canvas').first().waitFor({state:'visible',timeout:90000});
        await page.locator('#deployment-flow').waitFor({state:'visible',timeout:90000});
        await page.locator('canvas').first().click({position:{x:320,y:220}});await new Promise(resolve=>setTimeout(resolve,500));
        const locked=await page.evaluate(()=>document.pointerLockElement instanceof HTMLCanvasElement);
        if(!locked)return {locked,inGameOpen:false,authoritativeDeath:false,panelClosed:false,overlayKind:document.querySelector('#overlay')?.dataset.kind??null};
        await page.keyboard.press('Escape');await page.locator('#quitConfirm').waitFor({state:'visible',timeout:5000});
        await page.locator('#quitConfirm .row button').nth(1).click();await page.locator('#settingsPanel').waitFor({state:'visible'});
        const inGameOpen=true;
        try{await page.locator('#settingsPanel').waitFor({state:'detached',timeout:45000})}catch{}
        return await page.evaluate(({locked,inGameOpen})=>{const overlay=document.querySelector('#overlay');const kind=overlay?.dataset.kind??null;return {locked,inGameOpen,authoritativeDeath:kind==='death',panelClosed:document.querySelector('#settingsPanel')===null,overlayKind:kind}}, {locked,inGameOpen});
      `, { allowError: true, timeoutMs: 150_000 });
      artifacts.inGame = (await screenshot(context, 'in-game-death', 'ui-settings')).artifact;
    } catch (error) { failures.inGame = errorMessage(error); }

    const finalShot = await screenshot(context, 'final', 'ui-settings');
    observations.screenshot = finalShot.captured;
    observations.captures = captures;
    const facts = await context.writeArtifact('traces/ui-settings-observed.json', { observations, failures });
    const viewportQualified = observations.ownership?.viewport?.[0] === context.viewport[0] && observations.ownership?.viewport?.[1] === context.viewport[1];
    const menuPassed = observations.menu?.edited?.value === '1.35' && observations.menu?.edited?.menuHidden && observations.menu?.dialogRole === 'dialog' && observations.inGame?.inGameOpen;
    const persistPassed = observations.persist?.value === '1.35' && observations.persist?.stored === 1.35 && observations.persist?.lang === 'ko';
    const lastPassed = observations.lastRow?.footerVisible && observations.lastRow?.bodyScrolls && !observations.lastRow?.horizontalOverflow;
    const storagePassed = observations.storage?.failure?.state === 'save-failed' && observations.storage?.failure?.value === '1.55' && observations.storage?.corruptRecovery?.value === '1';
    const conflictPassed = observations.conflict?.ping === 'R' && observations.conflict?.reload === '—' && !observations.conflict?.capturing;
    const result = (index, passed, observed, artifact, code, capability) => ({
      id: context.definition.cases[index],
      verdict: capability ? VERDICT.UNQUALIFIED : !artifact ? VERDICT.UNQUALIFIED : !passed ? VERDICT.FAIL : viewportQualified ? VERDICT.PASS : VERDICT.UNQUALIFIED,
      reasons: capability ? [reason(capability)] : artifact && passed && viewportQualified ? [] : [reason(!artifact ? 'screenshot_unavailable' : !passed ? code : 'requested_viewport_unavailable')],
      observations: observed ?? {},
      artifacts: [facts, ...(artifact ? [artifact] : [])],
    });
    return {
      cases: [
        result(0, menuPassed, { menu: observations.menu, inGame: observations.inGame }, artifacts.inGame ?? artifacts.menu, 'menu_settings_edit_mismatch', observations.inGame?.locked ? null : 'in_game_pointer_lock_unavailable'),
        result(1, persistPassed, observations.persist, artifacts.persist, 'settings_persistence_mismatch'),
        result(2, lastPassed, observations.lastRow, artifacts.lastRow, 'last_row_or_footer_unreachable'),
        result(3, storagePassed, observations.storage, artifacts.storage, 'storage_failure_recovery_mismatch'),
        result(4, conflictPassed, observations.conflict, artifacts.conflict, 'key_conflict_mismatch'),
        result(5, observations.inGame?.authoritativeDeath && observations.inGame?.panelClosed, observations.inGame, artifacts.inGame, 'death_did_not_close_settings', observations.inGame?.locked && observations.inGame?.authoritativeDeath ? null : 'authoritative_death_input_unavailable'),
      ],
      inputProvenance: 'Actual loopback menu controls, Storage failure/corruption injection, reload persistence, trusted keyboard capture, real pointer-lock acquisition, and observed replicated death. No death or pointer-lock authority is synthesized.',
      observations: { observations, failures, requestedViewport: context.viewport, viewportQualified },
    };
  } finally {
    let closeReceipt = null;
    if (opened) { try { closeReceipt = await closeOwnedTab(context.repl); } catch (error) { closeReceipt = { error: errorMessage(error) }; } }
    context.recordCleanup({ opened, ownedTargetId, closeReceipt });
  }
}

export const scenarioHandlers = Object.freeze({
  'ui-primitives': runUiPrimitives,
  'ui-copy': runUiCopy,
  'ui-deploy': runUiDeploy,
  'ui-settings': runUiSettings,
  'ui-combat-hud': runUiCombatHud,
});





