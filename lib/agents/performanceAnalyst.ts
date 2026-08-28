import { getDb } from "../db/client";
import type { SiteRow } from "../types";

export interface TopQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
}

export interface PerformanceResult {
  ok: boolean;
  hasSearchConsoleData: boolean;
  hasAnalyticsData: boolean;
  changesApplied: number;
  topQueries: TopQuery[];
  totalClicks: number;
  totalImpressions: number;
  message: string;
}

// Same honesty principle as the Conversion Agent: if Search Console isn't
// connected, this says so rather than estimating a trend it has no basis
// for. Once lib/integrations/syncSearchConsole.ts has actually pulled real
// rows, this starts reporting them — same code path, no separate "demo
// mode."
export async function runPerformanceAnalyst(site: SiteRow): Promise<PerformanceResult> {
  const db = getDb();
  const scRows = db
    .prepare(`SELECT query, SUM(clicks) as clicks, SUM(impressions) as impressions, AVG(ctr) as ctr, AVG(avg_position) as avgPosition
               FROM search_console_snapshots WHERE site_id = ? GROUP BY query ORDER BY clicks DESC LIMIT 10`)
    .all(site.id) as { query: string; clicks: number; impressions: number; ctr: number; avgPosition: number }[];
  const gaCount = (db.prepare(`SELECT COUNT(*) as n FROM analytics_snapshots WHERE site_id = ?`).get(site.id) as { n: number }).n;
  const applied = (
    db.prepare(`SELECT COUNT(*) as n FROM seo_changes sc JOIN pages p ON p.id = sc.page_id WHERE p.site_id = ? AND sc.applied_at IS NOT NULL`).get(site.id) as { n: number }
  ).n;

  const totalClicks = scRows.reduce((n, r) => n + r.clicks, 0);
  const totalImpressions = scRows.reduce((n, r) => n + r.impressions, 0);

  if (scRows.length === 0 && gaCount === 0) {
    return {
      ok: true,
      hasSearchConsoleData: false,
      hasAnalyticsData: false,
      changesApplied: applied,
      topQueries: [],
      totalClicks: 0,
      totalImpressions: 0,
      message: `No Search Console or Analytics data connected yet — real before/after performance measurement needs one of those wired up. ${applied} SEO change(s) have been applied to the live site so far and are ready to be measured once it is.`,
    };
  }

  return {
    ok: true,
    hasSearchConsoleData: scRows.length > 0,
    hasAnalyticsData: gaCount > 0,
    changesApplied: applied,
    topQueries: scRows.map((r) => ({ query: r.query, clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, avgPosition: r.avgPosition })),
    totalClicks,
    totalImpressions,
    message: `${totalClicks} real clicks, ${totalImpressions} real impressions across ${scRows.length} tracked quer${scRows.length === 1 ? "y" : "ies"} (last 28 days).`,
  };
}
