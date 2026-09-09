import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

/** Twenty seconds in normal DOM, following the new deployment dogleg with W.
 * Reads state for navigation/evidence; never writes HP, position, bots or clocks. */
export async function breakoutProbe({ send, evaluate, waitFor, delay, capture }) {
  const bundle = await build({ stdin: { contents: `
    import { ARENA2 } from './src/map/arena2.js';
    import { GroundNavigator } from './src/map/navigation.js';
    const nav = new GroundNavigator(ARENA2);
    export const next = (from,to) => nav.next(from,to);`,
    resolveDir: fileURLToPath(new URL('..', import.meta.url)) },
    bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
  const { next } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
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
    return {elapsedMs:Date.now()-started,reached,samples,
      note:'Normal Undertow DOM matchmaking and 20s W/aim steering through the north deployment dogleg. Twelve seats with ordinary bots. No firing, state writes, clock shortcuts or forced deaths. Screenshots are visual evidence, not performance samples or human playtesting.'};
  } finally { await key('keyUp'); }
}
