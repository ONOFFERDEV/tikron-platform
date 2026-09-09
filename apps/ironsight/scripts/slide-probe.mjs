import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

/** Ordinary movement into the real Relay rifle corridor; no game-state writes. */
export async function slideProbe({ send, evaluate, delay, capture, click, waitFor }) {
  const bundled = await build({ stdin: { contents: `
    import { ARENA1 } from './src/map/arena1.js';
    import { GroundNavigator } from './src/map/navigation.js';
    const nav = new GroundNavigator(ARENA1);
    export const next = (from, to) => nav.next(from, to);`,
    resolveDir: fileURLToPath(new URL('..', import.meta.url)) },
    bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
  const { next } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
  const key = (type, key, code, windowsVirtualKeyCode) => send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode });
  const forward = type => key(type, 'w', 'KeyW', 87);
  const sprint = type => key(type, 'Shift', 'ShiftLeft', 16);
  const crouch = type => key(type, 'c', 'KeyC', 67);
  const snapshot = () => evaluate(`(() => {const I=window.ironsight;return { me:I.state().players[I.myId], movement:I.movementInfo(), camera:I.camPos(), fov:I.viewmodelInfo().fov };})()`);
  try {
    await forward('keyDown');
    const goal = { x: 55, z: 27 }, started = Date.now();
    for (;;) {
      const { me } = await snapshot();
      if (Math.hypot(me.x - goal.x, me.z - goal.z) < .45) break;
      if (Date.now() - started > 45000) throw Error(`Slide staging route stalled: ${JSON.stringify(me)}`);
      const target = next(me, goal);
      if (!target) throw Error('No collision-valid slide staging route');
      await evaluate(`window.ironsight.look(${Math.atan2(target.x - me.x, target.z - me.z)},0)`);
      await delay(70);
    }
    await forward('keyUp'); await delay(200);
    await evaluate(`window.ironsight.look(Math.PI/2,-.035)`); await delay(180);
    await capture('slide-before');
    await evaluate(`(() => {
      const I=window.ironsight, run=window.__slideRun={start:performance.now(),samples:[],events:[]};
      const socket=window.__inspectionSockets.at(-1);
      const listener=e=>{if(typeof e.data!=='string')return;const f=JSON.parse(e.data);
        if(f.t==='s:msg' && f.type==='slide' && f.payload.id===I.myId)run.events.push({t:performance.now()-run.start,...f.payload});};
      socket.addEventListener('message',listener);run.cleanup=()=>socket.removeEventListener('message',listener);
      const sample=()=>{if(run.done)return; const p=I.state().players[I.myId];
        run.samples.push({t:performance.now()-run.start,x:p.x,z:p.z,crouch:p.crouch,...I.movementInfo(),fov:I.viewmodelInfo().fov});requestAnimationFrame(sample);};sample();
    })()`);
    await sprint('keyDown'); await forward('keyDown'); await delay(420);
    await capture('slide-sprint');
    await crouch('keyDown'); await delay(220); await capture('slide-after');
    const during = await snapshot();
    await delay(700); await forward('keyUp'); await sprint('keyUp');
    await delay(180); const ended = await snapshot(); await capture('slide-settled');
    await crouch('keyUp'); await delay(250);
    const run = await evaluate('window.__slideRun.done=true;window.__slideRun.cleanup();({samples:window.__slideRun.samples,events:window.__slideRun.events})');
    if (!during.movement.sliding || !during.me.crouch || during.fov < 83 || ended.movement.sliding ||
        run.events.filter(e=>e.active).length !== 1 || run.events.filter(e=>!e.active).length !== 1)
      throw Error(`Slide confirmation failed: ${JSON.stringify({during,ended,events:run.events})}`);
    // Same key remains a normal crouch without run-up.
    await crouch('keyDown'); await delay(160); const ordinary = await snapshot();
    if (!ordinary.me.crouch || ordinary.movement.sliding) throw Error('Idle crouch incorrectly launched a slide');
    await crouch('keyUp');
    const cancellations = [];
    for (const [index, action] of ['release', 'ads', 'jump', 'pause'].entries()) {
      await delay(1400);
      await evaluate(`window.ironsight.look(${index % 2 ? Math.PI / 2 : Math.PI * 1.5},0)`);
      await sprint('keyDown'); await forward('keyDown'); await delay(400);
      await crouch('keyDown'); await delay(150);
      if (!(await snapshot()).movement.sliding) throw Error(`No slide before ${action}`);
      if (action === 'release') await crouch('keyUp');
      if (action === 'ads') await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 960, y: 540, button: 'right', clickCount: 1 });
      if (action === 'jump') await key('keyDown', ' ', 'Space', 32);
      if (action === 'pause') await evaluate('document.exitPointerLock()');
      await delay(180);
      const stopped = await snapshot();
      if (stopped.movement.sliding || (action === 'jump' && stopped.movement.grounded)) throw Error(`${action} did not cancel momentum`);
      cancellations.push({ action, ...stopped });
      await forward('keyUp'); await sprint('keyUp'); await crouch('keyUp');
      await key('keyUp', ' ', 'Space', 32);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 960, y: 540, button: 'right', clickCount: 1 });
    }
    await click('#quitConfirm button:nth-child(2)');
    await click('input[data-setting="reduced-motion"]');
    await key('keyDown', 'Escape', 'Escape', 27); await key('keyUp', 'Escape', 'Escape', 27);
    await click('#quitConfirm button'); await waitFor('!!document.pointerLockElement');
    await delay(1400); await evaluate('window.ironsight.look(Math.PI*1.5,0)');
    await sprint('keyDown'); await forward('keyDown'); await delay(400);
    await crouch('keyDown'); await delay(220); const reduced = await snapshot(); await capture('slide-reduced');
    if (!reduced.movement.sliding || Math.abs(reduced.fov - 78) > .01) throw Error('Reduced motion changed slide gameplay or retained FOV kick');
    await forward('keyUp'); await sprint('keyUp'); await crouch('keyUp');
    return { during, ended, ordinary, cancellations, reduced, ...run, note: 'Real key intents, collision-routed staging, server slide events and state; no teleport, room isolation, HP/bot edits or synthetic game events.' };
  } finally { await forward('keyUp'); await sprint('keyUp'); await crouch('keyUp'); }
}
