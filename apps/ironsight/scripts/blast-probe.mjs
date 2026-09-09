/** Ordinary Training grenades/settings; no event, position, HP or effect injection. */
export async function blastProbe({ send, evaluate, waitFor, delay, capture, click }) {
  const key = async (code, key, windowsVirtualKeyCode) => {
    for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, code, key, windowsVirtualKeyCode });
  };
  await evaluate(`(() => {
    const run = window.__blastRun = { frames: [], events: [], active: true, reduced: false };
    const socket = window.__inspectionSockets.at(-1);
    const listener = e => { if (typeof e.data !== 'string') return; const f = JSON.parse(e.data);
      if (f.t === 's:msg' && f.type === 'nadeBoom') run.events.push({at:performance.now(),payload:f.payload,reduced:run.reduced}); };
    socket.addEventListener('message', listener);
    run.cleanup = () => {run.active=false;socket.removeEventListener('message',listener);};
    const frame = () => {if(!run.active)return;const I=window.ironsight;
      run.frames.push({at:performance.now(),...I.blastInfo(),eye:I.camPos(),reduced:run.reduced,
        alive:I.state().players[I.myId].alive});requestAnimationFrame(frame);};requestAnimationFrame(frame);
  })()`);
  const start = Date.now();
  try {
    await capture('blast-play-before');
    await evaluate('window.ironsight.look(0,-Math.PI/2+.001)'); await delay(150);
    await key('KeyG', 'g', 71); await delay(150); await evaluate('window.ironsight.look(Math.PI/2,-.25)');
    await waitFor('window.__blastRun.events.length===1');
    await waitFor('Math.abs(window.ironsight.blastInfo().rollRadians)>.002');
    await capture('blast-play-impact');
    await delay(2100); await capture('blast-play-settled');
    if (await evaluate('window.ironsight.blastInfo().trauma!==0')) throw Error('Grenade trauma did not settle');
    await evaluate('document.exitPointerLock()'); await delay(180); await click('#quitConfirm button:nth-child(2)');
    await click('input[data-setting="reduced-motion"]');
    await key('Escape', 'Escape', 27); await click('#quitConfirm button'); await waitFor('!!document.pointerLockElement');
    await evaluate('window.__blastRun.reduced=true;window.ironsight.look(0,-Math.PI/2+.001)'); await delay(150);
    await key('KeyG', 'g', 71); await delay(100); await evaluate('window.ironsight.look(Math.PI/2,-.25)');
    await send('Input.dispatchKeyEvent', {type:'keyDown',code:'KeyW',key:'w',windowsVirtualKeyCode:87}); await delay(1000);
    await send('Input.dispatchKeyEvent', {type:'keyUp',code:'KeyW',key:'w',windowsVirtualKeyCode:87});
    await waitFor('window.__blastRun.events.length===2'); await capture('blast-play-reduced');
    await delay(Math.max(0, 20000 - (Date.now() - start)));
    const result = await evaluate('({frames:window.__blastRun.frames,events:window.__blastRun.events})');
    if (!result.frames.some(f=>!f.reduced&&Math.abs(f.rollRadians)>.002)) throw Error('No normal grenade response');
    if (result.frames.some(f=>f.reduced&&(f.trauma!==0||f.rollRadians!==0))) throw Error('Reduced motion retained blast response');
    if (result.frames.some(f=>Math.abs(f.rollRadians)>2*Math.PI/180)) throw Error('Roll exceeded cap');
    return {elapsedMs:Date.now()-start,...result,note:'20s ordinary Training input, two received nadeBoom events; real settings click disables second response. Not human/bot-TDM qualification.'};
  } finally {
    await send('Input.dispatchKeyEvent', {type:'keyUp',code:'KeyW',key:'w',windowsVirtualKeyCode:87});
    await evaluate('window.__blastRun.cleanup()');
  }
}
