import { BOT_CONTACT, type TeamPing } from '../ping.js';
import { botReached, combatBotArchetype, nearestVisibleEnemy,
  type BotBrain, type BotDecision, type BotView, type SquadBark, type SquadPing } from '../bots.js';

/** One channel for contact intelligence and tactical barks. Decisions are
 * sampled after normal fire/reload validation. Busy transitions are discarded,
 * never queued to announce a reload or position after it has ceased to apply. */
export class BotRadio {
  private readonly teams = new Map<number, number>();
  private readonly callers = new Map<string, number>();
  private readonly actions = new Map<string, SquadBark | undefined>();
  clear(): void { this.teams.clear(); this.callers.clear(); this.actions.clear(); }
  remove(id: string): void { this.callers.delete(id); this.actions.delete(id); }
  yieldToHuman(team: number, now: number, lifetimeMs: number): void {
    this.teams.set(team, Math.max(this.teams.get(team) ?? 0, now + lifetimeMs));
  }
  observe(id: string, view: BotView, brain: BotBrain, now: number, decision?: BotDecision,
    accepted: { reloading: boolean; fired: boolean } = { reloading: false, fired: false }): SquadPing | undefined {
    if (!view.self.alive || view.teamless || view.showcase || !combatBotArchetype(id)) return;
    let action: SquadBark | undefined;
    if (accepted.reloading) action = 'reload';
    else if (decision?.tactic === 'retreat' && brain.recovery?.reason === 'retreat') action = 'retreat';
    else if (decision?.tactic === 'hold' && brain.positioning?.holdUntilMs &&
      brain.positioning.point.y > 1 && botReached(view.self, brain.positioning.point, 1.3)) action = 'highGround';
    else if (brain.flank && decision?.tactic === 'flank' && Math.hypot(decision.move.mx, decision.move.mz) > .1) action = 'flank';
    const changed = this.actions.get(id) !== action;
    this.actions.set(id, action);
    if (now < (this.teams.get(view.self.team) ?? 0) || now < (this.callers.get(id) ?? 0)) return;

    // Use the brain's own settled observation, then independently recheck LOS,
    // facing, team and range. Neither a sound nor remembered cover threat counts.
    const target = brain.lockId && brain.lockMs >= BOT_CONTACT.observeMs
      ? nearestVisibleEnemy(view.self, view.enemies.filter(p => p.id === brain.lockId),
        brain.aimHeight, false, view.boxes, view.engagementRange, brain.lockId) : null;
    let radio: SquadBark;
    let point: { x: number; z: number };
    let kind: TeamPing['kind'];
    // A new reload/retreat takes precedence over another contact. Suppression
    // requires both current sight and an actually accepted weapon discharge.
    if (changed && action && brain.clockMs >= 2500) {
      radio = action; point = view.self;
      kind = action === 'reload' || action === 'retreat' ? 'backup' : 'go';
    } else if (target) {
      radio = brain.archetype === 'support' && decision?.tactic === 'suppress' && accepted.fired
        ? 'suppress' : 'contact';
      point = target; kind = 'enemy';
    } else return;
    this.teams.set(view.self.team, now + BOT_CONTACT.teamCooldownMs);
    this.callers.set(id, now + BOT_CONTACT.callerCooldownMs);
    return { from: id, kind, radio, x: Math.round(point.x), z: Math.round(point.z),
      expiresAt: now + BOT_CONTACT.lifetimeMs, ...(kind === 'enemy' ? { contact: true as const } : {}) };
  }
}
