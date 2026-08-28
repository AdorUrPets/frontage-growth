import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { Panel } from "../components/hud/Panel";
import { StatusPill } from "../components/hud/StatusPill";
import { ProviderBadge } from "../components/hud/ProviderBadge";
import { Bot } from "lucide-react";
import type { AgentRow } from "@/lib/types";

export const dynamic = "force-dynamic";

interface MissionRow {
  id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  client_id: string;
  client_name: string;
}

interface LatestRun {
  agent_code: string;
  status: string;
  provider: string | null;
  model: string | null;
  client_id: string | null;
}

export default function MissionsPage() {
  const db = getDb();
  const agents = db.prepare(`SELECT * FROM agents ORDER BY code`).all() as AgentRow[];

  const missions = db
    .prepare(
      `SELECT m.id, m.status, m.started_at, m.completed_at, c.id as client_id, c.name as client_name
       FROM missions m
       JOIN sites s ON s.id = m.site_id
       JOIN clients c ON c.id = s.client_id
       ORDER BY m.created_at DESC
       LIMIT 15`
    )
    .all() as MissionRow[];

  const latestRuns = db
    .prepare(
      `SELECT a.code as agent_code, ar.status, ar.provider, ar.model, c.id as client_id
       FROM agent_runs ar
       JOIN agents a ON a.id = ar.agent_id
       LEFT JOIN sites s ON s.id = ar.site_id
       LEFT JOIN clients c ON c.id = s.client_id
       WHERE ar.id IN (
         SELECT id FROM agent_runs ar2 WHERE ar2.agent_id = ar.agent_id ORDER BY created_at DESC LIMIT 1
       )`
    )
    .all() as LatestRun[];
  const statusByAgentCode = new Map(latestRuns.map((r) => [r.agent_code, r]));


  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold text-[var(--fg-text)]">AI Mission Board</h1>
        <p className="mt-1 text-xs text-[var(--fg-text-dim)]">
          Every agent below is live. Start a protocol from a client page — each card links to that agent&apos;s real output.
        </p>
      </div>

      <Panel title="Recent Missions">
        {missions.length === 0 ? (
          <p className="text-xs text-[var(--fg-text-dim)]">
            No missions run yet — open a client and click &quot;Initialise Growth Mission&quot;.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {missions.map((m) => (
              <Link
                key={m.id}
                href={`/clients/${m.client_id}`}
                className="flex items-center justify-between rounded-lg border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] px-4 py-3 text-xs hover:border-[var(--fg-border-bright)]"
              >
                <span className="font-semibold text-[var(--fg-text)]">{m.client_name}</span>
                <span className="text-[var(--fg-text-faint)]">
                  {m.started_at ? new Date(m.started_at).toLocaleString() : "—"}
                </span>
                <StatusPill status={m.status} />
              </Link>
            ))}
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => {
          const latest = statusByAgentCode.get(agent.code);
          const status = latest?.status === "complete" ? "online" : latest?.status === "failed" ? "error" : latest?.status === "running" ? "busy" : "idle";
          return (
            <Link key={agent.id} href={`/missions/${agent.code}`} className="block transition-transform hover:-translate-y-0.5">
              <Panel title={agent.name} icon={<Bot size={13} />} right={<StatusPill status={status} label={latest?.status ?? "idle"} />}>
                <p className="text-xs text-[var(--fg-text-dim)]">{agent.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-text-faint)]">
                    Task type: {agent.task_type}
                  </span>
                  {latest?.provider ? <ProviderBadge provider={latest.provider} model={latest.model} /> : null}
                </div>
              </Panel>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
