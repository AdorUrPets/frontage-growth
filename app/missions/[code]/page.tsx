import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { Panel } from "../../components/hud/Panel";
import { StatusPill } from "../../components/hud/StatusPill";
import { ProviderBadge } from "../../components/hud/ProviderBadge";
import { AGENT_META } from "../../components/dashboard/agentMeta";
import { AGENT_PROFILES } from "../agentProfiles";
import { relativeTime } from "../../components/dashboard/relativeTime";
import { ArrowLeft, Bot, ShieldCheck, Zap } from "lucide-react";

export const dynamic = "force-dynamic";

interface AgentRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  task_type: string;
  enabled: number;
}

interface RunRecord {
  id: string;
  status: string;
  provider: string | null;
  model: string | null;
  duration_ms: number | null;
  error: string | null;
  output_json: string | null;
  confidence: number | null;
  started_at: string | null;
  completed_at: string | null;
  client_id: string | null;
  client_name: string | null;
  mission_label: string | null;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

/** Pull a human-readable line out of an agent's stored output JSON. */
function summarizeOutput(outputJson: string | null): string | null {
  if (!outputJson) return null;
  try {
    const parsed = JSON.parse(outputJson);
    if (parsed == null) return null;
    if (typeof parsed === "string") return parsed;
    if (typeof parsed.message === "string") return parsed.message;
    const counts = Object.entries(parsed)
      .filter(([, v]) => typeof v === "number")
      .map(([k, v]) => `${k}: ${v}`);
    if (counts.length > 0) return counts.join(" · ");
    return null;
  } catch {
    return null;
  }
}

export default async function AgentDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const db = getDb();

  const agent = db.prepare(`SELECT id, code, name, description, task_type, enabled FROM agents WHERE code = ?`).get(code) as
    | AgentRecord
    | undefined;
  if (!agent) notFound();

  const runs = db
    .prepare(
      `SELECT ar.id, ar.status, ar.provider, ar.model, ar.duration_ms, ar.error, ar.output_json, ar.confidence,
              ar.started_at, ar.completed_at,
              c.id as client_id, c.name as client_name, m.label as mission_label
       FROM agent_runs ar
       LEFT JOIN sites s ON s.id = ar.site_id
       LEFT JOIN clients c ON c.id = s.client_id
       LEFT JOIN mission_steps ms ON ms.id = ar.mission_step_id
       LEFT JOIN missions m ON m.id = ms.mission_id
       WHERE ar.agent_id = ?
       ORDER BY COALESCE(ar.started_at, ar.created_at) DESC
       LIMIT 50`
    )
    .all(agent.id) as RunRecord[];

