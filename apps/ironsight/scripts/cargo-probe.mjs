import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';

/** Real Switchyard epoch and ordinary movement through the freight crossing. */
export async function cargoProbe({send,evaluate,delay,capture,waitFor,record=async()=>{}}) {
  const bundle=await build({stdin:{contents:`import {ARENA3} from './src/map/arena3.js';
    import {CoreCollision} from './src/core-gate.js';import {GroundNavigator} from './src/map/navigation.js';
    const closed=new GroundNavigator(ARENA3),open=new GroundNavigator({...ARENA3,boxes:new CoreCollision(ARENA3).open});
    export const next=(from,to,down)=>(down?open:closed).next(from,to);export {SIGNAL} from './src/signal-event.js';`,resolveDir:fileURLToPath(new URL('..',import.meta.url))},
    bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
  const {next,SIGNAL}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  const key=type=>send('Input.dispatchKeyEvent',{type,code:'KeyW',key:'w',windowsVirtualKeyCode:87});
  const snapshot=()=>evaluate(`(()=>{const I=window.ironsight,s=I.state(),hud=document.querySelector('#signalEvent');return {
    epoch:s.signalAt,phase:s.phase,coreOpen:s.coreOpen,me:s.players[I.myId],event:I.signalInfo(),
    radar:document.querySelector('#tacticalMap canvas').dataset.signal,hud:hud.textContent,visible:!hud.hidden,render:I.renderInfo()};})()`);
  const walk=async goal=>{
    const deadline=Date.now()+65000;
    try {
      for(;;) {
        const s=await snapshot();if(Math.hypot(s.me.x-goal.x,s.me.z-goal.z)<.35)break;
        if(Date.now()>deadline)throw Error(`Freight walk stalled: ${JSON.stringify(s)}`);
        const to=next(s.me,goal,s.coreOpen);await evaluate(`window.ironsight.look(${Math.atan2(to.x-s.me.x,to.z-s.me.z)},0)`);
        await key('keyDown');await delay(60);
      }
    }finally{await key('keyUp');}await delay(180);
  };
  const look=()=>evaluate('window.ironsight.look(Math.PI/2,.055)');
  try {
    await walk({x:121,z:50});await look();
    // Wait for a normal warning if the first one passed during staging.
    const warningDeadline=Date.now()+100000;
    while(Date.now()<warningDeadline) {
      const s=await snapshot();
      if(s.event.phase==='warning'&&s.epoch>0&&(s.event.serverNow-s.epoch)%SIGNAL.periodMs<500)break;
      await delay(100);
    }
    const staged=await snapshot();if(staged.event.phase!=='warning')throw Error('No natural cargo warning');
    await capture('cargo-cover');
    // The same forward input must be blocked before the counterweight drops.
    await key('keyDown');await delay(800);await key('keyUp');await delay(180);
    const blocked=await snapshot();await walk({x:121,z:50});await look();
    const start=Date.now(),samples=[];let shot=0,entered=false;
    while(Date.now()-start<20000) {
      const sample=await snapshot();sample.atMs=Date.now()-start;samples.push(sample);
      if(sample.coreOpen&&!entered){await capture('cargo-open');await walk({x:126,z:50});await look();entered=true;await capture('cargo-crossing');}
      if(sample.atMs>=shot*5000){await capture(`cargo-${shot*5}s`);shot++;}
      await delay(100);
    }
    await capture('cargo-20s');const elapsedMs=Date.now()-start;
    await waitFor('document.querySelector("#signalEvent").dataset.phase === "recovery"');
    await delay(100);const recovery=await snapshot();await capture('cargo-held');
    const layouts=[];
    for(const [width,height] of [[800,600],[390,844]]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await delay(120);
      const layout=await evaluate(`(()=>{const n=document.querySelector('#signalEvent'),r=n.getBoundingClientRect();return {
        width:innerWidth,height:innerHeight,text:n.textContent,visible:!n.hidden,inside:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&n.scrollWidth<=n.clientWidth};})()`);
      layouts.push(layout);await capture(`cargo-${width}x${height}`);
    }
    await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
    await walk({x:131,z:50});await waitFor('!window.ironsight.state().coreOpen');
    await evaluate('window.ironsight.look(-Math.PI/2,.055)');
    const after=await snapshot();await capture('cargo-restored');
    // Let the transient motor drain before evaluating mute/audio behavior.
    await delay(3500);
    const audio=await evaluate('window.__cargoAudio'),muted=await evaluate('localStorage.getItem("iron_muted")==="1"');
    const reducedMotion=await evaluate('JSON.parse(localStorage.getItem("ironsight.settings.v1")||"{}").reducedMotion===true');
    const checks={blocked:blocked.me.x<124&&!blocked.coreOpen,entered,
      lifted:samples.some(s=>s.event.lift===8),carried:samples.some(s=>Math.abs(s.event.berth)<5),
      radar:samples.every(s=>s.radar==='online'),epoch:samples.every(s=>s.epoch===staged.epoch)&&after.epoch===staged.epoch,
      visibleCollision:samples.every(s=>s.event.playableRoute&&s.event.core.open===s.coreOpen&&s.event.core.coverHeight===(s.coreOpen?0:3)),
      held:recovery.coreOpen&&recovery.hud.includes('CLEAR TO RAISE')&&Math.abs(recovery.me.x-126)<.5,
      restored:!after.coreOpen&&after.event.core.weightY===0&&after.me.x>129.5&&after.me.hp===staged.me.hp,
      layouts:layouts.every(l=>l.visible&&l.inside),audio:muted?audio.length===0:audio.length>=1&&audio.every(a=>a.ended)};
    const report={elapsedMs,staged,blocked,samples,recovery,after,layouts,audio,muted,reducedMotion,checks,
      note:'Real private Switchyard training, W/aim and natural schedule. Closed cover blocks forward input; cross the down lock, occupy it through recovery, leave and observe safe full-cover restoration. No state, clock, health or effect injection.'};
    await record(report);
    if(Object.values(checks).some(ok=>!ok))throw Error(`Cargo Shift failed: ${JSON.stringify({checks,after,layouts})}`);
    return report;
  } finally {await key('keyUp');}
}
