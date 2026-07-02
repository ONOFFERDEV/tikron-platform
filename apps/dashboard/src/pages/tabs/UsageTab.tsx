import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../../api/client";
import type { UsageDay } from "../../api/types";
import { Skeleton, SkeletonRows } from "../../components/Skeleton";
import { StatTile } from "../../components/StatTile";
import { ErrorState, GatewayUnreachable } from "../../components/states";
import { useApi } from "../../hooks/useApi";
import { fmtCompact, fmtDayShort, fmtNumber } from "../../lib/format";

const NEON = "#00e5a0"; // room-hours bars
const BLUE = "#58a6ff"; // peak CCU line
const AXIS = "#8b98a8";
const GRID = "#232b36";

export function UsageTab({ projectId }: { projectId: string }) {
  const usage = useApi(() => api.usage(projectId, 30), [projectId]);
  const limits = useApi(() => api.limits(projectId), [projectId]);

  const loading = usage.loading || limits.loading;
  const unreachable = usage.unreachable || limits.unreachable;
  const error = usage.error ?? limits.error;

  const reload = () => {
    usage.reload();
    limits.reload();
  };

  if (loading) {
    return (
      <section className="section">
        <div className="tiles">
          {[0, 1, 2].map((i) => (
            <div className="stat-tile" key={i}>
              <Skeleton w={90} h={12} />
              <Skeleton w={120} h={28} />
            </div>
          ))}
        </div>
        <div className="panel">
          <SkeletonRows rows={6} />
        </div>
      </section>
    );
  }

  if (unreachable) return <GatewayUnreachable onRetry={reload} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const days = usage.data ?? [];
  const messagesToday = days.length > 0 ? days[days.length - 1]!.messages : 0;
  const lim = limits.data;

  return (
    <section className="section">
      <div className="tiles">
        <StatTile
          label="Room-hours this month"
          value={lim ? fmtCompact(lim.monthRoomHours) : "-"}
          sub={lim ? `of ${fmtCompact(lim.caps.monthRoomHours)} cap` : undefined}
          progress={lim ? { value: lim.monthRoomHours, cap: lim.caps.monthRoomHours } : undefined}
          primary
        />
        <StatTile
          label="Live rooms"
          value={lim ? fmtNumber(lim.liveRooms) : "-"}
          sub={lim ? `of ${fmtNumber(lim.caps.concurrentRooms)} concurrent cap` : undefined}
          progress={lim ? { value: lim.liveRooms, cap: lim.caps.concurrentRooms } : undefined}
        />
        <StatTile label="Messages today" value={fmtCompact(messagesToday)} />
      </div>

      <div className="panel chart-panel">
        <div className="chart-head">
          <h3 className="chart-title">Last 30 days</h3>
          <div className="legend">
            <span className="legend-item">
              <span className="legend-swatch" style={{ background: NEON, opacity: 0.7 }} />
              room-hours
            </span>
            <span className="legend-item">
              <span className="legend-line" style={{ background: BLUE }} />
              peak CCU
            </span>
          </div>
        </div>
        {days.length === 0 ? (
          <div className="chart-empty">
            <span>No usage yet — ship your game and traffic shows up here.</span>
            <a href="/agar.html" target="_blank" rel="noreferrer">
              See a live game ↗
            </a>
          </div>
        ) : (
          <UsageChart days={days} />
        )}
      </div>
    </section>
  );
}

function UsageChart({ days }: { days: UsageDay[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={days} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="day"
          tickFormatter={fmtDayShort}
          stroke={AXIS}
          tick={{ fill: AXIS, fontSize: 11 }}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis
          yAxisId="left"
          stroke={AXIS}
          tick={{ fill: AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={fmtCompact}
          label={{ value: "room-hours", angle: -90, position: "insideLeft", fill: AXIS, fontSize: 11 }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke={AXIS}
          tick={{ fill: AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={fmtCompact}
          label={{ value: "peak CCU", angle: 90, position: "insideRight", fill: AXIS, fontSize: 11 }}
        />
        <Tooltip
          cursor={{ fill: "rgba(0, 229, 160, 0.06)" }}
          contentStyle={{
            background: "#10151d",
            border: "1px solid #232b36",
            borderRadius: 8,
            color: "#e6edf3",
            fontSize: 12,
          }}
          labelFormatter={(v) => fmtDayShort(String(v))}
          formatter={(value, name) => [fmtNumber(Number(value)), name]}
        />
        <Bar
          yAxisId="left"
          dataKey="roomHours"
          name="room-hours"
          fill={NEON}
          fillOpacity={0.7}
          radius={[2, 2, 0, 0]}
          maxBarSize={18}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="peakCcu"
          name="peak CCU"
          stroke={BLUE}
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
