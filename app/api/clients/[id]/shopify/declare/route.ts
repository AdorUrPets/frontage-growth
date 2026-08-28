import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { setSitePlatform } from "@/lib/db/shopify";

function getSiteId(clientId: string): string | null {
  const site = getDb().prepare(`SELECT id FROM sites WHERE client_id = ? ORDER BY created_at ASC LIMIT 1`).get(clientId) as
    | { id: string }
    | undefined;
  return site?.id ?? null;
}

// Explicit human declaration that a client's site IS a Shopify store —
// separate from `cms` (a passive crawl-time guess) and from actually
// completing OAuth. Nothing downstream (agents, the connect form) treats a
// client as Shopify until this has been called.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const siteId = getSiteId(id);
  if (!siteId) return NextResponse.json({ error: "Client has no site." }, { status: 404 });
  setSitePlatform(siteId, "shopify");
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const siteId = getSiteId(id);
  if (!siteId) return NextResponse.json({ error: "Client has no site." }, { status: 404 });
  setSitePlatform(siteId, null);
  return NextResponse.json({ ok: true });
}
