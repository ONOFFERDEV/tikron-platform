import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, isUnreachable } from "../api/client";

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  /** True when the failure was a gateway/network reachability problem. */
  unreachable: boolean;
  loading: boolean;
  /** Manual refetch (also used after mutations). */
  reload: () => void;
}

interface Options {
  /** Poll interval in ms. Omit/0 to fetch once. */
  intervalMs?: number;
  /** Skip fetching entirely (e.g. missing id). */
  enabled?: boolean;
}

/**
 * Runs `fetcher` on mount and whenever `deps` change, tracking loading/error
 * state and optionally polling. A 401 propagates through the client's global
 * unauthorized event, so it is treated here as a benign "no data" (the app
 * redirects to login at the route-guard level).
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: readonly unknown[],
  options: Options = {},
): AsyncState<T> {
  const { intervalMs = 0, enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [loading, setLoading] = useState(enabled);
  const [nonce, setNonce] = useState(0);
  const mounted = useRef(true);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    // Background poll refreshes should not flash the loading skeleton.
    const isInitial = data === null;
    if (isInitial) setLoading(true);

    const run = () => {
      fetcher()
        .then((result) => {
          if (cancelled || !mounted.current) return;
          setData(result);
          setError(null);
          setUnreachable(false);
        })
        .catch((e: unknown) => {
          if (cancelled || !mounted.current) return;
          if (e instanceof ApiError && e.status === 401) return; // handled globally
          setError(e instanceof Error ? e.message : "request failed");
          setUnreachable(isUnreachable(e));
        })
        .finally(() => {
          if (cancelled || !mounted.current) return;
          setLoading(false);
        });
    };

    run();
    const timer = intervalMs > 0 ? window.setInterval(run, intervalMs) : undefined;
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, enabled, intervalMs]);

  return { data, error, unreachable, loading, reload };
}
