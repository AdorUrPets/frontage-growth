// SQLite datetime('now') strings are UTC without a "Z" suffix — new Date()
// parses those as local time unless we append it, which would silently
// throw every relative time off by the local UTC offset.
export function relativeTime(isoLike: string | null): string {
  if (!isoLike) return "—";
  const iso = isoLike.includes("T") ? isoLike : isoLike.replace(" ", "T") + "Z";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
