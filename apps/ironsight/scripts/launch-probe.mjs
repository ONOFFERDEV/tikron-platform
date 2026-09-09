import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

/** Normal training matchmaking, collision-routed W, then the actual jump key.
 * No teleports, fabricated events, room isolation, HP edits or bot changes. */
export async function launchProbe({send,evaluate,delay,capture,click,waitFor}) {
  const bundle=await build({stdin:{contents:`import { ARENA3 } from './src/map/arena3.js';
    import { GroundNavigator } from './src/map/navigation.js';
    const nav=new GroundNavigator(ARENA3);export const next=(from,to)=>nav.next(from,to);`,
    resolveDir:fileURLToPath(new URL('..',import.meta.url))},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
  const {next}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  const key=(type,key,code,windowsVirtualKeyCode)=>send('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode});
  const forward=type=>key(type,'w','KeyW',87),jump=type=>key(type,' ','Space',32);
  const snapshot=()=>evaluate(`(()=>{const I=window.ironsight;return{me:I.state().players[I.myId],movement:I.movementInfo(),camera:I.camPos(),view:I.viewmodelInfo()};})()`);
  const walk=async goal=>{
    const start=Date.now();await forward('keyDown');
    for(;;){
      const {me}=await snapshot();if(Math.hypot(me.x-goal.x,me.z-goal.z)<.3 && me.y<.1)break;
      if(Date.now()-start>60000)throw Error(`Launch staging stalled: ${JSON.stringify({me,goal})}`);
      const target=next(me,goal);await evaluate(`window.ironsight.look(${Math.atan2(target.x-me.x,target.z-me.z)},0)`);await delay(50);
    }
    await forward('keyUp');await delay(700);
  };
  try{
    await walk({x:60,z:55});await evaluate('window.ironsight.look(Math.PI/2,.12)');await delay(500);
    const before=await snapshot();await capture('launch-before');
    await evaluate(`(()=>{const I=window.ironsight,run=window.__launchRun={start:performance.now(),samples:[],events:[]};
      const socket=window.__inspectionSockets.at(-1);const listener=e=>{if(typeof e.data!=='string')return;const f=JSON.parse(e.data);
      if(f.t==='s:msg'&&f.type==='traversal'&&f.payload.id===I.myId)run.events.push({t:performance.now()-run.start,...f.payload});};
      socket.addEventListener('message',listener);run.cleanup=()=>socket.removeEventListener('message',listener);
      const sample=()=>{if(run.done)return;const p=I.state().players[I.myId];run.samples.push({t:performance.now()-run.start,x:p.x,y:p.y,z:p.z,...I.movementInfo()});requestAnimationFrame(sample);};sample();})()`);
    await forward('keyDown');await jump('keyDown');await jump('keyUp');await delay(500);
    const flight=await snapshot();await forward('keyUp');await capture('launch-flight');
    await delay(850);const after=await snapshot();await capture('launch-after');
    const run=await evaluate('window.__launchRun.done=true;window.__launchRun.cleanup();({samples:window.__launchRun.samples,events:window.__launchRun.events})');
    if(run.events.length!==1 || run.events[0].kind!=='launch' || !flight.movement.launching || flight.me.y<4 ||
      after.movement.traversing || Math.hypot(after.me.x-70,after.me.z-55)>.08 || after.me.y!==3)
      throw Error(`Launch failed: ${JSON.stringify({before,flight,after,events:run.events})}`);
    // Leave the actual deck over its west edge before ground-nav staging.
    await evaluate('window.ironsight.look(-Math.PI/2,0)');await forward('keyDown');await delay(2050);await forward('keyUp');await delay(700);
    await walk({x:60,z:55});
    await evaluate('document.exitPointerLock()');await delay(180);await click('#quitConfirm button:nth-child(2)');
    await click('input[data-setting="reduced-motion"]');
    await key('keyDown','Escape','Escape',27);await key('keyUp','Escape','Escape',27);
    await click('#quitConfirm button');await waitFor('!!document.pointerLockElement');
    await evaluate('window.ironsight.look(Math.PI/2,.12)');await delay(500);
    await forward('keyDown');await jump('keyDown');await jump('keyUp');await delay(500);
    const reduced=await snapshot();await forward('keyUp');await capture('launch-reduced');await delay(850);
    if(!reduced.movement.launching || reduced.me.y<4 || Math.abs(reduced.view.fov-78)>.01)throw Error('Reduced-motion launch failed');
    return {before,flight,after,reduced,...run,note:'Normal W/Space intents to actual Switchyard pad; room event and authoritative height/landing. Reduced motion via real Settings UI.'};
  }finally{await forward('keyUp');await jump('keyUp');}
}
