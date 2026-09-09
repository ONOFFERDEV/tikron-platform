/** Twenty seconds of normal bot TDM; no phase/deadline/HP/position injection. */
export async function deploymentProbe({ evaluate, waitFor, delay, capture }) {
  const start = Date.now();
  await evaluate(`(() => {
    const run = window.__deploymentRun = { samples: [], active: true };
    let signature = '';
    const frame = () => {
      if (!run.active) return;
      const s = window.ironsight.state(), b = document.querySelector('#deployment-banner');
      const value = { phase:s.phase, deadline:s.warmupEndMs, kind:b.dataset.kind,
        text:b.textContent, hidden:b.hidden, locked:!!document.pointerLockElement };
      const next = JSON.stringify(value);
      if (next !== signature) {run.samples.push({at:performance.now(),...value}); signature=next;}
      requestAnimationFrame(frame);
    }; frame();
  })()`);
  try {
    await capture('deployment-arrival');
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
    const result = await evaluate(`({samples:window.__deploymentRun.samples,audio:window.__deploymentAudio??[],
      roster:Object.keys(window.ironsight.state().players),phase:window.ironsight.state().phase})`);
    const go = result.samples.filter(s => s.kind === 'go' && !s.hidden);
    if (go.length !== 1 || go[0].phase !== 'live') throw Error('Start announcement is not one authoritative edge');
    if (result.samples.some(s => s.kind === 'go' && s.phase !== 'live')) throw Error('Premature GO');
    if (new Set(result.samples.filter(s => s.phase === 'warmup').map(s => s.deadline)).size !== 1) throw Error('Deadline moved during warmup');
    const tones = result.audio.filter(s => [740,164.81,246.94,329.63].some(f=>Math.abs(s.frequency-f)<.01));
    if (tones.filter(s=>s.frequency===740).length !== 3 || tones.length !== 6 || tones.some(s=>!s.ended))
      throw Error(`Countdown/start audio not bounded: ${JSON.stringify(tones)}`);
    return {elapsedMs:Date.now()-start,...result,tones,note:'20s normal bot TDM; only matchmaking room isolation. Audio node observation, not listening approval.'};
  } finally { await evaluate('window.__deploymentRun.active=false'); }
}
