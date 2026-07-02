import { NavLink, Outlet, useNavigate } from "react-router";
import { api, UNAUTHORIZED_EVENT } from "../api/client";
import { useApi } from "../hooks/useApi";
import { useSession } from "../hooks/useSession";
import { Wordmark } from "./Wordmark";

const DOCS_HREF = "/agar.html";

/** App chrome: fixed left sidebar (projects + account) with a routed content
 *  area. Rendered only for authenticated sessions (guarded upstream). */
export function Shell() {
  const { session } = useSession();
  const navigate = useNavigate();
  const projects = useApi(() => api.listProjects(), []);

  // No server logout endpoint in the platform contract yet; drop the local
  // session (route guard falls back to login). The cookie is cleared server-side
  // once that endpoint lands.
  const logout = () => window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));

  return (
    <div className="shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate("/")} aria-label="Tikron home">
          <Wordmark size="sm" />
        </button>

        <nav className="nav" aria-label="Projects">
          <div className="nav-heading">
            <span>Projects</span>
            <NavLink to="/" className="nav-all" end>
              all
            </NavLink>
          </div>
          <ul className="nav-list">
            {projects.loading && <li className="nav-muted">loading…</li>}
            {!projects.loading && projects.data?.length === 0 && (
              <li className="nav-muted">no projects</li>
            )}
            {projects.data?.map((p) => (
              <li key={p.id}>
                <NavLink
                  to={`/projects/${p.id}`}
                  className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
                >
                  {p.name}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar-foot">
          <a className="nav-item nav-external" href={DOCS_HREF} target="_blank" rel="noreferrer">
            Docs &amp; demo ↗
          </a>
          <div className="account">
            {session && (
              <img
                className="avatar"
                src={session.avatarUrl}
                alt=""
                width={28}
                height={28}
                referrerPolicy="no-referrer"
              />
            )}
            <span className="account-login">{session?.login ?? "—"}</span>
            <button className="btn btn-ghost btn-sm" onClick={logout}>
              Log out
            </button>
          </div>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
