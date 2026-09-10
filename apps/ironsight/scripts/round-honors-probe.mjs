import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

/** Full ordinary DOM round. Only normal movement/look input; no result, clock,
 * health, position or bot injection. Separate from the unchanged hitch gate. */
export async function roundHonorsProbe({ send, evaluate, waitFor, delay, capture, record }) {
  if (!await evaluate('window.ironsight.state().mode === 2')) throw Error('Honors DOM probe requires the real arena-dom room');
  const bundle = await build({stdin:{contents:`
    import { ARENA2 } from './src/map/arena2.js';
    import { GroundNavigator } from './src/map/navigation.js';
    const nav = new GroundNavigator(ARENA2);
    export const goals = [ARENA2.caps.a, ARENA2.caps.b, ARENA2.caps.c];
    export const next = (from,to) => nav.next(from,to);
  `,resolveDir:fileURLToPath(new URL('..',import.meta.url))},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
  const route = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  await evaluate(`window.__honorsEvents=[];for(const socket of window.__inspectionSockets)socket.addEventListener('message',event=>{
    if(typeof event.data!=='string')return;try{const m=JSON.parse(event.data);
    if(m.t==='s:msg'&&m.type==='matchEnd')window.__honorsEvents.push(m.payload);}catch{}});`);
  const key = (down) => send('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',key:'w',code:'KeyW',windowsVirtualKeyCode:87});
  const start=Date.now(),samples=[];
  let goal=0, moving=false, lastGoalAt=Date.now();
  try {
    while(Date.now()-start<340000) {
      const sample=await evaluate(`(()=>{const s=window.ironsight.state(),me=s.players[window.ironsight.myId];
        return {phase:s.phase,red:s.redScore,blue:s.blueScore,me:{...me},locked:!!document.pointerLockElement,
          intro:window.ironsight.introInfo().active};})()`);
      samples.push({atMs:Date.now()-start,...sample});
      if(sample.phase==='ended')break;
      let walk=false;
      if(sample.phase==='live'&&sample.me.alive&&sample.locked&&!sample.intro) {
        const target=route.goals[goal];
        if(Date.now()-lastGoalAt>35000){goal=(goal+1)%route.goals.length;lastGoalAt=Date.now();}
        if(Math.hypot(sample.me.x-target.x,sample.me.z-target.z)>2.5) {
          const next=route.next(sample.me,target),yaw=Math.atan2(next.x-sample.me.x,next.z-sample.me.z);
          await evaluate(`window.ironsight.look(${yaw},0)`);walk=true;
        }
      }
      if(walk!==moving){await key(walk);moving=walk;}
      await delay(250);
    }
    await key(false);
    await waitFor(`!!document.querySelector('.roundHonors')`,5000);
    const evidence=await evaluate(`(()=>{const s=window.ironsight.state(),e=window.__honorsEvents.at(-1),card=document.querySelector('.roundHonors');
      return {event:e,players:s.players,cardId:card.dataset.mvp,text:card.textContent,
        heading:document.querySelector('#overlay h1').textContent,phase:s.phase};})()`);
    const mvp=evidence.event?.mvp;
    if(!mvp || evidence.cardId!==mvp.id || !evidence.players[mvp.id] ||
      evidence.players[mvp.id].team!==(evidence.event.winner==='red'?0:1) ||
      mvp.kills!==evidence.players[mvp.id].k || mvp.score!==mvp.kills*2+mvp.assists+mvp.captureSeconds)
      throw Error(`Invalid live honors: ${JSON.stringify(evidence)}`);
    const wowStart=Date.now(),stills=[];
    for(const seconds of [0,5,10,15,20]) {
      await delay(Math.max(0,wowStart+seconds*1000-Date.now()));
      await capture(`honors-${seconds}s`);
      stills.push({atMs:Date.now()-wowStart,phase:await evaluate('window.ironsight.state().phase')});
    }
    const result={elapsedMs:Date.now()-start,samples,evidence,stills,
      note:'Natural full-length DOM room, normal W/look only. End screen then automatic warmup; no vote, gameplay-state injection or clock override. Not a hitch acceptance probe.'};
    await record(result);
    return result;
  } finally { await key(false); }
}
