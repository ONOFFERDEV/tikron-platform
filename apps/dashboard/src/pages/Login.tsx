import { useEffect, useState } from "react";
import { api } from "../api/client";
import { GatewayUnreachable } from "../components/states";
import { useSession } from "../hooks/useSession";
import { useToast } from "../lib/toast";

/** Unauthenticated landing: product pitch + GitHub OAuth, plus a dev-mode
 *  login shortcut when the local backend advertises it. */
export function Login() {
  const { status, refresh } = useSession();
  const toast = useToast();
  const [devAvailable, setDevAvailable] = useState(false);
  const [devLogin, setDevLogin] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    api.devLoginAvailable().then((ok) => active && setDevAvailable(ok));
    return () => {
      active = false;
    };
  }, []);

  const onDevSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const login = devLogin.trim();
    if (!login) return;
    setSubmitting(true);
    try {
      await api.devLogin(login);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "dev login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login">
      <div className="login-card">
        <div className="brand brand-lg">
          <span className="brand-mark">◆</span>
          <span className="brand-word">Tikron</span>
        </div>
        <p className="login-pitch">
          Server-authoritative multiplayer for web games, on the edge.
        </p>

        {status === "unreachable" ? (
          <GatewayUnreachable onRetry={refresh} />
        ) : (
          <>
            <a className="btn btn-primary btn-block" href={api.githubLoginUrl()}>
              Continue with GitHub
            </a>

            {devAvailable && (
              <form className="dev-login" onSubmit={onDevSubmit}>
                <div className="dev-login-label">or dev login (local only)</div>
                <div className="dev-login-row">
                  <input
                    className="input"
                    value={devLogin}
                    onChange={(e) => setDevLogin(e.target.value)}
                    placeholder="github login"
                    aria-label="dev login username"
                    autoComplete="off"
                  />
                  <button
                    className="btn btn-secondary"
                    type="submit"
                    disabled={submitting || devLogin.trim() === ""}
                  >
                    {submitting ? "…" : "Enter"}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
      <p className="login-foot">
        New here? Ship a multiplayer game in 5 minutes —{" "}
        <a href="/agar.html" target="_blank" rel="noreferrer">
          try the live demo
        </a>
        .
      </p>
    </div>
  );
}
