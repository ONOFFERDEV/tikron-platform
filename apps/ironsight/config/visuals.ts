/** Presentation only. Distances in metres, angles in radians, rates per second. */
export const VISUALS = {
  exposure: 1.05, pixelRatio: 1.5,
  lighting: { hemisphere: 1.65, key: 2.1, ambient: 0.35 },
  skyZenith: 0x080f24,
  motion: {
    // AR, SMG, shotgun, sniper, pistol; a SINGLE camera-local rest transform.
    poses: [
      { x: 0.22, y: -0.20, z: -0.43, yaw: 0.12, pitch: 0.015 },
      { x: 0.20, y: -0.19, z: -0.42, yaw: 0.10, pitch: 0.01 },
      { x: 0.23, y: -0.21, z: -0.44, yaw: 0.13, pitch: 0.02 },
      { x: 0.22, y: -0.22, z: -0.46, yaw: 0.10, pitch: 0.01 },
      { x: 0.16, y: -0.17, z: -0.40, yaw: 0.06, pitch: 0.01 },
    ],
    bobAmplitude: 0.009, bobRate: 13, bobRoll: 0.012, speedResponse: 12,
    swayGain: 0.012, swayLimit: 0.025, swayResponse: 12,
    recoilSettleMs: 95, recoilBack: 0.065, recoilPitch: 0.13,
    adsResponse: 14, adsDepth: -0.40, adsMotion: 0.12, adsSightClearance: 0.012,
    swapDrop: 0.42, swapPitch: -0.65,
    breathAmplitude: 0.0015, breathRate: 1.8, hands: false,
  },
  // Attachment-only fallback: current locomotion clips have open, unarmed hands.
  // Enable the bounded reach explicitly in the inspector with &blend=0.85.
  remote: { holdBlend: 0, lengths: [0.72, 0.46, 0.82, 1.0, 0.30] },
};
