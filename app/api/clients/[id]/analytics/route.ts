import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { getSiteAnalyticsStatus, disconnectSiteAnalytics } from "@/lib/db/googleAuth";

function getSiteId(clientId: string): string | null {
  const site = getDb().prepare(`SELECT id FROM sites WHERE client_id = ? ORDER BY created_at ASC LIMIT 1`).get(clientId) as
    | { id: string }
    | undefined;
  return site?.id ?? null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const siteId = getSiteId(id);
  if (!siteId) return NextResponse.json({ error: "Client has no site." }, { status: 404 });

  const status = getSiteAnalyticsStatus(siteId);
  const db = getDb();
  const snapshotCount = (
    db.prepare(`SELECT COUNT(*) as n FROM analytics_snapshots WHERE site_id = ?`).get(siteId) as { n: number }
  ).n;
  const lastSynced = db
    .prepare(`SELECT captured_at FROM analytics_snapshots WHERE site_id = ? ORDER BY captured_at DESC LIMIT 1`)
    .get(siteId) as { captured_at: string } | undefined;

  return NextResponse.json({ siteId, ...status, snapshotCount, lastSyncedAt: lastSynced?.captured_at ?? null });
}

// Unassigns Analytics from this site only — the underlying connection (and any
// other client/integration using it) is untouched.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const siteId = getSiteId(id);
  if (!siteId) return NextResponse.json({ error: "Client has no site." }, { status: 404 });
  disconnectSiteAnalytics(siteId);
  return NextResponse.json({ ok: true });
}
