/** A clock estimate is presentation only; zero never starts a local round. */
export function intermissionLabel(deadline: number | undefined, serverNow: number): string {
  if (!Number.isFinite(deadline) || !deadline || !Number.isFinite(serverNow)) return 'AUTOMATIC / STAND BY';
  const seconds = Math.max(0, Math.ceil((deadline - serverNow) / 1000));
  return seconds > 0 ? `IN ${seconds}s` : 'AWAITING SERVER';
}
