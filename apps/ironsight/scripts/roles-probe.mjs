import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

/** Twenty seconds of ordinary W navigation in a normal live TDM. Read replicated
 * bots and incoming shots; never place them or write health, clocks or loadouts. */
export async function rolesProbe({send,evaluate,waitFor,delay,capture,flanks=false,contacts=false}) {
  const bundle=await build({stdin:{contents:`import {ARENA1} from './src/map/arena1.js';
    import {GroundNavigator} from './src/map/navigation.js';const nav=new GroundNavigator(ARENA1);
    export const next=(from,to)=>nav.next(from,to);`,resolveDir:fileURLToPath(new URL('..',import.meta.url))},
    bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
  const {next}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  const key=type=>send('Input.dispatchKeyEvent',{type,code:'KeyW',key:'w',windowsVirtualKeyCode:87});
  await waitFor('window.ironsight.state().phase === "live"');
  await delay(500); // deployment has yielded to the actual operator
  const travel = async (me,goal) => {
    const target=next(me,goal),distance=Math.hypot(target.x-me.x,target.z-me.z);
    await evaluate(`window.ironsight.look(${Math.atan2(target.x-me.x,target.z-me.z)},0)`);
    await key('keyDown');
    await delay(Math.min(80,Math.max(16,distance/6*1000)));
  };
  // Approach with ordinary inputs before recording the flank encounter. Small
  // steering steps and key-up during screenshots prevent the driver overshooting
  // one-metre corners while CDP encodes an image. No player-state placement.
  if(flanks) {
    const end=Date.now()+45000;
    while(Date.now()<end) {
      const me=await evaluate('window.ironsight.state().players[window.ironsight.myId]');
      if(me.alive&&Math.hypot(me.x-61,me.z-75)<2)break;
      if(me.alive)await travel(me,{x:61,z:75});else {await key('keyUp');await delay(100);}
    }
    await key('keyUp');
  }
  await evaluate(`(()=>{const run=window.__rolesRun={events:[]},socket=window.__inspectionSockets.at(-1);
    const listener=e=>{if(typeof e.data!=='string')return;const f=JSON.parse(e.data);
      if(f.t==='s:msg'&&['shot','kill','teamPing'].includes(f.type))run.events.push({at:performance.now(),type:f.type,payload:f.payload});};
    socket.addEventListener('message',listener);run.cleanup=()=>socket.removeEventListener('message',listener);})()`);
  const started=Date.now(),samples=[],layouts=[];let shot=0,contactShots=0,lastContact='';
  try {
    await key('keyDown');
    while(Date.now()-started<20000) {
      const sample=await evaluate(`(()=>{const I=window.ironsight,s=I.state(),card=document.querySelector('#teamPingNotice');return {me:s.players[I.myId],players:s.players,phase:s.phase,feed:document.querySelector('#feed').textContent,contact:card?.dataset.contact==='true'&&!card.hidden?card.textContent:null};})()`);
      sample.atMs=Date.now()-started;samples.push(sample);
      if(sample.me.alive) {
        await travel(sample.me,flanks?{x:123,z:75}:{x:65,z:50});
      }
      if(sample.atMs>=shot*5000) {await key('keyUp');await capture(`roles-live-${shot*5}s`);shot++;}
      const caller=sample.contact?.split('\n')[0];
      if(contacts&&caller&&caller!==lastContact&&contactShots<3) {
        await key('keyUp');await capture(`contact-${contactShots++}`);lastContact=caller;
        if(contactShots===1) {
          for(const [width,height] of [[1366,768],[800,600]]) {
            await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await delay(120);
            const layout=await evaluate(`(()=>{const n=document.querySelector('#teamPingNotice'),r=n.getBoundingClientRect();
              const hp=document.querySelector('#hp').getBoundingClientRect();return {width:innerWidth,height:innerHeight,visible:!n.hidden,
                text:n.textContent,inside:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,aboveVitals:r.bottom<=hp.top};})()`);
            layouts.push(layout);await capture(`contact-${width}x${height}`);
            if(!layout.visible||!layout.inside||!layout.aboveVitals)throw Error(`Unreadable contact card: ${JSON.stringify(layout)}`);
          }
          await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
        }
      }
      if(!sample.me.alive) {await key('keyUp');await delay(100);}
    }
    await capture('roles-live-20s');
    const events=await evaluate('window.__rolesRun.events');
    await delay(300);
    const audio=contacts?await evaluate('window.__contactAudio'):undefined;
    const muted=contacts?await evaluate('localStorage.getItem("iron_muted")==="1"'):false;
    if(contacts) {
      const reports=events.filter(e=>e.type==='teamPing'&&e.payload.contact);
      if(!reports.length||!contactShots)throw Error('No natural visual contact callout captured');
      if(muted ? audio.length!==0 : !audio?.length||audio.some(n=>!n.ended))throw Error('Radio cue mute/drain failed');
      for(let i=1;i<reports.length;i++)if(reports[i].at-reports[i-1].at<7800)throw Error('Team radio budget exceeded');
    }
    const weapons=[...new Set(samples.flatMap(s=>Object.entries(s.players).filter(([id])=>/^bot-\d+$/.test(id)).map(([,p])=>p.weapon)))].sort();
    if(![0,1,3].every(w=>weapons.includes(w)))throw Error(`Missing role weapons: ${weapons}`);
    const rushers=samples.flatMap(s=>Object.entries(s.players).filter(([id,p])=>/^bot-\d+$/.test(id)&&p.weapon===1&&p.alive).map(([,p])=>p));
    const lanes={north:rushers.filter(p=>p.z<33).length,south:rushers.filter(p=>p.z>67).length};
    if(flanks&&(!lanes.north||!lanes.south))throw Error(`Rushers did not use both flanks in this live capture: ${JSON.stringify(lanes)}`);
    return {elapsedMs:Date.now()-started,weapons,lanes,samples,events,audio,muted,layouts,contactShots,
      note:`Normal live Relay TDM, human seat following W/aim navigation toward ${flanks?'Freight south lane after an ordinary-input approach':'central approach'} for20s, no firing or game-state injection. Bot positions/loadouts and incoming combat events are read-only. This is not a performance sample or a staged role duel.`};
  } finally {await key('keyUp');await evaluate('window.__rolesRun.cleanup()');}
}
