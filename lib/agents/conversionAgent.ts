import { getDb } from "../db/client";
import type { SiteRow } from "../types";

export interface ConversionAnalysisResult {
  ok: boolean;
  hasData: boolean;
  totalConversions: number;
  byType: { eventType: string; count: number }[];
  message: string;
}

// Honest by construction: no conversion tracking is wired up yet (no
// tracking pixel/webhook exists on any client site), so this always
// reports that truthfully instead of fabricating a trend. Once
// lib/db/schema.ts's `conversions` table actually has rows, this starts
// reporting real counts by event_type with zero code changes needed.
export async function runConversionAgent(site: SiteRow): Promise<ConversionAnalysisResult> {
  const db = getDb();
  const total = (db.prepare(`SELECT COUNT(*) as n FROM conversions WHERE site_id = ?`).get(site.id) as { n: number }).n;

  if (total === 0) {
    return {
      ok: true,
      hasData: false,
      totalConversions: 0,
      byType: [],
      message: "No conversion events recorded for this site yet. Conversion tracking (phone_click, contact_form, quote_request, etc.) needs to be wired into the live site before this agent has anything real to analyse.",
    };
  }

  const byType = db
    .prepare(`SELECT event_type as eventType, COUNT(*) as count FROM conversions WHERE site_id = ? GROUP BY event_type ORDER BY count DESC`)
    .all(site.id) as { eventType: string; count: number }[];

  return {
    ok: true,
    hasData: true,
    totalConversions: total,
    byType,
    message: `${total} real conversion event(s) on record.`,
  };
}
