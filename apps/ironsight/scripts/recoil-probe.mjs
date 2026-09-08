/** Actual held mouse input, server shot events and read-only local recoil diagnostics. */
export async function recoilProbe({ send, evaluate, waitFor, delay, capture, record }) {
  const rows = [];
  const mouse = (type, button = 'left') => send('Input.dispatchMouseEvent', { type, x: 960, y: 540, button, clickCount: 1 });
  for (let slot = 1; slot <= 5; slot++) {
    for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: String(slot), code: `Digit${slot}`, windowsVirtualKeyCode: 48 + slot });
    await waitFor(`window.ironsight.viewmodelInfo().weapon === ${slot - 1}`);
    await delay(1000);
    await evaluate(`(() => {
      const run = window.__recoilRun = { shots: [], samples: [], start: performance.now(), active: true };
      const socket = window.__inspectionSockets.at(-1);
      const listener = e => { if (typeof e.data !== 'string') return; const f = JSON.parse(e.data);
        if (f.t === 's:msg' && f.type === 'shot' && f.payload.from === window.ironsight.myId)
          run.shots.push({ t: performance.now() - run.start, ...f.payload });
      };
      socket.addEventListener('message', listener);
      const frame = () => { if (!run.active) return;
        run.samples.push({ t: performance.now() - run.start, ...window.ironsight.recoilInfo() });
        requestAnimationFrame(frame);
      }; requestAnimationFrame(frame);
      run.cleanup = () => { run.active = false; socket.removeEventListener('message', listener); };
    })()`);
    await capture(`recoil-${slot}-ready`);
    await mouse('mousePressed'); await delay(1800);
    await capture(`recoil-${slot}-held`);
    await mouse('mouseReleased'); await delay(850);
    const run = await evaluate('window.__recoilRun.cleanup(); ({shots:window.__recoilRun.shots,samples:window.__recoilRun.samples,recovered:window.ironsight.recoilInfo()})');
    await record({ slot, ...run });
    await capture(`recoil-${slot}-recovered`);
    if (!run.shots.length || !run.samples.some(s => s.pitch > .001) || run.recovered.index !== 0 || run.recovered.pitch !== 0)
      throw Error(`Recoil feedback/recovery failed slot ${slot}`);
    if (slot <= 2 && (run.shots.length < 8 || !run.samples.some(s => Math.abs(s.yaw) > .001)))
      throw Error(`Automatic spray never reached lateral section slot ${slot}`);
    rows.push({ slot, ...run });
  }
  return { recoil: rows, note: 'Actual pointer/key path and server-confirmed shots. Local angles in radians, sampled on desktop rAF; not a human comfort or RTT acceptance.' };
}
