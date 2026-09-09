/** Read-only matched natural-round summary. Run after the three metric seeds.
 * node tools/roles-audit.mjs session58-after session59-after session59 */
import {readFile,writeFile} from 'node:fs/promises';
const [before='session58-after',after='session59-after',prefix='session59']=process.argv.slice(2);
if(![before,after,prefix].every(s=>/^[\w-]+$/.test(s)))throw Error('Invalid prefix');
const read=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^\uFEFF/,''));
const dist=lives=>{const xs=lives.flatMap(l=>Number.isFinite(l.damageMs)?[l.damageMs/1000]:[]).sort((a,b)=>a-b);
  return {observed:xs.length,censored:lives.length-xs.length,medianSeconds:xs[Math.floor((xs.length-1)*.5)]??null,
    under5:xs.filter(x=>x<5).length,in20to30:xs.filter(x=>x>=20&&x<=30).length};};
const summary={};
for(const [key,p] of [['before',before],['after',after]]) {
  const rounds=await Promise.all([166588,166589,166590].map(seed=>read(`.inspect/${p}-${seed}-bot-round.json`)));
  const roles={};
  for(const r of rounds)for(const row of Object.values(r.roles??{})) {
    const total=roles[row.role]??={samples:0,adsSamples:0,movingSamples:0,kills:0,deaths:0,lanes:[0,0,0]};
    for(const field of ['samples','adsSamples','movingSamples','kills','deaths'])total[field]+=row[field];
    row.lanes.forEach((n,i)=>total.lanes[i]+=n);
  }
  summary[key]={rounds:rounds.map(r=>({seed:r.seed,seconds:r.durationMs/1000,score:[r.redScore,r.blueScore],coreVisitors:r.core.visitors,
    initial:dist(r.lives.filter(l=>l.initial)),respawn:dist(r.lives.filter(l=>!l.initial))})),
    initial:dist(rounds.flatMap(r=>r.lives.filter(l=>l.initial))),respawn:dist(rounds.flatMap(r=>r.lives.filter(l=>!l.initial))),roles};
}
const otherMaps=[];
for(const map of ['undertow','switchyard']) {
  const r=await read(`.inspect/${prefix}-${map}-bot-round.json`);
  otherMaps.push({map,seed:r.seed,seconds:r.durationMs/1000,score:[r.redScore,r.blueScore],kills:r.kills.length,
    initial:dist(r.lives.filter(l=>l.initial)),respawn:dist(r.lives.filter(l=>!l.initial))});
}
const report={note:`Three matched seeds, production12-seat Relay TDM. Retained baseline ${before}, candidate ${after}; see session log for the intervention and publication status. Divergent lives are not individually paired. Role counters sampled at100ms, before final ended frame; movement count excludes first observed alive sample but may include a respawn missed between samples. Lane time is coarse thirds; routeSamples in source reports separately retain actual positions and active route stage each second when available. Censored contacts are absent, never zero. No human fairness/capacity claim.`,...summary,otherMaps};
await writeFile(`.inspect/${prefix}-role-comparison.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
