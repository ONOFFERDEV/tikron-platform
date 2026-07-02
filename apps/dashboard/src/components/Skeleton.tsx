/** Shimmering placeholder block. Width/height are caller-controlled via style. */
export function Skeleton({ w, h = 14, radius = 6 }: { w?: number | string; h?: number; radius?: number }) {
  return (
    <span
      className="skeleton"
      style={{ width: w ?? "100%", height: h, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

/** A stack of skeleton rows for table/list loading states. */
export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="skeleton-rows">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} h={18} />
      ))}
    </div>
  );
}
