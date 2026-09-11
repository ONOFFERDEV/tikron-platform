/** Owner-only movement reconciliation. Positions travel server -> owner only.
 * Commands contain one fixed-step intent, never a position, velocity or dt.
 * Kept independent of the room runtime so the browser uses the same contract. */
import { SprintSlide } from '../slide.js';
import { WaistTraversal } from '../traversal.js';
import type { SlideInput } from '../slide.js';
import type { Vec3 } from '../physics.js';

export const MOVEMENT_SYNC = Object.freeze({ version: 1, maxPending: 8, maxBatch: 8, catchupTicks: 2 });
export interface MovementCommand extends SlideInput { seq: number; yaw: number }

// These existing shared controllers have ordinary TypeScript private data
// fields, no timers or engine resources. The adapter explicitly copies their
// data, including nested vectors; prototype methods never enter the wire.
// Round-trip tests cover active slide/vault/launch AND their cooldowns. Keep
// this adapter in sync if the map stream changes a controller's state shape.
interface SlideState {
  runMs: number; remainingMs: number; cooldownMs: number; held: boolean;
  direction: { x: number; z: number }; charging: boolean; stepMs: number; expectedTravel: number;
}
interface TraversalState {
  route: { start: Vec3; end: Vec3; top: number; kind: 'vault' | 'mantle' | 'launch' } | null;
  elapsed: number; cooldown: number;
}
export interface MovementState {
  pos: Vec3; vy: number; grounded: boolean; crouch: boolean;
  slide: SlideState; traversal: TraversalState;
}
export interface MovementSnapshot extends MovementState {
  version: 1; epoch: number; ack: number; tick: number; alive: boolean; coreOpen: boolean;
}

export function saveControllers(slide = new SprintSlide(), traversal = new WaistTraversal()) {
  const s = slide as unknown as SlideState, t = traversal as unknown as TraversalState;
  return {
    slide: { runMs:s.runMs, remainingMs:s.remainingMs, cooldownMs:s.cooldownMs, held:s.held,
      direction:{...s.direction}, charging:s.charging, stepMs:s.stepMs, expectedTravel:s.expectedTravel },
    traversal: { elapsed:t.elapsed, cooldown:t.cooldown,
      route:t.route ? {...t.route, start:{...t.route.start}, end:{...t.route.end}} : null },
  };
}
export function restoreControllers(s: Pick<MovementState, 'slide' | 'traversal'>) {
  return { slide:Object.assign(new SprintSlide(), {...s.slide, direction:{...s.slide.direction}}),
    traversal:Object.assign(new WaistTraversal(), {...s.traversal,
      route:s.traversal.route ? {...s.traversal.route, start:{...s.traversal.route.start}, end:{...s.traversal.route.end}} : null }) };
}

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const ordinal = (v: unknown): v is number => finite(v) && Number.isSafeInteger(v) && v >= 0;
const vector = (v: unknown): v is Vec3 => record(v) && finite(v.x) && finite(v.y) && finite(v.z);

export function readMovementBatch(payload: unknown): { epoch: number; commands: MovementCommand[] } | null {
  if (!record(payload) || !ordinal(payload.epoch) || !Array.isArray(payload.commands)
    || payload.commands.length < 1 || payload.commands.length > MOVEMENT_SYNC.maxBatch) return null;
  const commands: MovementCommand[] = [];
  for (const c of payload.commands) {
    if (!record(c) || !ordinal(c.seq) || c.seq < 1 || !finite(c.yaw) || Math.abs(c.yaw) > Math.PI * 2
      || !finite(c.mx) || Math.abs(c.mx) > 1 || !finite(c.mz) || Math.abs(c.mz) > 1
      || typeof c.jump !== 'boolean' || typeof c.crouch !== 'boolean' || typeof c.sprint !== 'boolean'
      || typeof c.ads !== 'boolean' || commands.length && c.seq <= commands[commands.length - 1]!.seq) return null;
    commands.push({seq:c.seq,yaw:c.yaw,mx:c.mx,mz:c.mz,jump:c.jump,crouch:c.crouch,sprint:c.sprint,ads:c.ads});
  }
  return {epoch:payload.epoch,commands};
}

export function isMovementSnapshot(p: unknown): p is MovementSnapshot {
  if (!record(p) || p.version !== MOVEMENT_SYNC.version || !ordinal(p.epoch) || !ordinal(p.ack)
    || !ordinal(p.tick) || !vector(p.pos) || !finite(p.vy) || typeof p.grounded !== 'boolean'
    || typeof p.crouch !== 'boolean' || typeof p.alive !== 'boolean' || typeof p.coreOpen !== 'boolean'
    || !record(p.slide) || !record(p.traversal)) return false;
  const s=p.slide, t=p.traversal;
  if (!['runMs','remainingMs','cooldownMs','stepMs','expectedTravel'].every(k=>finite(s[k]) && s[k]>=0)
    || typeof s.held!=='boolean' || typeof s.charging!=='boolean' || !record(s.direction)
    || !finite(s.direction.x) || !finite(s.direction.z) || !finite(t.elapsed) || t.elapsed<0
    || !finite(t.cooldown) || t.cooldown<0) return false;
  return t.route===null || record(t.route) && vector(t.route.start) && vector(t.route.end)
    && finite(t.route.top) && ['vault','mantle','launch'].includes(String(t.route.kind));
}

/** Bounded ordered inbox. Duplicates are retransmission, gaps wait for repair;
 * the server's elapsed-tick budget prevents batches buying extra movement. */
export class MovementInbox {
  ack = 0;
  private credit = 0;
  private lastAppliedAt = -Infinity;
  readonly commands = new Map<number, MovementCommand>();
  constructor(readonly epoch: number) {}

  /** Record execution, not receipt: duplicates and queued future commands
   * cannot keep a silent player suspended. Time is supplied by the server. */
  applied(now: number): void { this.lastAppliedAt = now; }
  /** A delayed server timer may run several ticks before the next transport
   * callback. After applying its available commands, allow at most ONE ordinary
   * timestep for the next command instead of adding idle gravity immediately
   * within that burst and then integrating the late command on top of it.
   * Silence beyond this bounded window still advances autonomous physics. */
  waitingForInput(now: number, stepMs: number): boolean {
    return now >= this.lastAppliedAt && now - this.lastAppliedAt < stepMs;
  }

  receive(commands: readonly MovementCommand[]): void {
    for (const c of commands) if (c.seq>this.ack && c.seq<=this.ack+MOVEMENT_SYNC.maxPending && !this.commands.has(c.seq))
      this.commands.set(c.seq,c);
  }
  next(): MovementCommand | undefined {
    const c=this.commands.get(this.ack+1);
    if(c){this.commands.delete(c.seq);this.ack=c.seq;}
    return c;
  }
  /** One unit of authority-owned elapsed time per tick. A late input may use
   * one previously missed ground tick, capped at the existing 100ms dt budget.
   * This repairs packet/timer phase gaps without accumulating permanent latency.
   * No client dt/timestamp participates in this budget. */
  advance(): MovementCommand[] {
    this.credit=Math.min(MOVEMENT_SYNC.catchupTicks,this.credit+1);
    const result:MovementCommand[]=[];
    while(this.credit>0){const c=this.next();if(!c)break;result.push(c);this.credit--;}
    return result;
  }
  /** When gravity/traversal advances autonomously, that tick is already spent. */
  spendIdleTick(): void { this.credit=Math.max(0,this.credit-1); }
}
