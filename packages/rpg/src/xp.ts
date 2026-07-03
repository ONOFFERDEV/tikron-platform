/**
 * Experience — level-curve lookup and the kill-exp level-diff falloff. Pure: the engine
 * owns a unit's running xp total and asks these functions what level it maps to and how
 * much a kill is worth.
 */

/** Default per-victim-level base exp before the falloff multiplier. */
export const DEFAULT_KILL_EXP_PER_LEVEL = 50;
/** Default top level of the built-in curve. */
export const DEFAULT_MAX_LEVEL = 60;

/**
 * A default cumulative curve: `curve[L]` = total xp required to REACH level `L`
 * (`curve[1] = 0`). The step from L to L+1 costs `L*100`, so early levels are quick and
 * later ones ramp linearly. Index 0 is unused.
 */
export function defaultLevelCurve(maxLevel = DEFAULT_MAX_LEVEL): number[] {
  const curve: number[] = [0, 0];
  for (let L = 2; L <= maxLevel; L++) {
    curve[L] = curve[L - 1]! + (L - 1) * 100;
  }
  return curve;
}

/**
 * The highest level whose cumulative threshold is at or below `xp`, clamped to the
 * curve's top. Level is never below 1.
 */
export function levelForXp(curve: readonly number[], xp: number): number {
  let level = 1;
  for (let L = 2; L < curve.length; L++) {
    if (xp >= curve[L]!) level = L;
    else break;
  }
  return level;
}

/**
 * Exp granted for a kill. Level difference `victim − killer` scales the base by
 * `1 + 0.1·diff` (a higher victim is worth more, a lower one less), floored at 0; a gap
 * of 10+ levels either way yields 0. Multiplied by the victim's `expMultiplier`.
 */
export function killExp(
  killerLevel: number,
  victimLevel: number,
  expMultiplier = 1,
  basePerLevel = DEFAULT_KILL_EXP_PER_LEVEL,
): number {
  const diff = victimLevel - killerLevel;
  if (Math.abs(diff) >= 10) return 0;
  const factor = Math.max(0, 1 + 0.1 * diff);
  return Math.round(victimLevel * basePerLevel * factor * expMultiplier);
}
