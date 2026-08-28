import { Panel } from "../hud/Panel";
import { PagesDonut } from "./PagesDonut";

export function TopPagesPanel({ items, total }: { items: { label: string; value: number }[]; total: number }) {
  return (
    <Panel title="Top Pages by Clicks" right={<span className="fg-metric-tag">REAL DATA</span>}>
      {total === 0 ? (
        <p className="text-xs text-[var(--fg-text-dim)]">No per-page click data yet — appears once Search Console is connected and synced.</p>
      ) : (
        <PagesDonut items={items} total={total} totalLabel="Total Clicks" />
      )}
    </Panel>
  );
}
