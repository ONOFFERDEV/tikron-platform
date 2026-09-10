import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

/** Real Worker traversal via ordinary W/aim/fire intents. */
export async function structuresProbe({ send, evaluate, delay, capture, record }) {
  const bundle = await build({ stdin: { contents: `
    import { ARENA1 } from './src/map/arena1.js';
    import { GroundNavigator } from './src/map/navigation.js';
    const nav = new GroundNavigator(ARENA1);
    export const next = (from, to) => nav.next(from, to);
  `, resolveDir: fileURLToPath(new URL('..', import.meta.url)) },
    bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
  const { next } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  const key = type => send('Input.dispatchKeyEvent', { type, key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87 });
  const snapshot = () => evaluate(`(() => { const I=window.ironsight; return {
    me:I.state().players[I.myId],camera:I.camPos(),movement:I.movementInfo()}; })()`);
  const report = { note: 'Normal Relay training room. Collision-routed approach, then authored W/aim waypoints through both doors, up the stair, across the roof and down the south drop. No position, HP, bot, clock or event injection.', samples: [], stages: [] };
  let started = Date.now();
  const travel = async (goal, ground = false) => {
    const deadline = Date.now() + 45000;
    try {
      for (;;) {
        const sample = await snapshot(), me = sample.me;
        report.samples.push({ atMs: Date.now() - started, ...sample });
        if (Math.hypot(me.x - goal.x, me.z - goal.z) < .24) break;
        if (!me.alive || Date.now() > deadline) throw Error(`Structure route stalled: ${JSON.stringify({ me, goal })}`);
        const target = ground ? next(me, goal) : goal;
        await evaluate(`window.ironsight.look(${Math.atan2(target.x - me.x, target.z - me.z)},0)`);
        await key('keyDown'); await delay(30);
      }
    } finally { await key('keyUp'); }
    await delay(180);
  };
  const stage = async (label, yaw, pitch = 0) => {
    await key('keyUp'); await evaluate(`window.ironsight.look(${yaw},${pitch})`); await delay(150);
    const sample = await snapshot(); report.stages.push({ label, atMs: Date.now() - started, ...sample });
    await capture(`places-${label}`); await record(report);
    return sample;
  };
  try {
    await travel({ x: 32, z: 38 }, true);
    report.approachMs = Date.now() - started; report.samples = []; started = Date.now();
    await stage('entry', Math.PI / 2);
    await travel({ x: 36, z: 38 });
    const inside = await stage('interior', Math.PI / 2, -.04);
    if (inside.me.y !== 0) throw Error('Ground-floor entry failed');
    await travel({ x: 42, z: 38 }); await travel({ x: 42, z: 35.5 });
    await travel({ x: 46, z: 35.5 }); await stage('stair', Math.PI / 2, -.1);
    await travel({ x: 51, z: 35.5 }); await travel({ x: 51, z: 38.5 });
    const roof = await stage('roof', Math.atan2(75 - 51, 50 - 38.5));
    if (Math.abs(roof.me.y - 3) > .02 || Math.abs(roof.camera.y - 4.65) > .2) throw Error('Roof landing/camera failed');
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 960, y: 540, button: 'left', clickCount: 1 });
    await delay(500);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 960, y: 540, button: 'left', clickCount: 1 });
    await travel({ x: 45, z: 38.5 }); await travel({ x: 45, z: 43 }); await delay(600);
    const dropped = await stage('drop', Math.PI, -.1);
    if (dropped.me.y !== 0) throw Error('South roof drop failed');
    await travel({ x: 58, z: 38 }, true); await travel({ x: 53, z: 38 });
    const reverse = await stage('east-entry', -Math.PI / 2);
    if (reverse.me.y !== 0) throw Error('East doorway entry failed');
    if (Date.now() - started < 20000) await delay(20000 - (Date.now() - started));
    report.elapsedMs = Date.now() - started;
    await stage('complete', -Math.PI / 2); await record(report);
    return report;
  } finally {
    await key('keyUp');
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 960, y: 540, button: 'left', clickCount: 1 });
  }
}
