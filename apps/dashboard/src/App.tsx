import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { Shell } from "./components/Shell";
import { useSession } from "./hooks/useSession";
import { Login } from "./pages/Login";
import { ProjectDetail } from "./pages/ProjectDetail";
import { Projects } from "./pages/Projects";

/** Route guard keyed on session status. Unauthenticated (and unreachable)
 *  sessions get the login screen; authenticated sessions get the app shell. */
export function App() {
  const { status } = useSession();

  if (status === "loading") {
    return (
      <div className="boot">
        <div className="boot-mark">◆</div>
        <span className="boot-text">Loading Tikron…</span>
      </div>
    );
  }

  if (status !== "authed") {
    return <Login />;
  }

  return (
    <BrowserRouter basename="/dashboard">
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
