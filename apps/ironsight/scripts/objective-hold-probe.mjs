import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

/** Walk beside a real flag guard for twenty seconds. Only W and look inputs;
 * positions, health, bot brains, room clocks and capture gauges stay untouched. */
export async function objectiveHoldProbe({send,evaluate,waitFor,delay,capture}) {
  const bundle=await build({stdin:{contents:`
    import { ARENA2 } from './src/map/arena2.js';
    import { GroundNavigator } from './src/map/navigation.js';
    import { CoreCollision } from './src/core-gate.js';
    import { nearestBox } from './src/physics.js';
    const maps=new CoreCollision(ARENA2),nav=new GroundNavigator(ARENA2);
    export const caps=Object.values(ARENA2.caps);
    export const next=(p,to)=>nav.next(p,to);
    export function visible(a,b,open) {
      const d=Math.hypot(b.x-a.x,b.z-a.z);if(d<.01)return true;
      return nearestBox({x:a.x,y:a.y+1.65,z:a.z},{x:(b.x-a.x)/d,y:0,z:(b.z-a.z)/d},maps.hits(open),d)>=d;
    }`,resolveDir:fileURLToPath(new URL('..',import.meta.url))},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
  const {caps,next,visible}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  const key=type=>send('Input.dispatchKeyEvent',{type,key:'w',code:'KeyW',windowsVirtualKeyCode:87});
  const snapshot=()=>evaluate(`(()=>{const I=window.ironsight,s=I.state();return {me:s.players[I.myId],players:s.players,open:s.coreOpen,phase:s.phase,capA:s.capA,capB:s.capB,capC:s.capC};})()`);
  await waitFor('window.ironsight.state().phase === "live"');
  const began=Date.now(),samples=[];let captureAt,frame=0,follow;
  try {
    while(Date.now()-began<90000) {
      const s=await snapshot();
      const home=caps[s.me.team===0?0:2];
      const allies=Object.entries(s.players).filter(([id,p])=>id.startsWith('bot-')&&p.alive&&p.team===s.me.team);
      // Stay with the home court. Chasing a new distant holder after the first
      // one dies turns a guard review into an unrelated trip across the map.
      const holders=allies.filter(([,p])=>Math.hypot(home.x-p.x,home.z-p.z)<4);
      let ally=holders.find(([id])=>id===follow);
      if(!ally)ally=holders.sort(([,a],[,b])=>Math.hypot(a.x-s.me.x,a.z-s.me.z)-Math.hypot(b.x-s.me.x,b.z-s.me.z))[0];
      follow=ally?.[0];
      const p=ally?.[1],distance=p?Math.hypot(p.x-s.me.x,p.z-s.me.z):Infinity;
      const seen=!!p&&s.me.alive&&distance>=2&&distance<12&&visible(s.me,p,s.open);
      const clearCamera=allies.every(([,a])=>Math.hypot(a.x-s.me.x,a.z-s.me.z)>1.5);
      if(seen&&clearCamera&&captureAt===undefined)captureAt=Date.now();
      if(s.me.alive) {
        const goal=p??home;
        // Get close by normal collision navigation; then watch the living actor.
        const target=distance>3.5?next(s.me,goal):goal;
        const atHome=Math.hypot(home.x-s.me.x,home.z-s.me.z)<4;
        const look=seen?p:!p&&atHome?{x:s.me.team===0?147:3,z:49}:target;
        await evaluate(`window.ironsight.look(${Math.atan2(look.x-s.me.x,look.z-s.me.z)},0)`);
        const travel=p?distance:Math.hypot(home.x-s.me.x,home.z-s.me.z);
        await key(travel>3.5?'keyDown':'keyUp');
      } else {follow=undefined;await key('keyUp');}
      samples.push({atMs:Date.now()-began,recording:captureAt!==undefined,follow,seen,distance:Number.isFinite(distance)?distance:null,...s});
      if(captureAt!==undefined) {
        const elapsed=Date.now()-captureAt;
        if(elapsed>=frame*5000){await key('keyUp');await capture(`hold-${frame*5}s`);frame++;}
        if(elapsed>=20000)break;
      }
      await delay(100);
    }
    const observed=samples.filter(s=>s.recording&&s.seen);
    if(captureAt===undefined||Date.now()-captureAt<20000||observed.length<10)
      throw Error(`No sustained flag-guard view: ${observed.length} visible samples`);
    return {elapsedMs:Date.now()-began,captureMs:Date.now()-captureAt,visibleSamples:observed.length,
      samples,note:'Natural twelve-seat DOM; ordinary W/look follows an allied flag holder. No game-state or clock writes. Sight checks are horizontal standing-eye approximations, not proof of pixel visibility or human excitement.'};
  } finally {await key('keyUp');}
}
