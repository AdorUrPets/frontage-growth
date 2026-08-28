import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { nextProtocolAfter, getProtocol, PROTOCOL_SEQUENCE } from "@/lib/protocols/definitions";
import type { SiteRow } from "@/lib/types";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const site = db.prepare(`SELECT * FROM sites WHERE client_id = ? ORDER BY created_at ASC LIMIT 1`).get(id) as SiteRow | undefined;
  if (!site) return NextResponse.json({ error: "This client has no site on file." }, { status: 404 });

  const profile = db.prepare(`SELECT * FROM business_profiles WHERE client_id = ? ORDER BY created_at DESC LIMIT 1`).get(id);
  const crawl = db.prepare(`SELECT * FROM crawls WHERE site_id = ? ORDER BY created_at DESC LIMIT 1`).get(site.id);
  const pages = crawl
    ? db.prepare(`SELECT * FROM crawl_pages WHERE crawl_id = ? ORDER BY page_type, url`).all((crawl as { id: string }).id)
    : [];

  const missions = db.prepare(`SELECT * FROM missions WHERE site_id = ? ORDER BY created_at DESC`).all(site.id) as {
    id: string;
    protocol: string;
    status: string;
    created_at: string;
  }[];

  // The furthest-along completed protocol determines what's next in the
  // fixed sequence — not just the most recently completed one, since
  // re-running an earlier protocol shouldn't roll the pipeline backwards.
  const completedProtocols = new Set(missions.filter((m) => m.status === "complete").map((m) => m.protocol));
  const furthestCompletedIndex = PROTOCOL_SEQUENCE.reduce(
    (furthest, p, i) => (completedProtocols.has(p.code) ? i : furthest),
    -1
  );
  const lastApprovedProtocol = furthestCompletedIndex >= 0 ? PROTOCOL_SEQUENCE[furthestCompletedIndex].code : null;
  const currentMission = missions[0] ?? null; // most recent, regardless of status
  const next = nextProtocolAfter(lastApprovedProtocol);
  const nextAvailableProtocol =
    !currentMission || currentMission.status === "complete" || currentMission.status === "failed"
      ? next
      : null; // a mission is actively running or awaiting approval — nothing new to start yet

  const technicalFindings = db.prepare(`SELECT * FROM technical_findings WHERE site_id = ? ORDER BY severity, created_at DESC`).all(site.id);
  const schemaFindings = db
    .prepare(`SELECT sf.* FROM schema_findings sf JOIN pages p ON p.id = sf.page_id WHERE p.site_id = ? ORDER BY sf.created_at DESC`)
    .all(site.id);
  const keywordClusters = db.prepare(`SELECT * FROM keyword_clusters WHERE site_id = ?`).all(site.id);
  const keywords = db.prepare(`SELECT * FROM keywords WHERE site_id = ? ORDER BY priority, keyword`).all(site.id);
  const audiences = db.prepare(`SELECT * FROM audiences WHERE site_id = ?`).all(site.id);
  const channels = db.prepare(`SELECT * FROM channels WHERE site_id = ? ORDER BY enabled DESC, name`).all(site.id);
  const competitors = db.prepare(`SELECT * FROM competitors WHERE site_id = ? ORDER BY domain`).all(site.id);
  const contentOpportunities = db.prepare(`SELECT * FROM content_opportunities WHERE site_id = ? ORDER BY created_at DESC`).all(site.id);
  const contentAssets = db.prepare(`SELECT * FROM content_assets WHERE site_id = ? ORDER BY created_at DESC`).all(site.id);

  return NextResponse.json({
    profile,
    crawl,
    pages,
    missions,
    technicalFindings,
    schemaFindings,
    keywordClusters,
    keywords,
    audiences,
    channels,
    competitors,
    contentOpportunities,
    contentAssets,
    currentProtocol: currentMission ? getProtocol(currentMission.protocol) : null,
    nextProtocol: nextAvailableProtocol,
  });
}
