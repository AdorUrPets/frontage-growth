import Link from "next/link";
import { Panel } from "../components/hud/Panel";
import { StatusPill } from "../components/hud/StatusPill";
import {
  seoCounts,
  listTechnicalFindings,
  findingCategoryCounts,
  listSeoChanges,
  schemaTypeCounts,
  listKeywords,
  listCompetitors,
} from "@/lib/db/artifacts";
import { AlertTriangle, FileText, Braces, Hash, Globe2 } from "lucide-react";

export const dynamic = "force-dynamic";

const SEVERITY_STATUS: Record<string, string> = { CRITICAL: "error", HIGH: "error", MEDIUM: "warn", LOW: "idle", INFO: "idle" };

export default function SeoPage() {
  const counts = seoCounts();
  const findings = listTechnicalFindings(60);
  const categories = findingCategoryCounts();
  const changes = listSeoChanges(40);
  const schemaTypes = schemaTypeCounts();
  const keywords = listKeywords(60);
  const competitors = listCompetitors(60);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-bold text-[var(--fg-text)]">SEO Mission Control</h1>
        <p className="mt-1 text-xs text-[var(--fg-text-dim)]">
          Real technical findings, on-page proposals, schema and keyword work across every client — every row here is
          something an agent actually produced, not a projection.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="fg-metric">
          <div className="fg-metric-value">{counts.pages}</div>
          <div className="fg-metric-label">Pages Crawled</div>
        </div>
        <div className="fg-metric">
          <div className="fg-metric-value" style={{ color: counts.findingsHigh > 0 ? "var(--fg-red)" : undefined }}>
            {counts.findingsOpen}
          </div>
          <div className="fg-metric-label">Open Findings</div>
        </div>
        <div className="fg-metric">
          <div className="fg-metric-value">{counts.proposalsPending}</div>
          <div className="fg-metric-label">Proposals Pending</div>
        </div>
        <div className="fg-metric">
          <div className="fg-metric-value">{counts.proposalsLive}</div>
          <div className="fg-metric-label">Changes Live</div>
        </div>
        <div className="fg-metric">
          <div className="fg-metric-value">{counts.schemaProposals}</div>
          <div className="fg-metric-label">Schema Proposals</div>
        </div>
        <div className="fg-metric">
          <div className="fg-metric-value">{counts.keywords}</div>
          <div className="fg-metric-label">Keywords Tracked</div>
        </div>
      </div>

      <Panel
        title="Technical SEO Findings"
        icon={<AlertTriangle size={13} />}
        right={
          <span className="text-[10px] text-[var(--fg-text-faint)]">
            {categories.map((c) => `${c.category}: ${c.n}`).join(" · ") || "none open"}
          </span>
        }
      >
        {findings.length === 0 ? (
          <p className="text-xs text-[var(--fg-text-dim)]">No open technical findings — either nothing's been audited yet, or the site is clean.</p>
        ) : (
          <div className="fg-scroll flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
            {findings.map((f) => (
              <Link key={f.id} href={`/clients/${f.client_id}#technical-findings`} className="fg-row items-start">
                <StatusPill status={SEVERITY_STATUS[f.severity] ?? "idle"} label={f.severity} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--fg-text)]">{f.client_name}</span>
                    <span className="text-[10px] uppercase tracking-wide text-[var(--fg-text-faint)]">{f.category}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--fg-text-dim)]">{f.finding}</div>
                  {f.page_url ? <div className="mt-0.5 truncate font-mono text-[10px] text-[var(--fg-text-faint)]">{f.page_url}</div> : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="On-Page SEO Changes"
        icon={<FileText size={13} />}
        right={
          <span className="text-[10px] text-[var(--fg-text-faint)]">
            {counts.proposalsPending} pending · {counts.proposalsApproved} approved, not live · {counts.proposalsLive} live
          </span>
        }
      >
        {changes.length === 0 ? (
          <p className="text-xs text-[var(--fg-text-dim)]">No on-page proposals yet — run the On-Page SEO Agent from a client page.</p>
        ) : (
          <div className="fg-scroll flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
            {changes.map((c) => (
              <Link key={c.id} href={`/clients/${c.client_id}#seo-proposals`} className="fg-row flex-col items-stretch !gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] text-[var(--fg-text-faint)]">
                    {c.client_name} · {c.page_url} · {c.field}
                  </span>
                  <StatusPill status={c.applied_at ? "online" : c.approval_id ? "warn" : "idle"} label={c.applied_at ? "live" : c.approval_id ? "approved" : "pending"} />
                </div>
                <div className="text-[11px] text-[var(--fg-text)]">{c.after_value}</div>
              </Link>
            ))}
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Schema Proposals" icon={<Braces size={13} />} right={<span className="fg-metric-tag">REAL FIELDS ONLY</span>}>
          {schemaTypes.length === 0 ? (
            <p className="text-xs text-[var(--fg-text-dim)]">No schema proposals yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {schemaTypes.map((s) => (
                <div key={s.schema_type} className="flex items-center justify-between rounded-lg border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] px-3 py-2 text-xs">
                  <span className="font-bold text-[var(--fg-text)]">{s.schema_type}</span>
                  <span className="text-[var(--fg-text-dim)]">{s.n} page(s)</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Competitors Seen in Real Search Results" icon={<Globe2 size={13} />}>
          {competitors.length === 0 ? (
            <p className="text-xs text-[var(--fg-text-dim)]">No competitors identified yet.</p>
          ) : (
            <div className="fg-scroll flex max-h-[220px] flex-wrap gap-2 overflow-y-auto pr-1">
              {competitors.map((cp) => (
                <Link
                  key={cp.id}
                  href={`/clients/${cp.client_id}#competitors`}
                  className="rounded-full border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] px-3 py-1 text-[11px] text-[var(--fg-text)] hover:border-[var(--fg-border-bright)]"
                  title={cp.client_name}
                >
                  {cp.domain}
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Keyword Clusters" icon={<Hash size={13} />} right={<span className="text-[10px] text-[var(--fg-text-faint)]">{counts.clusters} cluster(s)</span>}>
        {keywords.length === 0 ? (
          <p className="text-xs text-[var(--fg-text-dim)]">No keyword research yet — run the Keyword Research Agent from a client page.</p>
        ) : (
          <div className="fg-scroll flex max-h-[420px] flex-col gap-1.5 overflow-y-auto pr-1">
            {keywords.map((k) => (
              <Link key={k.id} href={`/clients/${k.client_id}#keywords`} className="fg-row justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="w-7 shrink-0 font-mono text-[10px] font-bold text-[var(--fg-text-faint)]">{k.priority ?? "—"}</span>
                  <span className="min-w-0 truncate text-xs text-[var(--fg-text)]">{k.keyword}</span>
                  {k.cluster_label ? <span className="fg-metric-tag shrink-0">{k.cluster_label}</span> : null}
                </div>
                <span className="shrink-0 text-[10px] text-[var(--fg-text-faint)]">{k.client_name}</span>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
