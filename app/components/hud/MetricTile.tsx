export function MetricTile({
  value,
  label,
  tag,
}: {
  value: string | number;
  label: string;
  tag?: "REAL DATA" | "AI ANALYSIS" | "ESTIMATE" | "RECOMMENDATION";
}) {
  return (
    <div className="fg-metric">
      <div className="fg-metric-value">{value}</div>
      <div className="fg-metric-label">{label}</div>
      {tag ? <div className="fg-metric-tag">{tag}</div> : null}
    </div>
  );
}
