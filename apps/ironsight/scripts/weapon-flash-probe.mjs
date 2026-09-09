/** Twenty seconds of real Training input. Only read replicated state/renderer
 * diagnostics; no HP, position, reward, clock or effect writes. */
export async function weaponFlashProbe({ send, evaluate, waitFor, delay, capture }) {
  const rows = [];
  const mouse = type => send('Input.dispatchMouseEvent', { type, x: 960, y: 540, button: 'left', clickCount: 1 });
  await evaluate(`(() => {
    const run = window.__flashRun = { frames: [], shots: [], active: true };
    const socket = window.__inspectionSockets.at(-1);
    const listener = e => { if (typeof e.data !== 'string') return; const f = JSON.parse(e.data);
      if (f.t === 's:msg' && f.type === 'shot' && f.payload.from === window.ironsight.myId)
        run.shots.push({ at: performance.now(), weapon: f.payload.weapon, hit: f.payload.hit });
    };
    socket.addEventListener('message', listener);
    run.cleanup = () => { run.active = false; socket.removeEventListener('message', listener); };
    const sample = () => {
      if (!run.active) return;
      const v = window.ironsight.viewmodelInfo();
      run.frames.push({ at: performance.now(), weapon: v.weapon, flash: v.flash, programs: v.programs, textures: v.textures });
      requestAnimationFrame(sample);
    }; requestAnimationFrame(sample);
  })()`);
  const start = Date.now();
  try {
    for (let weapon = 0; weapon < 5; weapon++) {
      const slot = weapon + 1, began = Date.now();
      for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', {
        type, key: String(slot), code: `Digit${slot}`, windowsVirtualKeyCode: 48 + slot,
      });
      await waitFor(`window.ironsight.viewmodelInfo().weapon === ${weapon}`);
      await delay(650);
      await evaluate(`(() => {
        const state=window.ironsight.state(), me=state.players[window.ironsight.myId];
        const target=state.players['bot-idle']; const eye=window.ironsight.camPos();
        if (target?.alive) { const dx=target.x-eye.x,dz=target.z-eye.z;
          window.ironsight.look(Math.atan2(dx,dz),Math.atan2(target.y+1.1-eye.y,Math.hypot(dx,dz))); }
      })()`);
      await delay(120);
      await capture(`flash-${slot}-before`);
      await mouse('mousePressed');
      await capture(`flash-${slot}-firing`);
      await delay(250);
      await mouse('mouseReleased');
      await delay(120);
      const settled = await evaluate('window.ironsight.viewmodelInfo()');
      if (settled.flash.opacity !== 0) throw Error(`Flash tail remained for slot ${slot}`);
      await capture(`flash-${slot}-after`);
      rows.push({ slot, settled });
      await delay(Math.max(0, 4000 - (Date.now() - began)));
    }
    const observed = await evaluate('({ frames:window.__flashRun.frames, shots:window.__flashRun.shots })');
    for (let weapon = 0; weapon < 5; weapon++) {
      if (!observed.frames.some(f => f.weapon === weapon && f.flash.opacity > 0) ||
          !observed.shots.some(s => s.weapon === weapon + 1))
        throw Error(`Missing real shot/flash for slot ${weapon + 1}`);
    }
    return { elapsedMs: Date.now() - start, rows, ...observed,
      note: 'Real five-weapon keyboard/mouse Training sequence; flashes predict local accepted intent, shots/hits confirmed by server. No injected state or effect.' };
  } finally {
    await mouse('mouseReleased');
    await evaluate('window.__flashRun.cleanup()');
  }
}
