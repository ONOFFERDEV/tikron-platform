import { createReadStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
// CDP's streamed format is one event per line. Keep only raster/executable work
// and correlate it with the production preparation marks, including loading gaps.
// node scripts/compositor-trace-summary.mjs .inspect/compositor-prepare
const stem = process.argv[2];
if (!stem) throw Error('Pass the trace filename stem (without .json)');
const probe = JSON.parse(await readFile(stem + '.json', 'utf8'));
const markers = new Map(), threads = new Map(), processes = new Map(), ranges = new Map();
const rendererRanges = new Map();
const interesting = []; let count = 0;
for await (const line of createInterface({ input: createReadStream(stem + '-trace.json'), crlfDelay: Infinity })) {
  if (!line.startsWith('{"args":')) continue;
  const e = JSON.parse(line.replace(/\],"metadata":.*$/, '').replace(/,$/, '')); count++;
  if (e.ph === 'X' && e.name === 'ThreadControllerImpl::RunTask') {
    const key = `${e.pid}:${e.tid}`, range = rendererRanges.get(key) ?? { start: Infinity, end: -Infinity };
    range.start = Math.min(range.start,e.ts); range.end = Math.max(range.end,e.ts+e.dur); rendererRanges.set(key,range);
  }
  if (e.name.startsWith('ironsight-') && e.ph === 'I') markers.set(e.name, e);
  if (e.ph === 'M' && e.name === 'thread_name') threads.set(`${e.pid}:${e.tid}`, e.args.name);
  if (e.ph === 'M' && e.name === 'process_name') processes.set(e.pid, e.args.name);
  if (e.name.startsWith('ironsight-ui-') && ['b','e'].includes(e.ph)) {
    const entry = ranges.get(e.name) ?? {}; entry[e.ph === 'b' ? 'start' : 'end'] = e.ts; ranges.set(e.name, entry);
  }
  if (e.ph === 'X' && /RasterTask|SkiaOutputSurfaceImpl::FinishPaintRenderPass|ExecutableTask|RasterBuffer|DrawAndSwap|PaintArtifactCompositor|LayerTreeHost::DoUpdateLayers/.test(e.name)) interesting.push(e);
}
const anchor = markers.get('ironsight-ui-prepare-start');
if (!anchor || !markers.has('ironsight-ui-prepare-end')) throw Error('Trace does not cover preparation');
const offset = anchor.ts - probe.summary.preparation.marks.find(m => m.name === anchor.name).startTime * 1000;
const rendererRange = rendererRanges.get(`${anchor.pid}:${anchor.tid}`);
const describe = e => ({ name: e.name, thread: `${processes.get(e.pid)}/${threads.get(`${e.pid}:${e.tid}`)}`,
  startMs: (e.ts - offset) / 1000, wallMs: e.dur / 1000, cpuMs: e.tdur === undefined ? null : e.tdur / 1000 });
const overlap = (start, end) => interesting.filter(e => e.ts < end && e.ts + e.dur > start);
const phases = [...ranges].map(([name, range]) => {
  if (!range.start || !range.end) throw Error('Incomplete phase ' + name);
  const events = overlap(range.start, range.end);
  const counts = {};
  for (const e of events) counts[e.name] = (counts[e.name] ?? 0) + 1;
  return { name, startMs: (range.start-offset)/1000, durationMs: (range.end-range.start)/1000, counts,
    top: events.sort((a,b)=>b.dur-a.dur).slice(0, 8).map(describe) };
});
const startupSpikes = probe.summary.preparation.startupFrames.filter(([,dt])=>dt>150).map(([t,dt]) => ({ t, dt,
  traceCoversWindow: !!rendererRange && offset+(t-dt)*1000>=rendererRange.start && offset+t*1000<=rendererRange.end,
  beforeReady: t < probe.summary.preparation.firstReadyAt,
  gpu: probe.summary.preparation.startupDiagnostics?.find(d=>d.t===t),
  top: overlap(offset+(t-dt)*1000, offset+t*1000).sort((a,b)=>b.dur-a.dur).slice(0,12).map(describe) }));
const postPreparationCompiles = interesting.filter(e=>e.ts>markers.get('ironsight-ui-prepare-end').ts
  && /ExecutableTask/.test(e.name) && e.dur>50000).map(describe);
const report = { count, phases, startupSpikes, postPreparationCompiles };
await writeFile(stem+'-summary.json', JSON.stringify(report,null,2));
console.log(JSON.stringify({count, phases: phases.map(p=>({...p,top:p.top.slice(0,2)})), startupSpikes},null,2));
