import { PLAYER } from './config.js';

export const AMBUSH_WINDOW_MS = 2500;

/** Server current-pose rule, not a claim that the victim never saw the attacker.
 * The opening hit must be >=120 degrees behind a full-health victim, >=2m away. */
export function ambushOpening(victim: { x:number; z:number; yaw:number; hp:number },
  attacker: { x:number; z:number } | undefined): boolean {
  if (!attacker || victim.hp !== PLAYER.maxHp) return false;
  const dx=attacker.x-victim.x,dz=attacker.z-victim.z;
  if (Math.hypot(dx,dz)<2) return false;
  const delta=Math.atan2(dx,dz)-victim.yaw;
  return Math.abs(Math.atan2(Math.sin(delta),Math.cos(delta)))>=Math.PI*2/3;
}
