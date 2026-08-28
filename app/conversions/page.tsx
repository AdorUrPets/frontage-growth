import Link from "next/link";
import { Panel } from "../components/hud/Panel";
import { listConversionGoals, conversionCounts } from "@/lib/db/artifacts";
import { Target, Activity } from "lucide-react";

export const dynamic = "force-dynamic";

export default function ConversionsPage() {
  const goals = listConversionGoals();
  const counts = conversionCounts();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-bold text-[var(--fg-text)]">Conversion Intelligence</h1>
        <p className="mt-1 text-xs text-[var(--fg-text-dim)]">
          What the Business Understanding Agent determined each client should be optimising for, and real conversion
          events once a tracking pixel is wired into a client site — that part isn&apos;t built yet, so it says so below
          rather than inventing numbers.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="fg-metric">
          <div className="fg-metric-value">{goals.length}</div>
          <div className="fg-metric-label">Clients With Conversion Goals</div>
        </div>
        <div className="fg-metric">
          <div className="fg-metric-value">{counts.total}</div>
          <div className="fg-metric-label">Conversion Events Recorded</div>
        </div>
        <div className="fg-metric">
          <div className="fg-metric-value">{counts.sitesWithAnalytics}</div>
          <div className="fg-metric-label">Sites With Analytics Connected</div>
        </div>
      </div>

      <Panel title="Conversion Goals" icon={<Target size={13} />} right={<span className="fg-metric-tag">AI ANALYSIS — from real business profile</span>}>
        {goals.length === 0 ? (
          <p className="text-xs text-[var(--fg-text-dim)]">
            No business profile built yet — run the Business Understanding Agent from a client page to determine what
            it should be optimising for.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {goals.map((g) => (
              <Link key={g.client_id} href={`/clients/${g.client_id}#business-profile`} className="fg-row flex-col items-stretch !gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--fg-text)]">{g.client_name}</span>
                  {g.industry ? <span className="fg-metric-tag">{g.industry}</span> : null}
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <div className="fg-field-label !mb-0.5">Primary</div>
                    <div className="text-[var(--fg-text)]">{g.primary_conversion ?? "—"}</div>
                  </div>
                  <div>
                    <div className="fg-field-label !mb-0.5">Secondary</div>
                    <div className="text-[var(--fg-text)]">{g.secondary_conversion ?? "—"}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Conversion Events" icon={<Activity size={13} />} right={<span className="fg-metric-tag">REAL DATA</span>}>
        {counts.total === 0 ? (
          <p className="text-xs text-[var(--fg-text-dim)]">
            No conversion events recorded yet. This needs a tracking pixel or webhook wired into a client site to
            write real rows into the <code className="font-mono">conversions</code> table — that integration hasn&apos;t
            been built yet, so this honestly shows zero rather than a fabricated number.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {counts.byType.map((t) => (
              <div key={t.event_type} className="flex items-center justify-between rounded-lg border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] px-3 py-2 text-xs">
                <span className="font-bold text-[var(--fg-text)]">{t.event_type}</span>
                <span className="text-[var(--fg-text-dim)]">{t.n}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
