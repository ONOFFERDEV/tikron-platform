import { COPY, formatCopy } from './ui/copy.js';

export type IntermissionStatus =
  | { readonly kind: "automatic" }
  | { readonly kind: "scheduled"; readonly seconds: number }
  | { readonly kind: "awaiting-server" };

/** A clock estimate is presentation only; zero never starts a local round. */
export function intermissionStatus(deadline: number | undefined, serverNow: number): IntermissionStatus {
  if (!Number.isFinite(deadline) || !deadline || !Number.isFinite(serverNow)) return { kind: "automatic" };
  const seconds = Math.max(0, Math.ceil((deadline - serverNow) / 1000));
  return seconds > 0 ? { kind: "scheduled", seconds } : { kind: "awaiting-server" };
}

export function intermissionLabel(deadline: number | undefined, serverNow: number): string {
  return intermissionStatusLabel(intermissionStatus(deadline, serverNow));
}

export function intermissionStatusLabel(status: IntermissionStatus): string {
  switch (status.kind) {
    case "automatic": return COPY.intermission.automatic;
    case "scheduled": return formatCopy(COPY.intermission.inFmt, { seconds: status.seconds });
    case "awaiting-server": return COPY.intermission.awaitingServer;
  }
}
