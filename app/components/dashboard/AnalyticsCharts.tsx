import type { ReactNode } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

/**
 * Hand-rolled, fully themed SVG charts for the bottom analytics row.
 * Server-renderable; entrance animation is pure CSS (fg-draw / fg-fade).
 */

const PLOT_W = 320;
const PLOT_H = 150;
const PAD_L = 34;
const PAD_R = 8;
const PAD_T = 8;
const PAD_B = 20;

export function AnalyticsCard({
  title,
  compare = "vs last 30 days",
  value,
  delta,
  deltaDir = "up",
  demoTooltip,
  children,
}: {
  title: string;
  compare?: string;
  value: string;
  delta?: string;
  deltaDir?: "up" | "down";
  demoTooltip?: string;
  children: ReactNode;
}) {
  return (
    <section className="fg-panel flex min-w-0 flex-col" title={demoTooltip}>
      <div className="flex items-baseline justify-between gap-3 px-4 pt-3.5">
        <span className="fg-panel-title !text-[10px]">{title}</span>
        <span className="text-[9px] font-semibold text-[var(--fg-text-faint)]">{compare}</span>
      </div>
      <div className="flex items-center gap-2.5 px-4 pt-2">
        <span className="fg-chart-big">{value}</span>
        {delta ? (
          <span className="fg-chart-delta" data-dir={deltaDir}>
            {deltaDir === "up" ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {delta}
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1 px-2.5 pb-2.5 pt-1">{children}</div>
    </section>
  );
}

export function AnalyticsLineChart({
  series,
  yLabels,
  xLabels,
  color,
  gradientId,
}: {
  series: number[];
  yLabels: string[];
  xLabels: string[];
  color: string;
  gradientId: string;
}) {
  const w = PLOT_W - PAD_L - PAD_R;
  const h = PLOT_H - PAD_T - PAD_B;
  const min = 0;
  const max = Math.max(...series) * 1.15 || 1;
  const step = series.length > 1 ? w / (series.length - 1) : w;
  const pts = series.map((v, i) => ({
    x: PAD_L + i * step,
    y: PAD_T + h - ((v - min) / (max - min)) * h,
  }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L ${(PAD_L + w).toFixed(1)} ${PAD_T + h} L ${PAD_L} ${PAD_T + h} Z`;
  const gridRows = yLabels.length;

  return (
    <svg viewBox={`0 0 ${PLOT_W} ${PLOT_H}`} className="h-auto w-full" role="img" aria-label="trend chart">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {yLabels.map((label, i) => {
        const y = PAD_T + (i / Math.max(gridRows - 1, 1)) * h;
        return (
          <g key={label}>
            <line x1={PAD_L} y1={y} x2={PLOT_W - PAD_R} y2={y} stroke="rgba(120,165,255,0.09)" strokeWidth="1" />
            <text x={PAD_L - 5} y={y + 2.5} textAnchor="end" className="fg-axis-label">
              {label}
            </text>
          </g>
        );
      })}

      {xLabels.map((label, i) => {
        const x = PAD_L + (i / Math.max(xLabels.length - 1, 1)) * w;
        return (
          <text key={label} x={x} y={PLOT_H - 6} textAnchor={i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle"} className="fg-axis-label">
            {label}
          </text>
        );
      })}

      <path d={area} fill={`url(#${gradientId})`} className="fg-chart-area" />
      <path d={line} stroke={color} pathLength={1} className="fg-chart-line" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  );
}

export interface DonutSegment {
  label: string;
  pct: number;
  color: string;
}

export function ChannelDonut({
  segments,
  centerValue,
  centerLabel,
}: {
  segments: DonutSegment[];
  centerValue: string;
  centerLabel: string;
}) {
  const R = 44;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="flex items-center gap-4 px-2 py-1">
      <div className="relative flex-shrink-0">
        <svg viewBox="0 0 120 120" width={118} height={118}>
          <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(120,165,255,0.08)" strokeWidth="13" />
          {segments.map((s) => {
            const len = (s.pct / 100) * C;
            const el = (
              <circle
                key={s.label}
                cx="60"
                cy="60"
                r={R}
                className="fg-donut-seg"
                stroke={s.color}
                strokeWidth="13"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 60 60)"
                strokeLinecap="butt"
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[16px] font-extrabold text-[var(--fg-text)]">{centerValue}</span>
          <span className="text-[8.5px] font-semibold text-[var(--fg-text-faint)]">{centerLabel}</span>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-[10px]">
            <span className="fg-legend-dot" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate font-semibold text-[var(--fg-text-dim)]">{s.label}</span>
            <span className="font-bold text-[var(--fg-text)]">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
