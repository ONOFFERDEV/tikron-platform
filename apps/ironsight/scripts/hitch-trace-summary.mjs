// Read-only companion to hitch-probe --trace. No frame filtering or gate changes.
// node scripts/hitch-trace-summary.mjs .inspect/<probe>.json
import { readFile, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
const path = process.argv[2];
if (!path?.endsWith('.json')) throw Error('Pass a hitch-probe JSON path');
const probe = JSON.parse(await readFile(path, 'utf8'));
const tracePath=path.replace(/\.json$/, '') + '-trace.json';
// CDP writes one event per line. Stream twice: traces can exceed V8's maximum
// string length; only retain events that overlap the measured slow frames.
async function* entries() {
  const lines=createInterface({input:createReadStream(tracePath),crlfDelay:Infinity});
  for await(const line of lines) {
    if(!line.startsWith('{"args":'))continue;
    // The final event can share its line with the outer trace-array terminator
    // and metadata key. Strip only that CDP trailer, not any event fields.
    yield JSON.parse(line.replace(/\],"metadata":.*$/,'').replace(/,$/,''));
  }
}
let marker, endMarker, count=0, earliest=Infinity,latest=-Infinity;
const threads = new Map(), processes = new Map(), threadRanges = new Map();
for await(const e of entries()) {
  count++;
  if(e.ph!=='M'&&e.ts>0){earliest=Math.min(earliest,e.ts);latest=Math.max(latest,e.ts+(e.dur??0));}
  if(e.ph==='X' && e.name==='ThreadControllerImpl::RunTask') {
    const key=`${e.pid}:${e.tid}`, range=threadRanges.get(key)??{first:Infinity,last:-Infinity};
    range.first=Math.min(range.first,e.ts);range.last=Math.max(range.last,e.ts+(e.dur??0));threadRanges.set(key,range);
  }
  if(e.name==='ironsight-hitch-start')marker=e;
  if(e.name==='ironsight-hitch-end')endMarker=e;
  if(e.ph==='M') {
    if (e.name === 'thread_name') threads.set(`${e.pid}:${e.tid}`, e.args.name);
    if (e.name === 'process_name') processes.set(e.pid, e.args.name);
  }
}
if(!marker && endMarker && Number.isFinite(probe.summary.traceEndElapsedMs))
  marker={...endMarker,ts:endMarker.ts-probe.summary.traceEndElapsedMs*1000};
if (!marker) throw Error('Missing trace clock anchor');
// Long background tasks may begin before a rolling buffer's retained records.
// Their old timestamps do not prove the game renderer's window survived.
const rendererRange=threadRanges.get(`${marker.pid}:${marker.tid}`);
const intervals=probe.frames.map(f=>({end:marker.ts+f.t*1000,start:marker.ts+(f.t-f.dt)*1000}));
const events=[];
for await(const e of entries())if(intervals.some(w=>e.ts<w.end+10000&&e.ts+(e.dur??0)>w.start-10000))events.push(e);
const label = e => `${processes.get(e.pid) ?? e.pid}/${threads.get(`${e.pid}:${e.tid}`) ?? e.tid}`;
const complete = events.filter(e => e.ph === 'X' && e.dur > 0);
const windows = probe.frames.map(f => {
  const end = marker.ts + f.t * 1000, start = end - f.dt * 1000;
  const overlap = complete.filter(e => e.ts < end && e.ts + e.dur > start);
  const top = overlap.map(e => ({ thread: label(e), name: e.name,
    startMs: +((e.ts - marker.ts) / 1000).toFixed(3), durationMs: +(e.dur / 1000).toFixed(3),
    cpuMs:e.tdur===undefined?undefined:+(e.tdur/1000).toFixed(3),
    overlapMs: +((Math.min(end, e.ts + e.dur) - Math.max(start, e.ts)) / 1000).toFixed(3), args: e.args }))
    .sort((a,b) => b.overlapMs - a.overlapMs).slice(0, 25);
  const rendererTasks = overlap.filter(e => e.pid === marker.pid && e.tid === marker.tid && e.name === 'ThreadControllerImpl::RunTask');
  const frameSignals = events.filter(e => e.ts >= start - 10000 && e.ts <= end + 10000 && /BeginFrame|DrawFrame|SwapBuffers|AnimationFrame|PipelineReporter/.test(e.name))
    .map(e => ({ thread:label(e),name:e.name,phase:e.ph,tMs:+((e.ts-marker.ts)/1000).toFixed(3),durationMs:(e.dur??0)/1000,args:e.args }));
  return { ...f,traceCoversWindow:start>=earliest&&end<=latest&&!!rendererRange&&start>=rendererRange.first&&end<=rendererRange.last,
    rendererTaskMs: rendererTasks.reduce((n,e) => n + (Math.min(end,e.ts+e.dur)-Math.max(start,e.ts))/1000,0), top, frameSignals };
});
const result = { marker, events:count, retainedEvents:events.length, threads:[...threads], windows };
await writeFile(path.replace(/\.json$/, '')+'-trace-summary.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({events:events.length,windows:windows.map(({frameSignals,...w})=>({...w,top:w.top.slice(0,8)}))},null,2));
