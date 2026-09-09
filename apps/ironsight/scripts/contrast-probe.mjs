import { rolesProbe } from './roles-probe.mjs';

/** Actual settings keyboard inputs and ordinary bot-round navigation. */
export async function contrastProbe({send,evaluate,waitFor,delay,click,capture,teamless=false}) {
  const key = async (key, code=key, windowsVirtualKeyCode=0) => {
    await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode});
  };
  const snapshot = () => evaluate(`(()=>{const I=window.ironsight,s=I.state();return {
    me:s.players[I.myId],mode:s.mode,actors:I.actorAppearance(),render:I.renderInfo(),
    preference:JSON.parse(localStorage.getItem('ironsight.settings.v1')??'{}').enemyHighlight};})()`);
  const samples=[];
  await waitFor('window.ironsight.state().phase === "live"');
  await delay(500);
  for (const [index,color] of ['team','yellow','violet','team','yellow'].entries()) {
    await evaluate('document.exitPointerLock()');
    await waitFor('!!document.querySelector("#quitConfirm .row button:nth-child(2)")');
    await click('#quitConfirm .row button:nth-child(2)');
    await waitFor('!!document.querySelector("[data-setting=enemy-highlight]")');
    const prior=await snapshot();
    await evaluate('document.querySelector("[data-setting=enemy-highlight]").focus()');
    await key('Home','Home',36);
    for(let i=0;i<['team','yellow','violet'].indexOf(color);i++)await key('ArrowDown','ArrowDown',40);
    await key('Enter','Enter',13);
    await delay(150);
    const selected=await evaluate('document.querySelector("[data-setting=enemy-highlight]").value');
    if(selected!==color)throw Error(`Settings keyboard selection failed: ${selected} != ${color}`);
    if(index===1) {
      for(const [width,height] of [[1920,1080],[800,600]]) {
        await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
        await evaluate('document.querySelector("[data-setting=enemy-highlight]").scrollIntoView({block:"center"})');
        await delay(100);
        const fits=await evaluate('(()=>{const r=document.querySelector("[data-setting=enemy-highlight]").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;})()');
        if(!fits)throw Error('Enemy colour control clipped');
        await capture(`contrast-settings-${width}`);
      }
      await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
    }
    await key('Escape','Escape',27);
    await waitFor('!document.querySelector("#settingsPanel")');
    await click('#quitConfirm .row button:first-child');
    await waitFor('!!document.pointerLockElement');
    await delay(250);
    const after=await snapshot();
    if(color!=='team'&&after.preference!==color)throw Error('Colour was not saved');
    for(const actor of after.actors) {
      const priorActor=prior.actors.find(a=>a.id===actor.id);
      const hostile=teamless||actor.team!==after.me.team;
      if(!actor.depthTest)throw Error('Actor lost opaque depth testing');
      if(priorActor&&JSON.stringify(priorActor.versions)!==JSON.stringify(actor.versions))throw Error('Colour rebuilt material');
      if(color!=='team'&&hostile&&actor.colors.some(c=>c!==(color==='yellow'?0xffdf55:0xd995ff)))throw Error('Enemy colour missing');
      if(!hostile&&priorActor&&JSON.stringify(priorActor.colors)!==JSON.stringify(actor.colors))throw Error('Ally colour changed');
    }
    if(after.render.programs!==prior.render.programs)throw Error('Colour switch changed shader count');
    samples.push({color,prior,after});
    await capture(`contrast-live-${index}-${color}`);
  }
  const round=teamless ? null : await rolesProbe({send,evaluate,waitFor,delay,capture});
  return {samples,round,note:'Real settings keyboard inputs, then ordinary 20-second bot TDM navigation. Enemy-only overrides, depth state and shader/material stability checked. No gameplay-state injection.'};
}
