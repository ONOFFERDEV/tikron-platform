import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

/** Live Worker traversal: ordinary movement, sprint, look and fire only. */
export async function undertowPlacesProbe({ send, evaluate, delay, capture, record, east = false, channel = false, site = false }) {
  const bundle = await build({ stdin: { contents: `
    import { ARENA2 } from './src/map/arena2.js';
    import { GroundNavigator } from './src/map/navigation.js';
    import { RECONCILE_SOFT_M } from './client/config.js';
    import { routeFloor } from './src/map/terrain.js';
    const nav = new GroundNavigator(ARENA2);
    export const next = (from,to) => nav.next(from,to);
    export const soft = RECONCILE_SOFT_M;
    export const floor = (p) => routeFloor(ARENA2,p.x,p.z);
  `, resolveDir: fileURLToPath(new URL('..', import.meta.url)) }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
  const { next, soft, floor } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  const key = (type, sprint = false) => send('Input.dispatchKeyEvent', {
    type, key: sprint ? 'Shift' : 'w', code: sprint ? 'ShiftLeft' : 'KeyW', windowsVirtualKeyCode: sprint ? 16 : 87,
  });
  const snapshot = () => evaluate(`(() => { const I=window.ironsight; return {
    me:I.state().players[I.myId],camera:I.camPos(),movement:I.movementInfo()}; })()`);
  const report = { east, channel, site, softThresholdM: soft, stages: [], samples: [], landings: [],
    note: `${channel ? 'Walk then sprint down both channel stairs, past pump baffles, under three bridges and across the central yard slab.' : 'Walk then sprint through both doors, up/down the internal ramp, along thin walls, onto the roof slab and off the south drop.'} Matched errors compare the same acknowledged command; raw lag is separate. No state/time/health/position injection.` };
  const started = Date.now(), point = p => east ? { ...p, x: 150 - p.x } : p;
  const travel = async (goal, sprint = false, ground = false) => {
    goal = point(goal); const deadline = Date.now() + 60000;
    try {
      for (;;) {
        const sample = await snapshot(), p = sample.movement.pos;
        report.samples.push({ atMs: Date.now() - started, ...sample });
        if (Math.hypot(p.x - goal.x, p.z - goal.z) < .25) break;
        if (!sample.me.alive || Date.now() > deadline) throw Error(`Plant route stalled: ${JSON.stringify({ p, goal })}`);
        const target = ground ? next(p, goal) : goal;
        await evaluate(`window.ironsight.look(${Math.atan2(target.x - p.x, target.z - p.z)},0)`);
        if (sprint) await key('keyDown', true);
        await key('keyDown');
        await delay(Math.min(60, Math.max(12, Math.hypot(target.x - p.x, target.z - p.z) * (sprint ? 70 : 100))));
        await key('keyUp'); if (sprint) await key('keyUp', true); await delay(10);
      }
    } finally { await key('keyUp'); await key('keyUp', true); }
    await delay(200);
  };
  const stage = async (label, target, expectedY) => {
    target = point(target); const p = (await snapshot()).me;
    await evaluate(`window.ironsight.look(${Math.atan2(target.x - p.x, target.z - p.z)},${Math.atan2(target.y - (p.y + 1.65), Math.hypot(target.x - p.x, target.z - p.z))})`);
    await delay(200); let settled = await snapshot();
    if (label.endsWith('-drop')) {
      // A release/landing is asynchronous. Verify the actual replicated
      // landing instead of assuming it arrived within the old fixed sleep.
      // Keep the same .025m height and .15m matched-command assertions.
      const waitingAt = Date.now(), deadline = waitingAt + 2500;
      while (Math.abs(settled.me.y) > .025 || !settled.movement.grounded) {
        report.samples.push({ atMs: Date.now() - started, landingWait: true, ...settled });
        if (!settled.me.alive || Date.now() >= deadline) throw Error(`${label}: landing did not settle within 2500ms`);
        await delay(50); settled = await snapshot();
      }
      report.landings.push({ label, waitMs: Date.now() - waitingAt, authoritativeY: settled.me.y });
    }
    if (channel && label.endsWith('-stair')) expectedY = floor(settled.me);
    if (expectedY !== undefined && Math.abs(settled.me.y - expectedY) > .025)
      throw Error(`${label}: authoritative height ${settled.me.y}, expected ${expectedY}`);
    report.stages.push({ label, atMs: Date.now() - started, ...settled });
    await capture(label); await record(report);
  };
  let firstTick = -1;
  try {
    await travel(channel ? {x:32,z:71} : { x: 37, z: 66 }, false, true);
    firstTick = await evaluate('window.ironsight.movementReview().at(-1)?.tick ?? -1');
    for (const sprint of [false, true]) {
      const mode = sprint ? 'sprint' : 'walk';
      if (channel) {
        await stage(`${mode}-channel-entry`, {x:52,y:-1.3,z:71}, 0);
        await travel({x:38,z:71},sprint);
        await stage(`${mode}-channel-stair`, {x:52,y:-1.3,z:71});
        await travel({x:43,z:71},sprint);
        await stage(`${mode}-channel-lower`, {x:53,y:-1.3,z:72.5}, -3);
        for (const [x,z] of [[54,72.5],[60,72.5],[66,70],[75,71]]) await travel({x,z},sprint);
        await stage(`${mode}-channel-underpass`, {x:85,y:-1.3,z:71}, -3);
        await send('Input.dispatchMouseEvent',{type:'mousePressed',x:960,y:540,button:'left',clickCount:1});
        await delay(250);
        await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:960,y:540,button:'left',clickCount:1});
        for (const [x,z] of [[84,70],[90,72.5],[96,72.5],[107,71],[112,71],[118,71]]) await travel({x,z},sprint);
        await stage(`${mode}-channel-exit`, {x:102,y:-1.3,z:71}, 0);
        await travel({x:118,z:66},sprint); await travel({x:75,z:66},sprint);
        await travel({x:75,z:71},sprint);
        await stage(`${mode}-channel-bridge`, {x:55,y:-1,z:71}, 0);
        await travel({x:75,z:75.5},sprint); await travel({x:75,z:66},sprint);
        await travel({x:32,z:66},sprint); await travel({x:32,z:71},sprint);
        continue;
      }
      await stage(`${mode}-entry`, { x: 37, y: 1.7, z: 59 }, 0);
      await travel({ x: 37, z: 63 }, sprint); await travel({ x: 37, z: 61 }, sprint);
      await stage(`${mode}-interior`, { x: 49, y: 1.2, z: 59.7 }, 0);
      await travel({ x: 38, z: 61 }, sprint); await travel({ x: 38, z: 59.5 }, sprint);
      await travel({ x: 42, z: 59.5 }, sprint);
      await stage(`${mode}-stair`, { x: 47, y: 4, z: 59.5 });
      await travel({ x: 47, z: 59.5 }, sprint); await travel({ x: 47, z: 61.5 }, sprint);
      await stage(`${mode}-roof`, { x: 75, y: 4, z: 50 }, 3);
      await travel({ x: 47, z: 59.5 }, sprint); await travel({ x: 38, z: 59.5 }, sprint);
      await stage(`${mode}-downstairs`, { x: 33, y: 1.1, z: 59.7 }, 0);
      await travel({ x: 47, z: 59.5 }, sprint); await travel({ x: 47, z: 61.5 }, sprint);
      await travel({ x: 41, z: 61.5 }, sprint); await travel({ x: 41, z: 66 }, sprint);
      await delay(500); await stage(`${mode}-drop`, { x: 41, y: 2, z: 60 }, 0);
      await travel({ x: 45, z: 66 }, sprint); await travel({ x: 45, z: 63 }, sprint);
      await travel({ x: 50.9, z: 63 }, sprint); await travel({ x: 50.9, z: 61.5 }, sprint);
      await stage(`${mode}-window`, { x: 60, y: 1.65, z: 61.5 }, 0);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 960, y: 540, button: 'left', clickCount: 1 });
      await delay(300);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 960, y: 540, button: 'left', clickCount: 1 });
      await travel({ x: 50.9, z: 63 }, sprint); await travel({ x: 45, z: 63 }, sprint);
      await travel({ x: 45, z: 66 }, sprint); await travel({ x: 37, z: 66 }, sprint);
    }
    if (site) {
      await travel({ x: 93, z: 99 }, true, true);
      await stage('site-canal-lookout', { x: 110, y: 1.1, z: 118 }, 0);
    }
    report.corrections = await evaluate(`window.ironsight.movementReview().filter(s => s.tick > ${firstTick})`);
    const matched = report.corrections.filter(s => !s.reset && s.matchedError !== null);
    report.maxMatchedErrorM = Math.max(0, ...matched.map(s => s.matchedError));
    report.maxRawLagM = Math.max(0, ...report.corrections.map(s => s.rawError));
    report.elapsedMs = Date.now() - started;
    if (matched.length < 100 || report.maxMatchedErrorM >= soft)
      throw Error(`Movement acceptance: ${matched.length} matched samples, max ${report.maxMatchedErrorM}m, limit ${soft}m`);
    report.passed = true; await record(report); return report;
  } catch (error) {
    report.failure = String(error); report.elapsedMs = Date.now() - started;
    report.corrections = await evaluate(`window.ironsight.movementReview().filter(s => s.tick > ${firstTick})`);
    const matched = report.corrections.filter(s => !s.reset && s.matchedError !== null);
    report.maxMatchedErrorM = Math.max(0, ...matched.map(s => s.matchedError));
    report.maxRawLagM = Math.max(0, ...report.corrections.map(s => s.rawError));
    await record(report); throw error;
  }
  finally {
    await key('keyUp'); await key('keyUp', true);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 960, y: 540, button: 'left', clickCount: 1 });
  }
}
