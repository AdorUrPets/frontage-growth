import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { getShopifyStatus, disconnectShopify } from "@/lib/db/shopify";

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
  return NextResponse.json(getShopifyStatus(siteId));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const siteId = getSiteId(id);
  if (!siteId) return NextResponse.json({ error: "Client has no site." }, { status: 404 });
  disconnectShopify(siteId);
  return NextResponse.json({ ok: true });
}
