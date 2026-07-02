import { fraction } from "../lib/format";

/** A single KPI tile: label, big value, optional secondary text + progress. */
export function StatTile({
  label,
  value,
  sub,
  progress,
  primary = false,
}: {
  label: string;
  value: string;
  sub?: string;
  /** { value, cap } renders a neon progress meter under the number. */
  progress?: { value: number; cap: number };
  /** Highlight as the headline metric (neon number + glow). */
  primary?: boolean;
}) {
  const pct = progress ? fraction(progress.value, progress.cap) : null;
  return (
    <div className={primary ? "stat-tile primary" : "stat-tile"}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
      {pct !== null && (
        <div
          className="meter"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct * 100)}
        >
          <div className="meter-fill" style={{ width: `${pct * 100}%` }} />
        </div>
      )}
    </div>
  );
}
