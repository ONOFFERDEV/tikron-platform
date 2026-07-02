import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, isUnreachable, UNAUTHORIZED_EVENT } from "../api/client";
import type { Session } from "../api/types";

type Status = "loading" | "authed" | "anon" | "unreachable";

interface SessionState {
  status: Status;
  session: Session | null;
  refresh: () => void;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [session, setSession] = useState<Session | null>(null);

  const refresh = useCallback(() => {
    setStatus((s) => (s === "authed" ? s : "loading"));
    api
      .me()
      .then((me) => {
        setSession(me);
        setStatus(me ? "authed" : "anon");
      })
      .catch((e: unknown) => {
        setSession(null);
        setStatus(isUnreachable(e) ? "unreachable" : "anon");
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Any data call that 401s clears the session, dropping the app to login.
  useEffect(() => {
    const onUnauthorized = () => {
      setSession(null);
      setStatus("anon");
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const value = useMemo<SessionState>(
    () => ({ status, session, refresh }),
    [status, session, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
