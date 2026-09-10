/** Presentation metres only. Source scale and grip calibration remain together;
 * translating the entire fitted assembly preserves every animated hand contact. */
export const VIEWMODEL_FITS = [
  { advance: .12, x: .27, y: -.22, z: -.40, adsZ: -.38, adsFov: 56 },
  { advance: .14, x: .25, y: -.20, z: -.40, adsZ: -.38, adsFov: 59 },
  { advance: .14, x: .27, y: -.22, z: -.40, adsZ: -.38, adsFov: 60 },
  { advance: .14, x: .27, y: -.22, z: -.43, adsZ: -.38, adsFov: 40 },
  { advance: .18, x: .23, y: -.21, z: -.38, adsZ: -.38, adsFov: 59 },
] as const;
export const VIEWMODEL_HIP_FOV = 74;

/** Camera-local XY compensation gives exactly the selected weapon projection in
 * the existing world pass. Z/depth testing and the world aiming ray are retained.
 * Apply above all animated transforms, including hands and muzzle attachments. */
export function viewmodelProjectionScale(worldFov: number, weaponFov: number): number {
  return Math.tan(worldFov * Math.PI / 360) / Math.tan(weaponFov * Math.PI / 360);
}
