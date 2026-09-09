import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

/** Accompany a normal B assault using only W/Shift/look. Never changes game state,
 * bot orders, health, clock, loadouts or collision. Preserve deaths in capture. */
export async function objectiveApproachProbe({send,evaluate,waitFor,delay,capture,record}) {
  const bundle=await build({stdin:{contents:`
    import { ARENA2 } from './src/map/arena2.js';
    import { GroundNavigator } from './src/map/navigation.js';
    import { CoreCollision } from './src/core-gate.js';
    import { nearestBox } from './src/physics.js';
    const collision=new CoreCollision(ARENA2),nav=new GroundNavigator(ARENA2);
    export const routes=ARENA2.capApproaches.b,cap=ARENA2.caps.b;
    export const next=(p,to)=>nav.next(p,to);
    export function visible(a,b,open) {
      const dx=b.x-a.x,dz=b.z-a.z,dy=b.y-a.y,d=Math.hypot(dx,dy,dz);
      return d<.01||nearestBox({x:a.x,y:a.y+1.65,z:a.z},{x:dx/d,y:dy/d,z:dz/d},collision.hits(open),d)>=d;
    }`,resolveDir:fileURLToPath(new URL('..',import.meta.url))},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
  const {routes,cap,next,visible}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  const key=type=>send('Input.dispatchKeyEvent',{type,key:'w',code:'KeyW',windowsVirtualKeyCode:87});
  const sprint=type=>send('Input.dispatchKeyEvent',{type,key:'Shift',code:'ShiftLeft',windowsVirtualKeyCode:16});
  const snapshot=()=>evaluate(`(()=>{const I=window.ironsight,s=I.state();return {me:s.players[I.myId],players:s.players,open:s.coreOpen,phase:s.phase,capB:s.capB};})()`);
  await waitFor('window.ironsight.state().phase === "live"');
  const began=Date.now(),samples=[];let captureAt,frame=0,stage=0,follow,wasAlive=true;
  try {
    while(Date.now()-began<100000) {
      const s=await snapshot(),route=routes[s.me.team===0?0:1];
      if(!wasAlive&&s.me.alive)stage=0;
      wasAlive=s.me.alive;
      while(route[stage]&&Math.hypot(route[stage].x-s.me.x,route[stage].z-s.me.z)<.8)stage++;
      const allies=Object.entries(s.players).filter(([id,p])=>id.startsWith('bot-')&&p.alive&&p.team===s.me.team);
      const candidates=allies.filter(([,p])=>p.z>=78&&p.z<=98&&p.x>=20&&p.x<=130);
      let ally=candidates.find(([id])=>id===follow);
      if(!ally)ally=candidates.sort(([,a],[,b])=>Math.hypot(a.x-s.me.x,a.z-s.me.z)-Math.hypot(b.x-s.me.x,b.z-s.me.z))[0];
      follow=ally?.[0];const p=ally?.[1],distance=p?Math.hypot(p.x-s.me.x,p.z-s.me.z):Infinity;
      const seen=!!p&&s.me.alive&&distance>=2&&distance<14&&visible(s.me,p,s.open);
      const clearCamera=allies.every(([,p])=>Math.hypot(p.x-s.me.x,p.z-s.me.z)>1.5);
      if(seen&&clearCamera&&s.me.z>=79&&captureAt===undefined)captureAt=Date.now();
      if(s.me.alive) {
        const goal=route[stage]??cap,target=next(s.me,goal),atCourt=Math.hypot(cap.x-s.me.x,cap.z-s.me.z)<3;
        const looking=seen&&distance<7||atCourt;
        const look=looking?(seen?p:{x:s.me.team===0?81:69,z:87}):target;
        await evaluate(`window.ironsight.look(${Math.atan2(look.x-s.me.x,look.z-s.me.z)},0)`);
        await key(looking?'keyUp':'keyDown');
        await sprint(!looking&&distance>10?'keyDown':'keyUp');
      } else {await key('keyUp');await sprint('keyUp');follow=undefined;}
      samples.push({atMs:Date.now()-began,recording:captureAt!==undefined,follow,seen,stage,distance:Number.isFinite(distance)?distance:null,...s});
      if(captureAt!==undefined) {
        const elapsed=Date.now()-captureAt;
        if(elapsed>=frame*5000){await key('keyUp');await capture(`approach-${frame*5}s`);frame++;}
        if(elapsed>=20000)break;
      }
      await delay(100);
    }
    const observed=samples.filter(s=>s.recording&&s.seen);
    const result={elapsedMs:Date.now()-began,captureMs:captureAt===undefined?0:Date.now()-captureAt,
      visibleSamples:observed.length,samples,note:'Natural twelve-seat DOM. W/Shift/look follows the authored Pump service route and watches nearby allies. No health, position, bot or clock writes. Eye-segment visibility is not a pixel/human verdict.'};
    await record(result);
    if(result.captureMs<20000||observed.length<10)throw Error(`No sustained B approach view: ${observed.length} visible samples`);
    return result;
  } finally {await key('keyUp');await sprint('keyUp');}
}
