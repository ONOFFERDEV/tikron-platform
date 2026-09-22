import {
  createStage33HitProvider,
  type Stage33HitProvider,
} from "../../src/stage33-hit-calibration.js";

const provider = createStage33HitProvider();
if (provider === undefined) throw new Error("checked-in Stage33 HIT data failed schema verification");
export const stage33HitProvider: Stage33HitProvider = provider;
