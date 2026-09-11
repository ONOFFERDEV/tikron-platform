import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

/** Normal Worker inputs, with the existing Training-only command review adapter.
 * No position, health, bot, clock or server-state injection. */
export async function switchyardYardProbe({ send, evaluate, delay, capture, record, east = false }) {
  const built = await build({stdin:{contents:`
    import {ARENA3} from './src/map/arena3.js';
    import {GroundNavigator} from './src/map/navigation.js';
    export {RECONCILE_SOFT_M as soft} from './client/config.js';
    const nav=new GroundNavigator(ARENA3); export const next=(from,to)=>nav.next(from,to);
  `,resolveDir:fileURLToPath(new URL('..',import.meta.url))},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
  const {next,soft}=await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
  const key=(type,sprint=false)=>send('Input.dispatchKeyEvent',{type,key:sprint?'Shift':'w',code:sprint?'ShiftLeft':'KeyW',windowsVirtualKeyCode:sprint?16:87});
  const snapshot=()=>evaluate(`(()=>{const I=window.ironsight;return{me:I.state().players[I.myId],camera:I.camPos(),movement:I.movementInfo()}})()`);
  const point=p=>east?{...p,x:150-p.x}:p;
  const report={section:'yard',east,softThresholdM:soft,stages:[],samples:[],corrections:[],
    note:'Walk and sprint via ordinary inputs. Same-acknowledgement errors are separate from raw snapshot lag. Training-only adapter; not normal-play rollback acceptance.'};
  const started=Date.now();let lastTick=-1;
  const collect=async()=>{
    const fresh=await evaluate(`window.ironsight.movementReview().filter(s=>s.tick>${lastTick})`);
    report.corrections.push(...fresh);if(fresh.length)lastTick=fresh.at(-1).tick;
  };
  const travel=async(goal,sprint=false,ground=false)=>{
    goal=point(goal);const deadline=Date.now()+60000;
    try {for(;;){
      const sample=await snapshot(),p=sample.movement.pos;report.samples.push({atMs:Date.now()-started,...sample});
      if(Math.hypot(p.x-goal.x,p.z-goal.z)<.22)break;
      if(!sample.me.alive||Date.now()>deadline)throw Error(`Switchyard yard route stalled: ${JSON.stringify({p,goal})}`);
      const target=ground?next(p,goal):goal;
      await evaluate(`window.ironsight.look(${Math.atan2(target.x-p.x,target.z-p.z)},0)`);
      // A 50ms sprint step is .45m, wider than the .44m arrival diameter.
      // Walk the last metre so a discrete command cannot oscillate across
      // the waypoint forever. Arrival and reconciliation limits stay fixed.
      const fast=sprint&&Math.hypot(target.x-p.x,target.z-p.z)>1;
      if(fast)await key('keyDown',true);await key('keyDown');
      await delay(Math.min(60,Math.max(12,Math.hypot(target.x-p.x,target.z-p.z)*(fast?70:100))));
      await key('keyUp');if(fast)await key('keyUp',true);await delay(10);
    }}finally{await key('keyUp');await key('keyUp',true);}
    await delay(200);
  };
  const path=async(points,sprint=false,ground=false)=>{for(const [x,z]of points)await travel({x,z},sprint,ground);};
  const stage=async(label,target,expectedY)=>{
    target=point(target);const p=(await snapshot()).me;
    await evaluate(`window.ironsight.look(${Math.atan2(target.x-p.x,target.z-p.z)},${Math.atan2(target.y-p.y-1.65,Math.hypot(target.x-p.x,target.z-p.z))})`);
    await delay(200);const sample=await snapshot();
    if(expectedY!==undefined&&Math.abs(sample.me.y-expectedY)>.025)throw Error(`${label}: floor ${sample.me.y}, expected ${expectedY}`);
    await collect();report.stages.push({label,atMs:Date.now()-started,...sample});await capture(label);await record(report);
  };
  const fire=async()=>{
    await send('Input.dispatchMouseEvent',{type:'mousePressed',x:960,y:540,button:'left',clickCount:1});await delay(250);
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:960,y:540,button:'left',clickCount:1});
  };
  try {
    await travel({x:46,z:46},false,true);
    report.approachMs=Date.now()-started;lastTick=await evaluate('window.ironsight.movementReview().at(-1)?.tick ?? -1');
    for(const sprint of [false,true]) {
      const mode=sprint?'sprint':'walk';
      await stage(`${mode}-bay-front`,{x:47,y:2,z:36},0);
      await path([[46,42],[47,40]],sprint);
      await stage(`${mode}-service-bay`,{x:43,y:1.4,z:40},0);
      await path([[47,35]],sprint);
      await stage(`${mode}-north-breach`,{x:47,y:1.65,z:44},0);await fire();
      await path([[47,37.6],[42,37.6],[41.6,38],[41.6,42]],sprint);
      await stage(`${mode}-thin-wall`,{x:44,y:1.5,z:40},0);
      await path([[46,42],[52.4,42]],sprint);
      await stage(`${mode}-equipment-cover`,{x:50,y:1.1,z:39.5},0);await fire();
      await path([[55,42],[52.4,42],[52.4,37.6],[47,37.6],[46,42],[46,46]],sprint);
      await stage(`${mode}-south-exit`,{x:43,y:2,z:43},0);
    }
    await collect();const matched=report.corrections.filter(s=>!s.reset&&s.matchedError!==null);
    report.maxMatchedErrorM=Math.max(0,...matched.map(s=>s.matchedError));
    report.maxRawLagM=Math.max(0,...report.corrections.map(s=>s.rawError));
    report.resets=report.corrections.filter(s=>s.reset).length;report.matched=matched.length;report.elapsedMs=Date.now()-started;
    if(matched.length<100||report.maxMatchedErrorM>=soft||report.resets)throw Error(`Command agreement failed: ${matched.length} matched, ${report.maxMatchedErrorM}m, ${report.resets} resets`);
    report.passed=true;await record(report);return report;
  } catch(error) {await collect();report.failure=String(error);report.elapsedMs=Date.now()-started;await record(report);throw error;}
  finally {await key('keyUp');await key('keyUp',true);await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:960,y:540,button:'left',clickCount:1});}
}
