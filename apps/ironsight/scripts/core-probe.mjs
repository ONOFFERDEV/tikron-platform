import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

/** Real training-room epoch, normal W movement. No state/clock/position writes. */
export async function coreProbe({send,evaluate,delay,capture,waitFor}) {
  const bundle=await build({stdin:{contents:`import { ARENA1 } from './src/map/arena1.js';
    import { CoreCollision } from './src/core-gate.js';import { GroundNavigator } from './src/map/navigation.js';
    const c=new CoreCollision(ARENA1),closed=new GroundNavigator(ARENA1),open=new GroundNavigator({...ARENA1,boxes:c.open});
    export const next=(p,to,on)=>(on?open:closed).next(p,to);`,
    resolveDir:fileURLToPath(new URL('..',import.meta.url))},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
  const {next}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  const key=type=>send('Input.dispatchKeyEvent',{type,code:'KeyW',key:'w',windowsVirtualKeyCode:87});
  const snapshot=()=>evaluate(`(()=>{const I=window.ironsight,s=I.state();return{me:s.players[I.myId],epoch:s.signalAt,
    open:s.coreOpen,event:I.signalInfo(),map:document.querySelector('#tacticalMap canvas').dataset.signal,
    hud:document.querySelector('#signalEvent').innerText};})()`);
  const walk=async goal=>{
    const start=Date.now();await key('keyDown');
    try{for(;;){const s=await snapshot();if(Math.hypot(s.me.x-goal.x,s.me.z-goal.z)<.35)break;
      if(Date.now()-start>45000)throw Error(`Core walk stalled ${JSON.stringify(s)}`);
      const to=next(s.me,goal,s.open);await evaluate(`window.ironsight.look(${Math.atan2(to.x-s.me.x,to.z-s.me.z)},0)`);await delay(70);
    }}finally{await key('keyUp');}await delay(250);
  };
  try{
    await walk({x:67,z:50});await evaluate('window.ironsight.look(Math.PI/2,.08)');
    await waitFor('document.querySelector("#signalEvent").dataset.phase === "warning"');
    const before=await snapshot();await capture('core-warning');
    await waitFor('window.ironsight.state().coreOpen');
    const opened=await snapshot();await capture('core-opened');
    await walk({x:75,z:50});await evaluate('window.ironsight.look(Math.PI/2,.05)');
    const inside=await snapshot();await capture('core-crossing');
    await waitFor('document.querySelector("#signalEvent").dataset.phase === "recovery"');
    const held=await snapshot();await capture('core-held');
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
    await delay(180);await capture('core-phone');
    const layout=await evaluate(`(()=>{const r=document.querySelector('#signalEvent').getBoundingClientRect();return{x:r.x,right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight};})()`);
    await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
    await walk({x:83,z:50});await waitFor('!window.ironsight.state().coreOpen');
    await evaluate('window.ironsight.look(-Math.PI/2,.08)');
    const closed=await snapshot();await capture('core-sealed');
    if(before.open||!opened.open||opened.map!=='offline'||!inside.open||inside.me.x<74||inside.me.x>76||
      !held.open||held.map!=='online'||!held.hud.includes('CLEAR TO SEAL')||closed.open||closed.me.x<82||
      before.epoch!==closed.epoch||closed.me.hp!==before.me.hp||closed.event.core.shutterY!==0||
      layout.x<0||layout.right>layout.width||layout.bottom>layout.height)
      throw Error(`Core route/closure failed: ${JSON.stringify({before,opened,inside,held,closed,layout})}`);
    return{before,opened,inside,held,closed,layout,note:'Ordinary training matchmaking; actual server schedule and collision-routed W. Crossed the passage, held both shutters by standing inside, exited and observed safe closure. No state/clock/position edits.'};
  }finally{await key('keyUp');}
}
