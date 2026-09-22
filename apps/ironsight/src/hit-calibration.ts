import type { Vec3 } from "./physics.js";

export interface SoldierHitVolume {
  readonly headCenter: Vec3;
  readonly bodyTopY: number;
}

export function rotateHitVolume(volume: SoldierHitVolume, yaw: number): SoldierHitVolume {
  return {
    headCenter: {
      x: volume.headCenter.x * Math.cos(yaw) + volume.headCenter.z * Math.sin(yaw),
      y: volume.headCenter.y,
      z: volume.headCenter.z * Math.cos(yaw) - volume.headCenter.x * Math.sin(yaw),
    },
    bodyTopY: volume.bodyTopY,
  };
}
