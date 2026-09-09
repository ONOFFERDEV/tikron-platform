// node scripts/objective-hold-summary.mjs session68-before session68-hold
// One-second natural-round samples; orientation is not a visibility/aim verdict.
import { readFile, writeFile } from 'node:fs/promises';
const [before='session68-before',after='session68-hold']=process.argv.slice(2);
if(![before,after].every(p=>/^[\w-]+$/.test(p)))throw Error('Invalid prefix');
const rows=[];
for(const seed of [170684,170685,170686]) {
  const load=async prefix=>JSON.parse(await readFile(`.inspect/${prefix}-${seed}-bot-round.json`,'utf8'));
  const old=await load(before),current=await load(after);
  const watches=[0,1].map(team=>current.objectiveSamples.flatMap(s=>s.players).find(p=>p.team===team&&p.watch)?.watch);
  const summarize=round=>{
    const players=round.objectiveSamples.flatMap(s=>s.players);
    const holders=players.filter(p=>p.objective&&Math.hypot(p.x-p.objective.x,p.z-p.objective.z)<=2);
    const facing=holders.filter(p=>{
      const watch=watches[p.team];if(!watch)return false;
      const yaw=Math.atan2(watch.x-p.objective.x,watch.z-p.objective.z);
      return Math.abs(Math.atan2(Math.sin(p.yaw-yaw),Math.cos(p.yaw-yaw)))<=Math.PI/3;
    });
    const duels=players.filter(p=>p.duel);
    return {holderSamples:holders.length,approachFacingSamples:facing.length,
      approachFacingPercent:holders.length?100*facing.length/holders.length:null,
      duelSamples:duels.length,maxDuelAnchorOffset:duels.length?Math.max(...duels.map(p=>Math.abs(p.z-p.duel.z))):null};
  };
  rows.push({seed,before:summarize(old),after:summarize(current)});
}
const report={note:'One-second alive-player snapshots, <=2m from assigned anchor; facing within60 degrees of authored opposing-side approach. Includes actual combat turns and event-route holders. Before did not record local duel metadata: zero samples is unavailable, not zero duels. No claim of physical occupancy duration, LOS, side fairness or human enjoyment.',rows};
await writeFile(`.inspect/${after}-orientation.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
