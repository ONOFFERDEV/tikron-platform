export type DamageDirection = 'front' | 'right' | 'back' | 'left';

/** World yaw uses +z forward, +x right; keep the cue oriented while looking around. */
export function damageDirection(bearing: number, yaw: number): DamageDirection {
  const angle = Math.atan2(Math.sin(bearing - yaw), Math.cos(bearing - yaw));
  if (Math.abs(angle) <= Math.PI / 4) return 'front';
  if (Math.abs(angle) >= 3 * Math.PI / 4) return 'back';
  return angle > 0 ? 'right' : 'left';
}
