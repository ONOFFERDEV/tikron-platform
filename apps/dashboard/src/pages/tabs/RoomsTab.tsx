import { api } from "../../api/client";
import { SkeletonRows } from "../../components/Skeleton";
import { EmptyState, ErrorState, GatewayUnreachable } from "../../components/states";
import { useApi } from "../../hooks/useApi";
import { shortId } from "../../lib/format";

const REFRESH_MS = 10_000;

export function RoomsTab({ projectId }: { projectId: string }) {
  const rooms = useApi(() => api.liveRooms(projectId), [projectId], { intervalMs: REFRESH_MS });

  return (
    <section className="section">
      <div className="section-head">
        <div>
          <h2 className="section-title">Live rooms</h2>
          <p className="section-sub">
            Active game rooms across the edge. Auto-refreshes every 10 seconds.
          </p>
        </div>
        <span className="live-dot" title="auto-refreshing">
          ● live
        </span>
      </div>

      {rooms.loading && (
        <div className="panel">
          <SkeletonRows rows={4} />
        </div>
      )}

      {!rooms.loading && rooms.unreachable && <GatewayUnreachable onRetry={rooms.reload} />}
      {!rooms.loading && rooms.error && !rooms.unreachable && (
        <ErrorState message={rooms.error} onRetry={rooms.reload} />
      )}

      {!rooms.loading && !rooms.error && rooms.data?.length === 0 && (
        <EmptyState title="No live rooms">
          <p>No live rooms — open your game to see it here.</p>
        </EmptyState>
      )}

      {!rooms.loading && !rooms.error && rooms.data && rooms.data.length > 0 && (
        <div className="panel">
          <table className="table">
            <thead>
              <tr>
                <th>Room</th>
                <th>Type</th>
                <th className="col-right">Players</th>
              </tr>
            </thead>
            <tbody>
              {rooms.data.map((r) => (
                <tr key={r.roomId}>
                  <td className="mono" title={r.roomId}>
                    {shortId(r.roomId)}
                  </td>
                  <td>{r.type}</td>
                  <td className="col-right mono">
                    {r.count}
                    <span className="muted"> / {r.maxClients}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
