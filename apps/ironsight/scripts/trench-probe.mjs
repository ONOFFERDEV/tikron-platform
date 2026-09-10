import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

/** Real Worker/cold codec, ordinary movement/aim/fire/grenade inputs only. */
export async function trenchProbe({ send, evaluate, delay, capture, record, east = false }) {
  const bundle=await build({stdin:{contents:`
    import { ARENA1 } from './src/map/arena1.js';
    import { GroundNavigator } from './src/map/navigation.js';
    const nav=new GroundNavigator(ARENA1);export const next=(from,to)=>nav.next(from,to);
  `,resolveDir:fileURLToPath(new URL('..',import.meta.url))},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
  const {next}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  const key=(type,key='w',code='KeyW',windowsVirtualKeyCode=87)=>send('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode});
  const snapshot=()=>evaluate(`(()=>{const I=window.ironsight;return{me:I.state().players[I.myId],camera:I.camPos(),movement:I.movementInfo()}})()`);
  const report={east,note:'Normal training input route. No player/bot/health/clock/event mutation. Traverse both end ramps, baffles and the bridge underpass; throw and fire below grade.',samples:[],stages:[]};
  let started=Date.now();
  const travel=async goal=>{
    const deadline=Date.now()+50000;
    try {for(;;){
      const sample=await snapshot(),p=sample.me;report.samples.push({atMs:Date.now()-started,...sample});
      if(Math.hypot(p.x-goal.x,p.z-goal.z)<.22)break;
      if(!p.alive||Date.now()>deadline)throw Error(`Trench traversal stalled: ${JSON.stringify({p,goal})}`);
      const target=next(p,goal);
      await evaluate(`window.ironsight.look(${Math.atan2(target.x-p.x,target.z-p.z)},0)`);
      await key('keyDown');await delay(30);
    }}finally{await key('keyUp');}
    await delay(150);
  };
  const stage=async(label,target)=>{
    const p=(await snapshot()).me,dx=target.x-p.x,dz=target.z-p.z;
    await evaluate(`window.ironsight.look(${Math.atan2(dx,dz)},${Math.atan2(target.y-(p.y+1.65),Math.hypot(dx,dz))})`);
    await delay(180);const sample=await snapshot();report.stages.push({label,atMs:Date.now()-started,...sample});
    await capture(`trench-${label}`);await record(report);return sample;
  };
  const point=p=>east?{...p,x:150-p.x,z:152-p.z}:p;
  try {
    await travel(point({x:36,z:76}));report.approachMs=Date.now()-started;report.samples=[];started=Date.now();
    await stage('entry',point({x:50,y:-1.4,z:76}));
    await travel(point({x:43,z:76}));await stage('ramp',point({x:53,y:-1.35,z:76}));
    await travel(point({x:51,z:76}));
    const lower=await stage('lower',point({x:61,y:-1.4,z:77.6}));
    if(Math.abs(lower.me.y+3)>.02||Math.abs(lower.camera.y+1.35)>.15)throw Error('Negative floor/camera replication failed');
    await travel(point({x:57,z:77.6}));await travel(point({x:63,z:77.6}));
    await travel(point({x:71,z:76}));await stage('bridge',point({x:81,y:-1.3,z:76}));
    await travel(point({x:79,z:76}));await stage('fire',point({x:86,y:-2.7,z:74.4}));
    await send('Input.dispatchMouseEvent',{type:'mousePressed',x:960,y:540,button:'left',clickCount:1});await delay(450);
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:960,y:540,button:'left',clickCount:1});
    await key('keyDown','g','KeyG',71);await key('keyUp','g','KeyG',71);await delay(3300);
    await stage('after-grenade',point({x:88,y:-1.3,z:74.4}));
    await travel(point({x:87,z:74.4}));await travel(point({x:94,z:74.4}));await travel(point({x:102,z:76}));
    await stage('exit-ramp',point({x:114,y:1.4,z:76}));await travel(point({x:114,z:76}));
    const exit=await stage('yard',point({x:102,y:-1.3,z:76}));if(exit.me.y!==0)throw Error('Trench exit failed');
    if(Date.now()-started<20000)await delay(20000-(Date.now()-started));
    report.elapsedMs=Date.now()-started;report.passed=true;await record(report);return report;
  } finally {await key('keyUp');await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:960,y:540,button:'left',clickCount:1});}
}
