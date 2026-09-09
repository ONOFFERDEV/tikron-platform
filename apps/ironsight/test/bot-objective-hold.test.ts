import { describe, expect, it } from 'vitest';
import { alertBot, botThink, createBotBrain, resetBotPerception, type BotView } from '../src/bots.js';

const brain = () => createBotBrain({seed:68,waypoints:[{x:20,y:90}],aimNoiseRad:0,reactionMs:150});
const view = (): BotView => ({self:{x:20,y:0,z:70,yaw:0,pitch:0,team:0,alive:true,crouch:false},
  enemies:[{id:'enemy',x:20,y:0,z:75,team:1,alive:true,crouch:false}],
  objective:{x:20,z:70},teamless:false,boxes:[],engagementRange:40});
function advance(v: BotView, b: ReturnType<typeof brain>, ms=50) {
  const d=botThink(v,b,ms),{mx,mz}=d.move;
  v.self.x+=(mz*Math.sin(d.look.yaw)+mx*Math.cos(d.look.yaw))*6*ms/1000;
  v.self.z+=(mz*Math.cos(d.look.yaw)-mx*Math.sin(d.look.yaw))*6*ms/1000;
  v.self.yaw=d.look.yaw;v.self.pitch=d.look.pitch;
  return d;
}

describe('objective hold and counter',()=>{
  it('keeps a close flag duel in its capture court instead of retreating toward z=11',()=>{
    const b=brain(),v=view();let max=0;
    for(let i=0;i<120;i++) {advance(v,b);max=Math.max(max,Math.hypot(v.self.x-20,v.self.z-70));}
    expect(max).toBeLessThan(2);
    expect(v.self.z).toBeGreaterThan(68);
  });
  it('anchors an en-route duel when it becomes close, then releases on loss, reassignment and death',()=>{
    const b=brain(),v=view();v.objective={x:20,z:95};v.enemies=[{...v.enemies[0]!,z:90}];
    // First sight is distant; the capture push must continue before a local duel starts.
    for(let i=0;i<25;i++)advance(v,b);
    v.enemies=[{...v.enemies[0]!,z:v.self.z+5}];const at=v.self.z;
    for(let i=0;i<50;i++)advance(v,b);
    expect(Math.abs(v.self.z-at)).toBeLessThan(2);
    v.enemies=[];advance(v,b);expect(b.objectiveDuel).toBeUndefined();
    v.enemies=[{id:'other',x:v.self.x,y:0,z:v.self.z+5,team:1,alive:true,crouch:false}];advance(v,b);
    expect(b.objectiveDuel).toBeDefined();v.objective={x:30,z:95};advance(v,b);
    expect(b.objectiveDuel?.objectiveX).toBe(30);
    resetBotPerception(b);expect(b.objectiveDuel).toBeUndefined();
  });
  it('watches a public approach with a bounded sweep, leaving a silent rear flank unseen',()=>{
    const b=brain(),v=view();v.objectiveWatch={x:20,z:100};
    v.enemies=[{...v.enemies[0]!,z:60}];let previous=0,maxTurn=0;
    for(let i=0;i<160;i++) {
      const d=advance(v,b),signed=Math.atan2(Math.sin(d.look.yaw),Math.cos(d.look.yaw));
      maxTurn=Math.max(maxTurn,Math.abs(Math.atan2(Math.sin(d.look.yaw-previous),Math.cos(d.look.yaw-previous))));
      previous=d.look.yaw;
      expect(Math.abs(signed)).toBeLessThanOrEqual(Math.PI/6+.01);
      expect(d.fire).toBe(false);expect(b.lockId).toBeNull();
    }
    expect(maxTurn).toBeLessThanOrEqual(.301);
    alertBot(b,{x:20,z:60},true);
    const first=advance(v,b);expect(first.fire).toBe(false);
    let acquired=false;
    for(let i=0;i<20;i++) {advance(v,b);acquired ||= b.lockId==='enemy';}
    expect(acquired).toBe(true);
  });
  it('does not grant sight through cover or skip the reaction delay when a guard acquires',()=>{
    const b=brain(),v=view();v.objectiveWatch={x:20,z:100};
    v.boxes=[{min:{x:18,y:0,z:72},max:{x:22,y:3,z:73}}];
    for(let i=0;i<20;i++)expect(advance(v,b).fire).toBe(false);
    expect(b.lockId).toBeNull();v.boxes=[];v.self.yaw=0;
    expect(advance(v,b).fire).toBe(false);expect(b.lockMs).toBe(0);
    advance(v,b);advance(v,b);expect(b.lockMs).toBe(100);
    expect(advance(v,b).fire).toBe(true);
  });
});
