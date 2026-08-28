import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientReport } from "@/lib/db/artifacts";
import { Panel } from "../../components/hud/Panel";
import { StatusPill } from "../../components/hud/StatusPill";
import { ArrowLeft, Rocket, Wrench, FileText, Braces, Hash, Users, Route, UploadCloud, Search } from "lucide-react";

export const dynamic = "force-dynamic";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function ClientReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = getClientReport(id);
  if (!report) notFound();

  const { client, profile, missions, technical, onPage, schema, keywords, content, traffic, deployments, searchConsole, pagesCrawled, competitorsFound } =
    report;
  const openFindings = technical.critical + technical.high + technical.medium + technical.low;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/reports" className="mb-2 inline-flex items-center gap-1 text-[11px] text-[var(--fg-text-dim)] hover:text-[var(--fg-text)]">
          <ArrowLeft size={12} /> All reports
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-[var(--fg-text)]">{client.name} — Growth Report</h1>
            <p className="mt-1 text-xs text-[var(--fg-text-dim)]">
              {client.siteUrl ?? "no site"} {client.primaryLocation ? `· ${client.primaryLocation}` : ""}
            </p>
          </div>
          <Link href={`/clients/${client.id}`} className="fg-btn">
            Open Client Page <ArrowLeft size={12} className="rotate-180" />
          </Link>
        </div>
      </div>

      {profile ? (
        <Panel title="Business Profile" icon={<FileText size={13} />} right={<span className="fg-metric-tag">AI ANALYSIS</span>}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="fg-field-label">Industry</div>
              <div className="text-xs text-[var(--fg-text)]">{profile.industry ?? "—"}</div>
            </div>
            <div>
              <div className="fg-field-label">Service Area</div>
              <div className="text-xs text-[var(--fg-text)]">{profile.serviceArea ?? "—"}</div>
            </div>
            <div>
              <div className="fg-field-label">Primary Conversion</div>
              <div className="text-xs text-[var(--fg-text)]">{profile.primaryConversion ?? "—"}</div>
            </div>
            <div>
              <div className="fg-field-label">Secondary Conversion</div>
              <div className="text-xs text-[var(--fg-text)]">{profile.secondaryConversion ?? "—"}</div>
            </div>
          </div>
          {profile.summary ? <p className="mt-4 text-xs text-[var(--fg-text-dim)]">{profile.summary}</p> : null}
        </Panel>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <div className="fg-metric">
          <div className="fg-metric-value">{pagesCrawled}</div>
          <div className="fg-metric-label">Pages Crawled</div>
        </div>
        <div className="fg-metric">
          <div className="fg-metric-value" style={{ color: technical.critical + technical.high > 0 ? "var(--fg-red)" : undefined }}>
            {openFindings}
          </div>
          <div className="fg-metric-label">Open Findings</div>
        </div>
        <div className="fg-metric">
          <div className="fg-metric-value">{onPage.live}</div>
          <div className="fg-metric-label">Changes Live</div>
        </div>
        <div className="fg-metric">
          <div className="fg-metric-value">{schema.total}</div>
          <div className="fg-metric-label">Schema Proposals</div>
        </div>
        <div className="fg-metric">
          <div className="fg-metric-value">{keywords.total}</div>
          <div className="fg-metric-label">Keywords</div>
        </div>
        <div className="fg-metric">
          <div className="fg-metric-value">{competitorsFound}</div>
          <div className="fg-metric-label">Competitors Seen</div>
        </div>
      </div>

      <Panel title="Mission Timeline" icon={<Rocket size={13} />}>
        {missions.length === 0 ? (
          <p className="text-xs text-[var(--fg-text-dim)]">No missions run yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {missions.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <StatusPill status={m.status} />
                  <span className="font-bold text-[var(--fg-text)]">{m.protocol.toUpperCase()}</span>
                  <span className="text-[var(--fg-text-faint)]">{m.stepsDone} / {m.stepsTotal} steps</span>
                </div>
                <span className="text-[10px] text-[var(--fg-text-faint)]">{fmt(m.completedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Technical SEO" icon={<Wrench size={13} />}>
          <div className="grid grid-cols-4 gap-2 text-center">
            {(["critical", "high", "medium", "low"] as const).map((sev) => (
              <div key={sev} className="rounded-lg border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] py-2">
                <div className="text-base font-bold" style={{ color: sev === "critical" || sev === "high" ? "var(--fg-red)" : undefined }}>
                  {technical[sev]}
                </div>
                <div className="text-[9px] uppercase tracking-wide text-[var(--fg-text-faint)]">{sev}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10.5px] text-[var(--fg-text-faint)]">
            Findings stay open until fixed — there&apos;s no auto-resolve, so this is the real current count.
          </p>
        </Panel>

        <Panel title="On-Page SEO" icon={<FileText size={13} />}>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] py-2">
              <div className="text-base font-bold text-[var(--fg-text)]">{onPage.pending}</div>
              <div className="text-[9px] uppercase tracking-wide text-[var(--fg-text-faint)]">Pending</div>
            </div>
            <div className="rounded-lg border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] py-2">
              <div className="text-base font-bold text-[var(--fg-text)]">{onPage.approved}</div>
              <div className="text-[9px] uppercase tracking-wide text-[var(--fg-text-faint)]">Approved</div>
            </div>
            <div className="rounded-lg border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] py-2">
              <div className="text-base font-bold text-[var(--fg-accent)]">{onPage.live}</div>
              <div className="text-[9px] uppercase tracking-wide text-[var(--fg-text-faint)]">Live</div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Schema" icon={<Braces size={13} />}>
          {schema.byType.length === 0 ? (
            <p className="text-xs text-[var(--fg-text-dim)]">None yet.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {schema.byType.map((s) => (
                <div key={s.schema_type} className="flex justify-between text-xs">
                  <span className="text-[var(--fg-text)]">{s.schema_type}</span>
                  <span className="text-[var(--fg-text-faint)]">{s.n}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Keywords" icon={<Hash size={13} />}>
          <div className="text-xs text-[var(--fg-text)]">{keywords.total} keyword(s) in {keywords.clusters} cluster(s)</div>
        </Panel>

        <Panel title="Content" icon={<FileText size={13} />}>
          <div className="flex flex-col gap-1 text-xs text-[var(--fg-text)]">
            <span>{content.opportunities} opportunities identified</span>
            <span>{content.draftsReady} draft(s) ready</span>
            <span>{content.published} marked published</span>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Traffic & Audience" icon={<Users size={13} />}>
          <div className="flex flex-col gap-1 text-xs text-[var(--fg-text)]">
            <span>{traffic.audiences} audience segment(s) identified</span>
            <span className="flex items-center gap-1"><Route size={11} className="text-[var(--fg-text-faint)]" /> {traffic.channelsRelevant} of {traffic.channelsTotal} channels marked relevant</span>
          </div>
        </Panel>

        <Panel title="Search Console" icon={<Search size={13} />}>
          {!searchConsole.connected ? (
            <p className="text-xs text-[var(--fg-text-dim)]">Not connected yet — connect it from the client page to see real organic performance here.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-base font-bold text-[var(--fg-text)]">{searchConsole.clicks.toLocaleString()}</div>
                <div className="text-[9px] uppercase tracking-wide text-[var(--fg-text-faint)]">Clicks</div>
              </div>
              <div>
                <div className="text-base font-bold text-[var(--fg-text)]">{searchConsole.impressions.toLocaleString()}</div>
                <div className="text-[9px] uppercase tracking-wide text-[var(--fg-text-faint)]">Impressions</div>
              </div>
              <div>
                <div className="text-base font-bold text-[var(--fg-text)]">{searchConsole.avgPosition != null ? searchConsole.avgPosition.toFixed(1) : "—"}</div>
                <div className="text-[9px] uppercase tracking-wide text-[var(--fg-text-faint)]">Avg Position</div>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Deployments" icon={<UploadCloud size={13} />}>
        {deployments.length === 0 ? (
          <p className="text-xs text-[var(--fg-text-dim)]">Nothing pushed live yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {deployments.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <StatusPill status={d.status === "success" || d.status === "partial" ? "online" : d.status === "failed" ? "error" : "warn"} />
                  <span className="text-[var(--fg-text)]">{d.adapter}</span>
                  <span className="text-[var(--fg-text-dim)]">{d.summary}</span>
                </div>
                <span className="text-[10px] text-[var(--fg-text-faint)]">{fmt(d.deployedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
