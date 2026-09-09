import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

/** Real Undertow training epoch, ordinary input staging, no state/clock writes. */
export async function floodProbe({send,evaluate,delay,capture,waitFor}) {
  const bundle=await build({stdin:{contents:`import {ARENA2} from './src/map/arena2.js';
    import {GroundNavigator} from './src/map/navigation.js';const nav=new GroundNavigator(ARENA2);
    export const next=(from,to)=>nav.next(from,to);`,resolveDir:fileURLToPath(new URL('..',import.meta.url))},
    bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
  const {next}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  const key=type=>send('Input.dispatchKeyEvent',{type,code:'KeyW',key:'w',windowsVirtualKeyCode:87});
  const snapshot=()=>evaluate(`(()=>{const I=window.ironsight,s=I.state(),hud=document.querySelector('#signalEvent');return {
    epoch:s.signalAt,phase:s.phase,me:s.players[I.myId],event:I.signalInfo(),radar:document.querySelector('#tacticalMap canvas').dataset.signal,
    hud:hud.textContent,visible:!hud.hidden,render:I.renderInfo()};})()`);
  try {
    const goal={x:75,z:19},deadline=Date.now()+60000;
    while(Date.now()<deadline) {
      const {me}=await snapshot();if(Math.hypot(me.x-goal.x,me.z-goal.z)<.6)break;
      const to=next(me,goal);await evaluate(`window.ironsight.look(${Math.atan2(to.x-me.x,to.z-me.z)},0)`);
      await key('keyDown');await delay(Math.min(80,Math.max(16,Math.hypot(to.x-me.x,to.z-me.z)/6*1000)));
    }
    await key('keyUp');const staged=await snapshot();
    if(Math.hypot(staged.me.x-goal.x,staged.me.z-goal.z)>1)throw Error('Flood staging did not reach the north viewing lane');
    await evaluate(`window.ironsight.look(${Math.atan2(75-staged.me.x,-7-staged.me.z)},${Math.atan2(13-1.65,Math.hypot(75-staged.me.x,-7-staged.me.z))})`);
    await waitFor('document.querySelector("#signalEvent").dataset.phase === "warning"');
    const start=Date.now(),samples=[];let shot=0;
    while(Date.now()-start<20000) {
      const sample=await snapshot();sample.atMs=Date.now()-start;samples.push(sample);
      if(sample.atMs>=shot*5000){await capture(`flood-${shot*5}s`);shot++;}
      await delay(100);
    }
    await capture('flood-20s');const elapsedMs=Date.now()-start;
    await waitFor('document.querySelector("#signalEvent").dataset.phase === "recovery"');
    const recovery=await snapshot();await capture('flood-recovery');
    const layouts=[];
    for(const [width,height] of [[800,600],[390,844]]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await delay(120);
      const layout=await evaluate(`(()=>{const n=document.querySelector('#signalEvent'),r=n.getBoundingClientRect();return {
        width:innerWidth,height:innerHeight,text:n.textContent,inside:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight};})()`);
      layouts.push(layout);await capture(`flood-${width}x${height}`);
    }
    await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
    await waitFor('document.querySelector("#signalEvent").dataset.phase === "idle"');
    const after=await snapshot();await capture('flood-standby');
    const audio=await evaluate('window.__floodAudio'),muted=await evaluate('localStorage.getItem("iron_muted")==="1"');
    if(!samples.some(s=>s.event.lift===10&&s.event.streams===24)||samples.some(s=>s.radar!=='online'||s.epoch!==staged.epoch)||
      after.event.streams!==0||after.event.foam!==0||after.event.lift!==0||layouts.some(l=>!l.inside))
      throw Error(`Pressure Drop failed: ${JSON.stringify({after,layouts})}`);
    if(muted?audio.length!==0:audio.length!==1||audio.some(a=>!a.ended))throw Error('Discharge loop mute/drain failed');
    return {elapsedMs,staged,samples,recovery,after,layouts,audio,muted,
      note:'Real private Undertow training, W/aim staging and natural 8s warning/15s discharge. No game-state, clock, health or VFX injection. Exterior spectacle only; route payoff reserved for arc2/2.'};
  } finally {await key('keyUp');}
}
