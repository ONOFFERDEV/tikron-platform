import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const args = process.argv.slice(2);
const option = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const base = new URL(option('--url', 'http://localhost:8787'));
const weapons = option('--weapons', '0,3').split(',').map(Number);
if (weapons.some(w => !Number.isInteger(w) || w < 0 || w > 4)) throw Error('Weapons must be 0..4');
const prefix = option('--prefix', 'rig');
const pose = option('--pose', 'idle');
const selectedAngles = option('--angles', 'front,right,left,back,three-quarter,top-down,hands,hands-right').split(',');
const armModes = option('--arms', '1,0').split(',').map(Number);
if (!/^[\w-]+$/.test(prefix)) throw Error('Invalid filename prefix');
const output = fileURLToPath(new URL('../.inspect/', import.meta.url));
await mkdir(output, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'ironsight-inspect-'));
const edge = spawn(process.env.EDGE ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--window-size=1200,900', '--hide-scrollbars', `--user-data-dir=${profile}`,
  '--remote-debugging-port=0', '--no-first-run', 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let launchError;
edge.on('error', error => { launchError = error; });
let ws;
const pending = new Map();
let sequence = 0;
const forbiddenNetwork = [];
const errors = [];
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
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args);
    if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) errors.push(message.params.response);
    if (message.method === "Network.webSocketCreated" ||
        (message.method === "Network.requestWillBeSent" && /\/api\/matchmake/.test(message.params.request.url)))
      forbiddenNetwork.push(message.params);
    if (!request) return;
    pending.delete(message.id); clearTimeout(request.timer);
    if (message.error) request.reject(Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  };
  await send('Page.enable');
  await send('Network.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });
  const angles = [ ['front', 0, 10, 2.2], ['right', 90, 10, 2.2], ['left', -90, 10, 2.2],
    ['back', 180, 10, 2.2], ['three-quarter', 35, 10, 2.2], ['top-down', 0, 80, 2.2], ['hands', 35, 10, 1], ['hands-right', -35, 10, 1] ];
  let timedOut = false;
  for (const weapon of weapons) for (const arms of armModes) for (const [name, yaw, pitch, dist] of angles.filter(a => selectedAngles.includes(a[0]))) {
    const url = new URL(base);
    for (const [key, value] of Object.entries({ inspect: 'rig', weapon, arms, yaw, pitch, dist, pose })) url.searchParams.set(key, String(value));
    await send('Runtime.evaluate', { expression: 'window.__inspectReady = false' });
    await send('Page.navigate', { url: url.href });
    let ready = false;
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      await delay(100);
      try { ready = (await send('Runtime.evaluate', { expression: 'window.__inspectReady === true', returnByValue: true })).result?.value === true; }
      catch { /* execution context can disappear during navigation */ }
      if (ready) break;
    }
    if (!ready) { console.warn(`Readiness timed out: weapon ${weapon}, arms ${arms}, ${name}`); timedOut = true; }
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const file = join(output, `${prefix}-w${weapon}-arms${arms}-${name}.png`);
    await writeFile(file, Buffer.from(shot.data, 'base64'));
    console.log(file);
  }
  if (forbiddenNetwork.length) throw Error("Inspector opened gameplay network connections");
  await writeFile(join(output, `${prefix}-report.json`), JSON.stringify({ pose, weapons, angles: selectedAngles, armModes, errors, forbiddenNetwork }, null, 2));
  if (errors.length) throw Error(`Browser errors: ${JSON.stringify(errors)}`);
  if (timedOut) process.exitCode = 1;
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
