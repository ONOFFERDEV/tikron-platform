import rawData from "./generated/hit-rig-pose-data.json";
import type { Stage33Faction } from "./stage33-hit-calibration.js";

export interface HitRigClipData {
  readonly duration: number;
  readonly tracks: readonly {
    readonly name: string;
    readonly type: string;
    readonly times: readonly number[];
    readonly values: readonly number[];
  }[];
}

interface HitRigPoseData {
  readonly rig: {
    readonly bones: readonly {
      readonly name: string;
      readonly parent: string | null;
      readonly position: readonly number[];
      readonly quaternion: readonly number[];
      readonly scale: readonly number[];
    }[];
    readonly boneInverses: readonly (readonly number[])[];
    readonly bindMatrix: readonly number[];
    readonly meshMatrix: readonly number[];
    readonly clips: Readonly<Record<string, HitRigClipData>>;
  };
  readonly factions: Readonly<Record<Stage33Faction, {
    readonly glbSha256: string;
    readonly baseScale: number;
    readonly localMinY: number;
    readonly headLocalCenter: readonly number[];
    readonly headLocalRadius: number;
    readonly torso: {
      readonly positions: readonly number[];
      readonly joints: readonly number[];
      readonly weights: readonly number[];
    };
  }>>;
}

export const HIT_RIG_POSE_DATA: HitRigPoseData = rawData;
export const HIT_RIG_NORMALIZATION_SHA256 =
  "c78b21e423da0d57a737ed66b782c38c84d3b7f04036cc765308ea62e6a65387";
export const HIT_RIG_COMPONENT_SHA256: Readonly<Record<Stage33Faction, string>> = {
  khaki: "94493e3e0d27d4e7d2da0697f315312c6aec73540bc24e8bc6a3967881b71887",
  fieldgrey: "d51dcc3dbfc18fa34dbd641db38fb54b40d4df1f354954ea2938032fba619d47",
};
