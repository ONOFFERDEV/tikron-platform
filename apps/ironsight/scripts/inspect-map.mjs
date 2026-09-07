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
  await send('Network.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  for (const name of shots) {
    if (!/^[a-z-]+$/.test(name)) throw Error('Invalid shot name');
    const url = new URL(base);
    gameplay = ['game', 'flow', 'self-respawn', 'tdm', 'dom', 'ffa', 'practice-two', 'practice-three'].includes(name);
    if (gameplay && name !== 'flow') {
      url.searchParams.set('mode', ['tdm', 'dom', 'ffa'].includes(name) ? name : 'practice');
      if (name.startsWith('practice-')) url.searchParams.set('map', name === 'practice-two' ? 'arena2' : 'arena3');
    }
    else if (!['menu', 'menu-mobile', 'flow'].includes(name)) {
      url.searchParams.set('inspect', name.startsWith('weapon') || name.startsWith('reload-') ? 'weapon' : 'map');
      url.searchParams.set('shot', name);
      if (name.startsWith('undertow-')) url.searchParams.set('map', 'arena2');
    }
    if (name === 'menu-mobile') await send('Emulation.setDeviceMetricsOverride', { width: 720, height: 900, deviceScaleFactor: 1, mobile: false });
    else await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: url.href });
    if (name === 'flow') {
      await waitFor('!!document.querySelector("#modeMenu")');
      await click('[data-mode="practice"]'); await click('.deploy');
    }
    const expression = gameplay ? '!!window.ironsight?.state()?.players[window.ironsight.myId]'
      : name.startsWith('menu') ? '!!document.querySelector("#modeMenu")' : 'window.__inspectReady === true';
    await waitFor(expression);
    let combat;
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
        const reloadCapture = await send('Page.captureScreenshot', { format: 'png' });
        await writeFile(join(output, `${prefix}-flow-reloading.png`), Buffer.from(reloadCapture.data, 'base64'));
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 960, y: 540, button: 'left', clickCount: 1 });
        await delay(50);
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 960, y: 540, button: 'left', clickCount: 1 });
        const magDuring = await evaluate('document.querySelector("#ammo .mag").textContent');
        if (magDuring !== magBefore) throw Error('Firing consumed ammo during server reload');
        await waitFor('document.querySelector("#ammo .mag").textContent === "30"');
        await waitFor('window.ironsight.viewmodelInfo().phase === "idle"');
        const reloadPhases = await evaluate('clearInterval(window.__reloadSampleTimer); [...new Set(window.__reloadSamples)]');
        for (const phase of ['mag-out', 'mag-in', 'bolt', 'return', 'idle'])
          if (!reloadPhases.includes(phase)) throw Error(`Missing live reload phase ${phase}: ${reloadPhases}`);
        await waitFor('window.ironsight.state().players["bot-idle"].alive');
        const targetRespawned = await evaluate('window.ironsight.state().players["bot-idle"].hp === 100 && window.ironsight.state().players["bot-idle"].d > 0');
        if (!targetRespawned) throw Error('Target did not respawn after verified kill');
        combat = { movedMeters: after - before, serverVerifiedKills: killsAfter - killsBefore,
          magBeforeReload: magBefore, magAfterReload: 30, reloadPhases, fireDuringReloadBlocked: true, targetRespawned };
      }
    }
    const report = (await send('Runtime.evaluate', { expression: gameplay ? '({ ...window.ironsight.renderInfo(), players: Object.keys(window.ironsight.state().players).length, hp: window.ironsight.state().players[window.ironsight.myId].hp })' : 'window.__mapInspect ?? null', returnByValue: true })).result?.value;
    reports.push({ shot: name, report, combat });
    const capture = await send('Page.captureScreenshot', { format: 'png' });
    const file = join(output, `${prefix}-${name}.png`);
    await writeFile(file, Buffer.from(capture.data, 'base64'));
    if (name === 'vista' && args.includes('--write-vista')) {
      const webp = await send('Page.captureScreenshot', { format: 'webp', quality: 88 });
      await writeFile(fileURLToPath(new URL('../public/assets/relay-vista.webp', import.meta.url)), Buffer.from(webp.data, 'base64'));
    }
    console.log(file, JSON.stringify(report));
  }
  await writeFile(join(output, `${prefix}-report.json`), JSON.stringify({ reports, errors, forbiddenNetwork }, null, 2));
  if (errors.length) throw Error(`Browser errors: ${JSON.stringify(errors)}`);
  if (forbiddenNetwork.length) throw Error('Offline inspector opened gameplay network connections');
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
