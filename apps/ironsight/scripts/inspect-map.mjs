import { droneProbe } from './drone-probe.mjs';
import { structuresProbe } from './structures-probe.mjs';
import { roundHonorsProbe } from './round-honors-probe.mjs';
import { contrastProbe } from './contrast-probe.mjs';
import { ambushProbe } from './ambush-probe.mjs';
import { rolesProbe } from './roles-probe.mjs';
import { breakoutProbe } from './breakout-probe.mjs';
import { objectiveHoldProbe } from './objective-hold-probe.mjs';
import { objectiveApproachProbe } from './objective-approach-probe.mjs';
import { cargoProbe } from './cargo-probe.mjs';
import { deploymentProbe } from './deployment-probe.mjs';
import { blastProbe } from './blast-probe.mjs';
import { weaponFlashProbe } from './weapon-flash-probe.mjs';
import { mortarProbe } from './mortar-probe.mjs';
import { supportProbe } from './support-probe.mjs';
import { signalProbe } from './signal-probe.mjs';
import { floodProbe } from './flood-probe.mjs';
import { coreProbe } from './core-probe.mjs';
import { traversalProbe } from './traversal-probe.mjs';
import { launchProbe } from './launch-probe.mjs';
import { pingWheelProbe } from './ping-wheel-probe.mjs';
import { slideProbe } from './slide-probe.mjs';
import { recoilProbe } from './recoil-probe.mjs';
import { trainingProbe } from './training-probe.mjs';
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
  if (shots.includes('flood') || shots.includes('cargo')) await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__floodAudio=[];window.__cargoAudio=window.__floodAudio;
    const source=AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource=function(...args){const node=source.apply(this,args),start=node.start.bind(node);
      node.start=(...a)=>{if(node.loop&&document.pointerLockElement){const entry={at:performance.now(),ended:false};window.__floodAudio.push(entry);
        node.addEventListener('ended',()=>{entry.ended=true;entry.endAt=performance.now();});}return start(...a);};return node;};
  ` });
  if (args.includes('--contact-muted')) await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.setItem('iron_muted','1');`,
  });
  if (args.includes('--assert-contacts')) await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__contactAudio=[];
    const contactOsc=AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator=function(...args){const osc=contactOsc.apply(this,args),start=osc.start.bind(osc);
      osc.start=(...a)=>{if([620,830].includes(osc.frequency.value)){const entry={at:performance.now(),frequency:osc.frequency.value,ended:false};
        window.__contactAudio.push(entry);osc.addEventListener('ended',()=>{entry.ended=true;entry.endAt=performance.now();});}return start(...a);};return osc;};
  ` });
  if (args.includes('--intro-reduced')) await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.setItem('ironsight.settings.v1',JSON.stringify({reducedMotion:true}));`,
  });
  if (shots.includes('deployment-play')) await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__deploymentAudio=[];
    const original=AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator=function(...args){const osc=original.apply(this,args),start=osc.start.bind(osc);
      let frequency;const set=osc.frequency.setValueAtTime.bind(osc.frequency);osc.frequency.setValueAtTime=(v,t)=>{frequency=v;return set(v,t);};
      osc.start=(...a)=>{const entry={at:performance.now(),frequency:frequency??osc.frequency.value,ended:false};window.__deploymentAudio.push(entry);
        osc.addEventListener('ended',()=>{entry.ended=true;entry.endAt=performance.now();});return start(...a);};return osc;};
  ` });
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
    gameplay = ['places-play', 'cargo', 'gallery', 'flood', 'ambush', 'deployment-play', 'blast-play', 'flash-play', 'drone', 'mortar', 'support', 'core', 'signal', 'launch', 'vault', 'slide', 'recoil', 'audio', 'handling', 'journey', 'journey-match', 'menu-probe', 'game', 'flow', 'flow-undertow', 'self-respawn', 'tdm', 'dom', 'ffa', 'practice-two', 'practice-three', 'reconnect', 'onboarding'].includes(name);
    if (gameplay && !name.startsWith('flow') && !name.startsWith('journey')) {
      url.searchParams.set('mode', name === 'deployment-play' ? 'tdm' : ['tdm', 'dom', 'ffa'].includes(name) ? name : 'practice');
      if (name === 'vault') url.searchParams.set('map', 'arena2');
      if (name === 'flood' || name === 'gallery') url.searchParams.set('map', 'arena2');
      if (name === 'launch' || name === 'cargo') url.searchParams.set('map', 'arena3');
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
        for (const key of ['review-camera', 'review-enemy', 'review-enemy-yaw']) {
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
      if (args.includes('--assert-contrast') && ['tdm','ffa'].includes(name)) {
        combat = await contrastProbe({send,evaluate,waitFor,delay,click,teamless:name==='ffa',
          capture: async label => { const shot=await send('Page.captureScreenshot',{format:'png'});
            await writeFile(join(output,`${prefix}-${label}.png`),Buffer.from(shot.data,'base64')); }});
      }
      if (name === 'places-play') combat = await structuresProbe({ send, evaluate, delay,
        capture: async label => { const shot = await send('Page.captureScreenshot', { format: 'png' });
          await writeFile(join(output, `${prefix}-${label}.png`), Buffer.from(shot.data, 'base64')); },
        record: report => writeFile(join(output, `${prefix}-structures.json`), JSON.stringify(report, null, 2)),
      });
      if (name === 'deployment-play') {
        combat = await deploymentProbe({ evaluate, waitFor, delay, send,
          introMode: option('--intro-check', null), reduced: args.includes('--intro-reduced'),
          capture: async label => { const shot = await send('Page.captureScreenshot', {format:'png'}); await writeFile(join(output, `${prefix}-${label}.png`), Buffer.from(shot.data,'base64')); },
        });
      }
      if (name === 'tdm' && (args.includes('--assert-roles') || args.includes('--assert-flanks') || args.includes('--assert-contacts'))) combat = await rolesProbe({send,evaluate,waitFor,delay,flanks:args.includes('--assert-flanks'),contacts:args.includes('--assert-contacts'),
        capture: async label => {const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,`${prefix}-${label}.png`),Buffer.from(shot.data,'base64'));},
      });
      if (name === 'dom' && (args.includes('--assert-breakout') || args.includes('--assert-orders'))) combat = await breakoutProbe({send,evaluate,waitFor,delay,orders:args.includes('--assert-orders'),
        capture: async label => {const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,`${prefix}-${label}.png`),Buffer.from(shot.data,'base64'));},
      });
      if (name === 'dom' && args.includes('--assert-holds')) combat = await objectiveHoldProbe({send,evaluate,waitFor,delay,
        capture: async label => {const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,`${prefix}-${label}.png`),Buffer.from(shot.data,'base64'));},
      });
      if (name === 'dom' && args.includes('--assert-approaches')) combat = await objectiveApproachProbe({send,evaluate,waitFor,delay,
        capture: async label => {const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,`${prefix}-${label}.png`),Buffer.from(shot.data,'base64'));},
        record: report => writeFile(join(output,`${prefix}-approach-diagnostic.json`),JSON.stringify(report,null,2)),
      });
      if (name === 'dom' && args.includes('--assert-honors')) combat = await roundHonorsProbe({send,evaluate,waitFor,delay,
        capture: async label => {const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,`${prefix}-${label}.png`),Buffer.from(shot.data,'base64'));},
        record: report => writeFile(join(output,`${prefix}-honors.json`),JSON.stringify(report,null,2)),
      });
      if (name === 'cargo') combat = await cargoProbe({send,evaluate,waitFor,delay,
        capture: async label => {const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,`${prefix}-${label}.png`),Buffer.from(shot.data,'base64'));},
        record: report => writeFile(join(output,`${prefix}-cargo-diagnostic.json`),JSON.stringify(report,null,2)),
      });
      if (name === 'audio') {
        combat = await evaluate('window.ironsight.audioProbe()');
        const m = combat?.mixes;
        if (!m || m.length !== 5 || Math.abs(m[1].gain / m[0].gain - 1.4) > .001 ||
            Math.abs(m[3].gain / m[2].gain - 1.4) > .001 ||
            Math.abs(m[4].gain / m[1].gain - .32) > .001 || m[4].cutoff !== 1100 ||
            combat.ordinaryPeak !== 16 || combat.threatPeak !== 20 || combat.drained !== 0)
          throw Error(`Threat audio graph failed: ${JSON.stringify(combat)}`);
      }
      if ((args.includes('--assert-ping') || args.includes('--assert-backup')) && name === 'practice-two') {
        const backup = args.includes('--assert-backup');
        const key = async () => {
          await send('Input.dispatchKeyEvent', { type: 'keyDown', key: backup ? 'b' : 'q', code: backup ? 'KeyB' : 'KeyQ', windowsVirtualKeyCode: backup ? 66 : 81 });
          await send('Input.dispatchKeyEvent', { type: 'keyUp', key: backup ? 'b' : 'q', code: backup ? 'KeyB' : 'KeyQ', windowsVirtualKeyCode: backup ? 66 : 81 });
        };
        const layouts = [];
        for (const [width, height] of [[1920,1080],[1280,600],[720,900]]) {
          await send('Emulation.setDeviceMetricsOverride', {width,height,deviceScaleFactor:1,mobile:false});
          await key(); await waitFor('!document.querySelector("#teamPingNotice").hidden');
          const layout = await evaluate(`(() => {
            const n=document.querySelector('#teamPingNotice'), r=n.getBoundingClientRect();
            const overlaps=[...document.querySelectorAll('#trainingCoach,#ping,#briefing,#tacticalMap,#wbar,#hp,#teamPingHint')].filter(e=>!e.hidden).some(e=>{const b=e.getBoundingClientRect();return r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top;});
            return {width:innerWidth,height:innerHeight,text:n.textContent,fits:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,overlaps};
          })()`);
          if (!layout.fits || layout.overlaps || !layout.text.includes(backup ? 'YOU / NEED BACKUP' : 'YOU / GO HERE')) throw Error(`Ping layout failed: ${JSON.stringify(layout)}`);
          const shot = await send('Page.captureScreenshot', {format:'png'});
          await writeFile(join(output, `${prefix}-${backup ? 'backup' : 'ping'}-${width}.png`), Buffer.from(shot.data,'base64'));
          layouts.push(layout);
          await delay(5200);
          if (!await evaluate('document.querySelector("#teamPingNotice").hidden')) throw Error('Ping failed to expire');
        }
        await key(); await waitFor('!document.querySelector("#teamPingNotice").hidden');
        await evaluate('document.exitPointerLock()'); await delay(250);
        await key(); await delay(250);
        if (!await evaluate('document.querySelector("#teamPingNotice").hidden')) throw Error('Ping leaks into pause');
        let rebound = false;
        if (backup) {
          await click('#quitConfirm button:nth-child(2)');
          await evaluate(`document.querySelector('#settingsPanel .keyBtn[aria-label*="Need backup"]').scrollIntoView({block:'center'})`);
          await click('#settingsPanel .keyBtn[aria-label*="Need backup"]');
          await send('Input.dispatchKeyEvent', {type:'keyDown',code:'KeyV',key:'v',windowsVirtualKeyCode:86});
          await send('Input.dispatchKeyEvent', {type:'keyUp',code:'KeyV',key:'v',windowsVirtualKeyCode:86});
          await send('Input.dispatchKeyEvent', {type:'keyDown',code:'Escape',key:'Escape',windowsVirtualKeyCode:27});
          await send('Input.dispatchKeyEvent', {type:'keyUp',code:'Escape',key:'Escape',windowsVirtualKeyCode:27});
          await click('#quitConfirm button');
          await waitFor('document.pointerLockElement instanceof HTMLCanvasElement');
          await waitFor('document.querySelector("#teamPingHint").textContent.includes("V / NEED BACKUP")');
          await delay(2200);
          await key(); await delay(250);
          if (!await evaluate('document.querySelector("#teamPingNotice").hidden')) throw Error('Old backup binding still sends');
          await send('Input.dispatchKeyEvent', {type:'keyDown',code:'KeyV',key:'v',windowsVirtualKeyCode:86});
          await send('Input.dispatchKeyEvent', {type:'keyUp',code:'KeyV',key:'v',windowsVirtualKeyCode:86});
          await waitFor('!document.querySelector("#teamPingNotice").hidden');
          if (!await evaluate('document.querySelector("#teamPingNotice").textContent.includes("YOU / NEED BACKUP") && document.querySelector("#teamPingHint").textContent.includes("V / NEED BACKUP")')) throw Error('Backup rebinding failed');
          const shot = await send('Page.captureScreenshot', {format:'png'});
          await writeFile(join(output, `${prefix}-backup-rebound.png`), Buffer.from(shot.data,'base64'));
          rebound = true;
        }
        combat = {layouts, expiry:true, pauseClears:true, normalKey:true, rebound};
        await send('Emulation.setDeviceMetricsOverride', {width:1920,height:1080,deviceScaleFactor:1,mobile:false});
      }
      if (args.includes('--assert-ping-wheel') && name === 'practice-two') combat = await pingWheelProbe({ send, evaluate, waitFor, delay, click,
        capture: async label => { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(output, `${prefix}-${label}.png`), Buffer.from(shot.data, 'base64')); } });
      if (args.includes('--assert-training') && ['onboarding', 'practice-two', 'practice-three'].includes(name)) combat = await trainingProbe({ send, evaluate, waitFor, delay,
        capture: async label => { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(output, `${prefix}-${name}-${label}.png`), Buffer.from(shot.data, 'base64')); } });
      if (name === 'recoil') combat = await recoilProbe({ send, evaluate, waitFor, delay,
        record: async entry => writeFile(join(output, `${prefix}-recoil-${entry.slot}.json`), JSON.stringify(entry, null, 2)),
        capture: async label => { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(output, `${prefix}-${label}.png`), Buffer.from(shot.data, 'base64')); } });
      if (name === 'handling') combat = await handlingProbe({ send, evaluate, waitFor, delay, assertFixed: args.includes('--assert-handling'),
        capture: async label => { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(output, `${prefix}-${label}.png`), Buffer.from(shot.data, 'base64')); } });
      if (name === 'vault') combat = await traversalProbe({ send, evaluate, delay, click, waitFor,
        capture: async label => { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(output, `${prefix}-${label}.png`), Buffer.from(shot.data, 'base64')); } });
      if (name === 'flood') combat = await floodProbe({ send, evaluate, delay, waitFor,
        capture: async label => {const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,`${prefix}-${label}.png`),Buffer.from(shot.data,'base64'));} });
      if (name === 'signal') combat = await signalProbe({ send, evaluate, delay, click, waitFor,
        capture: async label => { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(output, `${prefix}-${label}.png`), Buffer.from(shot.data, 'base64')); } });
      if (name === 'drone') combat = await droneProbe({ send, evaluate, delay, waitFor, click, reduced: args.includes('--drone-reduced'),
        capture: async label => { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(output, `${prefix}-${label}.png`), Buffer.from(shot.data, 'base64')); } });
      if (name === 'flash-play') combat = await weaponFlashProbe({ send, evaluate, delay, waitFor,
        capture: async label => { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(output, `${prefix}-${label}.png`), Buffer.from(shot.data, 'base64')); } });
      if (name === 'ambush') combat = await ambushProbe({send,evaluate,delay,waitFor,
        capture: async label => { const shot = await send('Page.captureScreenshot', { format:'png' }); await writeFile(join(output, `${prefix}-${label}.png`), Buffer.from(shot.data,'base64')); } });
      if (name === 'blast-play') combat = await blastProbe({ send, evaluate, delay, waitFor, click,
        capture: async label => { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(output, `${prefix}-${label}.png`), Buffer.from(shot.data, 'base64')); } });
      if (name === 'mortar') combat = await mortarProbe({ send, evaluate, delay, waitFor, click, reduced: args.includes('--mortar-reduced'),
        capture: async label => { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(output, `${prefix}-${label}.png`), Buffer.from(shot.data, 'base64')); } });
      if (name === 'support') combat = await supportProbe({ send, evaluate, delay, waitFor, click,
        capture: async label => { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(output, `${prefix}-${label}.png`), Buffer.from(shot.data, 'base64')); } });
      if (name === 'core' || name === 'gallery') combat = await coreProbe({ send, evaluate, delay, waitFor, flood:name==='gallery',
        capture: async label => { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(output, `${prefix}-${label}.png`), Buffer.from(shot.data, 'base64')); } });
      if (name === 'launch') combat = await launchProbe({ send, evaluate, delay, click, waitFor,
        capture: async label => { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(output, `${prefix}-${label}.png`), Buffer.from(shot.data, 'base64')); } });
      if (name === 'slide') combat = await slideProbe({ send, evaluate, delay, click, waitFor,
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
        // Do not repair the look in the probe: the game must discard the steep
        // downward death aim itself, then keep the fresh view through look sync.
        await delay(300);
        combat = await evaluate('(() => { const p=window.ironsight.state().players[window.ironsight.myId]; return {deaths:p.d,hp:p.hp,pitch:p.pitch,yaw:p.yaw,expectedYaw:Math.atan2(75-p.x,50-p.z),reloadPhase:window.ironsight.viewmodelInfo().phase}; })()');
        // Relay practice is FFA-style centre-facing, not a team-facing spawn.
        const yawError = Math.atan2(Math.sin(combat.yaw-combat.expectedYaw),Math.cos(combat.yaw-combat.expectedYaw));
        if (combat.deaths < 1 || combat.hp !== 100 || Math.abs(combat.pitch) > .01 || Math.abs(yawError) > .01 || combat.reloadPhase !== 'idle') throw Error(`Respawn presentation failed: ${JSON.stringify(combat)}`);
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
    if (report?.lighting) {
      const lighting = report.lighting;
      const atmosphereName = report.siteGround?.some(g => g.name === 'undertow-ground') ? 'undertow-dusk'
        : report.siteGround?.some(g => g.name === 'switchyard-ground') ? 'switchyard-overcast' : null;
      const lightTypes = lighting.lights.map(l => l.type);
      if (lightTypes.length !== 16) throw Error('Total prepared light count changed');
      for (const type of ['DirectionalLight', 'HemisphereLight', 'AmbientLight'])
        if (lightTypes.filter(t => t === type).length !== 1) throw Error(`Fixed site light budget changed: ${type}`);
      if (lighting.shadowAutoUpdate || lighting.environment?.pmremGenerations !== 1)
        throw Error(`Site lighting was not prepared/cached: ${JSON.stringify(lighting)}`);
      const requested = await evaluate('performance.getEntriesByType("resource").map(e => new URL(e.name).pathname).filter(p => p.endsWith(".hdr") || p.endsWith("-sky.png"))');
      const expected = atmosphereName ? [`/assets/${atmosphereName}.hdr`, `/assets/${atmosphereName}-sky.png`] : ['/assets/industrial-daylight.hdr'];
      if (requested.length !== expected.length || expected.some(path => !requested.includes(path)))
        throw Error(`Environment was not lazy per map: ${JSON.stringify(requested)}`);
      if (atmosphereName) {
        if (lighting.sky?.width !== 1024 || lighting.sky.height !== 512 || lighting.sky.bytes !== 2097152 ||
            lighting.fog.near < 90 || lighting.environment.path !== expected[0])
          throw Error(`Site sky residency or unobstructed combat range changed: ${JSON.stringify(lighting)}`);
        const profile = JSON.parse(await readFile(fileURLToPath(new URL(`../client/${atmosphereName}.json`, import.meta.url)), 'utf8'));
        const key = lighting.lights.find(l => l.type === 'DirectionalLight');
        const direction = key.position.map((value, i) => value - [report.mapBounds.width / 2, 0, report.mapBounds.depth / 2][i]);
        const length = Math.hypot(...direction), sunLength = Math.hypot(...profile.sunDirection);
        if (direction.some((value, i) => Math.abs(value / length - profile.sunDirection[i] / sunLength) > 1e-6) ||
            lighting.exposure !== profile.exposure || key.color !== profile.keyColor.slice(1) ||
            key.intensity !== profile.keyIntensity || lighting.environmentIntensity !== profile.environmentIntensity ||
            lighting.fog.color !== profile.fogColor.slice(1) || lighting.fog.near !== profile.fogNear || lighting.fog.far !== profile.fogFar)
          throw Error('Sky bake, exposure and directional key disagree');
        const fill = lighting.lights.find(l => l.type === 'HemisphereLight');
        const ambient = lighting.lights.find(l => l.type === 'AmbientLight');
        if (fill.intensity !== profile.hemisphereIntensity || fill.color !== profile.hemisphereSky.slice(1) ||
            ambient.intensity !== profile.ambientIntensity) throw Error('Prepared fill does not match the sky profile');
      } else if (lighting.sky || lighting.exposure !== 1.05) throw Error('Authored weather leaked into daylight map');
    }
    if (report?.siteGround) {
      const ground = report.siteGround, apron = ground.find(g => g.name.endsWith('-apron'));
      const { width, depth } = report.mapBounds;
      const padding = Math.max(210, width * 3), padZ = Math.max(200, width > 60 ? width * 3 : 200);
      const extent = apron?.name === 'relay-apron' ? [-padding, -padZ, width + padding, depth + padZ] : [-60, -60, width + 60, depth + 60];
      const floor = ground.find(g => !g.name.endsWith('-apron'));
      if (!floor || floor.min[0] !== 0 || floor.min[2] !== 0 || floor.max[0] !== width || floor.max[2] !== depth)
        throw Error('Ground must match authoritative map bounds');
      if (floor.name === 'relay-ground' && (floor.atlas?.format !== 'R8' || floor.atlas.width !== 1024 ||
          floor.atlas.height !== Math.round(1024 * depth / width)))
        throw Error(`Relay ground atlas lost its compact metric layout: ${JSON.stringify(floor.atlas)}`);
      if (floor.name === 'undertow-ground' && (floor.atlas?.format !== 'RG8' || floor.atlas.width !== 1024 ||
          floor.atlas.height !== Math.round(1024 * depth / width)))
        throw Error(`Undertow ground lost its packed intensity/wetness layout: ${JSON.stringify(floor.atlas)}`);
      if (floor.name === 'switchyard-ground' && (floor.atlas?.format !== 'R8' || floor.atlas.width !== 1024 ||
          floor.atlas.height !== Math.round(1024 * depth / width)))
        throw Error(`Switchyard ground lost its compact metric layout: ${JSON.stringify(floor.atlas)}`);
      if (ground.length !== 2 || ground.some(g => !g.visible || g.max[1] >= 0) || !apron ||
          apron.min[0] !== extent[0] || apron.min[2] !== extent[1] || apron.max[0] !== extent[2] || apron.max[2] !== extent[3] ||
          apron.triangles > 4500)
        throw Error(`Site ground removed, raised or outside its budget: ${JSON.stringify(ground)}`);
    }
    if (report?.concreteDetail) {
      const detail = report.concreteDetail;
      if (detail.invalidUv || detail.meshes < 3 || detail.textures !== 2)
        throw Error(`Concrete detail missing, invalid or loaded on another map: ${JSON.stringify(detail)}`);
      if (report.siteGround?.some(g => ['relay-ground', 'undertow-ground', 'switchyard-ground'].includes(g.name)) &&
          (detail.detailMaps.some(t => t.width !== 256 || t.height !== 256) ||
           !detail.detailMaps.some(t => t.name.endsWith('-roughness') && t.format === 'R8')))
        throw Error(`Fine detail scale or roughness packing regressed: ${JSON.stringify(detail)}`);
      if (name.startsWith('switchyard-')) {
        for (const kind of ['ground', 'apron', 'concrete', 'steel', 'coated', 'deck'])
          if (!detail.switchyard?.[kind]?.meshes || detail.switchyard[kind].invalid ||
              (['steel', 'coated', 'deck'].includes(kind) && !detail.switchyard[kind].panelVertices))
            throw Error(`Switchyard ${kind} finish or panel coordinates missing: ${JSON.stringify(detail.switchyard)}`);
      }
    }
    // Generic role/contrast fixtures can select a map through the base URL.
    // Validate the rendered map, rather than assuming every generic name is Relay.
    const inspectedSite = report?.siteGround?.find(g => g.name.endsWith('-ground'))?.name;
    if (!gameplay && !name.startsWith('menu') && inspectedSite === 'relay-ground' && report?.uplinks) {
      if (!assetRequests.includes('/assets/props/relay-uplink.glb') || report.uplinks.length !== 2)
        throw Error('Relay uplinks not loaded');
      if (report.uplinks.some(p => p.max[2] >= 0 || Math.abs(p.min[1]) > 0.001 || p.triangles > 5000))
        throw Error('Relay uplink exceeds exterior geometry budget');
    }
    if ((inspectedSite === 'undertow-ground' || inspectedSite === 'switchyard-ground' || name.startsWith('undertow-') || name.startsWith('switchyard-') || name === 'practice-two' || name === 'practice-three') && assetRequests.some(p => p.includes('relay-uplink')))
      throw Error('Relay uplinks loaded on another map');
    if (name.startsWith('switchyard-')) {
      for (const required of ['/assets/maps/switchyard-architecture.glb', '/assets/maps/switchyard-ground-ao.png', '/assets/props/switchyard-transformer.glb'])
        if (!assetRequests.includes(required)) throw Error(`Switchyard asset not requested: ${required}`);
      if (assetRequests.some(p => /relay|undertow|arena[12]-dressing/.test(p))) throw Error('Switchyard requested another map asset');
    }
    if (name === 'relay' || name.startsWith('undertow-') || name === 'practice-two')
      if (assetRequests.some(p => p.includes('switchyard'))) throw Error('Switchyard assets loaded on another map');
    if (name.startsWith('glint-')) {
      const expected = ['glint-before', 'glint-away', 'glint-cover', 'glint-reload', 'glint-dead'].includes(name) ? 0
        : name.endsWith('effects-stress') ? 11 : 1;
      if (report?.glints?.active !== expected) throw Error(`Scope glint ${name}: expected ${expected}, got ${JSON.stringify(report?.glints)}`);
    }
    if (name.startsWith('blast-') && !gameplay) {
      const expected = ['blast-impact', 'blast-ads'].includes(name);
      if (!report?.blast || (expected ? Math.abs(report.blast.rollRadians) < .002 : report.blast.rollRadians !== 0))
        throw Error(`Blast motion fixture failed: ${JSON.stringify(report?.blast)}`);
      if (Math.abs(report.blast.rollRadians) > 2 * Math.PI / 180) throw Error('Blast exceeded two degrees');
    }
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
