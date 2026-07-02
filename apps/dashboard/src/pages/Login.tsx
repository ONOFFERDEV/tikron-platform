import { useEffect, useState } from "react";
import { api } from "../api/client";
import { GitHubIcon } from "../components/icons";
import { Wordmark } from "../components/Wordmark";
import { GatewayUnreachable } from "../components/states";
import { useSession } from "../hooks/useSession";
import { useToast } from "../lib/toast";

const REPO_URL = "https://github.com/DGO0/tikron-platform";

/** Unauthenticated landing — a mini product pitch. GitHub OAuth is the single
 *  hero action; dev-mode login is tucked into a secondary disclosure and only
 *  offered when the local backend advertises it. */
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
        <div className="login-head">
          <Wordmark size="lg" />
          <p className="login-pitch">Server-authoritative multiplayer for web games.</p>
        </div>

        {status === "unreachable" ? (
          <GatewayUnreachable onRetry={refresh} />
        ) : (
          <>
            <a className="btn btn-primary btn-block btn-github" href={api.githubLoginUrl()}>
              <GitHubIcon />
              Continue with GitHub
            </a>

            <div className="login-links">
              <a href="/agar.html" target="_blank" rel="noreferrer">
                Live demo
              </a>
              <span className="login-sep">·</span>
              <a href={REPO_URL} target="_blank" rel="noreferrer">
                GitHub repo
              </a>
            </div>

            {devAvailable && (
              <details className="dev-disclosure">
                <summary>Developer mode</summary>
                <form className="dev-login" onSubmit={onDevSubmit}>
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
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}
