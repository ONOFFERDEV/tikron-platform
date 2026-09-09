/** Seven ordinary gun kills, then 20s of server-earned sentry action. No state,
 * clock, health, position or reward injection; inspection look controls aim only. */
export async function droneProbe({send,evaluate,waitFor,delay,capture,click,reduced=false}) {
  const mouse=type=>send('Input.dispatchMouseEvent',{type,x:960,y:540,button:'left',clickCount:1});
  const key=async(code,key,n)=>{for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,code,key,windowsVirtualKeyCode:n});};
  const read=()=>evaluate(`(()=>{const I=window.ironsight;return {drone:I.droneInfo(),support:I.supportInfo(),me:I.state().players[I.myId],
    bots:Object.fromEntries(Object.entries(I.state().players).filter(([id])=>id.startsWith('bot-'))),
    title:document.querySelector('#airSupport strong').textContent,detail:document.querySelector('#airSupport span').textContent};})()`);
  if(reduced) {
    await evaluate('document.exitPointerLock()');await delay(180);await click('#quitConfirm button:nth-child(2)');
    await click('input[data-setting="reduced-motion"]');await key('Escape','Escape',27);await click('#quitConfirm button');await waitFor('!!document.pointerLockElement');
  }
  const before=await read();await capture('drone-before');
  for(let n=1;n<=7;n++) {
    if(n===4 || n===7){await key('KeyR','r',82);await delay(2300);}
    await waitFor('window.ironsight.state().players["bot-idle"].alive');
    const end=Date.now()+14000;
    while((await read()).me.k<n && Date.now()<end) {
      await evaluate(`(()=>{const I=window.ironsight,p=I.camPos(),b=I.state().players['bot-idle'];I.look(Math.atan2(b.x-p.x,b.z-p.z),Math.atan2(b.y+1.15-p.y,Math.hypot(b.x-p.x,b.z-p.z)));})()`);
      await delay(150);await mouse('mousePressed');await delay(220);await mouse('mouseReleased');await delay(140);
    }
    if((await read()).me.k!==n)throw Error(`Did not earn normal gun kill ${n}`);
    if(n===6)await capture('drone-one-away');
  }
  await waitFor('window.ironsight.droneInfo().flights.length===1');
  const earned=await read();await capture('drone-earned');
  const start=earned.drone.flights[0].startedAt;
  // Look towards the actual sentry and its normal target roster, without moving.
  await evaluate(`(()=>{const I=window.ironsight,p=I.camPos(),d=I.droneInfo().flights[0];I.look(Math.atan2(d.x-p.x,d.z-p.z),Math.atan2(2.1-p.y,4));})()`);
  const samples=[];let observedLock=false;
  for(const age of [1200,2400,3300,4200,5100,6900,8700,10500,12500,20000]) {
    while((await read()).drone.serverNow<start+age)await delay(35);
    const row=await read();samples.push({age,...row});observedLock ||= row.drone.effects.beams>0;await capture(`drone-${age}`);
    if(age===3300){
      await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await delay(80);await capture('drone-active-phone');
      await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
    }
  }
  const after=await read();
  if(!observedLock)throw Error('No actual server lock captured');
  if(after.me.k<=7)throw Error('Sentry did not eliminate a normal training target');
  if(after.support.count!==7)throw Error('Sentry kills recursively advanced support');
  if(after.drone.flights.length || after.drone.effects.draws || after.drone.queued)throw Error('Sentry did not drain');
  const layouts=[];
  for(const [width,height] of [[1920,1080],[1280,600],[720,900],[390,844]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await delay(120);
    const r=await evaluate(`(()=>{const a=document.querySelector('#airSupport'),r=a.getBoundingClientRect();return {width:innerWidth,height:innerHeight,
      fits:r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,overlaps:[...document.querySelectorAll('#hp,#ammo,#trainingCoach,#signalEvent,#elimination')].filter(e=>!e.hidden&&getComputedStyle(e).opacity!=='0').filter(e=>{const b=e.getBoundingClientRect();return r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top}).map(e=>e.id)};})()`);
    if(!r.fits||r.overlaps.length)throw Error(`Drone layout: ${JSON.stringify(r)}`);layouts.push(r);await capture(`drone-layout-${width}`);
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
  await evaluate('document.exitPointerLock()');await delay(180);
  const pauseHides=await evaluate('document.querySelector("#airSupport").hidden&&document.querySelector("#supportBanner").hidden');
  if(!pauseHides)throw Error('Sentry HUD overlaps pause');
  return {before,earned,samples,after,layouts,pauseHides,reduced,note:'Seven real gun kills, automatic server launch and 20s sampling. Private training, no gameplay-state injection; not human/iGPU qualification.'};
}
