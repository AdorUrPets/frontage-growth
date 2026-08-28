import Link from "next/link";
import { Panel } from "../components/hud/Panel";
import { StatusPill } from "../components/hud/StatusPill";
import { SearchPerformancePanel } from "../components/dashboard/SearchPerformancePanel";
import { listDeployments, listMissions, searchConsoleState } from "@/lib/db/artifacts";
import { UploadCloud, Rocket } from "lucide-react";

export const dynamic = "force-dynamic";

export default function ResultsPage() {
  const deployments = listDeployments();
  const missions = listMissions();
  const gsc = searchConsoleState();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-bold text-[var(--fg-text)]">Results</h1>
        <p className="mt-1 text-xs text-[var(--fg-text-dim)]">
          What actually shipped: deployments to live sites, completed missions, and real Search Console performance
          where it&apos;s connected.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="fg-metric">
          <div className="fg-metric-value">{missions.filter((m) => m.status === "complete").length}</div>
          <div className="fg-metric-label">Missions Completed</div>
        </div>
        <div className="fg-metric">
          <div className="fg-metric-value">{deployments.length}</div>
          <div className="fg-metric-label">Deployments to Live Sites</div>
        </div>
        <div className="fg-metric">
          <div className="fg-metric-value">{gsc.connectedSites}</div>
          <div className="fg-metric-label">Sites With Search Console</div>
        </div>
        <div className="fg-metric">
          <div className="fg-metric-value">{gsc.snapshotRows}</div>
          <div className="fg-metric-label">Synced Query/Page Rows</div>
        </div>
      </div>

      <SearchPerformancePanel
        connectedSites={gsc.connectedSites}
        totalClicks={gsc.totalClicks}
        totalImpressions={gsc.totalImpressions}
        avgPosition={gsc.avgPosition}
        topQueries={gsc.topQueries.map((q) => ({ label: q.query, value: q.clicks }))}
      />

      <Panel title="Deployments to Live Sites" icon={<UploadCloud size={13} />}>
        {deployments.length === 0 ? (
          <p className="text-xs text-[var(--fg-text-dim)]">Nothing pushed live yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {deployments.map((d) => (
              <Link key={d.id} href={`/clients/${d.client_id}#seo-proposals`} className="fg-row items-start">
                <StatusPill status={d.status === "success" || d.status === "partial" ? "online" : d.status === "failed" ? "error" : "warn"} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[var(--fg-text)]">{d.client_name}</span>
                    <span className="text-[10px] text-[var(--fg-text-faint)]">{d.deployed_at ? new Date(d.deployed_at.replace(" ", "T") + "Z").toLocaleString() : "—"}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--fg-text-dim)]">
                    {d.adapter} · {d.summary}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Mission History" icon={<Rocket size={13} />}>
        {missions.length === 0 ? (
          <p className="text-xs text-[var(--fg-text-dim)]">No missions run yet — start one from a client page.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {missions.map((m) => (
              <Link key={m.id} href={`/clients/${m.client_id}#pipeline`} className="fg-row items-start">
                <StatusPill status={m.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[var(--fg-text)]">{m.client_name}</span>
                    <span className="text-[10px] text-[var(--fg-text-faint)]">
                      {m.completed_at ? new Date(m.completed_at.replace(" ", "T") + "Z").toLocaleString() : "in progress"}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--fg-text-dim)]">
                    {m.protocol.toUpperCase()} protocol · {m.steps_complete} / {m.steps_total} steps
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
