/** Twenty seconds of normal bot TDM; no phase/deadline/HP/position injection. */
export async function deploymentProbe({ evaluate, waitFor, delay, capture, send, introMode, reduced }) {
  const start = Date.now();
  await evaluate(`(() => {
    const run = window.__deploymentRun = { samples: [], introFrames: [], active: true };
    let signature = '';
    const frame = () => {
      if (!run.active) return;
      const s = window.ironsight.state(), b = document.querySelector('#deployment-banner');
      const value = { phase:s.phase, deadline:s.warmupEndMs, kind:b.dataset.kind,
        text:b.textContent, hidden:b.hidden, locked:!!document.pointerLockElement };
      const next = JSON.stringify(value);
      if (next !== signature) {run.samples.push({at:performance.now(),...value}); signature=next;}
      const intro=window.ironsight.introInfo?.();
      if (intro && (intro.active || run.introFrames.at(-1)?.active)) run.introFrames.push({
        at:performance.now(),...structuredClone(intro),phase:s.phase,serverNow:window.ironsight.signalInfo().serverNow,
        player:{...s.players[window.ironsight.myId]},camera:window.ironsight.camPos(),render:window.ironsight.renderInfo(),
      });
      requestAnimationFrame(frame);
    }; frame();
  })()`);
  try {
    await capture('deployment-arrival');
    if (introMode) {
      if (!await evaluate('window.ironsight.introInfo().active')) throw Error('Expected a warmup introduction');
      const before = await evaluate('window.ironsight.introInfo()');
      // Real mouse input during the flight must not turn the actual operator.
      await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:1020,y:560,movementX:60,movementY:20});
      if (JSON.stringify((await evaluate('window.ironsight.introInfo()')).aim)!==JSON.stringify(before.aim))
        throw Error('Fly-through leaked mouse look');
      if (introMode === 'skip') {
        const nades = await evaluate('window.ironsight.state().players[window.ironsight.myId].nades');
        await evaluate(`(() => {
          window.__introWire=[];
          for(const socket of window.__inspectionSockets){const original=socket.send;
            socket.send=function(data){window.__introWire.push(typeof data==='string'?data:'binary');return original.call(this,data);};}
        })()`);
        await send('Input.dispatchKeyEvent',{type:'keyDown',key:'g',code:'KeyG',windowsVirtualKeyCode:71});
        await send('Input.dispatchKeyEvent',{type:'keyUp',key:'g',code:'KeyG',windowsVirtualKeyCode:71});
        await waitFor('!window.ironsight.introInfo().active'); await delay(200);
        if ((await evaluate('window.ironsight.state().players[window.ironsight.myId].nades'))!==nades)
          throw Error('Skip gesture threw a grenade');
        if (await evaluate(`window.__introWire.some(data=>data.includes('"nade"'))`))
          throw Error('Skip gesture sent a grenade intent (even if warmup would reject it)');
        await capture('intro-skipped');
      } else {
        await delay(650); await capture('intro-glide');
        await waitFor('!window.ironsight.introInfo().active'); await capture('intro-return');
      }
    }
    await waitFor('document.querySelector("#deployment-banner .deployment-count").textContent==="03"');
    await capture('deployment-three');
    await waitFor('document.querySelector("#deployment-banner .deployment-count").textContent==="01"');
    await capture('deployment-one');
    await waitFor('document.querySelector("#deployment-banner").dataset.kind==="go"');
    await capture('deployment-go');
    await delay(2400);
    if (!await evaluate('document.querySelector("#deployment-banner").hidden')) throw Error('GO did not expire');
    await capture('deployment-clear');
    await delay(Math.max(0, 20000 - (Date.now() - start)));
    const result = await evaluate(`({samples:window.__deploymentRun.samples,introFrames:window.__deploymentRun.introFrames,audio:window.__deploymentAudio??[],
      skipWire:window.__introWire?{frames:window.__introWire.length,nadeSent:window.__introWire.some(data=>data.includes('"nade"'))}:null,
      roster:Object.keys(window.ironsight.state().players),phase:window.ironsight.state().phase})`);
    const go = result.samples.filter(s => s.kind === 'go' && !s.hidden);
    if (go.length !== 1 || go[0].phase !== 'live') throw Error('Start announcement is not one authoritative edge');
    if (result.samples.some(s => s.kind === 'go' && s.phase !== 'live')) throw Error('Premature GO');
    if (new Set(result.samples.filter(s => s.phase === 'warmup').map(s => s.deadline)).size !== 1) throw Error('Deadline moved during warmup');
    if (introMode) {
      const frames=result.introFrames, active=frames.filter(f=>f.active), last=frames.at(-1);
      if (!active.length || !last || last.active || last.at-active[0].startedAt>4520 ||
        active.some(f=>f.phase!=='warmup'||f.deadline-f.serverNow<3490)) throw Error('Intro overran its warmup budget');
      if (new Set(frames.map(f=>f.render.programs)).size!==1) throw Error('Intro compiled a shader');
      if (active.some(f=>Math.abs(f.camera.x-f.player.x)>.01||Math.abs(f.camera.z-f.player.z)>.01||f.camera.y>5))
        throw Error('Cinematic camera persisted into gameplay queries');
      if (new Set(active.map(f=>JSON.stringify(f.aim))).size!==1) throw Error('Intro changed operator aim');
      if (reduced && new Set(active.map(f=>JSON.stringify(f.pose))).size!==1) throw Error('Reduced-motion camera moved');
      if (!reduced && introMode!=='skip' && active.at(-1).progress-active[0].progress<.1) throw Error('Fly-through did not move');
    }
    const tones = result.audio.filter(s => [740,164.81,246.94,329.63].some(f=>Math.abs(s.frequency-f)<.01));
    if (tones.filter(s=>s.frequency===740).length !== 3 || tones.length !== 6 || tones.some(s=>!s.ended))
      throw Error(`Countdown/start audio not bounded: ${JSON.stringify(tones)}`);
    return {elapsedMs:Date.now()-start,...result,tones,note:'20s normal bot TDM; only matchmaking room isolation. Audio node observation, not listening approval.'};
  } finally { await evaluate('window.__deploymentRun.active=false'); }
}
