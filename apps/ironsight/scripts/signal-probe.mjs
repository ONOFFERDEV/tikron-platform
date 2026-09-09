import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

/** Normal Relay training room and W navigation; event time/state is read only. */
export async function signalProbe({send,evaluate,delay,capture,waitFor}) {
  const bundle=await build({stdin:{contents:`import { ARENA1 } from './src/map/arena1.js';
    import { GroundNavigator } from './src/map/navigation.js';
    const nav=new GroundNavigator(ARENA1);export const next=(from,to)=>nav.next(from,to);`,
    resolveDir:fileURLToPath(new URL('..',import.meta.url))},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
  const {next}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  const key=(type,code='KeyW',key='w',windowsVirtualKeyCode=87)=>send('Input.dispatchKeyEvent',{type,code,key,windowsVirtualKeyCode});
  const snapshot=()=>evaluate(`(()=>{const I=window.ironsight,s=I.state();return{me:s.players[I.myId],epoch:s.signalAt,
    event:I.signalInfo(),map:document.querySelector('#tacticalMap canvas').dataset.signal,
    hud:document.querySelector('#signalEvent').innerText,phase:document.querySelector('#signalEvent').dataset.phase,
    render:I.renderInfo()};})()`);
  try {
    const goal={x:75,z:20},start=Date.now();await key('keyDown');
    for(;;){
      const {me}=await snapshot();if(Math.hypot(me.x-goal.x,me.z-goal.z)<.4)break;
      if(Date.now()-start>60000)throw Error(`Signal staging stalled ${JSON.stringify(me)}`);
      const to=next(me,goal);await evaluate(`window.ironsight.look(${Math.atan2(to.x-me.x,to.z-me.z)},0)`);await delay(80);
    }
    await key('keyUp');await delay(400);
    const {me}=await snapshot();await evaluate(`window.ironsight.look(${Math.atan2(75-me.x,-15-me.z)},${Math.atan2(30-1.65,Math.hypot(75-me.x,-15-me.z))})`);
    await waitFor('document.querySelector("#signalEvent").dataset.phase === "warning"');
    const before=await snapshot();await capture('signal-warning');
    await waitFor('document.querySelector("#signalEvent").dataset.phase === "blackout"');
    const began=await snapshot();await delay(800);const pulse=await snapshot();await capture('signal-pulse');
    await delay(3200);const during=await snapshot();await capture('signal-turn');
    await key('keyDown','KeyB','b',66);await key('keyUp','KeyB','b',66);
    await waitFor('!document.querySelector("#teamPingNotice").hidden');
    const callout=await evaluate('document.querySelector("#teamPingNotice").textContent');
    // Responsive HUD evidence during the same authoritative blackout.
    await send('Emulation.setDeviceMetricsOverride',{width:720,height:900,deviceScaleFactor:1,mobile:false});
    await delay(150);await capture('signal-narrow');
    const layout=await evaluate(`(()=>{const r=document.querySelector('#signalEvent').getBoundingClientRect();return {x:r.x,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight};})()`);
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
    await delay(150);await capture('signal-phone');
    const phone=await evaluate(`(()=>{const r=document.querySelector('#signalEvent').getBoundingClientRect();return {x:r.x,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight};})()`);
    await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
    await waitFor('document.querySelector("#signalEvent").dataset.phase === "recovery"');
    const after=await snapshot();await capture('signal-restored');
    if(before.map!=='online'||began.map!=='offline'||during.map!=='offline'||after.map!=='online' ||
      before.epoch!==after.epoch || Math.abs(after.event.yaw-before.event.yaw)<1 || !callout.includes('NEED BACKUP') ||
      layout.x<0||layout.right>layout.width||layout.bottom>layout.height||phone.x<0||phone.right>phone.width||phone.bottom>phone.height)
      throw Error(`Signal event failed: ${JSON.stringify({before,began,during,after,callout,layout})}`);
    return {before,began,pulse,during,after,callout,layout,phone,
      note:'Normal training matchmaking + collision-routed W + B. Actual server epoch, real 8s/15s event; no state/clock writes or fabricated events.'};
  }finally{await key('keyUp');}
}
