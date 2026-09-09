/** Earn a real UAV against the ordinary practice roster. Only aim, mouse/key
 * inputs and reads; no state/HP/clock changes or reward injection. */
export async function supportProbe({ send, evaluate, waitFor, delay, capture, click }) {
  const mouse = type => send('Input.dispatchMouseEvent', { type, x: 960, y: 540, button: 'left', clickCount: 1 });
  const read = () => evaluate(`(() => { const I=window.ironsight;return {support:I.supportInfo(),me:I.state().players[I.myId],
    title:document.querySelector('#airSupport strong').textContent,contacts:Number(document.querySelector('#tacticalMap canvas').dataset.reconContacts ?? 0),
    banner:document.querySelector('#supportBanner').hidden ? null : document.querySelector('#supportBanner').textContent}; })()`);
  await capture('recon-before');
  const before = await read();
  for (let n = 1; n <= 3; n++) {
    await waitFor('window.ironsight.state().players["bot-idle"].alive');
    const deadline = Date.now() + 12000;
    while ((await read()).me.k < n && Date.now() < deadline) {
      await evaluate(`(() => {const I=window.ironsight,p=I.camPos(),target=I.state().players['bot-idle'];
        const dx=target.x-p.x,dz=target.z-p.z;I.look(Math.atan2(dx,dz),Math.atan2(target.y+1.15-p.y,Math.hypot(dx,dz)));})()`);
      await delay(150); await mouse('mousePressed'); await delay(220); await mouse('mouseReleased'); await delay(140);
    }
    if ((await read()).me.k !== n) throw Error(`Did not earn kill ${n}`);
    if (n === 2) await capture('recon-one-away');
  }
  await waitFor('window.ironsight.supportInfo().flights.some(f=>f.owner===window.ironsight.myId)');
  const earned = await read(); await capture('recon-earned');
  await send('Emulation.setDeviceMetricsOverride', { width:390, height:844, deviceScaleFactor:1, mobile:false }); await delay(100);
  await capture('recon-earned-phone');
  const earnedPhone = await evaluate(`(() => {const n=document.querySelector('#supportBanner'),r=n.getBoundingClientRect();return {hidden:n.hidden,
    fits:r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,overlaps:[...document.querySelectorAll('#airSupport,#trainingCoach,#signalEvent,#caps')].filter(e=>!e.hidden).filter(e=>{const b=e.getBoundingClientRect();return r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top}).map(e=>e.id)};})()`);
  if (earnedPhone.hidden || !earnedPhone.fits || earnedPhone.overlaps.length) throw Error(`Earned phone layout: ${JSON.stringify(earnedPhone)}`);
  await send('Emulation.setDeviceMetricsOverride', { width:1920, height:1080, deviceScaleFactor:1, mobile:false });
  const samples = [earned];
  const launchAt = earned.support.flights[0].startedAt;
  for (const age of [2300, 4500, 6300, 10300, 12500, 20000]) {
    while ((await read()).support.serverNow < launchAt + age) await delay(60);
    if (age === 4500) {
      // Look towards the aircraft's actual shared-time pose, never move the camera.
      await evaluate(`(() => {const I=window.ironsight,p=I.camPos(),a=I.supportInfo().aircraft.find(a=>a.visible).position;
        I.look(Math.atan2(a[0]-p.x,a[2]-p.z),Math.atan2(a[1]-p.y,Math.hypot(a[0]-p.x,a[2]-p.z)));})()`);
    }
    const row = await read(); samples.push(row); await capture(`recon-${age}`);
    if (age === 4500) {
      await evaluate('document.exitPointerLock()'); await delay(180);
      if (!await evaluate('document.querySelector("#airSupport").hidden && document.querySelector("#supportBanner").hidden')) throw Error('Support overlaps pause');
      await click('#quitConfirm button:nth-child(2)'); await click('input[data-setting="reduced-motion"]');
      for (const type of ['keyDown','keyUp']) await send('Input.dispatchKeyEvent', { type, key:'Escape', code:'Escape', windowsVirtualKeyCode:27 });
      await click('#quitConfirm button'); await waitFor('!!document.pointerLockElement');
    }
    if (age === 2300 && row.contacts < 1) throw Error('Earned scan has no rendered contacts');
    if (age === 12500 && row.support.flights.length) throw Error('UAV did not expire');
  }
  const layouts = [];
  for (const [width, height] of [[1920,1080],[1280,600],[720,900],[390,844]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }); await delay(150);
    const layout = await evaluate(`(() => {const r=document.querySelector('#airSupport').getBoundingClientRect();
      return {width:innerWidth,height:innerHeight,rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},
        overlaps:[...document.querySelectorAll('#hp,#ammo,#wbar,#trainingCoach,#teamPingHint,#signalEvent,#elimination')].filter(e=>!e.hidden && getComputedStyle(e).opacity!=='0').filter(e=>{const b=e.getBoundingClientRect();return r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top}).map(e=>e.id)};})()`);
    if (layout.rect.right > width || layout.rect.left < 0 || layout.rect.bottom > height || layout.overlaps.length) throw Error(`Support layout: ${JSON.stringify(layout)}`);
    layouts.push(layout); await capture(`recon-layout-${width}`);
  }
  await send('Emulation.setDeviceMetricsOverride', { width:1920, height:1080, deviceScaleFactor:1, mobile:false });
  return { before, earned, earnedPhone, samples, layouts, reducedMotionAfter4500:true, pauseHides:true,
    note: 'Real server-confirmed practice kills and 20s after launch. Stationary training targets, not human 6v6/RTT qualification.' };
}
