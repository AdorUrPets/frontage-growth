import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { generateGrowthAgentToken, getGrowthAgentStatus, revokeGrowthAgentToken } from "@/lib/db/growthAgent";

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
  return NextResponse.json(getGrowthAgentStatus(siteId));
}

// (Re)generates the token — the raw value is returned only in this one
// response and never stored or shown again.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const siteId = getSiteId(id);
  if (!siteId) return NextResponse.json({ error: "Client has no site." }, { status: 404 });
  const token = generateGrowthAgentToken(siteId);
  return NextResponse.json({ token });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const siteId = getSiteId(id);
  if (!siteId) return NextResponse.json({ error: "Client has no site." }, { status: 404 });
  revokeGrowthAgentToken(siteId);
  return NextResponse.json({ ok: true });
}
