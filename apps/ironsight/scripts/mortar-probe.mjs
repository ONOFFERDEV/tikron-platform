/** Five ordinary kills then one real V-key designation, with twenty seconds of
 * post-call captures. No state, HP, clock, position or reward injection. */
export async function mortarProbe({ send, evaluate, waitFor, delay, capture, click, reduced = false }) {
  const mouse = type => send('Input.dispatchMouseEvent', { type, x:960,y:540,button:'left',clickCount:1 });
  const key = async (code, key, n) => { for(const type of ['keyDown','keyUp']) await send('Input.dispatchKeyEvent',{type,code,key,windowsVirtualKeyCode:n}); };
  const read = () => evaluate(`(() => {const I=window.ironsight;return {mortar:I.mortarInfo(),support:I.supportInfo(),blast:I.blastInfo(),
    me:I.state().players[I.myId],bots:Object.fromEntries(Object.entries(I.state().players).filter(([id])=>id.startsWith('bot-'))),
    title:document.querySelector('#airSupport strong').textContent, detail:document.querySelector('#airSupport span').textContent};})()`);
  const before=await read(); await capture('mortar-before');
  for(let n=1;n<=5;n++) {
    if(n===4){await key('KeyR','r',82);await delay(2300);}
    await waitFor('window.ironsight.state().players["bot-idle"].alive');
    const end=Date.now()+14000;
    while((await read()).me.k<n && Date.now()<end) {
      await evaluate(`(() => {const I=window.ironsight,p=I.camPos(),b=I.state().players['bot-idle'];
        I.look(Math.atan2(b.x-p.x,b.z-p.z),Math.atan2(b.y+1.15-p.y,Math.hypot(b.x-p.x,b.z-p.z)));})()`);
      await delay(150);await mouse('mousePressed');await delay(220);await mouse('mouseReleased');await delay(140);
    }
    if((await read()).me.k!==n)throw Error(`Did not earn kill ${n}`);
    if(n===4)await capture('mortar-one-away');
  }
  await waitFor('window.ironsight.mortarInfo().available');
  const earned=await read();await capture('mortar-earned');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await delay(100);await capture('mortar-earned-phone');
  await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
  if(reduced) {
    await evaluate('document.exitPointerLock()');await delay(180);await click('#quitConfirm button:nth-child(2)');
    await click('input[data-setting="reduced-motion"]');
    await evaluate(`document.querySelector('#settingsPanel .keyBtn[aria-label="Rebind Call mortar"]').scrollIntoView({block:'center'})`);
    await click('#settingsPanel .keyBtn[aria-label="Rebind Call mortar"]');await key('KeyH','h',72);
    await key('Escape','Escape',27);await click('#quitConfirm button');await waitFor('!!document.pointerLockElement');
    await key('KeyV','v',86);await delay(150);
    if(!(await read()).mortar.available || (await read()).mortar.strikes.length)throw Error('Old support key still calls');
    if(!(await read()).detail.includes('[H]'))throw Error('Rebound key absent from earned HUD');
  }
  const call = () => reduced ? key('KeyH','h',72) : key('KeyV','v',86);
  await evaluate('window.ironsight.look(0,.5)');await call();await delay(250);
  const rejected=await read(); if(!rejected.mortar.available || !rejected.detail.includes('open ground'))throw Error('Invalid designation consumed charge or lacked guidance');
  await waitFor('window.ironsight.state().players["bot-sneak"].alive');
  await evaluate(`(() => {const I=window.ironsight,p=I.camPos(),b=I.state().players['bot-sneak'];
    I.look(Math.atan2(b.x-p.x,b.z-p.z),Math.atan2(-p.y,Math.hypot(b.x-p.x,b.z-p.z)));})()`);
  await delay(200);await call();
  await waitFor('window.ironsight.mortarInfo().strikes.length===1');
  const called=await read();await capture('mortar-marked');
  await evaluate(`(() => {const I=window.ironsight,p=I.camPos(),b=I.mortarInfo().strikes[0];
    I.look(Math.atan2(b.x-p.x,b.z-p.z),Math.atan2(.9-p.y,Math.hypot(b.x-p.x,b.z-p.z)));})()`);
  const start=called.mortar.strikes[0].startedAt,samples=[];
  for(const age of [1500,2450,3150,3800,4450,5600,6500,10000,20000]) {
    while((await read()).mortar.serverNow<start+age)await delay(35);
    const row=await read();samples.push({age,...row});await capture(`mortar-${age}`);
  }
  const after=await read();
  if(after.me.k<=5)throw Error('Barrage did not damage the normal target roster');
  if(after.support.count!==5)throw Error('Support kills recursively advanced reward streak');
  if(after.mortar.available || after.mortar.strikes.length || after.mortar.effects.draws)throw Error('Mortar charge/effect did not drain');
  const layouts=[];
  for(const [width,height] of [[1920,1080],[1280,600],[720,900],[390,844]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await delay(120);
    const r=await evaluate(`(() => {const a=document.querySelector('#airSupport'),r=a.getBoundingClientRect();return {width:innerWidth,height:innerHeight,
      fits:r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,overlaps:[...document.querySelectorAll('#hp,#ammo,#trainingCoach,#signalEvent,#elimination')].filter(e=>!e.hidden&&getComputedStyle(e).opacity!=='0').filter(e=>{const b=e.getBoundingClientRect();return r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top}).map(e=>e.id)};})()`);
    if(!r.fits||r.overlaps.length)throw Error(`Mortar layout: ${JSON.stringify(r)}`);layouts.push(r);await capture(`mortar-layout-${width}`);
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
  await evaluate('document.exitPointerLock()');await delay(180);
  const pauseHides=await evaluate('document.querySelector("#airSupport").hidden&&document.querySelector("#supportBanner").hidden');
  if(!pauseHides)throw Error('Support HUD overlaps pause');
  await click('#quitConfirm button:nth-child(2)');await click('input[data-setting="reduced-motion"]');
  await key('Escape','Escape',27);await click('#quitConfirm button');await waitFor('!!document.pointerLockElement');
  await capture('mortar-reduced-after');
  return {before,earned,rejected,called,samples,after,layouts,pauseHides,reduced,rebound:reduced?'H':null,note:'Real practice kills, ordinary key input, and 20s post-call. No injected rewards or gameplay state; not human 6v6 qualification.'};
}
