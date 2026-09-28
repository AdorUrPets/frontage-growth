import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { getFreshAccessTokenForSite, setAnalyticsProperty } from "@/lib/db/googleAuth";
import { verifyAnalyticsProperty } from "@/lib/integrations/analytics";

// The real gate: analytics_connected is only ever set once verifyAnalyticsProperty() has
// actually round-tripped to Google's Admin API and confirmed this property is real and
// accessible with the site's current token - never set on the strength of a client-submitted
// propertyId alone.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = getDb().prepare(`SELECT id FROM sites WHERE client_id = ? ORDER BY created_at ASC LIMIT 1`).get(id) as
    | { id: string }
    | undefined;
  if (!site) return NextResponse.json({ error: "Client has no site." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const propertyId = typeof body.propertyId === "string" ? body.propertyId.replace(/^properties\//, "") : "";
  if (!propertyId) return NextResponse.json({ error: "propertyId is required." }, { status: 400 });

  try {
    const accessToken = await getFreshAccessTokenForSite(site.id);
    if (!accessToken) return NextResponse.json({ error: "No Google account assigned to this site yet." }, { status: 400 });

    const verified = await verifyAnalyticsProperty(propertyId, accessToken);
    setAnalyticsProperty(site.id, propertyId);
    return NextResponse.json({ ok: true, displayName: verified.displayName });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to verify Analytics property." }, { status: 502 });
  }
}
