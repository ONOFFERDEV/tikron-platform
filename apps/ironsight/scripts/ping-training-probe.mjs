/** Real settings clicks and keys; no lesson writes, teleport or synthetic room messages. */
export async function pingTrainingProbe({ send, evaluate, waitFor, delay, capture }) {
  const key = async (code, value, windowsVirtualKeyCode) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: value, windowsVirtualKeyCode });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: value, windowsVirtualKeyCode });
  };
  const click = async selector => {
    const pos = await evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) throw Error(`Missing click target: ${selector}`);
    await send('Input.dispatchMouseEvent', { type:'mousePressed', ...pos, button:'left', clickCount:1 });
    await send('Input.dispatchMouseEvent', { type:'mouseReleased', ...pos, button:'left', clickCount:1 });
  };
  const pause = async () => {
    await evaluate('document.exitPointerLock()');
    await waitFor('!!document.querySelector("#quitConfirm") && document.querySelector("#trainingCoach").hidden');
  };
  const resume = async () => {
    await key('Escape', 'Escape', 27);
    await click('#quitConfirm button');
    await waitFor('document.pointerLockElement instanceof HTMLCanvasElement');
    await delay(100);
  };
  const layouts = [];
  for (const [width,height] of [[1920,1080],[1280,600],[720,900]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await delay(100);
    const layout = await evaluate(`(() => {const c=document.querySelector('#trainingCoach'),r=c.getBoundingClientRect();
      const overlaps=[...document.querySelectorAll('#ping,#matchBrief,#tacticalMap,#wbar,#hp,#teamPingHint,#teamPingNotice')].filter(e=>!e.hidden).some(e=>{const b=e.getBoundingClientRect();return r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top;});
      return {width:innerWidth,height:innerHeight,text:c.textContent,step:c.dataset.step,fits:r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,outsideAim:r.right<innerWidth*.4,overlaps};})()`);
    if (layout.step !== '5' || !layout.fits || !layout.outsideAim || layout.overlaps) throw Error(`Ping lesson layout: ${JSON.stringify(layout)}`);
    layouts.push(layout); await capture(`ping-lesson-${width}`);
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
  await pause();
  await key('KeyQ','q',81);
  await delay(150);
  if (!await evaluate('document.querySelector("#trainingCoach").dataset.step === "5"')) throw Error('Paused ping completed lesson');
  await click('#quitConfirm button:nth-child(2)');
  // Reset ping to Q, then give Q to reload through the actual conflict-removal UI.
  await click('#settingsPanel .resetBtn[aria-label*="Team ping"]');
  await click('#settingsPanel .keyBtn[aria-label*="재장전"]');
  await key('KeyQ','q',81);
  await resume();
  await waitFor('document.querySelector("#trainingCoach p").textContent.includes("no key assigned")');
  await capture('ping-unbound');
  await pause();
  await click('#quitConfirm button:nth-child(2)');
  await click('#settingsPanel .keyBtn[aria-label*="Team ping"]');
  await key('KeyV','v',86);
  await click('#settingsPanel .resetBtn[aria-label*="재장전"]');
  await resume();
  await waitFor('document.querySelector("#trainingCoach p").textContent.includes("press V")');
  await capture('ping-rebound');
  // Ground route mark with ordinary look/key input and server-derived location.
  await evaluate('window.ironsight.look(0,-0.5)');
  await key('KeyQ','q',81); await delay(300);
  if (!await evaluate('document.querySelector("#trainingCoach").dataset.step === "5"')) throw Error('Old binding completed lesson');
  await key('KeyV','v',86);
  await waitFor('document.querySelector("#trainingCoach").dataset.step === "3" && !document.querySelector("#teamPingNotice").hidden');
  const echo = await evaluate('document.querySelector("#teamPingNotice").textContent');
  if (!echo.includes('YOU / GO HERE')) throw Error(`Missing own server mark: ${echo}`);
  await capture('ping-complete');
  return { layouts, pausedKeyIgnored:true, unboundGuidance:true, reboundKey:'V', oldKeyIgnored:true, echo };
}
