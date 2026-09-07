export interface SoundPoint { x: number; y: number; z: number }
/** Camera yaw zero faces +Z; screen-right is -X in this game's view. */
export function spatialMix(source: SoundPoint, listener: SoundPoint, yaw: number, range = 55) {
  const dx = source.x - listener.x, dz = source.z - listener.z;
  const distance = Math.hypot(dx, source.y - listener.y, dz);
  const horizontal = Math.hypot(dx, dz);
  return {
    pan: horizontal > 0.001 ? Math.max(-1, Math.min(1, (-dx * Math.cos(yaw) + dz * Math.sin(yaw)) / horizontal)) : 0,
    gain: distance >= range ? 0 : Math.min(1, 5 / Math.max(5, distance)) * (1 - distance / range),
    cutoff: 900 + 6500 * Math.max(0, 1 - distance / range),
  };
}
