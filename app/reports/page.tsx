import Link from "next/link";
import { listReportableClients, getClientReport } from "@/lib/db/artifacts";
import { FileText, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default function ReportsPage() {
  const clients = listReportableClients();
  const reports = clients.map((c) => getClientReport(c.id)).filter((r): r is NonNullable<typeof r> => r !== null);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-bold text-[var(--fg-text)]">Reports</h1>
        <p className="mt-1 text-xs text-[var(--fg-text-dim)]">
          A client-facing growth report generated from real mission results — findings, changes shipped, keywords,
          content and real Search Console performance where it&apos;s connected.
        </p>
      </div>

      {reports.length === 0 ? (
        <div className="fg-panel flex flex-col items-center gap-2 py-16 text-center">
          <FileText size={22} className="text-[var(--fg-text-faint)]" />
          <p className="text-xs text-[var(--fg-text-dim)]">No clients yet — add one to generate its first report.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {reports.map((r) => {
            const missionsComplete = r.missions.filter((m) => m.status === "complete").length;
            const openFindings = r.technical.critical + r.technical.high + r.technical.medium + r.technical.low;
            return (
              <Link key={r.client.id} href={`/reports/${r.client.id}`} className="fg-panel block p-5 transition-colors hover:border-[var(--fg-border-bright)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-[var(--fg-text)]">{r.client.name}</div>
                    <div className="truncate text-[11px] text-[var(--fg-text-faint)]">{r.client.siteUrl ?? "no site"}</div>
                  </div>
                  <ArrowRight size={14} className="shrink-0 text-[var(--fg-text-faint)]" />
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                  <div>
                    <div className="text-base font-bold text-[var(--fg-text)]">{missionsComplete}</div>
                    <div className="text-[9px] uppercase tracking-wide text-[var(--fg-text-faint)]">Missions</div>
                  </div>
                  <div>
                    <div className="text-base font-bold text-[var(--fg-text)]">{r.onPage.live}</div>
                    <div className="text-[9px] uppercase tracking-wide text-[var(--fg-text-faint)]">Live Changes</div>
                  </div>
                  <div>
                    <div className="text-base font-bold" style={{ color: openFindings > 0 ? "var(--fg-amber)" : undefined }}>
                      {openFindings}
                    </div>
                    <div className="text-[9px] uppercase tracking-wide text-[var(--fg-text-faint)]">Open Findings</div>
                  </div>
                  <div>
                    <div className="text-base font-bold text-[var(--fg-text)]">{r.keywords.total}</div>
                    <div className="text-[9px] uppercase tracking-wide text-[var(--fg-text-faint)]">Keywords</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
