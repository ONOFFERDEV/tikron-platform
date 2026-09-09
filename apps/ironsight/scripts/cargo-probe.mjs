import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';

/** Real Switchyard training epoch; ordinary W/aim staging and no state writes. */
export async function cargoProbe({send,evaluate,delay,capture,waitFor,record=async()=>{}}) {
  const bundle=await build({stdin:{contents:`import {ARENA3} from './src/map/arena3.js';
    import {GroundNavigator} from './src/map/navigation.js';const nav=new GroundNavigator(ARENA3);
    export const next=(from,to)=>nav.next(from,to);export {SIGNAL} from './src/signal-event.js';`,resolveDir:fileURLToPath(new URL('..',import.meta.url))},
    bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
  const {next,SIGNAL}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  const key=type=>send('Input.dispatchKeyEvent',{type,code:'KeyW',key:'w',windowsVirtualKeyCode:87});
  const snapshot=()=>evaluate(`(()=>{const I=window.ironsight,s=I.state(),hud=document.querySelector('#signalEvent');return {
    epoch:s.signalAt,phase:s.phase,coreOpen:s.coreOpen,me:s.players[I.myId],event:I.signalInfo(),
    radar:document.querySelector('#tacticalMap canvas').dataset.signal,hud:hud.textContent,visible:!hud.hidden,render:I.renderInfo()};})()`);
  const look=async sample=>evaluate(`window.ironsight.look(${Math.atan2(156-sample.me.x,50+sample.event.berth-sample.me.z)},${Math.atan2(Math.max(12.5,sample.event.bottom+1.5)-1.65,Math.hypot(156-sample.me.x,50+sample.event.berth-sample.me.z))})`);
  try {
    const goal={x:143,z:53},deadline=Date.now()+65000;
    while(Date.now()<deadline) {
      const {me}=await snapshot();if(Math.hypot(me.x-goal.x,me.z-goal.z)<.7)break;
      const to=next(me,goal);await evaluate(`window.ironsight.look(${Math.atan2(to.x-me.x,to.z-me.z)},0)`);
      await key('keyDown');await delay(Math.min(80,Math.max(16,Math.hypot(to.x-me.x,to.z-me.z)/6*1000)));
    }
    await key('keyUp');const staged=await snapshot();
    if(Math.hypot(staged.me.x-goal.x,staged.me.z-goal.z)>1)throw Error('Cargo staging did not reach east service');
    await look(staged);
    // Staging can miss the first warning. Observe the next normal epoch rather
    // than resetting the room clock or asking the server to trigger the event.
    const warningDeadline=Date.now()+100000;
    while(Date.now()<warningDeadline) {
      const s=await snapshot();
      if(s.event.phase==='warning'&&s.epoch>0&&(s.event.serverNow-s.epoch)%SIGNAL.periodMs<500)break;
      await delay(100);
    }
    const warning=await snapshot();if(warning.event.phase!=='warning')throw Error('No natural cargo warning');
    const start=Date.now(),samples=[];let shot=0;
    while(Date.now()-start<20000) {
      const sample=await snapshot();sample.atMs=Date.now()-start;samples.push(sample);
      await look(sample);
      if(sample.atMs>=shot*5000){await capture(`cargo-${shot*5}s`);shot++;}
      await delay(100);
    }
    await capture('cargo-20s');const elapsedMs=Date.now()-start;
    await waitFor('document.querySelector("#signalEvent").dataset.phase === "recovery"');
    await delay(100);const recovery=await snapshot();await look(recovery);await capture('cargo-recovery');
    const layouts=[];
    for(const [width,height] of [[800,600],[390,844]]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await delay(120);
      const layout=await evaluate(`(()=>{const n=document.querySelector('#signalEvent'),r=n.getBoundingClientRect();return {
        width:innerWidth,height:innerHeight,text:n.textContent,visible:!n.hidden,inside:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&n.scrollWidth<=n.clientWidth};})()`);
      layouts.push(layout);await capture(`cargo-${width}x${height}`);
    }
    await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
    await waitFor('document.querySelector("#signalEvent").dataset.phase === "idle"');
    const after=await snapshot();await capture('cargo-standby');
    const audio=await evaluate('window.__cargoAudio'),muted=await evaluate('localStorage.getItem("iron_muted")==="1"');
    const reducedMotion=await evaluate('JSON.parse(localStorage.getItem("ironsight.settings.v1")||"{}").reducedMotion===true');
    const checks={lifted:samples.some(s=>s.event.lift===8),carried:samples.some(s=>Math.abs(s.event.berth)<5),
      radar:samples.every(s=>s.radar==='online'),epoch:samples.every(s=>s.epoch===staged.epoch),
      exterior:samples.every(s=>!s.coreOpen&&!s.event.playableRoute),
      settled:after.event.lift===0&&Math.abs(after.event.berth)===14,layouts:layouts.every(l=>l.visible&&l.inside),
      audio:muted?audio.length===0:audio.length>=1&&audio.every(a=>a.ended)};
    const report={elapsedMs,staged,samples,recovery,after,layouts,audio,muted,reducedMotion,checks,
      note:'Real private Switchyard training, W/aim staging and the natural room schedule. No game-state, clock, health or effect injection. Exterior transfer only; authoritative cover payoff required in Cargo Shift2/2.'};
    await record(report);
    if(Object.values(checks).some(ok=>!ok))throw Error(`Cargo Shift failed: ${JSON.stringify({checks,after,layouts})}`);
    return report;
  } finally {await key('keyUp');}
}
