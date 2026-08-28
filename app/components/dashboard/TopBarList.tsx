export function TopBarList({ items, unit }: { items: { label: string; value: number }[]; unit?: string }) {
  if (items.length === 0) return null;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="min-w-0 flex-1 truncate text-[var(--fg-text-dim)]">{item.label}</span>
            <span className="shrink-0 font-bold text-[var(--fg-text)]">
              {item.value.toLocaleString()}
              {unit ? ` ${unit}` : ""}
            </span>
          </div>
          <div className="fg-bar-track">
            <div className="fg-bar-fill" style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
