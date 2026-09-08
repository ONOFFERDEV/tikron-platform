// Production Web Audio graph rendered to WAV for repeatable before/after review.
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
const prefix = process.argv[2] ?? 'audio';
if (!/^[\w-]+$/.test(prefix)) throw Error('Invalid prefix');
const profile = await mkdtemp(join(tmpdir(), 'ironsight-inspect-audio-'));
const edge = spawn(process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ['--headless=new', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--no-first-run', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let ws, id = 0; const pending = new Map(), reports = [], errors = [];
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const key = ++id, timer = setTimeout(() => { pending.delete(key); reject(Error(method)); }, 30000);
  pending.set(key, { resolve, reject, timer }); ws.send(JSON.stringify({ id: key, method, params }));
});
const evaluate = async expression => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
  return r.result?.value;
};
try {
  let port;
  for (let i = 0; i < 100; i++) { try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await delay(100); } }
  if (!port) throw Error('Edge did not start');
  const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = event => {
    const m = JSON.parse(event.data), r = pending.get(m.id);
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params);
    if (!r) return; pending.delete(m.id); clearTimeout(r.timer);
    m.error ? r.reject(Error(JSON.stringify(m.error))) : r.resolve(m.result);
  };
  await send('Runtime.enable'); await send('Page.enable');
  const built = await build({ stdin: { resolveDir: process.cwd(), contents: `
    import {initAudio,playFire,setMuted,setMasterVolume} from './client/audio.ts';
    globalThis.captureAudio=async (weapon,mode)=>{
      const c=new OfflineAudioContext(2,48000,48000);
      // Offline contexts do not run until startRendering; schedule production cues first.
      Object.defineProperty(c,'state',{get:()=> 'running'});
      const original=window.AudioContext, add=window.addEventListener;
      let resume, sources=0, ended=0, buffers=0;
      const create=c.createBufferSource.bind(c), buffer=c.createBuffer.bind(c);
      c.createBuffer=(...args)=>{buffers+=args[0]*args[1]*4;return buffer(...args);};
      c.createBufferSource=()=>{sources++;const s=create();s.addEventListener('ended',()=>ended++);return s;};
      window.AudioContext=function(){return c;};
      window.addEventListener=(type,fn)=>{if(type==='pointerdown')resume=fn;};
      const started=performance.now();
      try {initAudio();resume();setMuted(false);setMasterVolume(1);
        if(mode==='muted')setMuted(true);
        if(mode==='zero')setMasterVolume(0);
        // Let gain automation settle before the measured shot.
        Object.defineProperty(c,'currentTime',{value:0.1,configurable:true});
        for(let i=0;i<(['saturation','recovery','priority'].includes(mode)?25:1);i++)playFire(weapon,['remote','saturation','recovery','priority'].includes(mode)?{x:-8,y:0,z:0}:undefined);
      if(mode==='priority')playFire(weapon);
        delete c.currentTime;
      } finally {window.AudioContext=original;window.addEventListener=add;}
      const prepareMs=performance.now()-started;
      const suspended=mode==='recovery'?c.suspend(0.6):null;
      const rendering=c.startRendering();
      if(suspended){await suspended;for(let i=0;i<25;i++)playFire(weapon,{x:-8,y:0,z:0});await c.resume();}
      const rendered=await rendering;
      const a=rendered.getChannelData(0),b=rendered.getChannelData(1);
      let peak=0,sum=0,left=0,right=0,tail=0;
      const bytes=new Uint8Array(44+a.length*4),v=new DataView(bytes.buffer);
      const str=(o,s)=>{for(let i=0;i<s.length;i++)bytes[o+i]=s.charCodeAt(i);};
      str(0,'RIFF');v.setUint32(4,bytes.length-8,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);v.setUint32(24,48000,true);v.setUint32(28,192000,true);v.setUint16(32,4,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,a.length*4,true);
      for(let i=0;i<a.length;i++){if(i>4800){peak=Math.max(peak,Math.abs(a[i]),Math.abs(b[i]));left+=a[i]*a[i];right+=b[i]*b[i];sum+=a[i]*a[i]+b[i]*b[i];}if(i>14400&&i<28800)tail+=a[i]*a[i]+b[i]*b[i];v.setInt16(44+i*4,Math.max(-1,Math.min(1,a[i]))*32767,true);v.setInt16(46+i*4,Math.max(-1,Math.min(1,b[i]))*32767,true);}
      let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
      return {wav:btoa(binary),peak,rms:Math.sqrt(sum/(43200*2)),tailRms:Math.sqrt(tail/(14400*2)),left,right,sources,ended,bufferBytes:buffers,prepareMs};
    };` }, bundle: true, write: false, format: 'iife' });
  for (const mode of ['local', 'remote', 'saturation', 'recovery', 'priority', 'muted', 'zero']) for (const weapon of mode === 'local' ? [0, 1, 2, 3, 4] : [0]) {
    await send('Page.navigate', { url: 'about:blank' }); await delay(100);
    await evaluate(built.outputFiles[0].text);
    const r = await evaluate(`captureAudio(${weapon},${JSON.stringify(mode)})`);
    await writeFile(`.inspect/${prefix}-${mode}-${weapon}.wav`, Buffer.from(r.wav, 'base64')); delete r.wav;
    if (!Number.isFinite(r.peak) || (r.peak >= 1 && !process.argv.includes('--baseline'))) throw Error('Nonfinite/clipped audio');
    if ((mode === 'muted' || mode === 'zero') && r.peak > 0.00001) throw Error('Mute/volume leaked');
    if (mode === 'remote' && r.right <= r.left) throw Error('Stereo direction reversed');
    if (mode === 'saturation' && r.sources !== 21) throw Error('Remote voice cap changed');
    if (mode === 'recovery' && r.sources !== 41) throw Error('Remote voices failed to recover');
    if (mode === 'priority' && r.sources !== 22) throw Error('Remote saturation dropped local fire');
    if (r.ended !== r.sources - 1) throw Error('Transient sources did not end');
    reports.push({ mode, weapon, ...r }); console.log(mode, weapon, JSON.stringify(r));
  }
  await writeFile(`.inspect/${prefix}-report.json`, JSON.stringify({ reports, errors }, null, 2));
  if (errors.length) throw Error('Browser errors');
} finally {
  if (ws?.readyState === WebSocket.OPEN) { await send('Browser.close').catch(() => {}); ws.close(); }
  if (edge.exitCode === null) edge.kill();
  for (const r of pending.values()) clearTimeout(r.timer);
  if (!resolve(profile).startsWith(resolve(tmpdir()) + sep)) throw Error('Unsafe profile cleanup');
  await rm(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 });
}

