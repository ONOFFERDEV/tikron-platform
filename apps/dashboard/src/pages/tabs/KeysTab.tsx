import { useState } from "react";
import { api } from "../../api/client";
import type { CreatedApiKey } from "../../api/types";
import { CopyButton } from "../../components/CopyButton";
import { Modal } from "../../components/Modal";
import { SkeletonRows } from "../../components/Skeleton";
import { EmptyState, ErrorState, GatewayUnreachable } from "../../components/states";
import { useApi } from "../../hooks/useApi";
import { fmtDate } from "../../lib/format";
import { useToast } from "../../lib/toast";

export function KeysTab({ projectId }: { projectId: string }) {
  const keys = useApi(() => api.listKeys(projectId), [projectId]);
  const toast = useToast();
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const create = async () => {
    setCreating(true);
    try {
      const key = await api.createKey(projectId);
      setCreated(key);
      keys.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "failed to create key");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (keyId: string) => {
    if (!window.confirm("Revoke this key? Clients using it will stop working immediately.")) return;
    setRevoking(keyId);
    try {
      await api.revokeKey(projectId, keyId);
      toast.success("Key revoked");
      keys.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "failed to revoke key");
    } finally {
      setRevoking(null);
    }
  };

  return (
    <section className="section">
      <div className="section-head">
        <div>
          <h2 className="section-title">API keys</h2>
          <p className="section-sub">
            Use a key to authenticate the client SDK. The full secret is shown only once.
          </p>
        </div>
        <button className="btn btn-primary" onClick={create} disabled={creating}>
          {creating ? "Creating…" : "Create key"}
        </button>
      </div>

      {keys.loading && (
        <div className="panel">
          <SkeletonRows rows={3} />
        </div>
      )}

      {!keys.loading && keys.unreachable && <GatewayUnreachable onRetry={keys.reload} />}
      {!keys.loading && keys.error && !keys.unreachable && (
        <ErrorState message={keys.error} onRetry={keys.reload} />
      )}

      {!keys.loading && !keys.error && keys.data?.length === 0 && (
        <EmptyState title="No API keys yet">
          <p>Create a key to connect your game client to this project.</p>
        </EmptyState>
      )}

      {!keys.loading && !keys.error && keys.data && keys.data.length > 0 && (
        <div className="panel">
          <table className="table">
            <thead>
              <tr>
                <th>Prefix</th>
                <th>Created</th>
                <th>Status</th>
                <th className="col-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.data.map((k) => (
                <tr key={k.id}>
                  <td className="mono">{k.prefix}…</td>
                  <td>{fmtDate(k.createdAt)}</td>
                  <td>
                    {k.revokedAt ? (
                      <span className="badge badge-revoked">revoked</span>
                    ) : (
                      <span className="badge badge-active">active</span>
                    )}
                  </td>
                  <td className="col-right">
                    {!k.revokedAt && (
                      <button
                        className="btn btn-ghost btn-sm btn-danger"
                        onClick={() => revoke(k.id)}
                        disabled={revoking === k.id}
                      >
                        {revoking === k.id ? "…" : "Revoke"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {created && <NewKeyDialog created={created} onClose={() => setCreated(null)} />}
    </section>
  );
}

function NewKeyDialog({ created, onClose }: { created: CreatedApiKey; onClose: () => void }) {
  return (
    <Modal title="Your new API key" onClose={onClose}>
      <p className="warn">
        Store this now — for your security, we can&apos;t show it again.
      </p>
      <div className="key-reveal">
        <code className="key-value mono">{created.key}</code>
        <CopyButton value={created.key} label="Copy key" />
      </div>
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
