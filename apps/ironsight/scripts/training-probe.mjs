import { pingTrainingProbe } from './ping-training-probe.mjs';
/** Exercise teaching with normal inputs and server state, without mutating lesson state. */
export async function trainingProbe({ send, evaluate, waitFor, delay, capture }) {
  const step = () => evaluate('document.querySelector("#trainingCoach").dataset.step');
  if (await step() !== '0') throw Error('Training did not start with movement');
  await capture('move');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87 });
  await delay(950);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87 });
  await waitFor('document.querySelector("#trainingCoach").dataset.step === "1"');
  await capture('aim');
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 960, y: 540, button: 'right', buttons: 2, clickCount: 1 });
  await delay(1000);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 960, y: 540, button: 'right', buttons: 0, clickCount: 1 });
  const exploration = await evaluate('new URL(location.href).searchParams.get("map") === "arena2"');
  const hasTargets = await evaluate('!["arena2","arena3"].includes(new URL(location.href).searchParams.get("map"))');
  await waitFor(`document.querySelector("#trainingCoach").dataset.step === "${exploration ? 4 : hasTargets ? 2 : 5}"`);
  await capture(exploration ? 'objective' : hasTargets ? 'hit' : 'exploration');
  let objective;
  if (exploration) {
    const position = () => evaluate('(() => {const p=window.ironsight.state().players[window.ironsight.myId];return {x:p.x,z:p.z};})()');
    const walkTo = async (x, z) => {
      const deadline = Date.now() + 20000;
      try {
        while (Date.now() < deadline) {
          const p = await position();
          if (Math.hypot(x - p.x, z - p.z) < .5) return p;
          await evaluate(`window.ironsight.look(${Math.atan2(x - p.x, z - p.z)},0)`);
          await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87 });
          await delay(50);
        }
        throw Error(`Objective route failed at ${x},${z}: ${JSON.stringify(await position())}`);
      } finally {
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87 });
      }
    };
    const before = await evaluate('({mode:window.ironsight.state().mode,a:window.ironsight.state().capA,red:window.ironsight.state().redScore,blue:window.ironsight.state().blueScore})');
    const started = Date.now();
    const route = [];
    // Walk the actual northern exit/court with ordinary W and look input.
    // No teleports, lesson-state writes, score edits or collision shortcuts.
    for (const [x, z] of [[3,39],[3,25],[17,25],[17,15],[27,15]]) route.push(await walkTo(x,z));
    await waitFor('document.querySelector("#trainingCoach progress").value >= 1000');
    await capture('objective-hold');
    await evaluate('document.exitPointerLock()');
    await delay(200);
    if (!await evaluate('document.querySelector("#trainingCoach").hidden')) throw Error('Objective lesson overlaps pause');
    const resume = await evaluate('(() => {const r=document.querySelector("#quitConfirm button").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
    await send('Input.dispatchMouseEvent', {type:'mousePressed',...resume,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent', {type:'mouseReleased',...resume,button:'left',clickCount:1});
    await waitFor('document.pointerLockElement instanceof HTMLCanvasElement');
    await delay(300);
    if (!await evaluate('document.querySelector("#trainingCoach progress").value < 1000')) throw Error('Paused hold did not reset');
    await walkTo(33,15);
    await delay(300);
    if (!await evaluate('document.querySelector("#trainingCoach progress").value === 0')) throw Error('Leaving A did not reset the rehearsal');
    await capture('objective-left');
    await walkTo(27,15);
    await waitFor('document.querySelector("#trainingCoach").dataset.step === "5"');
    await capture('objective-complete');
    const after = await evaluate('({mode:window.ironsight.state().mode,a:window.ironsight.state().capA,red:window.ironsight.state().redScore,blue:window.ironsight.state().blueScore})');
    if (JSON.stringify(before) !== JSON.stringify(after)) throw Error('Rehearsal altered match scores or capture gauge');
    objective = {route, elapsedMs:Date.now()-started, before, after, pauseResets:true, leavingResets:true,
      holdMs:await evaluate('document.querySelector("#trainingCoach progress").max')};
  }
  if (hasTargets) {
    for (let i = 0; i < 12 && await step() !== '5'; i++) {
      await evaluate(`(() => { const target=window.ironsight.state().players['bot-idle']; const p=window.ironsight.camPos();
        const dx=target.x-p.x,dz=target.z-p.z; window.ironsight.look(Math.atan2(dx,dz),Math.atan2(1.1-p.y,Math.hypot(dx,dz))); })()`);
      await delay(100);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 960, y: 540, button: 'left', clickCount: 1 });
      await delay(40);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 960, y: 540, button: 'left', clickCount: 1 });
      await delay(200);
    }
    if (await step() !== '5') throw Error('Confirmed target hit did not reach ping training');
  }
  const ping = await pingTrainingProbe({ send, evaluate, waitFor, delay, capture });
  const result = await evaluate(`(() => { const c=document.querySelector('#trainingCoach'),r=c.getBoundingClientRect();
    return { step:c.dataset.step, text:c.textContent, role:c.getAttribute('role'), visible:!c.hidden,
      outsideAim:r.right < innerWidth*.4, fits:r.bottom < innerHeight, players:Object.keys(window.ironsight.state().players).length }; })()`);
  result.objective = objective;
  result.ping = ping;
  if (!result.visible || !result.outsideAim || !result.fits || result.role !== 'status') throw Error('Training layout/semantics failed');
  result.connectionLayouts = [];
  await waitFor('document.querySelector("#ping strong").textContent !== "MEASURING DELAY"');
  for (const [width, height] of [[1920, 1080], [1280, 600], [720, 900]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await delay(50);
    const layout = await evaluate(`(() => {
      const c=document.querySelector('#trainingCoach').getBoundingClientRect();
      const p=document.querySelector('#ping').getBoundingClientRect();
      const m=document.querySelector('#tacticalMap').getBoundingClientRect();
      const b=document.querySelector('#matchBrief').getBoundingClientRect();
      return {width:innerWidth,height:innerHeight,gap:c.top-p.bottom,mapGap:p.top-m.bottom,
        briefOverlap:c.left<b.right && c.right>b.left && c.top<b.bottom && c.bottom>b.top,
        fits:c.right<=innerWidth && c.bottom<=innerHeight,delay:document.querySelector('#ping strong').textContent};
    })()`);
    if (!layout.fits || layout.briefOverlap || layout.gap < 6 || layout.mapGap < 6 || layout.delay === 'MEASURING DELAY') throw Error(`Connection/training overlap or missing clock: ${JSON.stringify(layout)}`);
    result.connectionLayouts.push(layout);
    await capture(`connection-${width}`);
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await evaluate('document.exitPointerLock()');
  await delay(200);
  if (!await evaluate('document.querySelector("#trainingCoach").hidden')) throw Error('Training overlaps paused menu');
  return result;
}
