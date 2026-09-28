import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { getFreshAccessTokenForSite } from "@/lib/db/googleAuth";
import { listAnalyticsProperties } from "@/lib/integrations/analytics";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = getDb().prepare(`SELECT id FROM sites WHERE client_id = ? ORDER BY created_at ASC LIMIT 1`).get(id) as
    | { id: string }
    | undefined;
  if (!site) return NextResponse.json({ error: "Client has no site." }, { status: 404 });

  try {
    const accessToken = await getFreshAccessTokenForSite(site.id);
    if (!accessToken) return NextResponse.json({ error: "No Google account assigned to this site yet." }, { status: 400 });
    const properties = await listAnalyticsProperties(accessToken);
    return NextResponse.json({ properties });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to list Analytics properties." }, { status: 502 });
  }
}
