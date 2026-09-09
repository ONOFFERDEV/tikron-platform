/** Stable identities shared by the room and presentation. Paired seats distribute
 * each role to both teams in a normally alternating twelve-seat fill. No stat buffs. */
export const BOT_ROLES = {
  rusher: { label: 'RUSH', weapon: 1 },
  anchor: { label: 'ANCHOR', weapon: 0 },
  sniper: { label: 'SCOUT', weapon: 3 },
} as const;
export type BotRole = keyof typeof BOT_ROLES;
const ROTATION: readonly BotRole[] = ['rusher', 'anchor', 'sniper'];

export function botRole(id: string): BotRole | undefined {
  if (!/^bot-[1-9]\d*$/.test(id)) return undefined;
  const n = Number(id.slice(4));
  if (!Number.isSafeInteger(n)) return undefined;
  return ROTATION[Math.floor((n - 1) / 2) % ROTATION.length];
}

export function botLabel(id: string): string | undefined {
  const role = botRole(id);
  return role ? `${BOT_ROLES[role].label} ${id.slice(4)}` : undefined;
}
