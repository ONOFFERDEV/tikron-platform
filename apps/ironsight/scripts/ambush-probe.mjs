import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

/** Ordinary training movement and mouse fire; no state/HP/deadline/medal writes. */
export async function ambushProbe({send,evaluate,waitFor,delay,capture}) {
  const bundle=await build({stdin:{contents:`import {ARENA1} from './src/map/arena1.js';
    import {GroundNavigator} from './src/map/navigation.js';const nav=new GroundNavigator(ARENA1);
    export const next=(from,to)=>nav.next(from,to);`,resolveDir:fileURLToPath(new URL('..',import.meta.url))},
    bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
  const {next}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  const key=(type,code='KeyW',key='w',windowsVirtualKeyCode=87)=>send('Input.dispatchKeyEvent',{type,code,key,windowsVirtualKeyCode});
  const mouse=(type,button)=>send('Input.dispatchMouseEvent',{type,x:960,y:540,button,clickCount:1});
  const snapshot=()=>evaluate(`(()=>{const I=window.ironsight,s=I.state();return {me:s.players[I.myId],target:s.players['bot-idle'],
    notice:document.querySelector('#elimination').textContent,opacity:document.querySelector('#elimination').style.opacity};})()`);
  const start=Date.now(),path=[];
  await evaluate(`(()=>{const run=window.__ambushRun={events:[]},socket=window.__inspectionSockets.at(-1);
    const listener=e=>{if(typeof e.data!=='string')return;const f=JSON.parse(e.data);
      if(f.t==='s:msg'&&['shot','kill'].includes(f.type))run.events.push({at:performance.now(),type:f.type,payload:f.payload});};
    socket.addEventListener('message',listener);run.cleanup=()=>socket.removeEventListener('message',listener);})()`);
  try {
    const arrival=await snapshot();await capture('ambush-arrival');
    await key('keyDown');
    const goal={x:13,z:39};
    for(;;) {
      const s=await snapshot();path.push({atMs:Date.now()-start,x:s.me.x,z:s.me.z});
      if(Math.hypot(s.me.x-goal.x,s.me.z-goal.z)<.4)break;
      if(Date.now()-start>30000)throw Error(`Ambush approach stalled ${JSON.stringify(s)}`);
      const to=next(s.me,goal);await evaluate(`window.ironsight.look(${Math.atan2(to.x-s.me.x,to.z-s.me.z)},0)`);await delay(70);
    }
    await key('keyUp');await delay(200);
    await key('keyDown','Digit4','4',52);await key('keyUp','Digit4','4',52);await delay(650);
    await mouse('mousePressed','right');await delay(500);
    await evaluate(`(()=>{const I=window.ironsight,p=I.state().players['bot-idle'],eye=I.camPos();
      I.look(Math.atan2(p.x-eye.x,p.z-eye.z),Math.atan2(p.y+1.6-eye.y,Math.hypot(p.x-eye.x,p.z-eye.z)));})()`);
    await delay(200);const behind=await snapshot();await capture('ambush-behind');
    await mouse('mousePressed','left');await delay(100);await mouse('mouseReleased','left');
    await waitFor('document.querySelector("#elimination .ambush")?.textContent === "AMBUSH"');
    await mouse('mouseReleased','right');
    const earned=await snapshot();await capture('ambush-confirmed');
    await delay(2000);const cleared=await snapshot();
    if(cleared.opacity!=='0'||cleared.notice!=='')throw Error('Ambush did not expire');
    await capture('ambush-cleared');
    await delay(Math.max(0,20000-(Date.now()-start)));
    const events=await evaluate('window.__ambushRun.events');
    const kill=events.find(e=>e.type==='kill'&&e.payload.medal==='ambush');
    if(!kill||kill.payload.victim!=='bot-idle'||earned.me.k!==arrival.me.k+1||behind.me.x<12.5||behind.target.hp!==100)
      throw Error(`No authoritative ambush ${JSON.stringify({arrival,behind,earned,events})}`);
    return {elapsedMs:Date.now()-start,arrival,behind,earned,cleared,path,events,
      note:'Actual training-room W movement around a stationary target, normal sniper swap/ADS and mouse headshot. This proves earned medal flow, not combat-bot awareness; paired production-brain fixtures and natural TDM rounds cover perception. No injected gameplay state, reward or effect.'};
  } finally {
    await key('keyUp');await mouse('mouseReleased','left');await mouse('mouseReleased','right');
    await evaluate('window.__ambushRun.cleanup()');
  }
}
