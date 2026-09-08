import { handlingProbe } from './handling-probe.mjs';
import { firstPlay, menuProbe } from './first-play.mjs';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const args = process.argv.slice(2);
const option = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const base = new URL(option('--url', 'http://localhost:8787'));
const shots = option('--shots', 'overview,cooling,relay,freight,spawn,vista,stress,menu,game').split(',');
if (args.includes('--assert-budgets') && !shots.some(s => s.endsWith('effects-stress'))) throw Error('--assert-budgets requires an effects-stress shot');
const reports = []; const errors = [];
const software = args.includes('--software');
const prefix = option('--prefix', 'relay');
if (!/^[\w-]+$/.test(prefix)) throw Error('Invalid filename prefix');
const output = fileURLToPath(new URL('../.inspect/', import.meta.url));
await mkdir(output, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'ironsight-inspect-'));
const edge = spawn(process.env.EDGE ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new', ...(software ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []), '--ignore-gpu-blocklist',
  '--window-size=1920,1080', '--hide-scrollbars', `--user-data-dir=${profile}`,
  '--remote-debugging-port=0', '--no-first-run', 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let launchError;
edge.on('error', error => { launchError = error; });
let ws;
const pending = new Map();
let sequence = 0;
const forbiddenNetwork = [];
let gameplay = false;
const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;
const click = async selector => {
  const pos = await evaluate(`(() => { const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...pos, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...pos, button: 'left', clickCount: 1 });
};
const waitFor = async expression => {
  const end = Date.now() + 60000;
  while (Date.now() < end) { try { if (await evaluate(expression)) return; } catch {} await delay(150); }
  throw Error(`Readiness timeout: ${expression}`);
};
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP timeout: ${method}`)); }, 25000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
try {
  let port;
  for (let i = 0; i < 100; i++) {
    if (launchError) throw launchError;
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; }
    catch { await delay(100); }
  }
  if (!port) throw Error('Edge did not start');
  const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = event => {
    const message = JSON.parse(event.data), request = pending.get(message.id);
    if (!gameplay && (message.method === "Network.webSocketCreated" ||
        (message.method === "Network.requestWillBeSent" && /\/api\/matchmake/.test(message.params.request.url))))
      forbiddenNetwork.push(message.params);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args);
    if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) errors.push(message.params.response);
    if (!request) return;
    pending.delete(message.id); clearTimeout(request.timer);
    if (message.error) request.reject(Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  };
  await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__inspectionSockets=[]; const NativeSocket=window.WebSocket; window.WebSocket=class extends NativeSocket { constructor(...args){super(...args);window.__inspectionSockets.push(this);} };` });
  if (args.includes('--isolated-tdm')) {
    const room = `arena-first-play-${Date.now()}`;
    reports.push({ isolation: room, note: 'Only matchmaking room routing is isolated; normal deployed server rules and clock.' });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `const fetchOriginal=window.fetch;window.fetch=async(...args)=>{const response=await fetchOriginal(...args);if(String(args[0]).includes('/api/matchmake?mode=tdm') && response.ok){const data=await response.json();data.room=${JSON.stringify(room)};return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});}return response;};` });
  }
  await send('Network.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  const browserVersion = await send('Browser.getVersion');
  for (const name of shots) {
    if (!/^[a-z-]+$/.test(name)) throw Error('Invalid shot name');
    const url = new URL(base);
    gameplay = ['audio', 'handling', 'journey', 'journey-match', 'menu-probe', 'game', 'flow', 'flow-undertow', 'self-respawn', 'tdm', 'dom', 'ffa', 'practice-two', 'practice-three', 'reconnect', 'onboarding'].includes(name);
    if (gameplay && !name.startsWith('flow') && !name.startsWith('journey')) {
      url.searchParams.set('mode', ['tdm', 'dom', 'ffa'].includes(name) ? name : 'practice');
      if (name.startsWith('practice-')) url.searchParams.set('map', name === 'practice-two' ? 'arena2' : 'arena3');
    }
    else if (!name.startsWith('menu') && !name.startsWith('flow') && !name.startsWith('journey')) {
      url.searchParams.set('inspect', name.startsWith('match-') ? 'match' : name.startsWith('weapon') || name.startsWith('reload-') ? 'weapon' : 'map');
      url.searchParams.set('shot', name);
      if (name.startsWith('weapon-')) {
        const weapon = ['ar', 'smg', 'shotgun', 'sniper', 'pistol'].indexOf(name.split('-')[1]);
        if (weapon > 0) url.searchParams.set('weapon', String(weapon));
      }
      if (name.startsWith('undertow-')) url.searchParams.set('map', 'arena2');
      if (name.startsWith('switchyard-')) url.searchParams.set('map', 'arena3');
      if (url.searchParams.get('inspect') === 'map') {
        for (const key of ['review-camera', 'review-enemy']) {
          const value = option(`--${key}`, null);
          if (value) url.searchParams.set(key, value);
        }
      }
    }
    if (name.endsWith('narrow')) await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
    else if (name.endsWith('short')) await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 600, deviceScaleFactor: 1, mobile: false });
    else if (name.endsWith('mobile')) await send('Emulation.setDeviceMetricsOverride', { width: 720, height: 900, deviceScaleFactor: 1, mobile: false });
    else await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: url.href });
    if (name.startsWith('journey')) {
      await firstPlay({ send, evaluate, click, waitFor, delay, matchOnly: name === 'journey-match', assertFixed: args.includes('--assert-first-play'),
        capture: async label => { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(output, `${prefix}-${label}.png`), Buffer.from(shot.data, 'base64')); },
        record: async entry => { reports.push(entry); await writeFile(join(output, `${prefix}-journey.json`), JSON.stringify({ reports, errors }, null, 2)); console.log(entry.stage, entry.elapsed ?? ''); },
      });
      continue;
    }
    if (name.startsWith('flow')) {
      await waitFor('!!document.querySelector("#modeMenu")');
      await click('[data-mode="practice"]');
      if (name === 'flow-undertow') await click('[data-map="arena2"]');
      await click('.deploy');
      if (name === 'flow-undertow' && !(await evaluate('new URLSearchParams(location.search).get("map") === "arena2"')))
        throw Error('Training site did not persist into deployment');
    }
    const expression = gameplay ? '!!window.ironsight?.state()?.players[window.ironsight.myId]'
      : name.startsWith('menu') ? '!!document.querySelector("#modeMenu")' : 'window.__inspectReady === true';
    await waitFor(expression);
    if (name.startsWith('menu')) {
      if (name === 'menu-undertow') await click('[data-mode="dom"]');
      if (name === 'menu-switchyard') await click('[data-mode="ffa"]');
      if (name.startsWith('menu-training')) {
        await click('[data-mode="practice"]'); await click('[data-map="arena2"]');
        if (!(await evaluate('document.querySelector("[data-map=arena2]").getAttribute("aria-pressed") === "true" && document.querySelector(".vista").dataset.site === "arena2"')))
          throw Error('Training site selection did not update presentation');
      }
      await evaluate('Promise.all([...document.images].map(i => i.decode().catch(()=>{})))');
      await delay(350);
    }
    if (name === 'menu-settings' || name === 'menu-settings-mobile') {
      await click('.settingsBtn');
      const key = async (code, modifiers = 0) => {
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: code, code, modifiers });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: code, code, modifiers });
      };
      if (!(await evaluate('document.activeElement === document.querySelector("#settingsPanel input") && document.querySelector("#settingsPanel").getAttribute("role") === "dialog"'))) throw Error('Settings dialog focus/semantics missing');
      await key('Tab', 8);
      if (!(await evaluate('document.activeElement === document.querySelector("#settingsPanel .bottomRow button:last-child")'))) throw Error('Settings backward focus wrap failed');
      await key('Tab');
      if (!(await evaluate('document.activeElement === document.querySelector("#settingsPanel input")'))) throw Error('Settings forward focus wrap failed');
      await evaluate('document.querySelector("#settingsPanel input").value="1.35"; document.querySelector("#settingsPanel input").dispatchEvent(new Event("input",{bubbles:true}))');
      await evaluate('const motion=document.querySelector("[data-setting=reduced-motion]"); motion.checked=true; motion.dispatchEvent(new Event("change",{bubbles:true})); const volume=document.querySelector("[data-setting=volume]"); volume.value="0.35"; volume.dispatchEvent(new Event("input",{bubbles:true}));');
      await click('#settingsPanel .keyBtn'); await key('Escape');
      if (!(await evaluate('!!document.querySelector("#settingsPanel") && !document.querySelector(".capturing")'))) throw Error('Escape did not cancel key capture');
      await key('Escape');
      if (!(await evaluate('!document.querySelector("#settingsPanel") && document.activeElement === document.querySelector(".settingsBtn")'))) throw Error('Settings close/focus restoration failed');
      await click('.settingsBtn');
      if (!(await evaluate('document.querySelector("#settingsPanel input").value === "1.35"'))) throw Error('Settings value did not persist');
      if (!(await evaluate('document.querySelector("[data-setting=reduced-motion]").checked && document.querySelector("[data-setting=volume]").value === "0.35" && document.querySelector("#settingsPanel").textContent.includes("움직임 줄이기")'))) throw Error('Presentation settings/translated labels failed');
      const accessibility = await evaluate('({ dialog:document.querySelector("#settingsPanel").getAttribute("role"), sensitivity:document.querySelector("#settingsPanel input").value, fits:document.querySelector("#settingsPanel .panel").getBoundingClientRect().right <= innerWidth, namedControls:[...document.querySelectorAll("#settingsPanel .keyBtn,#settingsPanel .resetBtn")].every(n=>!!n.getAttribute("aria-label")) })');
      if (!accessibility.fits || !accessibility.namedControls) throw Error('Settings accessibility/layout check failed');
      await evaluate(`window.__mapInspect = ${JSON.stringify(accessibility)}`);
    }
    if (name === 'match-vote') {
      await click('[data-action="restart"]');
      if (!(await evaluate('document.querySelector("[data-action=restart]").disabled && document.querySelector("#overlay").textContent.includes("1 / 2")'))) throw Error('Rematch vote UI failed');
    }
    let combat;
    if (name === 'onboarding') {
      await delay(1000);
      const capture = await send('Page.captureScreenshot', { format: 'png' });
      await writeFile(join(output, `${prefix}-onboarding-briefing.png`), Buffer.from(capture.data, 'base64'));
    }
    if (gameplay) {
      await delay(1500);
      await send('Page.bringToFront');
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 960, y: 540, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 960, y: 540, button: 'left', clickCount: 1 });
      await delay(300);
      const locked = (await send('Runtime.evaluate', { expression: 'document.pointerLockElement instanceof HTMLCanvasElement', returnByValue: true })).result?.value;
      if (!locked) {
        const failed = await send('Page.captureScreenshot', { format: 'png' });
        await writeFile(join(output, `${prefix}-${name}-failed.png`), Buffer.from(failed.data, 'base64'));
        throw Error(`Gameplay click failed to engage pointer lock: ${JSON.stringify(await evaluate('({top:document.elementFromPoint(960,540)?.outerHTML,lock:document.pointerLockElement?.outerHTML,focus:document.hasFocus(),url:location.href})'))}; errors=${JSON.stringify(errors)}`);
      }
      if (name === 'audio') {
        combat = await evaluate('window.ironsight.audioProbe()');
        const m = combat?.mixes;
        if (!m || m.length !== 5 || Math.abs(m[1].gain / m[0].gain - 1.4) > .001 ||
            Math.abs(m[3].gain / m[2].gain - 1.4) > .001 ||
            Math.abs(m[4].gain / m[1].gain - .32) > .001 || m[4].cutoff !== 1100 ||
            combat.ordinaryPeak !== 16 || combat.threatPeak !== 20 || combat.drained !== 0)
          throw Error(`Threat audio graph failed: ${JSON.stringify(combat)}`);
      }
      if (name === 'handling') combat = await handlingProbe({ send, evaluate, waitFor, delay, assertFixed: args.includes('--assert-handling'),
        capture: async label => { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(output, `${prefix}-${label}.png`), Buffer.from(shot.data, 'base64')); } });
      if (name === 'menu-probe') combat = await menuProbe({ send, evaluate, click, waitFor, delay, assertFixed: args.includes('--assert-first-play') });
      if (name === 'reconnect') {
        const before = await evaluate('window.ironsight.myId');
        const closeRequestedAt = Date.now();
        await evaluate('window.__inspectionSockets.at(-1).close(4000,"inspection reconnect")');
        await waitFor('document.querySelector("#overlay").dataset.kind === "connection"');
        const disconnectShownAt = Date.now();
        const dropped = await send('Page.captureScreenshot', { format: 'png' });
        await writeFile(join(output, `${prefix}-reconnect-disconnected.png`), Buffer.from(dropped.data, 'base64'));
        await waitFor('window.__inspectionSockets.length >= 2 && window.__inspectionSockets.at(-1).readyState === 1 && document.querySelector("#overlay").dataset.kind !== "connection"');
        if (before !== await evaluate('window.ironsight.myId')) throw Error('Reconnect changed the held seat');
        combat = { reconnected: true, sameSeat: true,
          gracefulCloseDetectionMs: disconnectShownAt - closeRequestedAt,
          recoveryAfterNoticeMs: Date.now() - disconnectShownAt };
      }
      if (name === 'self-respawn') {
        await waitFor('!window.ironsight.state().players[window.ironsight.myId].prot');
        await evaluate('window.ironsight.look(0,-Math.PI/2+0.001)'); await delay(150);
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 960, y: 540, button: 'left', clickCount: 1 });
        await delay(50);
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 960, y: 540, button: 'left', clickCount: 1 });
        const key = async (value, code, keyCode) => {
          await send('Input.dispatchKeyEvent', { type: 'keyDown', key: value, code, windowsVirtualKeyCode: keyCode });
          await send('Input.dispatchKeyEvent', { type: 'keyUp', key: value, code, windowsVirtualKeyCode: keyCode });
        };
        await key('g', 'KeyG', 71); await delay(900); await key('g', 'KeyG', 71);
        await delay(1800); await key('r', 'KeyR', 82);
        await waitFor('window.ironsight.viewmodelInfo().phase !== "idle"');
        await waitFor('!window.ironsight.state().players[window.ironsight.myId].alive');
        await delay(100);
        const death = await send('Page.captureScreenshot', { format: 'png' });
        await writeFile(join(output, `${prefix}-self-death.png`), Buffer.from(death.data, 'base64'));
        await waitFor('window.ironsight.state().players[window.ironsight.myId].alive');
        await evaluate('window.ironsight.look(Math.PI/2,0)'); await delay(300);
        combat = await evaluate('({deaths:window.ironsight.state().players[window.ironsight.myId].d,hp:window.ironsight.state().players[window.ironsight.myId].hp,reloadPhase:window.ironsight.viewmodelInfo().phase})');
        if (combat.deaths < 1 || combat.hp !== 100 || combat.reloadPhase !== 'idle') throw Error(`Respawn presentation failed: ${JSON.stringify(combat)}`);
      }
      if (name === 'flow') {
        const before = await evaluate('window.ironsight.state().players[window.ironsight.myId].x');
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87 });
        await delay(400);
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87 });
        await delay(250);
        const after = await evaluate('window.ironsight.state().players[window.ironsight.myId].x');
        if (after - before < 1) throw Error('W did not move the authoritative player');
        const killsBefore = await evaluate('window.ironsight.state().players[window.ironsight.myId].k');
        for (let i = 0; i < 8; i++) {
          await evaluate(`(() => { const target=window.ironsight.state().players['bot-idle']; const p=window.ironsight.camPos();
            const dx=target.x-p.x,dz=target.z-p.z; window.ironsight.look(Math.atan2(dx,dz),Math.atan2(1.1-p.y,Math.hypot(dx,dz))); })()`);
          await delay(100);
          await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 960, y: 540, button: 'left', clickCount: 1 });
          await delay(35);
          await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 960, y: 540, button: 'left', clickCount: 1 });
          await delay(150);
          if (await evaluate(`window.ironsight.state().players[window.ironsight.myId].k > ${killsBefore}`)) break;
        }
        const killsAfter = await evaluate('window.ironsight.state().players[window.ironsight.myId].k');
        if (killsAfter <= killsBefore) throw Error('Real-control fire did not produce a server-verified kill');
        const magBefore = await evaluate('document.querySelector("#ammo .mag").textContent');
        await evaluate('window.__reloadSamples=[]; window.__reloadSampleTimer=setInterval(()=>window.__reloadSamples.push(window.ironsight.viewmodelInfo().phase),20)');
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'r', code: 'KeyR', windowsVirtualKeyCode: 82 });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'r', code: 'KeyR', windowsVirtualKeyCode: 82 });
        await waitFor('window.ironsight.viewmodelInfo().phase === "mag-out"');
        const remoteReloadDeadline = await evaluate('window.ironsight.state().players[window.ironsight.myId].reloadEnd');
        if (!Number.isFinite(remoteReloadDeadline) || remoteReloadDeadline <= 0) throw Error('Reload deadline missing from binary state');
        const reloadCapture = await send('Page.captureScreenshot', { format: 'png' });
        await writeFile(join(output, `${prefix}-flow-reloading.png`), Buffer.from(reloadCapture.data, 'base64'));
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 960, y: 540, button: 'left', clickCount: 1 });
        await delay(50);
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 960, y: 540, button: 'left', clickCount: 1 });
        const magDuring = await evaluate('document.querySelector("#ammo .mag").textContent');
        if (magDuring !== magBefore) throw Error('Firing consumed ammo during server reload');
        await waitFor('document.querySelector("#ammo .mag").textContent === "30"');
        await waitFor('window.ironsight.viewmodelInfo().phase === "idle"');
        await waitFor('window.ironsight.state().players[window.ironsight.myId].reloadEnd === 0');
        const reloadPhases = await evaluate('clearInterval(window.__reloadSampleTimer); [...new Set(window.__reloadSamples)]');
        for (const phase of ['mag-out', 'mag-in', 'bolt', 'return', 'idle'])
          if (!reloadPhases.includes(phase)) throw Error(`Missing live reload phase ${phase}: ${reloadPhases}`);
        await waitFor('window.ironsight.state().players["bot-idle"].alive');
        const targetRespawned = await evaluate('window.ironsight.state().players["bot-idle"].hp === 100 && window.ironsight.state().players["bot-idle"].d > 0');
        if (!targetRespawned) throw Error('Target did not respawn after verified kill');
        combat = { movedMeters: after - before, serverVerifiedKills: killsAfter - killsBefore,
          magBeforeReload: magBefore, magAfterReload: 30, remoteReloadDeadline, reloadDeadlineCleared: true, reloadPhases, fireDuringReloadBlocked: true, targetRespawned };
      }
    }
    const report = (await send('Runtime.evaluate', { expression: gameplay ? '({ ...window.ironsight.renderInfo(), players: Object.keys(window.ironsight.state().players).length, hp: window.ironsight.state().players[window.ironsight.myId].hp })' : 'window.__mapInspect ?? null', returnByValue: true })).result?.value;
    if (name.startsWith('weapon-') && name.endsWith('-cycle')) {
      const cycle = report?.reloadCycle;
      if (cycle?.frames !== 182 || ['reach', 'mag-out', 'mag-in', 'bolt', 'return', 'idle'].some(p => !cycle.phases.includes(p)))
        throw Error(`Incomplete moving reload fixture: ${JSON.stringify(report)}`);
    }
    if (args.includes('--assert-budgets') && name.endsWith('effects-stress')) {
      if (report.peakCallsIncludingShadowBake > 240 || report.peakTrianglesIncludingShadowBake > 500000 ||
          report.peakTextureMiB > 64 || report.peakTextures > 32 || report.effects.drained.explosions !== 0 || report.effects.drained.tracers !== 0)
        throw Error(`Renderer resource budget or effect cleanup failed: ${JSON.stringify(report)}`);
      // Frame timing is deliberately not an automated hardware acceptance gate.
    }
    const assetRequests = await evaluate('performance.getEntriesByType("resource").map(e => new URL(e.name).pathname).filter(p => p.startsWith("/assets/maps/") || p.startsWith("/assets/props/"))');
    if (report?.siteGround) {
      const ground = report.siteGround, apron = ground.find(g => g.name.endsWith('-apron'));
      const { width, depth } = report.mapBounds;
      const padding = Math.max(210, width * 3), padZ = Math.max(200, width > 60 ? width * 3 : 200);
      const extent = apron?.name === 'relay-apron' ? [-padding, -padZ, width + padding, depth + padZ] : [-60, -60, width + 60, depth + 60];
      const floor = ground.find(g => !g.name.endsWith('-apron'));
      if (!floor || floor.min[0] !== 0 || floor.min[2] !== 0 || floor.max[0] !== width || floor.max[2] !== depth)
        throw Error('Ground must match authoritative map bounds');
      if (ground.length !== 2 || ground.some(g => !g.visible || g.max[1] >= 0) || !apron ||
          apron.min[0] !== extent[0] || apron.min[2] !== extent[1] || apron.max[0] !== extent[2] || apron.max[2] !== extent[3] ||
          apron.triangles > 4500)
        throw Error(`Site ground removed, raised or outside its budget: ${JSON.stringify(ground)}`);
    }
    if (report?.concreteDetail) {
      const detail = report.concreteDetail;
      const otherMap = name.startsWith('undertow-') || name.startsWith('switchyard-');
      if (detail.invalidUv || (otherMap ? detail.meshes !== 0 : detail.meshes < 3 || detail.textures !== 2))
        throw Error(`Concrete detail missing, invalid or loaded on another map: ${JSON.stringify(detail)}`);
    }
    if (!gameplay && !name.startsWith('menu') && !name.startsWith('undertow-') && !name.startsWith('switchyard-') && report?.uplinks) {
      if (!assetRequests.includes('/assets/props/relay-uplink.glb') || report.uplinks.length !== 2)
        throw Error('Relay uplinks not loaded');
      if (report.uplinks.some(p => p.max[2] >= 0 || Math.abs(p.min[1]) > 0.001 || p.triangles > 5000))
        throw Error('Relay uplink exceeds exterior geometry budget');
    }
    if ((name.startsWith('undertow-') || name.startsWith('switchyard-') || name === 'practice-two' || name === 'practice-three') && assetRequests.some(p => p.includes('relay-uplink')))
      throw Error('Relay uplinks loaded on another map');
    if (name.startsWith('switchyard-')) {
      for (const required of ['/assets/maps/switchyard-architecture.glb', '/assets/maps/switchyard-ground-ao.png', '/assets/props/switchyard-transformer.glb'])
        if (!assetRequests.includes(required)) throw Error(`Switchyard asset not requested: ${required}`);
      if (assetRequests.some(p => /relay|undertow|arena[12]-dressing/.test(p))) throw Error('Switchyard requested another map asset');
    }
    if (name === 'relay' || name.startsWith('undertow-') || name === 'practice-two')
      if (assetRequests.some(p => p.includes('switchyard'))) throw Error('Switchyard assets loaded on another map');
    reports.push({ shot: name, report, combat, assetRequests });
    const capture = await send('Page.captureScreenshot', { format: 'png' });
    const file = join(output, `${prefix}-${name}.png`);
    await writeFile(file, Buffer.from(capture.data, 'base64'));
    if (['vista', 'undertow-vista', 'switchyard-vista'].includes(name) && args.includes('--write-vista')) {
      const webp = await send('Page.captureScreenshot', { format: 'webp', quality: 88 });
      const site = name === 'vista' ? 'relay' : name.slice(0, -6);
      await writeFile(fileURLToPath(new URL(`../public/assets/${site}-vista.webp`, import.meta.url)), Buffer.from(webp.data, 'base64'));
    }
    console.log(file, JSON.stringify(report));
  }
  await writeFile(join(output, `${prefix}-report.json`), JSON.stringify({ browserVersion, reports, errors, forbiddenNetwork }, null, 2));
  if (errors.length) throw Error(`Browser errors: ${JSON.stringify(errors)}`);
  if (forbiddenNetwork.length) throw Error('Offline inspector opened gameplay network connections');
} catch (error) {
  const diagnostics = await evaluate('({ url:location.href, self:window.ironsight?.state()?.players[window.ironsight?.myId], viewmodel:window.ironsight?.viewmodelInfo?.() })').catch(() => null);
  const capture = await send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
  if (capture) await writeFile(join(output, `${prefix}-failure.png`), Buffer.from(capture.data, 'base64'));
  await writeFile(join(output, `${prefix}-report.json`), JSON.stringify({ reports, errors, forbiddenNetwork, failure: String(error), diagnostics }, null, 2));
  throw error;
} finally {
  if (ws?.readyState === WebSocket.OPEN) {
    await send('Browser.close').catch(() => {});
    ws.close();
  }
  if (edge.exitCode === null) edge.kill();
  for (const request of pending.values()) clearTimeout(request.timer);
  // Edge needs a moment to release profile files on Windows.
  if (!resolve(profile).startsWith(resolve(tmpdir()) + sep)) throw Error("Unsafe profile cleanup path");
  await rm(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 });
}
