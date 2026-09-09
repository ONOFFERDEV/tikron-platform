import { nearestVisibleEnemy, type BotBrain, type BotView } from './bots.js';
import { BOT_CONTACT, type TeamPing } from './ping.js';
export { BOT_CONTACT } from './ping.js';

/** Radio reports reuse actual visual acquisition. No random numbers, tracking
 * tags, hearing-to-vision conversion, or orders fed back into the bot brains. */
export class BotContacts {
  private readonly teams = new Map<number, number>();
  private readonly callers = new Map<string, number>();
  clear(): void { this.teams.clear(); this.callers.clear(); }
  remove(id: string): void { this.callers.delete(id); }
  yieldToHuman(team: number, now: number, lifetimeMs: number): void {
    this.teams.set(team, Math.max(this.teams.get(team) ?? 0, now + lifetimeMs));
  }
  observe(id: string, view: BotView, brain: BotBrain, now: number): TeamPing | undefined {
    if (!view.self.alive || view.teamless || view.showcase || !brain.lockId || brain.lockMs < BOT_CONTACT.observeMs ||
      now < (this.teams.get(view.self.team) ?? 0) || now < (this.callers.get(id) ?? 0)) return;
    // Recheck the locked target against current cover/facing, even when called
    // independently of botThink. Hearing memory alone can never emit a report.
    const target = nearestVisibleEnemy(view.self, view.enemies.filter(p => p.id === brain.lockId),
      brain.aimHeight, false, view.boxes, view.engagementRange, brain.lockId);
    if (!target) return;
    this.teams.set(view.self.team, now + BOT_CONTACT.teamCooldownMs);
    this.callers.set(id, now + BOT_CONTACT.callerCooldownMs);
    return { from: id, kind: 'enemy', contact: true, x: Math.round(target.x), z: Math.round(target.z),
      expiresAt: now + BOT_CONTACT.lifetimeMs };
  }
}
