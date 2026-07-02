import { useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../api/client";
import { Modal } from "../components/Modal";
import { SkeletonRows } from "../components/Skeleton";
import { ErrorState, GatewayUnreachable } from "../components/states";
import { useApi } from "../hooks/useApi";
import { fmtDate } from "../lib/format";
import { useToast } from "../lib/toast";

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
        <Onboarding onCreate={() => setCreating(true)} />
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

/** Zero-projects onboarding: the create → key → connect path, with one CTA. */
function Onboarding({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="onboard">
      <div>
        <h2 className="onboard-title">Create your first project</h2>
        <p className="onboard-lead">
          A project is a multiplayer backend — its own API keys, usage, and live rooms. Three steps
          to your first connected player:
        </p>
      </div>
      <ol className="onboard-steps">
        <li className="onboard-step">
          <span className="step-num">1</span>
          <div className="step-body">
            <span className="step-title">Create a project</span>
            <span className="step-note">Give it a name — you can add more anytime.</span>
          </div>
        </li>
        <li className="onboard-step">
          <span className="step-num">2</span>
          <div className="step-body">
            <span className="step-title">Grab an API key</span>
            <span className="step-note">
              Issue a key on the <strong>API keys</strong> tab. It authenticates your game client.
            </span>
          </div>
        </li>
        <li className="onboard-step">
          <span className="step-num">3</span>
          <div className="step-body">
            <span className="step-title">Connect your game</span>
            <span className="step-note">
              <code>new GameClient(host, {"{ apiKey }"})</code> — you&apos;re live on the edge.
            </span>
          </div>
        </li>
      </ol>
      <div>
        <button className="btn btn-primary" onClick={onCreate}>
          Create your first project
        </button>
      </div>
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
