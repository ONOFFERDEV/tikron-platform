// Real browser controls and read-only game diagnostics. Never changes room state or time.
export async function firstPlay({ send, evaluate, click, waitFor, delay, capture, record, matchOnly = false, assertFixed = false }) {
  const key = async (code, down = true) => send('Input.dispatchKeyEvent', {
    type: down ? 'keyDown' : 'keyUp', code,
    key: code.startsWith('Key') ? code.slice(3).toLowerCase() : code.startsWith('Digit') ? code.slice(5) : code,
    windowsVirtualKeyCode: code.startsWith('Key') ? code.charCodeAt(3) : code.startsWith('Digit') ? code.charCodeAt(5) : 0,
  });
  const tap = async code => { await key(code); await key(code, false); };
  const mouse = async (type, button = 'left') => send('Input.dispatchMouseEvent', { type, x: 960, y: 540, button, clickCount: 1 });
  const state = () => evaluate(`(() => { const g=window.ironsight,s=g.state();return {phase:s.phase,mode:s.mode,end:s.matchEndMs,red:s.redScore,blue:s.blueScore,self:s.players[g.myId],players:s.players,overlay:document.querySelector('#overlay').innerText,brief:document.querySelector('#matchBrief').innerText}; })()`);
  const unlock = async () => { await evaluate('document.exitPointerLock()'); await waitFor('!!document.querySelector("#quitConfirm")'); };
  const lock = async () => { await send('Page.bringToFront'); await mouse('mousePressed'); await mouse('mouseReleased'); await waitFor('!!document.pointerLockElement'); };
  const deploy = async (mode, map) => {
    await waitFor('!!document.querySelector("#modeMenu")');
    await click(`[data-mode="${mode}"]`);
    if (map) await click(`[data-map="${map}"]`);
    await capture(`${mode}-${map ?? 'site'}-menu`);
    await click('.deploy');
    await waitFor('!!window.ironsight?.state()?.players[window.ironsight.myId]');
    await delay(600); await capture(`${mode}-${map ?? 'site'}-briefing`); await lock();
  };
  for (const map of matchOnly ? [] : ['arena1', 'arena2']) {
    await deploy('practice', map);
    const started = Date.now();
    for (let step = 0; Date.now() - started < 120000; step++) {
      // Walk short stretches, turn, try every weapon/ADS/reload without teleporting.
      await evaluate(`window.ironsight.look(${Math.PI / 2 + Math.floor(step / 3) * Math.PI / 2},0)`);
      await key('KeyW'); await delay(900); await key('KeyW', false);
      await tap(`Digit${step % 5 + 1}`); await delay(400);
      await mouse('mousePressed', 'right'); await mouse('mousePressed'); await delay(400);
      await mouse('mouseReleased'); await mouse('mouseReleased', 'right'); await tap('KeyR');
      await delay(2300);
      if (step % 6 === 0) { await capture(`practice-${map}-${step}`); await record({ stage: `practice-${map}`, elapsed: Date.now() - started, state: await state() }); }
    }
    await record({ stage: `practice-${map}-complete`, elapsed: Date.now() - started });
    await unlock(); await capture(`practice-${map}-pause`); await click('#quitConfirm .quit');
  }
  await deploy('tdm');
  const started = Date.now(); let ended = false;
  for (let step = 0; Date.now() - started < 370000; step++) {
    const s = await state();
    if (s.phase === 'ended') { ended = true; await record({stage:'round-end',state:s}); break; }
    if (s.self.alive) {
      await evaluate(`window.ironsight.look(${Math.PI / 2 + Math.floor(step / 4) * Math.PI / 2},0)`);
      await key('KeyW'); await mouse('mousePressed'); await delay(1100);
      await key('KeyW',false); await mouse('mouseReleased');
      const after = await state();
      if (after.phase !== 'ended' && after.end - Date.now() > 4000) await tap('KeyR');
    }
    await delay(900);
    if (step % 10 === 0) { await capture(`tdm-${step}`); await record({stage:'tdm',elapsed:Date.now()-started,state:await state()}); }
  }
  if (!ended) throw Error('Natural bot TDM round did not finish in 370 seconds');
  await waitFor('!!document.querySelector("[data-action=restart]")'); await capture('round-end');
  if (assertFixed) {
    await delay(10000);
    if (await evaluate('window.ironsight.state().phase') !== 'ended') throw Error('Results disappeared before ten seconds of reading');
    await record({stage:'results-reading-window',atLeastMs:10000});
  }
  await click('[data-action="restart"]'); await waitFor('window.ironsight.state().phase === "warmup"');
  await capture('rematch-warmup'); await lock();
  await waitFor('window.ironsight.state().phase === "live"');
  await record({stage:'rematch-live',state:await state()});
  await unlock(); await click('#quitConfirm .row button:nth-child(2)');
  await capture('settings');
  await record({stage:'settings-focus',focus:await evaluate('document.activeElement?.outerHTML')});
  await tap('Escape'); await delay(1300); await click('#quitConfirm .row button:first-child');
  await waitFor('!!document.pointerLockElement');
  const id = await evaluate('window.ironsight.myId');
  await evaluate('window.__inspectionSockets.at(-1).close(4000,"first-play reconnect")');
  await waitFor('document.querySelector("#overlay").dataset.kind === "connection"'); await capture('reconnecting');
  await waitFor('window.__inspectionSockets.at(-1).readyState === 1 && document.querySelector("#overlay").dataset.kind !== "connection"');
  if (id !== await evaluate('window.ironsight.myId')) throw Error('Reconnect lost held seat');
  await capture('reconnected'); await record({stage:'reconnected',sameSeat:true,state:await state()});
}

