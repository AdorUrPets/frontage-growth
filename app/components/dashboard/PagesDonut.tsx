const PALETTE = ["var(--fg-accent)", "var(--fg-cyan)", "var(--fg-blue)", "var(--fg-violet)", "var(--fg-amber)", "var(--fg-text-faint)"];

const R = 54;
const CIRC = 2 * Math.PI * R;

export function PagesDonut({ items, totalLabel, total }: { items: { label: string; value: number }[]; totalLabel: string; total: number }) {
  if (total === 0) return null;
  let cumulative = 0;

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 140 140" className="h-32 w-32 shrink-0 -rotate-90">
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--fg-border)" strokeWidth="14" />
        {items.map((item, i) => {
          const frac = item.value / total;
          const len = frac * CIRC;
          const el = (
            <circle
              key={item.label}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth="14"
              strokeDasharray={`${len} ${CIRC - len}`}
              strokeDashoffset={-cumulative}
              strokeLinecap="butt"
            />
          );
          cumulative += len;
          return el;
        })}
      </svg>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="mb-1">
          <div className="text-lg font-black text-[var(--fg-text)]">{total.toLocaleString()}</div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--fg-text-faint)]">{totalLabel}</div>
        </div>
        {items.map((item, i) => (
          <div key={item.label} className="flex items-center gap-2 text-[10.5px]">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="min-w-0 flex-1 truncate text-[var(--fg-text-dim)]">{item.label}</span>
            <span className="shrink-0 font-bold text-[var(--fg-text)]">{item.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
