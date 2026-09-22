export interface HitAnimationStamp {
  readonly clip: string;
  readonly startedAtMs: number;
}

export interface HitAnimationSample {
  readonly clip: string;
  readonly timeSeconds: number;
}

export function advanceHitAnimationStamp(
  previous: HitAnimationStamp | undefined,
  clip: string,
  serverNowMs: number,
  forceRestart: boolean,
): HitAnimationStamp | undefined {
  if (clip.length === 0 || !Number.isFinite(serverNowMs)) return undefined;
  if (!forceRestart && previous?.clip === clip) return previous;
  return { clip, startedAtMs: serverNowMs };
}

export function sampleLoopingHitAnimation(
  stamp: HitAnimationStamp,
  serverNowMs: number,
  durationSeconds: number | undefined,
): HitAnimationSample | undefined {
  if (!Number.isFinite(stamp.startedAtMs) || !Number.isFinite(serverNowMs)
    || durationSeconds === undefined || !Number.isFinite(durationSeconds) || durationSeconds <= 0
    || serverNowMs < stamp.startedAtMs) return undefined;
  const elapsedSeconds = (serverNowMs - stamp.startedAtMs) / 1000;
  const timeSeconds = elapsedSeconds % durationSeconds;
  return { clip: stamp.clip, timeSeconds };
}

export function selectHitAnimationSnap<T>(
  before: T,
  after: T,
  sampledServerTimeMs: number,
  transitionAtMs: number,
): T | undefined {
  if (!Number.isFinite(sampledServerTimeMs) || !Number.isFinite(transitionAtMs)) return undefined;
  return sampledServerTimeMs < transitionAtMs ? before : after;
}