export async function menuProbe({ send, evaluate, click, waitFor, delay, assertFixed }) {
  const tap = async (code, modifiers = 0) => {
    await send('Input.dispatchKeyEvent', {type:'keyDown',code,key:code === 'KeyM' ? 'm' : code,modifiers});
    await send('Input.dispatchKeyEvent', {type:'keyUp',code,key:code === 'KeyM' ? 'm' : code,modifiers});
  };
  await tap('KeyM'); await delay(100);
  const muted = await evaluate('({saved:localStorage.getItem("iron_muted"),visible:!!document.querySelector("#audioMuted") && !document.querySelector("#audioMuted").hidden})');
  await evaluate('document.exitPointerLock()'); await waitFor('!!document.querySelector("#quitConfirm")');
  const pause = await evaluate('({role:document.querySelector("#quitConfirm").getAttribute("role"),focus:document.activeElement?.textContent,text:document.querySelector("#quitConfirm").innerText})');
  await tap('Tab', 8);
  const focusWrapped = await evaluate('document.activeElement === document.querySelector("#quitConfirm .quit")');
  // A movement key pressed in the menu must not become movement on resume.
  const before = await evaluate('window.ironsight.camPos()');
  await send('Input.dispatchKeyEvent', {type:'keyDown',code:'KeyS',key:'s',windowsVirtualKeyCode:83});
  await delay(1300); // browser guards against immediate Escape -> relock
  await send('Page.bringToFront');
  await click('#quitConfirm .row button:first-child'); await waitFor('!!document.pointerLockElement');
  await delay(500);
  await send('Input.dispatchKeyEvent', {type:'keyUp',code:'KeyS',key:'s',windowsVirtualKeyCode:83});
  const after = await evaluate('window.ironsight.camPos()');
  const menuKeyMovement = Math.hypot(after.x-before.x, after.z-before.z);
  await evaluate('document.exitPointerLock()'); await waitFor('!!document.querySelector("#quitConfirm")');
  await click('#quitConfirm .row button:nth-child(2)');
  const muteControl = await evaluate('document.querySelector("[data-setting=muted]")?.checked ?? null');
  // Close the actual transport while settings is open, without changing client/room state.
  await evaluate('window.__inspectionSockets.at(-1).close(4000,"menu recovery probe")');
  await waitFor('document.querySelector("#overlay").dataset.kind === "connection"');
  const recovery = await evaluate('({settingsCover:!!document.querySelector("#settingsPanel"),pauseCover:!!document.querySelector("#quitConfirm"),text:document.querySelector("#overlay").innerText})');
  await waitFor('window.__inspectionSockets.at(-1).readyState === 1 && document.querySelector("#overlay").dataset.kind !== "connection"');
  if (assertFixed) {
    // Deterministically exercise the browser's rejected-lock path, then restore
    // the browser method and prove a real gesture can recover.
    await evaluate(`window.__savedLock=HTMLCanvasElement.prototype.requestPointerLock;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.reject(new DOMException('Browser cooldown','NotAllowedError'));`);
    await send('Input.dispatchMouseEvent',{type:'mousePressed',x:960,y:540,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:960,y:540,button:'left',clickCount:1});
    await waitFor('document.querySelector("#overlay").innerText.includes("Click again to resume")');
    await evaluate('HTMLCanvasElement.prototype.requestPointerLock=window.__savedLock');
    await delay(1300); await send('Page.bringToFront');
    await send('Input.dispatchMouseEvent',{type:'mousePressed',x:960,y:540,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:960,y:540,button:'left',clickCount:1});
    await waitFor('!!document.pointerLockElement');
  }
  if (assertFixed && (!muted.visible || pause.role !== 'dialog' || !focusWrapped || menuKeyMovement > 0.1 || muteControl !== true || recovery.settingsCover || recovery.pauseCover))
    throw Error(`First-play menu regression: ${JSON.stringify({muted,pause,focusWrapped,muteControl,recovery})}`);
  return {muted,pause,focusWrapped,menuKeyMovement,muteControl,recovery,lockRejectionRecovery:assertFixed};
}
