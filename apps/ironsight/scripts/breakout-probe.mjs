import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

/** Twenty seconds in normal DOM, following the new deployment dogleg with W.
 * Reads state for navigation/evidence; never writes HP, position, bots or clocks. */
export async function breakoutProbe({ send, evaluate, waitFor, delay, capture, orders = false }) {
  const bundle = await build({ stdin: { contents: `
    import { ARENA2 } from './src/map/arena2.js';
    import { GroundNavigator } from './src/map/navigation.js';
    const nav = new GroundNavigator(ARENA2);
    export const caps = ARENA2.caps;
    export const next = (from,to) => nav.next(from,to);`,
    resolveDir: fileURLToPath(new URL('..', import.meta.url)) },
    bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
  const { next, caps } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  const key = type => send('Input.dispatchKeyEvent', { type, code: 'KeyW', key: 'w', windowsVirtualKeyCode: 87 });
  const snapshot = () => evaluate(`(() => { const I=window.ironsight,s=I.state();
    return {me:s.players[I.myId],players:s.players,phase:s.phase,open:s.coreOpen}; })()`);
  await waitFor('window.ironsight.state().phase === "live"');
  await delay(500);
  const start = await snapshot(), east = start.me.team === 1;
  const goals = [{x:5,z:26},{x:13,z:27},{x:13,z:25},{x:27,z:16}]
    .map(p => ({x:east?150-p.x:p.x,z:p.z}));
  const started = Date.now(), samples = [], reached = [];
  let stage = 0, shot = 0, priorAlive = true;
  try {
    while (Date.now()-started < 20000) {
      const s = await snapshot();
      samples.push({ atMs:Date.now()-started,stage,...s });
      if (s.me.alive && !priorAlive) stage = 0;
      priorAlive = s.me.alive;
      if (s.me.alive) {
        const goal = goals[Math.min(stage,goals.length-1)];
        if (Math.hypot(s.me.x-goal.x,s.me.z-goal.z)<.55 && stage<goals.length) {
          await key('keyUp');
          await evaluate(`window.ironsight.look(${east?-1:1}*Math.PI/2,0)`);
          await capture(`breakout-stage-${stage}`);
          reached.push({stage,atMs:Date.now()-started,me:s.me}); stage++;
        } else if (stage<goals.length) {
          const target = next(s.me,goal);
          await evaluate(`window.ironsight.look(${Math.atan2(target.x-s.me.x,target.z-s.me.z)},0)`);
          await key('keyDown');
        } else await key('keyUp');
      } else await key('keyUp');
      if (Date.now()-started>=shot*5000) { await key('keyUp'); await capture(`breakout-${shot*5}s`); shot++; }
      await delay(70);
    }
    await key('keyUp'); await capture('breakout-20s');
    if (!reached.some(r=>r.stage===2)) throw Error('Natural round did not reach the screened exit and inside peek');
    let squad;
    if (orders) {
      const start=Date.now(),observations=[];let frame=0,follow;
      while(Date.now()-start<20000) {
        const s=await snapshot(),allies=Object.entries(s.players).filter(([id,p])=>id.startsWith('bot-')&&p.alive&&p.team===s.me.team);
        // Walk with an actual teammate; after a natural death, resume from the
        // real spawn instead of leaving the capture staring at its back wall.
        if(s.me.alive) {
          let ally=allies.find(([id])=>id===follow);
          if(!ally)ally=[...allies].sort(([,a],[,b])=>Math.hypot(a.x-s.me.x,a.z-s.me.z)-Math.hypot(b.x-s.me.x,b.z-s.me.z))[0];
          follow=ally?.[0];
          if(ally) {
            const p=ally[1],distance=Math.hypot(p.x-s.me.x,p.z-s.me.z),target=distance>2.5?next(s.me,p):p;
            await evaluate(`window.ironsight.look(${Math.atan2(target.x-s.me.x,target.z-s.me.z)},0)`);
            await key(distance>2.5?'keyDown':'keyUp');
          } else await key('keyUp');
        } else {follow=undefined;await key('keyUp');}
        const occupied=Object.entries(caps).filter(([,c])=>allies.some(([,p])=>Math.hypot(p.x-c.x,p.z-c.z)<16)).map(([k])=>k);
        const separation=Math.max(0,...allies.flatMap(([,a])=>allies.map(([,b])=>Math.hypot(a.x-b.x,a.z-b.z))));
        observations.push({atMs:Date.now()-start,occupied,separation,...s});
        if(Date.now()-start>=frame*5000){await key('keyUp');await capture(`squad-${frame*5}s`);frame++;}
        await delay(100);
      }
      await key('keyUp');await capture('squad-20s');
      const spread=observations.some(s=>s.occupied.length>=2&&s.separation>40);
      if(!spread)throw Error('No simultaneous allied presence at two objectives in the natural squad capture');
      squad={elapsedMs:Date.now()-start,spread,observations};
    }
    return {elapsedMs:Date.now()-started,reached,samples,squad,
      note:'Normal Undertow DOM matchmaking and 20s W/aim steering through the north deployment dogleg. Twelve seats with ordinary bots. No firing, state writes, clock shortcuts or forced deaths. Screenshots are visual evidence, not performance samples or human playtesting.'};
  } finally { await key('keyUp'); }
}
