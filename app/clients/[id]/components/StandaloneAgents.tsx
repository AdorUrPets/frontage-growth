"use client";

import { useEffect, useState, useCallback } from "react";
import { Panel } from "../../../components/hud/Panel";
import { ProviderBadge } from "../../../components/hud/ProviderBadge";
import { Compass, Target, TrendingUp, Play, Loader2, Mail } from "lucide-react";

interface AgentRunRow {
  id: string;
  status: string;
  output_json: string | null;
  error: string | null;
  provider: string | null;
  model: string | null;
  completed_at: string | null;
}

interface NextAction {
  priority: string;
  action: string;
  evidence: string;
}

function AgentCard({ clientId, code, label, icon: Icon }: { clientId: string; code: string; label: string; icon: typeof Compass }) {
  const [run, setRun] = useState<AgentRunRow | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}/agents/${code}`);
    const data = await res.json();
    setRun(data.run);
  }, [clientId, code]);

  useEffect(() => { load(); }, [load]);

  async function trigger() {
    setRunning(true);
    await fetch(`/api/clients/${clientId}/agents/${code}`, { method: "POST" });
    setRunning(false);
    load();
  }

  const output = run?.output_json ? JSON.parse(run.output_json) : null;

  return (
    <Panel
      id={`agent-${code}`}
      title={label}
      icon={<Icon size={13} />}
      right={
        <button className="fg-btn" onClick={trigger} disabled={running}>
          {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} {running ? "Running…" : "Run"}
        </button>
      }
    >
      {!run ? (
        <p className="text-xs text-[var(--fg-text-dim)]">Not run yet.</p>
      ) : run.status === "failed" ? (
        <p className="text-xs text-[var(--fg-red)]">{run.error}</p>
      ) : code === "growth_commander" && output?.actions ? (
        <div className="flex flex-col gap-2">
          {(output.actions as NextAction[]).map((a, i) => (
            <div key={i} className="rounded-lg border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] p-3">
              <div className="flex items-center gap-2">
                <span className="fg-metric-tag">{a.priority}</span>
                <span className="text-xs font-semibold text-[var(--fg-text)]">{a.action}</span>
              </div>
              <p className="mt-1 text-[11px] text-[var(--fg-text-dim)]">{a.evidence}</p>
            </div>
          ))}
        </div>
      ) : code === "performance_analyst" && output?.hasSearchConsoleData ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[var(--fg-text-dim)]">{output.message}</p>
          <div className="flex flex-col gap-1">
            {(output.topQueries as { query: string; clicks: number; impressions: number; avgPosition: number }[]).slice(0, 6).map((q, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] px-3 py-2 text-[11px]">
                <span className="min-w-0 flex-1 truncate text-[var(--fg-text)]">{q.query}</span>
                <span className="text-[var(--fg-text-faint)]">{q.clicks} clicks · {q.impressions} impr · pos {q.avgPosition.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-[var(--fg-text-dim)]">{output?.message ?? JSON.stringify(output)}</p>
      )}
      {run?.provider ? (
        <div className="mt-3 flex items-center justify-between text-[10px] text-[var(--fg-text-faint)]">
          <ProviderBadge provider={run.provider} model={run.model} />
          {run.completed_at ? <span>{new Date(run.completed_at).toLocaleString()}</span> : null}
        </div>
      ) : null}
    </Panel>
  );
}

export function StandaloneAgents({ clientId }: { clientId: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <AgentCard clientId={clientId} code="growth_commander" label="Growth Commander" icon={Compass} />
      <AgentCard clientId={clientId} code="conversion_agent" label="Conversion Agent" icon={Target} />
      <AgentCard clientId={clientId} code="performance_analyst" label="Performance Analyst" icon={TrendingUp} />
      <AgentCard clientId={clientId} code="email_dns_health" label="Email & DNS Health" icon={Mail} />
    </div>
  );
}
