import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
/** Real Training inputs. Observe tracer diagnostics and server shot echoes. */
export async function viewmodelProbe({ send, evaluate, waitFor, delay, capture }) {
  const bundle = await build({ stdin: { contents: `import {ARENA1} from './src/map/arena1.js';
    import {nearestBox} from './src/physics.js';
    export function target(eye) { let best;
      for(let i=0;i<64;i++){ const yaw=i*Math.PI/32, dir={x:Math.sin(yaw),y:0,z:Math.cos(yaw)};
        const distance=nearestBox(eye,dir,ARENA1.boxes,35);
        if(distance>=3 && distance<35 && (!best || distance<best.distance)) best={yaw,distance,
          point:[eye.x+dir.x*distance,eye.y,eye.z+dir.z*distance]}; }
      return best; }
    export function wallHit(eye, end) {
      const delta={x:end[0]-eye.x,y:end[1]-eye.y,z:end[2]-eye.z};
      const length=Math.hypot(delta.x,delta.y,delta.z);
      const dir={x:delta.x/length,y:delta.y/length,z:delta.z/length};
      return { length, distance:nearestBox(eye,dir,ARENA1.boxes,100) };
    }`, resolveDir: fileURLToPath(new URL('..', import.meta.url)) },
    bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
  const { target, wallHit } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  const mouse = (type, button = 'left') => send('Input.dispatchMouseEvent', { type, button, x: 960, y: 540, clickCount: 1 });
  const key = async (key, code, virtual) => {
    for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: virtual });
  };
  const start = Date.now(), rows = [];
  await evaluate(`(() => {
    const run = window.__viewmodelRun = { shots: [] }, socket = window.__inspectionSockets.at(-1);
    const listener = e => { if (typeof e.data !== 'string') return; const f = JSON.parse(e.data);
      if (f.t === 's:msg' && f.type === 'shot' && f.payload.from === window.ironsight.myId) run.shots.push(f.payload); };
    socket.addEventListener('message', listener);
    run.cleanup = () => socket.removeEventListener('message', listener);
  })()`);
  try {
    for (let weapon = 0; weapon < 5; weapon++) {
      await key(String(weapon + 1), `Digit${weapon + 1}`, 49 + weapon);
      await waitFor(`window.ironsight.viewmodelInfo().weapon === ${weapon}`);
      await delay(700);
      for (const ads of [false, true]) {
        const wall = target(await evaluate('window.ironsight.camPos()'));
        if (!wall) throw Error('No nearby solid wall for the firing proof');
        await evaluate(`window.ironsight.look(${wall.yaw}, 0)`);
        if (ads) await mouse('mousePressed', 'right');
        await delay(500);
        const label = `wall-${weapon + 1}-${ads ? 'ads' : 'hip'}`;
        await capture(`${label}-before`);
        const before = await evaluate('window.__viewmodelRun.shots.length');
        console.log(`viewmodel ${label}: firing`);
        await mouse('mousePressed');
        await capture(`${label}-fired`);
        await mouse('mouseReleased');
        await waitFor(`window.__viewmodelRun.shots.length > ${before}`);
        const sample = await evaluate('({ view:window.ironsight.viewmodelInfo(), shot:window.__viewmodelRun.shots.at(-1), eye:window.ironsight.camPos() })');
        if (sample.shot.weapon !== weapon + 1 || sample.view.weapon !== weapon || (sample.view.ads >= .99) !== ads)
          throw Error(`Weapon/ADS state differs from the requested shot: ${JSON.stringify(sample)}`);
        const path = sample.view.lastSelfShot;
        if (!path || path.sourceError > 1e-6 || Math.hypot(path.endpointScreen[0] - 960, path.endpointScreen[1] - 540) > 1)
          throw Error(`Muzzle/crosshair alignment failed: ${JSON.stringify(sample)}`);
        if (Math.hypot(...path.muzzle.map((v, i) => v - path.casing[i])) < .05) throw Error('Casing is still at muzzle');
        const intersection = wallHit(sample.eye, path.endpoint);
        // Recoil raises the real aiming ray; test its collider intersection,
        // rather than requiring it to hit the original level aim point.
        if (Math.abs(intersection.length - intersection.distance) > 1e-4 || intersection.distance > 35.1 || sample.shot.dist > 35.1)
          throw Error(`Shot did not reach the selected wall: ${JSON.stringify({ wall, sample })}`);
        rows.push({ weapon, ads, wall, intersection, ...sample });
        console.log(`viewmodel ${label}: verified`);
        if (ads) await mouse('mouseReleased', 'right');
        await delay(650);
      }
      await key('r', 'KeyR', 82); await delay(300);
      await capture(`wall-${weapon + 1}-reload`);
      await waitFor('window.ironsight.viewmodelInfo().phase === "idle"');
    }
    return { elapsedMs: Date.now() - start, rows,
      note: 'Ten actual hip/ADS wall shots and five reloads; source muzzle and projected tracer endpoint asserted. Server echoes retained including weapon spread. No state, clock or effect injection.' };
  } finally {
    await mouse('mouseReleased'); await mouse('mouseReleased', 'right');
    await evaluate('window.__viewmodelRun.cleanup()');
  }
}
