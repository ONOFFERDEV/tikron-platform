/** Ordinary held keys, relative pointer motion and Settings clicks. */
export async function pingWheelProbe({ send, evaluate, waitFor, delay, click, capture }) {
  const key = (type, code = 'KeyQ') => send('Input.dispatchKeyEvent', { type, code, key: code.slice(-1).toLowerCase(), windowsVirtualKeyCode: code.charCodeAt(3) });
  const up = code => key('keyUp', code), down = code => key('keyDown', code);
  const hidden = 'document.querySelector("#pingWheel").hidden';
  const notice = 'document.querySelector("#teamPingNotice")';
  const open = async (code = 'KeyQ') => { await down(code); await waitFor(`!${hidden}`); };
  const mouse = async (x,y) => {
    await send('Input.dispatchMouseEvent', { type:'mouseMoved', x, y }); await delay(100);
  };
  const layouts = [];
  for (const [width,height] of [[1920,1080],[1280,600],[720,900]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await mouse(width/2,height/2);
    await open();
    const layout = await evaluate(`(() => {const e=document.querySelector('#pingWheel'),r=e.getBoundingClientRect();
      const overlaps=[...document.querySelectorAll('#ping,#matchBrief,#tacticalMap,#wbar,#hp,#teamPingHint,#teamPingNotice,#trainingCoach')].filter(e=>!e.hidden).some(e=>{const b=e.getBoundingClientRect();return r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top;});
      return {width:innerWidth,height:innerHeight,fits:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,overlaps,text:e.textContent};})()`);
    if (!layout.fits || layout.overlaps) throw Error(`Wheel layout: ${JSON.stringify(layout)}`);
    layouts.push(layout); await capture(`wheel-${width}`);
    await up(); await delay(150);
    if (!await evaluate(`${hidden} && ${notice}.hidden`)) throw Error('Centre release sent a ping');
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
  await mouse(960,540);
  await open();
  const aim = await evaluate('Object.values(window.ironsight.state().players).map(p=>[p.yaw,p.pitch])');
  await mouse(1020,540);
  const heldAim = await evaluate('Object.values(window.ironsight.state().players).map(p=>[p.yaw,p.pitch])');
  if (JSON.stringify(aim) !== JSON.stringify(heldAim)) throw Error('Wheel motion changed server aim');
  await waitFor('document.querySelector("#pingWheel").dataset.selection === "backup"');
  await capture('wheel-backup-selected'); await up();
  await waitFor(`${notice}.textContent.includes('YOU / NEED BACKUP') && !${notice}.hidden`);
  await capture('wheel-backup-sent'); await delay(5200);
  await mouse(960,540); await open(); await mouse(900,540);
  await waitFor('document.querySelector("#pingWheel").dataset.selection === "go"');
  await up(); await waitFor(`${notice}.textContent.includes('YOU / GO HERE') && !${notice}.hidden`);
  await capture('wheel-go-sent'); await delay(5200);
  await mouse(960,540); await open(); await mouse(1020,540);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',x:1020,y:540,button:'right',clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:1020,y:540,button:'right',clickCount:1});
  await up(); await delay(200);
  if (!await evaluate(`${hidden} && ${notice}.hidden`)) throw Error('Right-click cancel sent');
  await open(); await evaluate('document.exitPointerLock()'); await up(); await delay(200);
  if (!await evaluate(`${hidden} && ${notice}.hidden`)) throw Error('Pause did not cancel');
  await click('#quitConfirm button:nth-child(2)');
  await evaluate(`document.querySelector('#settingsPanel .keyBtn[aria-label*="Team ping"]').scrollIntoView({block:'center'})`);
  await click('#settingsPanel .keyBtn[aria-label*="Team ping"]'); await down('KeyV'); await up('KeyV');
  await send('Input.dispatchKeyEvent',{type:'keyDown',code:'Escape',key:'Escape',windowsVirtualKeyCode:27});
  await send('Input.dispatchKeyEvent',{type:'keyUp',code:'Escape',key:'Escape',windowsVirtualKeyCode:27});
  await click('#quitConfirm button'); await waitFor('document.pointerLockElement instanceof HTMLCanvasElement');
  await down(); await delay(400);
  if (!await evaluate(hidden)) throw Error('Old key opens wheel');
  await up(); await open('KeyV'); await capture('wheel-rebound'); await up('KeyV');
  await down('KeyV'); await up('KeyV'); await waitFor(`!${notice}.hidden`);
  return { layouts, backupEcho:true, routeEcho:true, aimFrozen:true, centreCancel:true, rightCancel:true, pauseCancel:true, rebound:'V', tapEcho:true };
}
