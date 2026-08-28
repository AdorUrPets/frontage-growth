import Link from "next/link";
import { Panel } from "../components/hud/Panel";
import { StatusPill } from "../components/hud/StatusPill";
import { listAudiences, listChannels, listContentOpportunities, listContentAssets } from "@/lib/db/artifacts";
import { Users, Route, Lightbulb, Share2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default function TrafficPage() {
  const audiences = listAudiences();
  const channels = listChannels();
  const opportunities = listContentOpportunities();
  const assets = listContentAssets();

  const enabledChannels = channels.filter((c) => c.enabled).length;
  const draftAssets = assets.filter((a) => a.status === "draft").length;
  const publishedAssets = assets.filter((a) => a.published_at).length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-bold text-[var(--fg-text)]">Traffic Mission Control</h1>
        <p className="mt-1 text-xs text-[var(--fg-text-dim)]">
          Audiences, channels and content the Traffic and Content agents have actually produced. Distribution drafts
          are ready to post manually — nothing here auto-publishes to social.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="fg-metric">
          <div className="fg-metric-value">{audiences.length}</div>
          <div className="fg-metric-label">Audience Segments</div>
        </div>
        <div className="fg-metric">
          <div className="fg-metric-value">{enabledChannels}</div>
          <div className="fg-metric-label">Channels Marked Relevant</div>
        </div>
        <div className="fg-metric">
          <div className="fg-metric-value">{opportunities.length}</div>
          <div className="fg-metric-label">Content Opportunities</div>
        </div>
        <div className="fg-metric">
          <div className="fg-metric-value">{draftAssets}</div>
          <div className="fg-metric-label">Drafts Ready</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Audience Segments" icon={<Users size={13} />} right={<span className="fg-metric-tag">AI ANALYSIS</span>}>
          {audiences.length === 0 ? (
            <p className="text-xs text-[var(--fg-text-dim)]">No audience research yet — run the Audience Discovery Agent from a client page.</p>
          ) : (
            <div className="fg-scroll flex max-h-[360px] flex-col gap-2 overflow-y-auto pr-1">
              {audiences.map((a) => (
                <Link key={a.id} href={`/clients/${a.client_id}#audiences`} className="fg-row flex-col items-stretch !gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--fg-text)]">{a.label}</span>
                    <span className="text-[10px] text-[var(--fg-text-faint)]">{a.client_name}</span>
                  </div>
                  {a.description ? <p className="text-[11px] text-[var(--fg-text-dim)]">{a.description}</p> : null}
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Organic Channels" icon={<Route size={13} />} right={<span className="fg-metric-tag">AI RECOMMENDATION — no ads</span>}>
          {channels.length === 0 ? (
            <p className="text-xs text-[var(--fg-text-dim)]">No channel strategy yet — run the Traffic Strategist from a client page.</p>
          ) : (
            <div className="fg-scroll flex max-h-[360px] flex-col gap-2 overflow-y-auto pr-1">
              {channels.map((c) => (
                <Link key={c.id} href={`/clients/${c.client_id}#channels`} className="fg-row items-start">
                  <StatusPill status={c.enabled ? "online" : "idle"} label={c.enabled ? "relevant" : "not relevant"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[var(--fg-text)]">{c.name}</span>
                      <span className="text-[10px] text-[var(--fg-text-faint)]">{c.client_name}</span>
                    </div>
                    {c.relevance_reason ? <p className="mt-0.5 text-[11px] text-[var(--fg-text-dim)]">{c.relevance_reason}</p> : null}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Content Opportunities" icon={<Lightbulb size={13} />} right={<span className="fg-metric-tag">AI ANALYSIS — from real keyword gaps</span>}>
        {opportunities.length === 0 ? (
          <p className="text-xs text-[var(--fg-text-dim)]">No content opportunities yet — run the Content Opportunity Agent from a client page.</p>
        ) : (
          <div className="fg-scroll flex max-h-[360px] flex-col gap-2 overflow-y-auto pr-1">
            {opportunities.map((o) => (
              <Link key={o.id} href={`/clients/${o.client_id}#content-opportunities`} className="fg-row flex-col items-stretch !gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[var(--fg-text)]">{o.title}</span>
                  <span className="text-[10px] text-[var(--fg-text-faint)]">{o.client_name}</span>
                </div>
                {o.proposed_url ? <span className="font-mono text-[10px] text-[var(--fg-text-faint)]">{o.proposed_url}</span> : null}
                {o.business_relevance ? <p className="text-[11px] text-[var(--fg-text-dim)]">{o.business_relevance}</p> : null}
              </Link>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Content Distribution Drafts"
        icon={<Share2 size={13} />}
        right={<span className="text-[10px] text-[var(--fg-text-faint)]">{publishedAssets} marked published · {draftAssets} draft</span>}
      >
        {assets.length === 0 ? (
          <p className="text-xs text-[var(--fg-text-dim)]">No content drafts yet.</p>
        ) : (
          <div className="fg-scroll flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
            {assets.map((a) => (
              <details key={a.id} className="rounded-lg border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] p-3">
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-[var(--fg-text)]">{a.channel ?? "website"}</span>
                  {a.format ? <span className="fg-metric-tag">{a.format}</span> : null}
                  <StatusPill status={a.status === "qa_passed" ? "online" : a.status === "qa_flagged" ? "error" : "idle"} label={a.status} />
                  <Link href={`/clients/${a.client_id}#content-drafts`} className="ml-auto text-[10px] text-[var(--fg-text-faint)] hover:text-[var(--fg-text-dim)]">
                    {a.client_name} →
                  </Link>
                </summary>
                <pre className="fg-scroll mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-[11px] text-[var(--fg-text-dim)]">{a.body}</pre>
              </details>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
