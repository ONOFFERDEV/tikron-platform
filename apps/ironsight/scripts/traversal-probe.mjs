import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

/** Walk to actual Undertow cover, then use only bound player keys. */
export async function traversalProbe({ send, evaluate, delay, capture, click, waitFor }) {
  const bundle=await build({stdin:{contents:`import { ARENA2 } from './src/map/arena2.js';
    import { GroundNavigator } from './src/map/navigation.js';
    const nav=new GroundNavigator(ARENA2);export const next=(from,to)=>nav.next(from,to);`,
    resolveDir:fileURLToPath(new URL('..',import.meta.url))},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
  const {next}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  const key=(type,key,code,windowsVirtualKeyCode)=>send('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode});
  const forward=type=>key(type,'w','KeyW',87), jump=type=>key(type,' ','Space',32);
  const snapshot=()=>evaluate(`(()=>{const I=window.ironsight;return{me:I.state().players[I.myId],movement:I.movementInfo(),camera:I.camPos(),view:I.viewmodelInfo()};})()`);
  try {
    const goal={x:22,z:43.2},start=Date.now();
    await forward('keyDown');
    for(;;){
      const {me}=await snapshot();
      if(Math.hypot(me.x-goal.x,me.z-goal.z)<.3)break;
      if(Date.now()-start>60000)throw Error(`Traversal route stalled: ${JSON.stringify(me)}`);
      const target=next(me,goal);
      await evaluate(`window.ironsight.look(${Math.atan2(target.x-me.x,target.z-me.z)},0)`);await delay(50);
    }
    await forward('keyUp');await delay(700);await evaluate('window.ironsight.look(0,-.1)');
    await waitFor('Math.abs(window.ironsight.state().players[window.ironsight.myId].yaw)<.01');await delay(300);
    const before=await snapshot();await capture('vault-before');
    await evaluate(`(()=>{const I=window.ironsight,run=window.__vaultRun={start:performance.now(),samples:[],events:[]};
      const socket=window.__inspectionSockets.at(-1);const listener=e=>{if(typeof e.data!=='string')return;const f=JSON.parse(e.data);
      if(f.t==='s:msg'&&f.type==='traversal'&&f.payload.id===I.myId)run.events.push({t:performance.now()-run.start,...f.payload});};
      socket.addEventListener('message',listener);run.cleanup=()=>socket.removeEventListener('message',listener);
      const sample=()=>{if(run.done)return;const p=I.state().players[I.myId];run.samples.push({t:performance.now()-run.start,x:p.x,y:p.y,z:p.z,...I.movementInfo()});requestAnimationFrame(sample);};sample();})()`);
    await forward('keyDown');await jump('keyDown');await jump('keyUp');
    await delay(250);const rise=await snapshot();await forward('keyUp');
    await capture('vault-rise');
    await delay(600);const after=await snapshot();await capture('vault-after');
    const run=await evaluate('window.__vaultRun.done=true;window.__vaultRun.cleanup();({samples:window.__vaultRun.samples,events:window.__vaultRun.events})');
    if(run.events.length!==1 || run.events[0].kind!=='vault' || !rise.movement.traversing ||
      after.movement.traversing || Math.abs(after.me.z-46.48)>.08 || after.me.y!==0 || Math.abs(after.me.x-run.events[0].x)>.03)
      throw Error(`Vault failed: ${JSON.stringify({before,rise,after,events:run.events})}`);
    // Reduced motion through the real Settings UI; cross the same lip backwards.
    await evaluate('document.exitPointerLock()');await delay(180);await click('#quitConfirm button:nth-child(2)');
    await click('input[data-setting="reduced-motion"]');
    await key('keyDown','Escape','Escape',27);await key('keyUp','Escape','Escape',27);
    await click('#quitConfirm button');await waitFor('!!document.pointerLockElement');
    await evaluate('window.ironsight.look(Math.PI,-.1)');await delay(500);
    await forward('keyDown');await jump('keyDown');await jump('keyUp');await delay(350);
    const reduced=await snapshot();await forward('keyUp');await capture('vault-reduced');await delay(500);
    if(!reduced.movement.traversing || Math.abs(reduced.view.fov-78)>.01)throw Error('Reduced-motion traversal failed');
    return {before,rise,after,reduced,...run,note:'Collision-routed W staging, ordinary jump intents, authoritative traversal event/state. No teleport, bot/HP edits, isolated room or fabricated event.'};
  }finally{await forward('keyUp');await jump('keyUp');}
}
