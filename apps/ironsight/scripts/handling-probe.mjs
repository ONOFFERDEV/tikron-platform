/** Real pointer/key path; records render intervals, not network latency or human feel. */
export async function handlingProbe({ send, evaluate, waitFor, delay, capture, assertFixed }) {
  const rows = [];
  const mouse = (type, button) => send('Input.dispatchMouseEvent', { type, x: 960, y: 540, button, clickCount: 1 });
  const key = (type, n) => send('Input.dispatchKeyEvent', { type, key: String(n), code: `Digit${n}`, windowsVirtualKeyCode: 48 + n });
  for (const [index, adsMs] of [250, 200, 225, 400, 165].entries()) {
    await key('keyDown', index + 1); await key('keyUp', index + 1);
    await waitFor(`window.ironsight.viewmodelInfo().weapon === ${index}`);
    await delay(1000);
    await evaluate(`(() => {
      const socket = window.__inspectionSockets.at(-1);
      window.__handlingRun = { start: 0, triggerMs: null, samples: [], shots: [] };
      const run = window.__handlingRun;
      const listener = e => { if (typeof e.data !== 'string') return;
        const f = JSON.parse(e.data);
        if (run.start && f.t === 's:msg' && f.type === 'shot' && f.payload.from === window.ironsight.myId)
          run.shots.push(performance.now() - run.start);
      };
      socket.addEventListener('message', listener);
      const canvas = document.pointerLockElement;
      const trigger = e => { if (e.button === 0 && run.start) run.triggerMs = performance.now() - run.start; };
      canvas.addEventListener('mousedown', trigger);
      run.cleanup = () => { socket.removeEventListener('message', listener); canvas.removeEventListener('mousedown', trigger); };
      document.pointerLockElement.addEventListener('mousedown', () => {
        run.start = performance.now();
        const sample = () => { const t = performance.now() - run.start;
          run.samples.push({ t, ...window.ironsight.viewmodelInfo(), mag: Number(document.querySelector('#ammo .mag').textContent) });
          if (t < 800) requestAnimationFrame(sample);
        }; requestAnimationFrame(sample);
      }, { once: true });
    })()`);
    await mouse('mousePressed', 'right'); await mouse('mousePressed', 'left');
    await delay(150); await capture(`handling-${index + 1}-acquiring`);
    await delay(850);
    await mouse('mouseReleased', 'left'); await mouse('mouseReleased', 'right');
    const run = await evaluate('window.__handlingRun.cleanup(); ({triggerMs:window.__handlingRun.triggerMs, samples:window.__handlingRun.samples, shots:window.__handlingRun.shots})');
    const settled = run.samples.find(s => s.ads >= 0.9999)?.t ?? null;
    if (assertFixed && (settled === null || settled < adsMs - 20 || settled > adsMs + 55 || !run.shots.length ||
        run.shots[0] < adsMs - 20 || run.shots[0] > Math.max(adsMs, run.triggerMs ?? 0) + 200))
      throw Error(`Handling timer mismatch for slot ${index + 1}: ${JSON.stringify({settled, firstShot:run.shots[0], triggerMs:run.triggerMs, adsMs})}`);
    rows.push({ slot: index + 1, adsMs, settledMs: settled, firstConfirmedShotMs: run.shots[0] ?? null, ...run });
  }
  const movementKey = (type, key, code, windowsVirtualKeyCode) => send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode });
  await delay(300);
  await movementKey('keyDown', 'w', 'KeyW', 87);
  await movementKey('keyDown', 'Shift', 'ShiftLeft', 16);
  await delay(400);
  await evaluate(`(() => {
    const run = window.__sprintRun = { start: 0, shots: [] };
    const socket = window.__inspectionSockets.at(-1);
    const listener = e => { if (typeof e.data !== 'string') return; const f = JSON.parse(e.data);
      if (run.start && f.t === 's:msg' && f.type === 'shot' && f.payload.from === window.ironsight.myId)
        run.shots.push(performance.now() - run.start);
    };
    socket.addEventListener('message', listener); run.cleanup = () => socket.removeEventListener('message', listener);
    document.pointerLockElement.addEventListener('mousedown', () => { run.start = performance.now(); }, { once: true });
  })()`);
  await mouse('mousePressed', 'left');
  await delay(500);
  await mouse('mouseReleased', 'left');
  await movementKey('keyUp', 'w', 'KeyW', 87);
  await movementKey('keyUp', 'Shift', 'ShiftLeft', 16);
  const sprint = await evaluate('window.__sprintRun.cleanup(); ({slot:5, sprintToFireMs:90, confirmedShotsMs:window.__sprintRun.shots})');
  if (assertFixed && (!sprint.confirmedShotsMs.length || sprint.confirmedShotsMs[0] < 80 || sprint.confirmedShotsMs[0] > 300))
    throw Error(`Sprint recovery/control mismatch: ${JSON.stringify(sprint)}`);
  return { handling: rows, sprint, note: 'Local rAF and received self-shot times from actual mouse/key intents; includes render/tick/transport scheduling. Not RTT or human acceptance.' };
}
