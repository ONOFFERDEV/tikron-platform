/** Read-only route evidence from natural rounds, not a scripted bot path.
 * node tools/flanks-audit.mjs session60 */
import {readFile,writeFile} from 'node:fs/promises';
const prefix=process.argv[2]??'session60';
if(!/^[\w-]+$/.test(prefix))throw Error('Invalid prefix');
const summary=[];
for(const suffix of ['after-166588','after-166589','after-166590','switchyard']) {
  const name=`${prefix}-${suffix}`;
  const round=JSON.parse(await readFile(`.inspect/${name}-bot-round.json`,'utf8'));
  const samples=round.routeSamples;
  if(!Array.isArray(samples)||!samples.length)throw Error(`Missing route samples in ${name}`);
  const ids=[...new Set(samples.map(s=>s.id))];
  const bots=ids.map(id=>{
    const own=samples.filter(s=>s.id===id),active=own.filter(s=>s.stage!==null);
    return {id,samples:own.length,activeSamples:active.length,
      northSamples:own.filter(s=>s.z<33).length,southSamples:own.filter(s=>s.z>67).length,
      stages:[...new Set(active.map(s=>s.stage))].sort(),
      activeX:[Math.min(...active.map(s=>s.x)),Math.max(...active.map(s=>s.x))]};
  });
  summary.push({name,seed:round.seed,seconds:round.durationMs/1000,bots});
  // Circles rather than connected lines: death/respawn and missed observations
  // must not draw an invented traversal. Darker dots are overlapping samples.
  const dots=samples.map(s=>`<circle cx="${s.x.toFixed(2)}" cy="${s.z.toFixed(2)}" r=".45" fill="${s.stage===null?'#d4dade':Number(s.id.slice(4))<7?'#62e6eb':'#ffb15c'}" opacity=".45"/>`).join('');
  const heatmap=await readFile(`.inspect/${name}-bot-heatmap.svg`,'utf8');
  const note='<text x="1" y="104" font-size="2.4" fill="white">RUSH actual 1s samples: cyan north assignment / amber south / grey no commitment</text>';
  await writeFile(`.inspect/${name}-routes.svg`,heatmap.replace('</svg>',`${dots}${note}</svg>`));
}
await writeFile(`.inspect/${prefix}-flank-summary.json`,JSON.stringify({note:'Normal production rounds, no route/position/HP/clock writes. Active stage5 is the far-side return leg, not proof of a completed route. One-second samples omit dead bots and may miss short events. Overlaid dots are observed positions, not connected/guessed paths. No human fairness claim.',rounds:summary},null,2));
console.log(JSON.stringify(summary,null,2));
