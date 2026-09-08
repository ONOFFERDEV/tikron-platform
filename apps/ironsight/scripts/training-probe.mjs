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
  await waitFor(`document.querySelector("#trainingCoach").dataset.step === "${exploration ? 3 : 2}"`);
  await capture(exploration ? 'exploration' : 'hit');
  if (!exploration) {
    for (let i = 0; i < 12 && await step() !== '3'; i++) {
      await evaluate(`(() => { const target=window.ironsight.state().players['bot-idle']; const p=window.ironsight.camPos();
        const dx=target.x-p.x,dz=target.z-p.z; window.ironsight.look(Math.atan2(dx,dz),Math.atan2(1.1-p.y,Math.hypot(dx,dz))); })()`);
      await delay(100);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 960, y: 540, button: 'left', clickCount: 1 });
      await delay(40);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 960, y: 540, button: 'left', clickCount: 1 });
      await delay(200);
    }
    if (await step() !== '3') throw Error('Confirmed target hit did not complete training');
    await capture('complete');
  }
  const result = await evaluate(`(() => { const c=document.querySelector('#trainingCoach'),r=c.getBoundingClientRect();
    return { step:c.dataset.step, text:c.textContent, role:c.getAttribute('role'), visible:!c.hidden,
      outsideAim:r.right < innerWidth*.4, fits:r.bottom < innerHeight, players:Object.keys(window.ironsight.state().players).length }; })()`);
  if (!result.visible || !result.outsideAim || !result.fits || result.role !== 'status') throw Error('Training layout/semantics failed');
  result.connectionLayouts = [];
  for (const [width, height] of [[1920, 1080], [1280, 600], [720, 900]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await delay(50);
    const layout = await evaluate(`(() => {
      const c=document.querySelector('#trainingCoach').getBoundingClientRect();
      const p=document.querySelector('#ping').getBoundingClientRect();
      const m=document.querySelector('#tacticalMap').getBoundingClientRect();
      return {width:innerWidth,height:innerHeight,gap:c.top-p.bottom,mapGap:p.top-m.bottom,
        fits:c.right<=innerWidth && c.bottom<=innerHeight,delay:document.querySelector('#ping strong').textContent};
    })()`);
    if (!layout.fits || layout.gap < 6 || layout.mapGap < 6 || layout.delay === 'MEASURING DELAY') throw Error(`Connection/training overlap or missing clock: ${JSON.stringify(layout)}`);
    result.connectionLayouts.push(layout);
    await capture(`connection-${width}`);
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await evaluate('document.exitPointerLock()');
  await delay(200);
  if (!await evaluate('document.querySelector("#trainingCoach").hidden')) throw Error('Training overlaps paused menu');
  return result;
}
