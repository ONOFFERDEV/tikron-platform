// Read-only route/contact comparison; does not rerun or alter the natural rounds.
// node scripts/objective-approach-summary.mjs session68-hold session70-pumps
import { readFile, writeFile } from 'node:fs/promises';
const [before,after]=process.argv.slice(2);
if(![before,after].every(p=>p&&/^[\w-]+$/.test(p)))throw Error('Pass before/after metric prefixes');
const ids=new Set(['bot-2','bot-3','bot-4','bot-5']); // initial B assignments in these fixed natural fills
const quantile=(v,q)=>{const a=[...v].sort((a,b)=>a-b);return a.length?a[Math.floor((a.length-1)*q)]:null;};
const rows=[];
for(const seed of [170684,170685,170686]) {
  const row={seed};
  for(const [key,prefix] of [['before',before],['after',after]]) {
    const r=JSON.parse(await readFile(`.inspect/${prefix}-${seed}-bot-round.json`,'utf8'));
    const initial=r.lives.filter(l=>l.initial&&ids.has(l.id));
    const observed=initial.filter(l=>l.damageAt),samples=r.objectiveSamples.flatMap(s=>s.players
      .filter(p=>p.objective?.x===75&&p.objective.z===95).map(p=>({atMs:s.atMs,...p})));
    // Report ALL opening assigned lives, including a survivor whose first damage
    // came only after reassignment. Do not drop inconvenient/censored samples.
    row[key]={openingB:{lives:initial.length,observed:observed.length,censored:initial.length-observed.length,
      medianSeconds:quantile(observed.map(l=>l.damageMs/1000),.5),
      within12m:observed.filter(l=>Math.hypot(l.damageAt.x-75,l.damageAt.z-95)<=12).length,
      samples:initial.map(l=>({id:l.id,damageSeconds:l.damageMs===undefined?null:l.damageMs/1000,at:l.damageAt??null}))},
      bAssignmentSamples:samples.length,behindPumps:samples.filter(p=>p.z>=84&&p.z<=88&&p.x>=20&&p.x<=130).length,
      exposedCrossLane:samples.filter(p=>p.z>=72&&p.z<=76&&p.x>=30&&p.x<=120).length,
      court:samples.filter(p=>Math.hypot(p.x-75,p.z-95)<=4).length,
      approaches:samples.filter(p=>p.approach).length,
      fastRespawns:r.lives.filter(l=>!l.initial&&l.damageMs<5000).map(l=>({id:l.id,team:l.team,bornMs:l.bornMs,
        damageMs:l.damageMs,spawn:l.spawn,at:l.damageAt,exposedAtSpawn:l.threats.some(t=>t.exposed)}))};
  }
  rows.push(row);
}
const result={note:'Same three normal twelve-bot seeds, 100ms life sampling and 1s movement sampling. Opening B cohort is fixed before simulation, not selected by outcome. Coordinates/counts are route evidence, not human pacing/fairness. Unobserved damage remains absent.',rows};
await writeFile(`.inspect/${after}-routes.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