  const stats = db
    .prepare(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) as completed,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
         SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped,
         SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
         AVG(duration_ms) as avg_ms
       FROM agent_runs WHERE agent_id = ?`
    )
    .get(agent.id) as {
    total: number;
    completed: number | null;
    failed: number | null;
    skipped: number | null;
    running: number | null;
    avg_ms: number | null;
  };

  const profile = AGENT_PROFILES[agent.code];
  const meta = AGENT_META[agent.code];
  const Icon = meta?.icon ?? Bot;
  const accent = meta?.accent ?? "var(--fg-cyan)";

  const latest = runs[0];
  const isRunning = (stats.running ?? 0) > 0;
  const liveStatus = isRunning ? "running" : latest ? latest.status : "idle";
  const statusLabel = isRunning ? (meta?.verb ?? "Running") : latest ? latest.status : "idle — never run";

  const successRate = stats.total > 0 ? Math.round(((stats.completed ?? 0) / stats.total) * 100) : null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/missions" className="mb-3 inline-flex items-center gap-1 text-[11px] text-[var(--fg-text-dim)] hover:text-[var(--fg-text)]">
          <ArrowLeft size={12} /> AI Mission Board
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-xl border"
            style={{
              color: accent,
              borderColor: `color-mix(in srgb, ${accent} 45%, transparent)`,
              background: `color-mix(in srgb, ${accent} 10%, transparent)`,
              boxShadow: `0 0 18px color-mix(in srgb, ${accent} 22%, transparent)`,
            }}
          >
            <Icon size={20} />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-[var(--fg-text)]">{agent.name}</h1>
            <p className="mt-0.5 font-mono text-[10.5px] text-[var(--fg-text-faint)]">
              {agent.code} · task type: {agent.task_type}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {profile?.gated ? (
              <span className="fg-pill fg-pill--idle" title="Runs inside the approval-gated protocol sequence">
                <ShieldCheck size={11} /> approval-gated
              </span>
            ) : (
              <span className="fg-pill fg-pill--idle" title="Run on demand from a client page">
                <Zap size={11} /> on demand
              </span>
            )}
            {agent.enabled ? null : <StatusPill status="disabled" />}
            <StatusPill status={liveStatus} label={statusLabel} />
          </div>
        </div>
      </div>

      <Panel title="What this agent does">
        <div className="flex flex-col gap-3 text-xs leading-relaxed">
          <div>
            <div className="fg-field-label">Role</div>
            <p className="text-[var(--fg-text)]">{profile?.role ?? agent.description ?? "—"}</p>
          </div>
          {profile?.why ? (
            <div>
              <div className="fg-field-label">Why it exists</div>
              <p className="text-[var(--fg-text-dim)]">{profile.why}</p>
            </div>
          ) : null}
          {profile?.produces ? (
            <div>
              <div className="fg-field-label">What it produces</div>
              <p className="font-mono text-[11px] text-[var(--fg-text-dim)]">{profile.produces}</p>
            </div>
          ) : null}
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="fg-metric">
          <div className="fg-metric-value">{stats.total}</div>
          <div className="fg-metric-label">Total Runs</div>
        </div>
        <div className="fg-metric">
          <div className="fg-metric-value">{stats.completed ?? 0}</div>
          <div className="fg-metric-label">Completed</div>
        </div>
        <div className="fg-metric">
          <div className="fg-metric-value" style={{ color: (stats.failed ?? 0) > 0 ? "var(--fg-red)" : undefined }}>
            {stats.failed ?? 0}
          </div>
          <div className="fg-metric-label">Failed</div>
        </div>
        <div className="fg-metric">
          <div className="fg-metric-value">{stats.skipped ?? 0}</div>
          <div className="fg-metric-label">Skipped</div>
        </div>
        <div className="fg-metric">
          <div className="fg-metric-value">{successRate != null ? `${successRate}%` : "—"}</div>
          <div className="fg-metric-label">Success Rate</div>
        </div>
        <div className="fg-metric">
          <div className="fg-metric-value">{formatDuration(stats.avg_ms != null ? Math.round(stats.avg_ms) : null)}</div>
          <div className="fg-metric-label">Avg Duration</div>
        </div>
      </div>

      <Panel
        title="Activity Log"
        right={<span className="text-[10px] text-[var(--fg-text-faint)]">{runs.length === 0 ? "no runs yet" : `${runs.length} most recent run(s) · REAL DATA`}</span>}
      >
        {runs.length === 0 ? (
          <p className="text-xs text-[var(--fg-text-dim)]">
            This agent hasn&apos;t run yet. {profile?.gated ? "It runs as part of a protocol — start one from a client page." : "Run it on demand from a client page."}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {runs.map((r) => (
              <div key={r.id} className="fg-rail-row !items-start" style={{ ["--fg-feed" as string]: r.status === "failed" ? "var(--fg-red)" : accent }}>
                <span className="fg-feed-icon">
                  <Icon size={12} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={r.status} />
                    {r.client_name && r.client_id ? (
                      <Link href={`/clients/${r.client_id}`} className="text-[11px] font-bold text-[var(--fg-text)] hover:text-[var(--fg-accent)]">
                        {r.client_name}
                      </Link>
                    ) : (
                      <span className="text-[11px] text-[var(--fg-text-faint)]">no client</span>
                    )}
                    {r.mission_label ? <span className="text-[9.5px] text-[var(--fg-text-faint)]">· {r.mission_label}</span> : null}
                    {r.provider ? <ProviderBadge provider={r.provider} model={r.model} /> : null}
                  </div>
                  {r.error ? (
                    <p className={`mt-1 text-[10.5px] ${r.status === "skipped" ? "text-[var(--fg-text-faint)]" : "text-[var(--fg-red)]"}`}>{r.error}</p>
                  ) : null}
                  {summarizeOutput(r.output_json) ? (
                    <p className="mt-1 text-[10.5px] text-[var(--fg-text-dim)]">{summarizeOutput(r.output_json)}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5 text-[9.5px] text-[var(--fg-text-faint)]">
                  <span>{relativeTime(r.completed_at ?? r.started_at)}</span>
                  <span>{formatDuration(r.duration_ms)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Execution Log"
        right={<span className="text-[10px] text-[var(--fg-text-faint)]">raw stored output per run</span>}
      >
        {runs.length === 0 ? (
          <p className="text-xs text-[var(--fg-text-dim)]">Nothing executed yet — this fills in with each run&apos;s raw output.</p>
        ) : (
          <div className="fg-scroll flex max-h-[560px] flex-col gap-2 overflow-y-auto pr-1">
            {runs.map((r) => (
              <details key={r.id} className="rounded-lg border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] p-3">
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-[11px]">
                  <StatusPill status={r.status} />
                  <span className="font-mono text-[10px] text-[var(--fg-text-faint)]">{r.id.slice(0, 8)}</span>
                  <span className="text-[var(--fg-text-dim)]">{r.client_name ?? "—"}</span>
                  <span className="ml-auto text-[9.5px] text-[var(--fg-text-faint)]">
                    {r.started_at ? new Date(r.started_at.replace(" ", "T") + "Z").toLocaleString() : "—"}
                  </span>
                </summary>
                <div className="mt-3 flex flex-col gap-2 text-[10.5px]">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div>
                      <div className="fg-field-label !mb-1">Duration</div>
                      <div className="text-[var(--fg-text)]">{formatDuration(r.duration_ms)}</div>
                    </div>
                    <div>
                      <div className="fg-field-label !mb-1">Provider</div>
                      <div className="text-[var(--fg-text)]">{r.provider ?? "—"}</div>
                    </div>
                    <div>
                      <div className="fg-field-label !mb-1">Model</div>
                      <div className="truncate text-[var(--fg-text)]">{r.model ?? "—"}</div>
                    </div>
                    <div>
                      <div className="fg-field-label !mb-1">Confidence</div>
                      <div className="text-[var(--fg-text)]">{r.confidence != null ? r.confidence.toFixed(2) : "—"}</div>
                    </div>
                  </div>
                  {r.error ? (
                    <div>
                      <div className="fg-field-label !mb-1">Error</div>
                      <pre className="fg-scroll overflow-x-auto whitespace-pre-wrap text-[10px] text-[var(--fg-red)]">{r.error}</pre>
                    </div>
                  ) : null}
                  <div>
                    <div className="fg-field-label !mb-1">Output</div>
                    <pre className="fg-scroll max-h-64 overflow-auto whitespace-pre-wrap text-[10px] text-[var(--fg-text-dim)]">
                      {r.output_json ? JSON.stringify(JSON.parse(r.output_json), null, 2) : "(no output recorded)"}
                    </pre>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
