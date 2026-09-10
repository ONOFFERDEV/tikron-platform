import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

/** Normal Worker inputs, with the existing Training-only command review adapter.
 * No position, health, bot, clock or server-state injection. */
export async function relayYardProbe({ send, evaluate, delay, capture, record, east = false, section = 'yard' }) {
  if (!['yard', 'roof', 'trench'].includes(section)) throw Error('Unknown Relay route section');
  const built = await build({stdin:{contents:`
    import {ARENA1} from './src/map/arena1.js';
    import {GroundNavigator} from './src/map/navigation.js';
    export {RECONCILE_SOFT_M as soft} from './client/config.js';
    const nav=new GroundNavigator(ARENA1); export const next=(from,to)=>nav.next(from,to);
  `,resolveDir:fileURLToPath(new URL('..',import.meta.url))},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
  const {next,soft}=await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
  const key=(type,sprint=false)=>send('Input.dispatchKeyEvent',{type,key:sprint?'Shift':'w',code:sprint?'ShiftLeft':'KeyW',windowsVirtualKeyCode:sprint?16:87});
  const snapshot=()=>evaluate(`(()=>{const I=window.ironsight;return{me:I.state().players[I.myId],camera:I.camPos(),movement:I.movementInfo()}})()`);
  const point=p=>east?{...p,x:150-p.x}:p;
  const report={section,east,softThresholdM:soft,stages:[],samples:[],corrections:[],
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
      if(!sample.me.alive||Date.now()>deadline)throw Error(`Relay ${section} route stalled: ${JSON.stringify({p,goal})}`);
      const target=ground?next(p,goal):goal;
      await evaluate(`window.ironsight.look(${Math.atan2(target.x-p.x,target.z-p.z)},0)`);
      if(sprint)await key('keyDown',true);await key('keyDown');
      await delay(Math.min(60,Math.max(12,Math.hypot(target.x-p.x,target.z-p.z)*(sprint?70:100))));
      await key('keyUp');if(sprint)await key('keyUp',true);await delay(10);
    }}finally{await key('keyUp');await key('keyUp',true);}
    await delay(200);
  };
  const path=async(points,sprint=false,ground=false)=>{for(const [x,z]of points)await travel({x,z},sprint,ground);};
  const stage=async(label,target,expectedY)=>{
    target=point(target);const p=(await snapshot()).me;
    await evaluate(`window.ironsight.look(${Math.atan2(target.x-p.x,target.z-p.z)},${Math.atan2(target.y-p.y-1.65,Math.hypot(target.x-p.x,target.z-p.z))})`);
    await delay(200);let sample=await snapshot();
    if(label.endsWith('drop')) {
      const end=Date.now()+2500;
      while(Math.abs(sample.me.y)>.025||!sample.movement.grounded){
        if(Date.now()>end)throw Error('Roof drop did not settle');await delay(50);sample=await snapshot();
      }
    }
    if(expectedY!==undefined&&Math.abs(sample.me.y-expectedY)>.025)throw Error(`${label}: floor ${sample.me.y}, expected ${expectedY}`);
    await collect();report.stages.push({label,atMs:Date.now()-started,...sample});await capture(label);await record(report);
  };
  const fire=async()=>{
    await send('Input.dispatchMouseEvent',{type:'mousePressed',x:960,y:540,button:'left',clickCount:1});await delay(250);
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:960,y:540,button:'left',clickCount:1});
  };
  try {
    await travel(section==='roof'?{x:41,z:46}:section==='trench'?{x:36,z:76}:{x:30.5,z:88},false,true);
    report.approachMs=Date.now()-started;lastTick=await evaluate('window.ironsight.movementReview().at(-1)?.tick ?? -1');
    for(const sprint of [false,true]) {
      const mode=sprint?'sprint':'walk';
      if(section==='yard') {
        await stage(`${mode}-court-front`,{x:30.5,y:2,z:80},0);
        await path([[30.5,83.8],[24.6,83.8],[24.6,81.6]],sprint);
        await stage(`${mode}-thin-wall`,{x:30.5,y:1.65,z:81.6},0);
        await path([[30.5,81.6],[30.5,78.8]],sprint);
        await stage(`${mode}-north-breach`,{x:30.5,y:1.65,z:85},0);
        await path([[30.5,83.8],[37.3,83.8]],sprint);
        await stage(`${mode}-working-court`,{x:26,y:2,z:80.5},0);await fire();
        await path([[37.3,84.7],[40,84.7]],sprint);
        await travel({x:64,z:86},sprint,true);
        await stage(`${mode}-cargo-entry`,{x:56,y:1.65,z:86},0);
        await path([[61.8,86],[56,86]],sprint);
        await stage(`${mode}-cargo-pocket`,{x:59,y:1.65,z:88},0);await fire();
        await path([[56,82],[62,82],[64,86]],sprint);
        await travel({x:30.5,z:88},sprint,true);
      } else if(section==='roof') {
        await stage(`${mode}-room-entry`,{x:41,y:1.65,z:38},0);
        await path([[41,41],[41,38],[42,38],[42,35.5],[46,35.5]],sprint);
        await stage(`${mode}-stair`,{x:51,y:4,z:35.5});
        await path([[51,35.5],[51,38.5]],sprint);
        await stage(`${mode}-roof`,{x:75,y:4,z:50},3);await fire();
        await path([[51,35.5],[42,35.5]],sprint);
        await stage(`${mode}-downstairs`,{x:40,y:1.65,z:39},0);
        await path([[51,35.5],[51,38.5],[45,38.5],[45,46]],sprint);
        await stage(`${mode}-drop`,{x:45,y:2,z:38},0);
        await path([[49,46],[49,41],[54.9,41],[54.9,39.5]],sprint);
        await stage(`${mode}-window`,{x:60,y:1.65,z:39.5},0);
        await path([[54.9,41],[49,41],[49,46],[41,46]],sprint);
      } else {
        // East swaps the staggered trench baffles in Z as well as X.
        const trenchPath=async points=>path(points.map(([x,z])=>[x,east?152-z:z]),sprint);
        await stage(`${mode}-trench-entry`,{x:50,y:-1.3,z:76},0);
        await trenchPath([[43,76]]);await stage(`${mode}-trench-ramp`,{x:51,y:-1.3,z:76});
        await trenchPath([[51,76],[57,77.6],[63,77.6],[71,76],[75,76]]);
        await stage(`${mode}-trench-underpass`,{x:84,y:-1.3,z:76},-3);await fire();
        await trenchPath([[79,76],[87,74.4],[94,74.4],[102,76],[114,76]]);
        await stage(`${mode}-trench-exit`,{x:100,y:-1.3,z:76},0);
        await travel({x:75,z:71},sprint,true);await travel({x:75,z:76},sprint);
        await stage(`${mode}-bridge-slab`,{x:55,y:-1,z:76},0);
        await travel({x:75,z:71},sprint);await travel({x:36,z:76},sprint,true);
      }
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
