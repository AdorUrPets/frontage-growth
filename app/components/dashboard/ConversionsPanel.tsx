import { Panel } from "../hud/Panel";
import { TopBarList } from "./TopBarList";

export function ConversionsPanel({ total, byType }: { total: number; byType: { label: string; value: number }[] }) {
  return (
    <Panel title="Conversions" right={<span className="fg-metric-tag">REAL DATA</span>}>
      {total === 0 ? (
        <p className="text-xs text-[var(--fg-text-dim)]">
          No conversion events recorded yet — nothing is fabricated here. This fills in once a client site sends real conversion events.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="fg-metric !p-3">
            <div className="fg-metric-value !text-lg">{total.toLocaleString()}</div>
            <div className="fg-metric-label">Total Events</div>
          </div>
          <TopBarList items={byType} />
        </div>
      )}
    </Panel>
  );
}
