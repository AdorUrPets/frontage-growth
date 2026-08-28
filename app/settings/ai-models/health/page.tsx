import { listProviderHealth } from "@/lib/db/providers";
import { refreshAllProviderHealth } from "@/lib/ai/health";
import { Panel } from "../../../components/hud/Panel";
import { StatusPill } from "../../../components/hud/StatusPill";
import { ProviderBadge } from "../../../components/hud/ProviderBadge";
import { MetricTile } from "../../../components/hud/MetricTile";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const { ollama } = await refreshAllProviderHealth();
  const health = listProviderHealth();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel
        title="Ollama"
        right={<StatusPill status={ollama.online ? "online" : "disabled"} />}
      >
        <div className="mb-3"><ProviderBadge provider="ollama" /></div>
        <p className="text-xs text-[var(--fg-text-dim)]">
          {ollama.online ? `${ollama.models.length} model(s) installed, GPU telemetry not wired up yet.` : ollama.error}
        </p>
      </Panel>

      {health
        .filter((h) => h.provider_code !== "ollama")
        .map((row) => (
          <Panel key={row.provider_code} title={row.provider_code} right={<StatusPill status={row.status} />}>
            <div className="mb-3"><ProviderBadge provider={row.provider_code} /></div>
            <div className="grid grid-cols-2 gap-3">
              <MetricTile value={row.configured_count} label="Configured" tag="REAL DATA" />
              <MetricTile value={row.available_count} label="Available" tag="REAL DATA" />
              <MetricTile value={row.requests_today} label="Requests Today" tag="REAL DATA" />
              <MetricTile value={row.failures_today} label="Failures Today" tag="REAL DATA" />
              <MetricTile value={row.fallback_events_today} label="Fallback Events" tag="REAL DATA" />
              <MetricTile
                value={row.last_checked_at ? new Date(row.last_checked_at).toLocaleTimeString() : "—"}
                label="Last Checked"
                tag="REAL DATA"
              />
            </div>
          </Panel>
        ))}
    </div>
  );
}
