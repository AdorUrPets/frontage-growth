import { getDb } from "@/lib/db/client";
import { usageSummary } from "@/lib/db/providers";
import { Panel } from "../../../components/hud/Panel";
import { ProviderBadge } from "../../../components/hud/ProviderBadge";
import { StatusPill } from "../../../components/hud/StatusPill";

interface UsageRow {
  id: string;
  provider_code: string;
  model_id: string | null;
  task_type: string | null;
  status: string;
  duration_ms: number | null;
  error: string | null;
  created_at: string;
}

const ROW_GRID = "grid grid-cols-[160px_140px_90px_70px_1fr_140px] items-center gap-3";

export default function UsagePage() {
  const summary = usageSummary(24);
  const recent = getDb()
    .prepare(`SELECT * FROM provider_usage ORDER BY created_at DESC LIMIT 50`)
    .all() as UsageRow[];

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Last 24 hours">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {summary.length === 0 ? (
            <p className="text-xs text-[var(--fg-text-dim)]">No requests recorded yet.</p>
          ) : (
            summary.map((s) => (
              <div key={s.providerCode} className="fg-metric">
                <div className="mb-1"><ProviderBadge provider={s.providerCode} /></div>
                <div className="fg-metric-value">{s.total}</div>
                <div className="fg-metric-label">{s.failures} failed</div>
              </div>
            ))
          )}
        </div>
      </Panel>

      <Panel title="Recent Requests">
        {recent.length === 0 ? (
          <p className="text-xs text-[var(--fg-text-dim)]">Nothing routed yet — this fills in as agents run.</p>
        ) : (
          <div className="fg-scroll flex flex-col gap-1 overflow-x-auto">
            <div className={`${ROW_GRID} px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--fg-text-faint)]`}>
              <span>Provider</span>
              <span>Task</span>
              <span>Status</span>
              <span>Time</span>
              <span></span>
              <span className="text-right">When</span>
            </div>
            {recent.map((r) => (
              <div key={r.id} className={`${ROW_GRID} rounded-lg border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] px-4 py-2.5 text-xs`}>
                <ProviderBadge provider={r.provider_code} model={r.model_id} />
                <span className="truncate text-[var(--fg-text-dim)]">{r.task_type ?? "—"}</span>
                <StatusPill status={r.status === "success" ? "online" : "error"} label={r.status === "success" ? "success" : "failed"} />
                <span className="text-[var(--fg-text-faint)]">{r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : "—"}</span>
                <span className="truncate text-[var(--fg-red)]">{r.status === "error" ? r.error : ""}</span>
                <span className="text-right text-[var(--fg-text-faint)]">{new Date(r.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
