import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

/** Live Worker traversal: ordinary movement, sprint, look and fire only. */
export async function switchyardPlacesProbe({ send, evaluate, delay, capture, record, east = false, rail = false, site = false }) {
  const bundle = await build({ stdin: { contents: `
    import { ARENA3 } from './src/map/arena3.js';
    import { GroundNavigator } from './src/map/navigation.js';
    import { RECONCILE_SOFT_M } from './client/config.js';
    import { routeFloor } from './src/map/terrain.js';
    const nav = new GroundNavigator(ARENA3);
    export const next = (from,to) => nav.next(from,to);
    export const soft = RECONCILE_SOFT_M;
    export const floor = (p) => routeFloor(ARENA3,p.x,p.z);
  `, resolveDir: fileURLToPath(new URL('..', import.meta.url)) }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
  const { next, soft, floor } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  const key = (type, sprint = false) => send('Input.dispatchKeyEvent', {
    type, key: sprint ? 'Shift' : 'w', code: sprint ? 'ShiftLeft' : 'KeyW', windowsVirtualKeyCode: sprint ? 16 : 87,
  });
  const snapshot = () => evaluate(`(() => { const I=window.ironsight; return {
    me:I.state().players[I.myId],camera:I.camPos(),movement:I.movementInfo()}; })()`);
  const report = { east, rail, site, softThresholdM: soft, stages: [], samples: [], landings: [],
    note: `${rail ? 'Walk/sprint down and up both rail end ramps, past cabinet/pallet cover, under bridges, along thin retaining walls and across the central yard slab.' : 'Walk/sprint both doors, internal stair up/down, thin walls, roof slab and south drop.'} Matched acknowledged commands use the Training-only review adapter. No state, clock, health or position injection.` };
  const started = Date.now(), point = p => east ? { ...p, x: 150 - p.x } : p;
  const travel = async (goal, sprint = false, ground = false) => {
    goal = point(goal); const deadline = Date.now() + 60000;
    try {
      for (;;) {
        const sample = await snapshot(), p = sample.movement.pos;
        report.samples.push({ atMs: Date.now() - started, ...sample });
        if (Math.hypot(p.x - goal.x, p.z - goal.z) < .25) break;
        if (!sample.me.alive || Date.now() > deadline) throw Error(`Switchyard room route stalled: ${JSON.stringify({ p, goal })}`);
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
    if (rail && label.endsWith('-stair')) expectedY = floor(settled.me);
    if (expectedY !== undefined && Math.abs(settled.me.y - expectedY) > .025)
      throw Error(`${label}: authoritative height ${settled.me.y}, expected ${expectedY}`);
    report.stages.push({ label, atMs: Date.now() - started, ...settled });
    await capture(label); await record(report);
  };
  let firstTick = -1;
  try {
    await travel(rail ? { x: 32, z: 72 } : { x: 40, z: 66 }, false, true);
    firstTick = await evaluate('window.ironsight.movementReview().at(-1)?.tick ?? -1');
    for (const sprint of [false, true]) {
      const mode = sprint ? 'sprint' : 'walk';
      if (rail) {
        await stage(`${mode}-rail-entry`, {x:52,y:-1.3,z:72}, 0);
        await travel({x:38,z:72},sprint);
        await stage(`${mode}-rail-stair`, {x:50,y:-1.3,z:72});
        await travel({x:43,z:72},sprint);
        await stage(`${mode}-rail-lower`, {x:49,y:-1.3,z:74}, -3);
        for (const [x,z] of [[48,74],[54,74],[58,72],[68,72],[70,69],[78,69],[75,72]]) await travel({x,z},sprint);
        await stage(`${mode}-rail-underpass`, {x:88,y:-1.3,z:74.6}, -3);
        await send('Input.dispatchMouseEvent',{type:'mousePressed',x:960,y:540,button:'left',clickCount:1});
        await delay(250);
        await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:960,y:540,button:'left',clickCount:1});
        for (const [x,z] of [[82,72],[92,74],[102,74],[107,72],[112,72],[118,72]]) await travel({x,z},sprint);
        await stage(`${mode}-rail-exit`, {x:100,y:-1.3,z:72}, 0);
        await travel({x:118,z:66},sprint); await travel({x:75,z:66},sprint);
        await travel({x:75,z:72},sprint);
        await stage(`${mode}-rail-bridge`, {x:55,y:-1,z:72}, 0);
        await travel({x:75,z:77.5},sprint); await travel({x:75,z:66},sprint);
        await travel({x:32,z:66},sprint); await travel({x:32,z:72},sprint);
        continue;
      }
      await stage(`${mode}-entry`, { x: 39, y: 1.7, z: 59 }, 0);
      await travel({ x: 40, z: 63 }, sprint); await travel({ x: 40, z: 61 }, sprint);
      await stage(`${mode}-interior`, { x: 48, y: 1.2, z: 59.7 }, 0);
      await travel({ x: 39, z: 61 }, sprint); await travel({ x: 39, z: 59.5 }, sprint);
      await travel({ x: 43, z: 59.5 }, sprint);
      await stage(`${mode}-stair`, { x: 47, y: 4, z: 59.5 });
      await travel({ x: 47, z: 59.5 }, sprint); await travel({ x: 47, z: 61.5 }, sprint);
      await stage(`${mode}-roof`, { x: 75, y: 4, z: 50 }, 3);
      await travel({ x: 47, z: 59.5 }, sprint); await travel({ x: 39, z: 59.5 }, sprint);
      await stage(`${mode}-downstairs`, { x: 36.5, y: 1.1, z: 59.7 }, 0);
      await travel({ x: 47, z: 59.5 }, sprint); await travel({ x: 47, z: 61.5 }, sprint);
      await travel({ x: 42, z: 61.5 }, sprint); await travel({ x: 42, z: 66 }, sprint);
      await delay(500); await stage(`${mode}-drop`, { x: 42, y: 2, z: 60 }, 0);
      await travel({ x: 44, z: 66 }, sprint); await travel({ x: 44, z: 63 }, sprint);
      await travel({ x: 48.9, z: 63 }, sprint); await travel({ x: 48.9, z: 61.5 }, sprint);
      await stage(`${mode}-window`, { x: 60, y: 1.65, z: 61.5 }, 0);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 960, y: 540, button: 'left', clickCount: 1 });
      await delay(300);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 960, y: 540, button: 'left', clickCount: 1 });
      await travel({ x: 48.9, z: 63 }, sprint); await travel({ x: 44, z: 63 }, sprint);
      await travel({ x: 44, z: 66 }, sprint); await travel({ x: 40, z: 66 }, sprint);
      if (site) {
        await travel({x:57,z:97},sprint,true);
        await stage(`${mode}-depot`,{x:45,y:7,z:109},0);
        await travel({x:6,z:49},sprint,true);
        await stage(`${mode}-service-court`,{x:-12,y:7,z:49},0);
        // Parallel to the outer plinth: its visible mass stays beyond the
        // server rectangle and cannot snag a player walking along the edge.
        await travel({x:.65,z:49},sprint); await travel({x:.65,z:55},sprint);
        await stage(`${mode}-boundary`,{x:-12,y:6,z:58},0);
        await travel({x:6,z:55},sprint); await travel({x:40,z:66},sprint,true);
      }
    }
    report.corrections = await evaluate(`window.ironsight.movementReview().filter(s => s.tick > ${firstTick})`);
    const matched = report.corrections.filter(s => !s.reset && s.matchedError !== null);
    report.maxMatchedErrorM = Math.max(0, ...matched.map(s => s.matchedError));
    report.maxRawLagM = Math.max(0, ...report.corrections.map(s => s.rawError));
    report.elapsedMs = Date.now() - started;
    if (matched.length < 100 || report.maxMatchedErrorM >= soft)
      throw Error(`Movement acceptance: ${matched.length} matched samples, max ${report.maxMatchedErrorM}m, limit ${soft}m`);
    if (report.corrections.some(s => s.reset)) throw Error('Movement reset during room circuit');
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
