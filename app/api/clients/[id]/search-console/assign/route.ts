import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { assignSiteGoogleConnection } from "@/lib/db/googleAuth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = getDb().prepare(`SELECT id FROM sites WHERE client_id = ? ORDER BY created_at ASC LIMIT 1`).get(id) as
    | { id: string }
    | undefined;
  if (!site) return NextResponse.json({ error: "Client has no site." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const connectionId = typeof body.connectionId === "string" ? body.connectionId : "";
  if (!connectionId) return NextResponse.json({ error: "connectionId is required." }, { status: 400 });

  assignSiteGoogleConnection(site.id, connectionId);
  return NextResponse.json({ ok: true });
}
