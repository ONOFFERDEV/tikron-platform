// Frame-hitch probe: plays TDM vs bots and records all long frames, shader
// program (re)compiles, long tasks and CPU attribution.
//
//   node scripts/hitch-probe.mjs <url> [runMs=90000] [out.json] [--assert] [--mode=tdm|ffa|dom] [--until-ended]
// CPU sampling remains on by default. --no-profile is a diagnostic control;
// --trace adds cross-process tracing and --diagnostic-timing records callback /
// heartbeat timings. These controls do not replace the ordinary acceptance run.
//
// --assert exits 1 when a shader program is compiled after warm-up (t > 3 s), when any frame
// in the measurement exceeds 150 ms, or when fewer than two deaths happened (the probe must reach the
// death/respawn path). Found the 2026-09-08 death hitch: hiding the viewmodel removed a
// PointLight from the light count and recompiled every lit material (1,149 ms frame).
import { spawn } from 'node:child_process';
import { appendFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const positional = process.argv.slice(2).filter(a => !a.startsWith('--'));
const base = positional[0] ?? 'http://localhost:8796';
const runMs = Number(positional[1] ?? 90000);
const out = positional[2] ?? '.inspect/hitch-probe.json';
const assert = process.argv.includes('--assert');
// Optional cross-process diagnosis; the ordinary acceptance run stays untraced.
// V8's "idle" cannot distinguish a compositor/GPU stall from missing BeginFrames.
const trace = process.argv.includes('--trace');
// Session65 rejected the sampling-only hypothesis: unprofiled FFA also stalled.
// Cross-process traces found long GPU/ANGLE tasks while JS stayed responsive.
// Preserve the original 500us CPU observer in acceptance and retain failures.
const profileCpu = !process.argv.includes('--no-profile');
const diagnosticTiming = process.argv.includes('--diagnostic-timing');
const traceCategories = process.argv.find(a => a.startsWith('--trace-categories='))?.slice(19)
  ?? 'toplevel,cc,viz,devtools.timeline,blink.user_timing';
let traceComplete;
const traced = new Promise(resolve => { traceComplete = resolve; });
// Optional natural-round evidence: do not shorten at two deaths. Leave the room
// ended for at least one 5s persistence interval, capture it, then exit without
// voting. A supervisor can stop/restart workerd and run the normal probe against
// the same durable state. No client writes to scores, deadlines or server state.
const untilEnded = process.argv.includes('--until-ended');
const mode = (process.argv.find(a => a.startsWith('--mode=')) ?? '--mode=tdm').slice(7);
// Compile the app's immutable collision map/navigation into the Node driver only.
// The old fixed 0.9-radian turn loop circles within expanded deployment pockets.
// Route normal W-key movement to map objectives; never write player/server state.
const routeBundle = await build({ stdin: { contents: `
  import { mapForMode } from './src/modes.js';
  import { GroundNavigator } from './src/map/navigation.js';
  export function createRoute(mode) {
    const map = mapForMode(mode), nav = new GroundNavigator(map);
    return { bounds: map.bounds, caps: Object.values(map.caps), next: (from, to) => nav.next(from, to) };
  }`, resolveDir: fileURLToPath(new URL('..', import.meta.url)) },
  bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const { createRoute } = await import(`data:text/javascript;base64,${Buffer.from(routeBundle.outputFiles[0].text).toString('base64')}`);
const route = createRoute(mode);
const delay = ms => new Promise(r => setTimeout(r, ms));
const profile = await mkdtemp(join(tmpdir(), 'ironsight-hitch-'));
const edge = spawn(process.env.EDGE ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new', '--ignore-gpu-blocklist', '--window-size=1920,1080', '--hide-scrollbars',
  `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--no-first-run', 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let ws; const pending = new Map(); let seq = 0; const errors = [];
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq; const timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout ' + method)); }, 60000);
  pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;
const waitFor = async (expr, ms = 60000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await evaluate(expr)) return; } catch {} await delay(150); } throw Error('timeout ' + expr); };
const key = (value, code, keyCode, type) => send('Input.dispatchKeyEvent', { type, key: value, code, windowsVirtualKeyCode: keyCode });
const clickCenter = async () => {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 960, y: 540, button: 'left', clickCount: 1 });
  await delay(80);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 960, y: 540, button: 'left', clickCount: 1 });
};
try {
  let port; for (let i = 0; i < 100 && !port; i++) { try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch { await delay(100); } }
  if (!port) throw Error('Edge did not start');
  const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); clearTimeout(p.timer); m.error ? p.reject(Error(JSON.stringify(m.error))) : p.resolve(m.result); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.text ?? 'exception');
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args);
    if (m.method === 'Tracing.tracingComplete') traceComplete(m.params);
  });
  await send('Runtime.enable'); await send('Page.enable');
  if (profileCpu) await send('Profiler.enable');
  // three.js hands every renderer to this hook on construction; it is the only supported way to reach it from outside the bundle.
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__THREE_DEVTOOLS__ = new EventTarget(); window.__THREE_DEVTOOLS__.addEventListener('observe', e => { if (e.detail && e.detail.isWebGLRenderer) window.__renderer = e.detail; });` });
  if (diagnosticTiming) await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__hitchTiming={callbacks:[],timers:[],visibility:[]};
    const nativeRaf=window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame=callback=>nativeRaf(timestamp=>{
      const start=performance.now();try{return callback(timestamp);}finally{
        const list=window.__hitchTiming.callbacks;list.push({name:callback.name,start,end:performance.now(),timestamp});
        if(list.length>512)list.shift();
      }
    });
    let heartbeat=performance.now();setInterval(()=>{const now=performance.now(),gap=now-heartbeat;heartbeat=now;
      const list=window.__hitchTiming.timers;list.push({t:now,gap});if(list.length>128)list.shift();},20);
    document.addEventListener('visibilitychange',()=>window.__hitchTiming.visibility.push({t:performance.now(),state:document.visibilityState}));
  ` });
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  const url = new URL(base); url.searchParams.set('mode', mode);
  await send('Page.navigate', { url: url.href });
  await waitFor('!!window.ironsight?.state()?.players[window.ironsight.myId]');
  await delay(1500);
  await send('Page.bringToFront');
  await clickCenter();
  await waitFor('!!document.pointerLockElement');
  await delay(500);
  const nowBefore = await evaluate('performance.now()');
  if (profileCpu) {
    await send('Profiler.setSamplingInterval', { interval: 500 });
    await send('Profiler.start');
  }
  const profilerSetupMs = profileCpu ? await evaluate('performance.now()') - nowBefore : 0;
  if (trace) await send('Tracing.start', { traceConfig: { includedCategories: traceCategories.split(','),
    recordMode: 'recordContinuously', traceBufferSizeInKb: 32768 }, transferMode: 'ReturnAsStream' });
  await evaluate(`(() => {
    const P = window.__perf = { frames: [], long: [], events: [], frameCount: 0, t0: performance.now() };
    performance.mark('ironsight-hitch-start');
    const I = window.ironsight; let last = performance.now();
    let wasAlive = true, hp = 100, seen = new Set(), lastProgs = -1, phase; const seenKeys = new Map();
    P.room = { mode: I.state().mode, players: Object.keys(I.state().players) };
    const snap = () => { const s = I.state(); const me = s.players[I.myId]; let d = Infinity, n = 0;
      for (const [id, p] of Object.entries(s.players)) { if (id === I.myId || !p.alive || !me) continue; const dd = Math.hypot(p.x - me.x, p.z - me.z); if (dd < d) d = dd; n++; if (dd < 25 && !seen.has(id)) { seen.add(id); P.events.push({ t: performance.now(), kind: 'enemy-near-first', id, d: Math.round(dd) }); } }
      return { me, d, n }; };
    new PerformanceObserver(l => { for (const e of l.getEntries()) P.long.push({ t: Math.round(e.startTime), dur: Math.round(e.duration) }); }).observe({ entryTypes: ['longtask'] });
    const loop = () => { const now = performance.now(); const dt = now - last; last = now;
      P.frameCount++;
      const { me, d, n } = snap(); const ri = I.renderInfo();
      if (I.state().phase !== phase) { phase = I.state().phase; P.events.push({ t: now, kind: 'phase', phase, seats: Object.keys(I.state().players).length }); }
      if (lastProgs >= 0 && ri.programs !== lastProgs) P.events.push({ t: now, kind: 'programs', from: lastProgs, to: ri.programs });
      const R = window.__renderer; if (R) { const live = new Set(); for (const p of R.info.programs) { live.add(p.cacheKey); if (!seenKeys.has(p.cacheKey)) { seenKeys.set(p.cacheKey, p.name); if (lastProgs >= 0) P.events.push({ t: now, kind: 'program-new', name: p.name, key: p.cacheKey }); } } for (const k of [...seenKeys.keys()]) if (!live.has(k)) { P.events.push({ t: now, kind: 'program-gone', name: seenKeys.get(k), key: k }); seenKeys.delete(k); } }
      lastProgs = ri.programs;
      if (me) { if (wasAlive && !me.alive) P.events.push({ t: now, kind: 'death', near: Math.round(d) });
        if (!wasAlive && me.alive) P.events.push({ t: now, kind: 'respawn' });
        if (me.alive && me.hp < hp) P.events.push({ t: now, kind: 'damage', hp: me.hp, near: Math.round(d) });
        wasAlive = me.alive; hp = me.hp; }
      if (dt > 24) P.frames.push({ t: Math.round(now), dt: Math.round(dt * 10) / 10, alive: me?.alive, near: Math.round(d), enemies: n, programs: ri.programs, textures: ri.textures, geometries: ri.geometries,
        timing:window.__hitchTiming?{callbacks:window.__hitchTiming.callbacks.filter(c=>c.end>=now-dt-30).map(c=>({...c,start:c.start-P.t0,end:c.end-P.t0,timestamp:c.timestamp-P.t0})),
          timers:window.__hitchTiming.timers.filter(c=>c.t>=now-dt-30).map(c=>({...c,t:c.t-P.t0})),visibility:document.visibilityState}:undefined });
      requestAnimationFrame(loop); };
    requestAnimationFrame(loop); return true; })()`);
  const start = Date.now();
  // Wander in bursts, turn, and fire so the bots engage and kill the probe.
  // runMs is an upper bound: stop 6 s after the second death so the respawn path is covered too.
  let yaw = 0, doneAt = Infinity, routeIndex = 0;
  const navigationSamples = [];
  while (Date.now() - start < runMs && Date.now() < doneAt) {
    if (untilEnded && await evaluate(`window.ironsight.state().phase === 'ended'`)) {
      await delay(5500);
      break;
    }
    // Short steering steps respect corners in the shared capsule-clear flow field.
    // On small maps retain the original wander fixture for comparable old runs.
    if (route.bounds.width > 60) {
      await key('w', 'KeyW', 87, 'keyDown');
      for (let step = 0; step < 9; step++) {
        const me = await evaluate(`window.ironsight.state().players[window.ironsight.myId]`);
        if (me?.alive) {
          let goal = route.caps[routeIndex % route.caps.length];
          if (Math.hypot(goal.x - me.x, goal.z - me.z) < 3) goal = route.caps[++routeIndex % route.caps.length];
          const target = route.next(me, goal);
          yaw = Math.atan2(target.x - me.x, target.z - me.z);
          await evaluate(`window.ironsight.look(${yaw}, 0)`);
          if (step === 0) navigationSamples.push({ t: Date.now() - start, x: me.x, z: me.z, goal, target });
          // Never overshoot a one-metre navigation corner at the 6 m/s walk speed.
          await delay(Math.min(200, Math.max(30, Math.hypot(target.x - me.x, target.z - me.z) / 6 * 1000)));
        } else await delay(200);
      }
      await key('w', 'KeyW', 87, 'keyUp');
    } else {
      yaw += 0.9; await evaluate(`window.ironsight.look(${yaw}, 0)`);
      await key('w', 'KeyW', 87, 'keyDown'); await delay(1800); await key('w', 'KeyW', 87, 'keyUp');
    }
    if (untilEnded && await evaluate(`window.ironsight.state().phase === 'ended'`)) continue;
    await clickCenter();
    await delay(600);
    if (!untilEnded && doneAt === Infinity && (await evaluate(`window.__perf.events.filter(e => e.kind === 'death').length`)) >= 2) doneAt = Date.now() + 6000;
  }
  const finalState = await evaluate(`(() => { const s = window.ironsight.state(); return { phase: s.phase, redScore: s.redScore, blueScore: s.blueScore, matchEndMs: s.matchEndMs, players: Object.keys(s.players) }; })()`);
  if (untilEnded) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(out.replace(/\.json$/, '') + '-ended.png', Buffer.from(shot.data, 'base64'));
  }
  // Snapshot before exporting diagnostics: trace streaming can take seconds and
  // must not append unrelated export-time frames to a completed gameplay run.
  const data = JSON.parse(await evaluate('JSON.stringify({...window.__perf,measurementMs:performance.now()-window.__perf.t0})'));
  const prof = profileCpu ? (await send('Profiler.stop')).profile : {startTime:0,nodes:[],samples:[],timeDeltas:[]};
  let traceEndElapsedMs;
  if (trace) {
    traceEndElapsedMs = await evaluate(`(() => { const t=performance.now()-window.__perf.t0; performance.mark('ironsight-hitch-end'); return t; })()`);
    await send('Tracing.end');
    const { stream } = await traced;
    const path = out.replace(/\.json$/, '') + '-trace.json';
    await writeFile(path, '');
    for (;;) {
      const chunk = await send('IO.read', { handle: stream, size: 1048576 });
      await appendFile(path, chunk.base64Encoded ? Buffer.from(chunk.data, 'base64') : chunk.data);
      if (chunk.eof) break;
    }
    await send('IO.close', { handle: stream });
  }
  // Profile timestamps do not reliably align with performance.timeOrigin on this platform; anchor on the pre-start performance.now().
  const originMs = await evaluate('performance.timeOrigin');
  const profStartPageMs = prof.startTime / 1000 - originMs;
  const usePageMs = Math.abs(profStartPageMs - nowBefore) < 5000 ? profStartPageMs : nowBefore;
  const nodes = new Map(prof.nodes.map(n => [n.id, n]));
  const times = []; let t = usePageMs; for (let i = 0; i < prof.samples.length; i++) { t += prof.timeDeltas[i] / 1000; times.push(t); }
  const label = n => `${n.callFrame.functionName || '(anon)'} ${(n.callFrame.url || '').split('/').pop()}:${n.callFrame.lineNumber}`;
  const attribute = (from, to) => { const agg = new Map(); let cnt = 0;
    for (let i = 0; i < times.length; i++) { if (times[i] < from || times[i] > to) continue; cnt++; const k = label(nodes.get(prof.samples[i])); agg.set(k, (agg.get(k) ?? 0) + 1); }
    return { samples: cnt, top: [...agg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${v} ${k}`) }; };
  const rel = e => ({ ...e, t: Math.round(e.t - data.t0) });
  const worst = [...data.frames].sort((a, b) => b.dt - a.dt).slice(0, 12).map(f => ({ ...rel(f), events: data.events.filter(e => Math.abs(e.t - f.t) < 1500).map(e => `${e.kind}@${Math.round(e.t - f.t)}ms${e.hp !== undefined ? ' hp' + e.hp : ''}${e.to !== undefined ? ' ' + e.from + '->' + e.to : ''}${e.name ? ' ' + e.name : ''}`), profile: attribute(f.t - f.dt, f.t) }));
  const deaths = data.events.filter(e => e.kind === 'death').length;
  // Count cache-key additions too: replacing one program can leave the count unchanged.
  const recompiles = data.events.filter(e => (e.kind === 'programs' || e.kind === 'program-new') && e.t - data.t0 > 3000).map(rel);
  const spikes = data.frames.filter(f => f.dt > 150).map(rel);
  const summary = { url: url.href, runMs, untilEnded, diagnostics: { profileCpu, trace, diagnosticTiming }, profilerSetupMs, traceEndElapsedMs,
    measurementMs:data.measurementMs,measuredFrames:data.frameCount,finalState, room: data.room, navigationSamples, deaths, frames24ms: data.frames.length, longTasks: data.long.length, recompiles, spikes, errors,
    events: data.events.filter(e => e.kind !== 'program-new' && e.kind !== 'program-gone').map(rel), worst };
  await writeFile(out, JSON.stringify({ summary, frames: data.frames.map(rel), long: data.long, programEvents: data.events.filter(e => e.kind === 'program-new' || e.kind === 'program-gone').map(rel) }, null, 1));
  console.log(JSON.stringify({ ...summary, events: undefined, worst: worst.slice(0, 3) }, null, 1));
  if (assert) {
    const failed = recompiles.length > 0 || spikes.length > 0 || deaths < 2 || errors.length > 0 || (untilEnded && finalState.phase !== 'ended');
    console.log(JSON.stringify({ hitchGate: failed ? 'FAIL' : 'PASS', deaths, recompiles: recompiles.length, spikes: spikes.length, errors: errors.length }));
    process.exitCode = failed ? 1 : 0;
  }
} finally {
  try { ws?.close(); } catch {}
  edge.kill(); await delay(500); await rm(profile, { recursive: true, force: true }).catch(() => {});
}
