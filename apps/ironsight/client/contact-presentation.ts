import { botLabel } from '../src/bot-roles.js';
import { BOT_CONTACT, type TeamPing } from '../src/ping.js';

/** Direction to a frozen report, relative to the listener's current view. */
export function contactText(ping: TeamPing, me: { x: number; z: number }, yaw: number,
  callout: string, serverNow: number): string {
  const dx = ping.x - me.x, dz = ping.z - me.z;
  const angle = Math.atan2(Math.sin(Math.atan2(dx, dz) - yaw), Math.cos(Math.atan2(dx, dz) - yaw));
  const direction = Math.abs(angle) <= Math.PI / 4 ? 'AHEAD' : Math.abs(angle) >= Math.PI * 3 / 4 ? 'BEHIND' : angle > 0 ? 'RIGHT' : 'LEFT';
  const age = Math.max(0, (serverNow - (ping.expiresAt - BOT_CONTACT.lifetimeMs)) / 1000);
  return `${botLabel(ping.from) ?? 'ALLY'} / CONTACT\n${callout} / ${direction} / ${Math.round(Math.hypot(dx, dz))} m\nLAST SEEN ${age.toFixed(1)} s AGO`;
}
