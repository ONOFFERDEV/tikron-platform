import { afterEach, expect, it, vi } from 'vitest';
// @ts-expect-error -- opt-in Node telemetry, shared Workers-only test tsconfig
import { writeFile } from 'node:fs/promises';
import { createTestRoom } from '@tikron/server/testing';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema, type ArenaState } from '../src/schema.js';
import type { BotBrain } from '../src/bots.js';
import type { BotNavigator } from '../src/rooms/bot-navigation.js';
import type { MapDef } from '../src/map/types.js';
declare const process: { env: Record<string,string|undefined> };
const wallNow = performance.now.bind(performance); // retain real time across fake game timers
afterEach(()=>{vi.clearAllTimers();vi.restoreAllMocks();vi.useRealTimers();});

it.skipIf(!process.env.BOT_NAV_REPORT)('records natural all-map routes, rooftop combat and tick cost',async()=>{
  vi.useFakeTimers();vi.setSystemTime(1_000_000);
  class Round extends ArenaRoomImpl { protected override startInWarmup=false; }
  const reports=[];
  for(const mode of ['tdm','dom','ffa']) {
    const started=wallNow();
    const h=await createTestRoom(Round,{id:`arena-${mode}`,codec:ArenaSchema,sync:'throttled'});
    const setupMs=wallNow()-started;
    const r=h.room as unknown as {state:ArenaState;botBrains:Map<string,BotBrain>;map:MapDef;
      navigator:BotNavigator;tickBots:(dt:number)=>void};
    const times:number[]=[],original=r.tickBots.bind(r);
    vi.spyOn(r,'tickBots').mockImplementation(dt=>{const before=wallNow();original(dt);times.push(wallNow()-before);});
    const bots:Record<string,{role:string;roofTicks:number;rampTicks:number;interiorTicks:number;lowerTicks:number;
      holdTicks:number;roofKills:number;maxY:number;minY:number;kills:number;lastKills:number}>={};
    for(let tick=0;tick<3600 && r.state.phase!=='ended';tick++) {
      await h.advance(50);
      for(const [id,brain] of r.botBrains) {
        const p=r.state.players[id];if(!p||!brain.archetype)continue;
        const row=bots[id]??={role:brain.archetype,roofTicks:0,rampTicks:0,interiorTicks:0,lowerTicks:0,holdTicks:0,
          roofKills:0,maxY:p.y,minY:p.y,kills:0,lastKills:0};
        if(p.alive) {
          row.maxY=Math.max(row.maxY,p.y);row.minY=Math.min(row.minY,p.y);
          if(p.y>=2.99&&p.y<3.1){row.roofTicks++;row.roofKills+=Math.max(0,p.k-row.lastKills);}
          if(p.y>.1&&p.y<2.9)row.rampTicks++;
          if(p.y<-.2)row.lowerTicks++;
          if(r.map.structures?.some(s=>p.x>s.footprint.minX&&p.x<s.footprint.maxX&&p.z>s.footprint.minZ&&p.z<s.footprint.maxZ&&p.y<.1))row.interiorTicks++;
          if(brain.positioning?.holdUntilMs)row.holdTicks++;
        }
        row.lastKills=p.k;row.kills=p.k;
      }
    }
    times.sort((a,b)=>a-b);
    reports.push({mode,setupMs,ticks:times.length,botTickMs:{p50:times[Math.floor(times.length*.5)],
      p95:times[Math.floor(times.length*.95)],max:times.at(-1)},navigation:r.navigator.stats,bots});
    vi.clearAllTimers();vi.restoreAllMocks();
  }
  await writeFile('.inspect/combat-s5-natural-routes-verified.json',JSON.stringify(reports,null,2));
  for(const r of reports) {
    // DOM's current flags and authored approaches are ground-level. Objective
    // priority must not be weakened just to manufacture rooftop telemetry.
    // Its actual deck ascent/descent is separately required by the route test.
    if(r.mode!=='dom')expect(Object.values(r.bots).some(b=>b.roofTicks>10),r.mode+' roof use').toBe(true);
    expect(Object.values(r.bots).reduce((n,b)=>n+b.kills,0),r.mode+' combat').toBeGreaterThan(0);
  }
  expect(Object.values(reports[0]!.bots).some(b=>b.interiorTicks>20)).toBe(true);
},120000);
