import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

const ACCENT_VAR: Record<string, string> = {
  blue: "var(--fg-blue)",
  green: "var(--fg-green)",
  violet: "var(--fg-violet)",
  cyan: "var(--fg-cyan)",
  amber: "var(--fg-amber)",
  coral: "var(--fg-coral)",
};

function Sparkline({ points, color, gradientId }: { points: number[]; color: string; gradientId: string }) {
  if (points.length < 2) return null;
  const w = 100;
  const h = 26;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = w / (points.length - 1);
  const coords = points.map(
    (p, i) => `${((i * step * 100) / 100).toFixed(2)},${(h - 3 - ((p - min) / span) * (h - 6)).toFixed(2)}`
  );
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="fg-kpi-spark"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${coords.join(" ")} ${w},${h}`} fill={`url(#${gradientId})`} />
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.4"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
    </svg>
  );
}

export function KpiCard({
  icon: Icon,
  label,
  value,
  suffix,
  delta,
  deltaDir = "up",
  deltaSub = "vs last 30 days",
  spark,
  accent,
  demoTooltip,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  suffix?: string;
  delta?: string;
  deltaDir?: "up" | "down";
  deltaSub?: string;
  spark?: number[];
  accent: "blue" | "green" | "violet" | "cyan" | "amber" | "coral";
  /** set when the value shown is a simulated preview, renders as a tooltip */
  demoTooltip?: string;
}) {
  const color = ACCENT_VAR[accent];
  const gradientId = `fg-spark-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <div className="fg-kpi-card" data-accent={accent} title={demoTooltip}>
      <div className="fg-kpi-head">
        <span className="fg-kpi-icon">
          <Icon size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="fg-kpi-label">{label}</div>
          <div className="fg-kpi-value">
            {value}
            {suffix ? <span className="text-[13px] font-bold text-[var(--fg-text-faint)]">{suffix}</span> : null}
          </div>
          {delta ? (
            <div className="fg-kpi-delta" data-dir={deltaDir}>
              {deltaDir === "up" ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
              {delta}
              <span className="fg-kpi-delta-sub">{deltaSub}</span>
            </div>
          ) : null}
        </div>
      </div>
      {spark ? <Sparkline points={spark} color={color} gradientId={gradientId} /> : null}
    </div>
  );
}
