import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { getSiteGoogleStatus, getSiteAnalyticsStatus } from "@/lib/db/googleAuth";
import { findSiteForDomain } from "@/lib/growthStatus";

// Cross-app read for Pentest Mission Control: is this domain's Frontage
// Growth work far enough along to be included in a combined push? Every
// field here is a live DB derivation - no invented "ready" flag beyond a
// straight AND of real, already-stored signals.
export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain");
  if (!domain) return NextResponse.json({ error: "domain query param is required." }, { status: 400 });

  const match = findSiteForDomain(domain);
  if (!match) return NextResponse.json({ found: false });

  const { site, client } = match;
  const db = getDb();

  const missions = db
    .prepare(`SELECT protocol, status, created_at FROM missions WHERE site_id = ? ORDER BY created_at DESC`)
    .all(site.id) as { protocol: string; status: string; created_at: string }[];

  function protocolState(code: string) {
    const rows = missions.filter((m) => m.protocol === code);
    const complete = rows.find((m) => m.status === "complete");
    return {
      missionStatus: complete ? "complete" : rows[0]?.status ?? "not_started",
      completedAt: complete?.created_at ?? null,
    };
  }

  const seo = protocolState("seo");
  const traffic = protocolState("traffic");
  const searchConsoleStatus = getSiteGoogleStatus(site.id);
  const analyticsStatus = getSiteAnalyticsStatus(site.id);

  const pendingCommits = db
    .prepare(
      `SELECT id, adapter, status, summary, rollback_ref, deployed_at, created_at
       FROM deployments WHERE site_id = ? AND status = 'committed' ORDER BY created_at DESC`
    )
    .all(site.id);

  const blockingReasons: string[] = [];
  if (seo.missionStatus !== "complete") blockingReasons.push("SEO protocol not complete.");
  if (traffic.missionStatus !== "complete") blockingReasons.push("Traffic protocol not complete.");
  if (!searchConsoleStatus.connected) blockingReasons.push("Search Console not connected.");
  if (!analyticsStatus.connected) blockingReasons.push("Analytics not connected.");

  return NextResponse.json({
    found: true,
    siteId: site.id,
    clientId: client.id,
    clientName: client.name,
    repoLocalPath: site.repo_local_path,
    seo,
    traffic,
    searchConsole: { connected: searchConsoleStatus.connected, property: searchConsoleStatus.property },
    analytics: { connected: analyticsStatus.connected, propertyId: analyticsStatus.propertyId },
    pendingCommits,
    ready: blockingReasons.length === 0,
    blockingReasons,
    reportUrl: `/api/clients/${client.id}/report`,
  });
}
