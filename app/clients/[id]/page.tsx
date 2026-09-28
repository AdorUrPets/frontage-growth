import { notFound } from "next/navigation";
import Link from "next/link";
import { getClient } from "@/lib/db/clients";
import { ClientOverview } from "./components/ClientOverview";
import { GrowthMissionPanel } from "./components/GrowthMissionPanel";
import { StandaloneAgents } from "./components/StandaloneAgents";
import { SearchConsolePanel } from "./components/SearchConsolePanel";
import { AnalyticsPanel } from "./components/AnalyticsPanel";
import { SeoToCodePanel } from "./components/SeoToCodePanel";
import { ComingLater } from "../../components/hud/ComingLater";
import { HashScroll } from "../../components/hud/HashScroll";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = getClient(id);
  if (!client) notFound();

  return (
    <div className="flex flex-col gap-6">
      <HashScroll />
      <div>
        <Link href="/clients" className="mb-2 inline-flex items-center gap-1 text-[11px] text-[var(--fg-text-dim)] hover:text-[var(--fg-text)]">
          <ArrowLeft size={12} /> All clients
        </Link>
        <h1 className="text-lg font-bold text-[var(--fg-text)]">{client.name}</h1>
        <p className="mt-1 text-xs text-[var(--fg-text-dim)]">{client.site?.url}</p>
      </div>

      <ClientOverview client={client} />

      {client.site ? (
        <>
          <GrowthMissionPanel clientId={client.id} siteId={client.site.id} />
          <StandaloneAgents clientId={client.id} />
          <SearchConsolePanel clientId={client.id} siteId={client.site.id} siteUrl={client.site.url} />
          <AnalyticsPanel clientId={client.id} />
          <SeoToCodePanel clientId={client.id} />
        </>
      ) : (
        <ComingLater section="Growth Mission Pipeline" phase="add a site URL to this client first" />
      )}
    </div>
  );
}
