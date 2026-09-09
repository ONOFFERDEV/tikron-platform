// node scripts/dom-orders-summary.mjs session67-before session67-orders
// Consumes the opt-in Undertow tool's 1s target samples and 100ms life samples.
import { readFile, writeFile } from 'node:fs/promises';
const [before='session67-before',after='session67-orders']=process.argv.slice(2);
if(![before,after].every(p=>/^[\w-]+$/.test(p)))throw Error('Invalid prefix');
const quantile=(values,q)=>{const a=[...values].sort((a,b)=>a-b);return a.length?a[Math.floor((a.length-1)*q)]:null;};
const summarize=r=>{
  let teamSeconds=0,clumped=0,multiObjectiveTeamSeconds=0,contestedClumped=0,contestedTeamSeconds=0;
  for(const s of r.objectiveSamples)for(const team of [0,1]){
    const counts=new Map();
    for(const p of s.players.filter(p=>p.team===team&&p.objective)){
      const k=JSON.stringify(p.objective);counts.set(k,(counts.get(k)??0)+1);
    }
    const largest=Math.max(0,...counts.values());teamSeconds++;
    if(largest>=4)clumped++;
    if(counts.size>=2)multiObjectiveTeamSeconds++;
    if([s.capA,s.capB,s.capC].filter(g=>g!==(team===0?200:0)).length>=2){contestedTeamSeconds++;if(largest>=4)contestedClumped++;}
  }
  const lives=initial=>{const a=r.lives.filter(l=>l.initial===initial),seen=a.filter(l=>l.damageMs!==undefined);return{
    observed:seen.length,censored:a.length-seen.length,medianSeconds:quantile(seen.map(l=>l.damageMs/1000),.5),
    fastUnder5s:seen.filter(l=>l.damageMs<5000).length};};
  return{seed:r.seed,score:[r.redScore,r.blueScore],durationSeconds:r.durationMs/1000,kills:r.kills.length,
    initial:lives(true),respawn:lives(false),gallery:r.gallery.visitors.length,
    assignments:{teamSeconds,clumped,clumpedPercent:100*clumped/teamSeconds,multiObjectiveTeamSeconds,
      contestedTeamSeconds,contestedClumped,contestedClumpedPercent:100*contestedClumped/contestedTeamSeconds}};
};
const rows=[];
for(const seed of [170684,170685,170686]){
  const pair={seed};for(const [key,prefix] of [['before',before],['after',after]])pair[key]=summarize(JSON.parse(await readFile(`.inspect/${prefix}-${seed}-bot-round.json`,'utf8')));
  rows.push(pair);
}
await writeFile(`.inspect/${after}-comparison.json`,JSON.stringify(rows,null,2));console.log(JSON.stringify(rows,null,2));
