const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const decimal = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });

/** 1234 -> "1.2k", 2_500_000 -> "2.5M". */
export function fmtCompact(n: number): string {
  if (!Number.isFinite(n)) return "-";
  return compact.format(n);
}

/** Plain number with at most one decimal, thousands-grouped. */
export function fmtNumber(n: number): string {
  if (!Number.isFinite(n)) return "-";
  return decimal.format(n);
}

/** ISO timestamp -> "Jul 2, 2026". Falls back to the raw string if unparseable. */
export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" });
}

/** "YYYY-MM-DD" -> "Jul 2" for compact chart axis ticks. */
export function fmtDayShort(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Clamped 0..1 fraction, safe against a zero/negative cap. */
export function fraction(value: number, cap: number): number {
  if (!Number.isFinite(cap) || cap <= 0) return 0;
  return Math.max(0, Math.min(1, value / cap));
}

/** Shorten a long room id for display: "abc123def456" -> "abc123…f456". */
export function shortId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}
