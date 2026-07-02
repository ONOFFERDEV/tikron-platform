import type { ReactNode } from "react";

/** Inline error panel with an optional retry. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state state-error" role="alert">
      <span className="state-title">Something went wrong</span>
      <span className="state-body">{message}</span>
      {onRetry && (
        <button className="btn btn-ghost" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

/** Shown when the gateway origin couldn't be reached at all. */
export function GatewayUnreachable({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="state state-error" role="alert">
      <span className="state-title">Gateway unreachable</span>
      <span className="state-body">
        Couldn&apos;t reach the PlayEdge gateway. Start it with{" "}
        <code>pnpm --filter @playedge/gateway dev</code> and try again.
      </span>
      {onRetry && (
        <button className="btn btn-ghost" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

/** Neutral empty state with a headline, supporting copy, and optional action. */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="state state-empty">
      <span className="state-title">{title}</span>
      {children && <div className="state-body">{children}</div>}
      {action}
    </div>
  );
}
