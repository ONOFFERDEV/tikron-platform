import { useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../api/client";
import { CopyButton } from "../components/CopyButton";
import { Modal } from "../components/Modal";
import { SkeletonRows } from "../components/Skeleton";
import { EmptyState, ErrorState, GatewayUnreachable } from "../components/states";
import { useApi } from "../hooks/useApi";
import { fmtDate } from "../lib/format";
import { useToast } from "../lib/toast";

const QUICKSTART = "pnpm create tikron@latest my-game";

export function Projects() {
  const projects = useApi(() => api.listProjects(), []);
  const [creating, setCreating] = useState(false);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-sub">Each project gets its own API keys, usage, and live rooms.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          New project
        </button>
      </header>

      {projects.loading && (
        <div className="panel">
          <SkeletonRows rows={3} />
        </div>
      )}

      {!projects.loading && projects.unreachable && (
        <GatewayUnreachable onRetry={projects.reload} />
      )}

      {!projects.loading && projects.error && !projects.unreachable && (
        <ErrorState message={projects.error} onRetry={projects.reload} />
      )}

      {!projects.loading && !projects.error && projects.data?.length === 0 && (
        <EmptyState
          title="Create your first project"
          action={
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              New project
            </button>
          }
        >
          <p>Spin up a server-authoritative multiplayer backend in about five minutes.</p>
          <div className="snippet">
            <code>{QUICKSTART}</code>
            <CopyButton value={QUICKSTART} />
          </div>
          <p className="muted">
            Prefer to see it first?{" "}
            <a href="/agar.html" target="_blank" rel="noreferrer">
              Open the agar.io demo ↗
            </a>
          </p>
        </EmptyState>
      )}

      {!projects.loading && !projects.error && projects.data && projects.data.length > 0 && (
        <div className="card-grid">
          {projects.data.map((p) => (
            <ProjectCard key={p.id} id={p.id} name={p.name} createdAt={p.createdAt} />
          ))}
        </div>
      )}

      {creating && (
        <CreateProjectDialog
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            projects.reload();
          }}
        />
      )}
    </div>
  );
}

function ProjectCard({ id, name, createdAt }: { id: string; name: string; createdAt: string }) {
  const navigate = useNavigate();
  return (
    <button className="project-card" onClick={() => navigate(`/projects/${id}`)}>
      <span className="project-card-name">{name}</span>
      <span className="project-card-meta mono">created {fmtDate(createdAt)}</span>
    </button>
  );
}

function CreateProjectDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await api.createProject(trimmed);
      toast.success(`Project "${trimmed}" created`);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "failed to create project");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="New project" onClose={onClose}>
      <form onSubmit={submit}>
        <label className="field">
          <span className="field-label">Name</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-game"
            autoFocus
            maxLength={64}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || name.trim() === ""}>
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
