import type { WeaponKey } from "../src/weapon-contract.js";

export type WeaponContactFrame = {
  readonly source: "root" | "magazine" | "pump" | "shell" | "bolt" | "clip" | "slide";
  readonly position: readonly [number, number, number];
  readonly quaternion: readonly [number, number, number, number];
};

type ContactFrames = Readonly<Record<string, WeaponContactFrame>>;
const contactFrames = (value: ContactFrames): ContactFrames => Object.freeze(value);
const FLIP_X: readonly [number, number, number, number] = [1, 0, 0, 0];
const IDENTITY: readonly [number, number, number, number] = [0, 0, 0, 1];

/** Exact frozen-v3 surface samples from contact-frames-v1.json.
 * Positions are local to source; quaternions use glTF/Three xyzw ordering. */
export const WEAPON_CONTACT_FRAMES: Readonly<Record<WeaponKey, ContactFrames>> = Object.freeze({
  automatic_rifle: contactFrames({
    grip_r: { source: "root", position: [.052, .014, .01399997], quaternion: FLIP_X },
    grip_l: { source: "root", position: [.045, .02, .37], quaternion: [-.70710678, 0, 0, .70710678] },
    magwell: { source: "root", position: [.035, -.01, .14], quaternion: FLIP_X },
    magazine: { source: "magazine", position: [.035, 0, 1e-8], quaternion: FLIP_X },
  }),
  trench_smg: contactFrames({
    grip_r: { source: "root", position: [.038, 0, 0], quaternion: FLIP_X },
    grip_l: { source: "root", position: [.04804173, .05510046, .31999999],
      quaternion: [-.69945342, .10375409, -.10375408, .69945342] },
    magwell: { source: "root", position: [.028, .01, .17], quaternion: FLIP_X },
    magazine: { source: "magazine", position: [.028, 0, 1e-8], quaternion: FLIP_X },
  }),
  pump_shotgun: contactFrames({
    grip_r: { source: "root", position: [.052, .017, .014], quaternion: FLIP_X },
    pump: { source: "pump", position: [.04609691, .01083075, 0],
      quaternion: [-.70625504, .03469611, -.03469611, .70625504] },
    grip_l: { source: "pump", position: [.04609691, .01083075, 0],
      quaternion: [-.70625504, .03469611, -.03469611, .70625504] },
    chamber: { source: "root", position: [.04223879, .01882683, .17249998],
      quaternion: [.99518474, .09801699, 0, 0] },
    shell: { source: "shell", position: [.04223879, -.04617317, -.0575],
      quaternion: [.99518474, .09801699, 0, 0] },
  }),
  bolt_service_rifle: contactFrames({
    grip_r: { source: "root", position: [.045, 0, 0], quaternion: FLIP_X },
    grip_l: { source: "root", position: [.038, .015, .44],
      quaternion: [-.70710678, 0, 0, .70710678] },
    bolt_hand: { source: "bolt", position: [.11, -.015, -.19], quaternion: FLIP_X },
    clip: { source: "clip", position: [.035, 0, 0], quaternion: IDENTITY },
  }),
  service_pistol: contactFrames({
    grip_r: { source: "root", position: [.026, 0, .005], quaternion: FLIP_X },
    grip_l: { source: "root", position: [.024, .045, .028],
      quaternion: [-.70710678, 0, 0, .70710678] },
    magwell: { source: "root", position: [.014, -.025, 0], quaternion: FLIP_X },
    magazine: { source: "magazine", position: [.014, 0, 0], quaternion: FLIP_X },
    chamber: { source: "root", position: [.0225, .098, .108],
      quaternion: [-.70710678, 0, 0, .70710678] },
    slide: { source: "slide", position: [.0225, -1e-8, 1e-8],
      quaternion: [-.70710678, 0, 0, .70710678] },
  }),
});

export const VIEWMODEL_WEAPON_SCALE: Readonly<Record<WeaponKey, number>> = Object.freeze({
  automatic_rifle: .65,
  trench_smg: .75,
  pump_shotgun: .5,
  bolt_service_rifle: .38,
  service_pistol: .85,
});
