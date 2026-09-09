/** Frozen-pose perception comparison, NOT a live match or pacing measurement.
 * node tools/perception-audit.mjs 423d156 session58
 * Imports the historical brain from git read-only; evidence stays in .inspect.
 */
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
const [revision='423d156',prefix='session58']=process.argv.slice(2);
if(!/^[a-f\d]{7,40}$/.test(revision)||!/^[\w-]+$/.test(prefix))throw Error('Invalid revision/prefix');
const before=execFileSync('git',['show',`${revision}:apps/ironsight/src/bots.ts`],{encoding:'utf8'});
const legacyPath=`.inspect/${prefix}-legacy-bots.ts`;
await writeFile(legacyPath,before.replaceAll('"./physics.js"','"../src/physics.js"')
  .replaceAll('"./config.js"','"../src/config.js"').replaceAll('"./game-config.js"','"../src/game-config.js"'));
const source=`import * as before from './${legacyPath}';import * as after from './src/bots.ts';
export function sample(kind){
 const api=kind==='before'?before:after;
 const brain=api.createBotBrain({seed:58,waypoints:[{x:40,y:11}],aimNoiseRad:0,reactionMs:150});
 const self={x:20,y:0,z:11,yaw:Math.PI/2,pitch:0,team:1,alive:true,crouch:false};
 const enemy={id:'flanker',x:8,y:0,z:11,team:0,alive:true,crouch:false};
 if(kind==='heard')after.alertBot(brain,enemy);
 const frames=[];
 for(let ms=50;ms<=1000;ms+=50){const d=api.botThink({self,enemies:[enemy],boxes:[],teamless:false,engagementRange:40},brain,50);
  self.yaw=d.look.yaw;self.pitch=d.look.pitch;
  frames.push({ms,yaw:self.yaw,fire:d.fire,lock:brain.lockId});}
 return {kind,frames,firstFireMs:frames.find(f=>f.fire)?.ms??null,pose:{x:self.x,y:self.y,z:self.z,yaw:self.yaw}};
}`;
const bundled=await build({stdin:{contents:source,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const {sample}=await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const samples=['before','silent','heard'].map(sample);
if(samples[0].firstFireMs===null||samples[1].firstFireMs!==null||samples[2].firstFireMs===null)throw Error('Perception regression');
await writeFile(`.inspect/${prefix}-perception-fixtures.json`,JSON.stringify({revision,
 note:'One-second deterministic brain fixture: observer at (8,1.65,11), enemy at (20,0,11) facing east, legal open Relay lane. Positions held fixed to isolate looking/trigger behavior; movement decisions are not integrated. Before runs historical production brain, silent/heard run current production brain. Stills use these actual returned yaws; no gameplay option disables perception.',samples},null,2));
console.log(JSON.stringify(samples.map(s=>({kind:s.kind,firstFireMs:s.firstFireMs,yaw:s.pose.yaw})),null,2));

// Match comparisons deliberately retain each round's original mode/note.
const rounds={};
for(const kind of ['before','after']) {
 rounds[kind]=await Promise.all([166588,166589,166590].map(async seed=>JSON.parse(await readFile(`.inspect/${prefix}-${kind}-${seed}-bot-round.json`,'utf8'))));
}
const distribution=lives=>{
 const values=lives.flatMap(l=>Number.isFinite(l.damageMs)?[l.damageMs/1000]:[]).sort((a,b)=>a-b);
 return {lives:lives.length,observed:values.length,censored:lives.length-values.length,
 medianSeconds:values[Math.floor((values.length-1)*.5)]??null,
 under5:values.filter(v=>v<5).length,inTarget20To30:values.filter(v=>v>=20&&v<=30).length};
};
const summary=Object.fromEntries(Object.entries(rounds).map(([kind,rs])=>[kind,{
 rounds:rs.map(r=>({seed:r.seed,seconds:r.durationMs/1000,score:[r.redScore,r.blueScore],coreVisitors:r.core.visitors,
  initial:distribution(r.lives.filter(l=>l.initial)),respawn:distribution(r.lives.filter(l=>!l.initial))})),
 initial:distribution(rs.flatMap(r=>r.lives.filter(l=>l.initial))),respawn:distribution(rs.flatMap(r=>r.lives.filter(l=>!l.initial))),
}]));
await writeFile(`.inspect/${prefix}-contact-comparison.json`,JSON.stringify({
 note:'Three matched seeds, production twelve-bot Relay TDM. Only perception/turning/respawn memory differ. Trajectories diverge, so lives are not individually paired. Damage sampled at100ms; censored contacts remain absent. No human fairness or deployed capacity claim.',...summary},null,2));
console.log(JSON.stringify(summary,null,2));
