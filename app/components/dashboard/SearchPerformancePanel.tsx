import { Panel } from "../hud/Panel";
import { TopBarList } from "./TopBarList";

export function SearchPerformancePanel({
  connectedSites,
  totalClicks,
  totalImpressions,
  avgPosition,
  topQueries,
}: {
  connectedSites: number;
  totalClicks: number;
  totalImpressions: number;
  avgPosition: number | null;
  topQueries: { label: string; value: number }[];
}) {
  return (
    <Panel title="Search Performance (last 28 days)" right={<span className="fg-metric-tag">REAL DATA — Search Console</span>}>
      {connectedSites === 0 ? (
        <p className="text-xs text-[var(--fg-text-dim)]">
          No client has Search Console connected yet — connect one from a client page to see real organic performance here.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="fg-metric !p-3">
              <div className="fg-metric-value !text-lg">{totalClicks.toLocaleString()}</div>
              <div className="fg-metric-label">Clicks</div>
            </div>
            <div className="fg-metric !p-3">
              <div className="fg-metric-value !text-lg">{totalImpressions.toLocaleString()}</div>
              <div className="fg-metric-label">Impressions</div>
            </div>
            <div className="fg-metric !p-3">
              <div className="fg-metric-value !text-lg">{avgPosition != null ? avgPosition.toFixed(1) : "—"}</div>
              <div className="fg-metric-label">Avg Position</div>
            </div>
          </div>
          {topQueries.length > 0 ? (
            <div>
              <div className="fg-field-label">Top Queries by Clicks</div>
              <TopBarList items={topQueries} unit="clicks" />
            </div>
          ) : null}
        </div>
      )}
    </Panel>
  );
}
