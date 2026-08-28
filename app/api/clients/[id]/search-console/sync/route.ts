import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { syncSearchConsoleData } from "@/lib/integrations/syncSearchConsole";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = getDb().prepare(`SELECT id FROM sites WHERE client_id = ? ORDER BY created_at ASC LIMIT 1`).get(id) as
    | { id: string }
    | undefined;
  if (!site) return NextResponse.json({ error: "Client has no site." }, { status: 404 });

  const result = await syncSearchConsoleData(site.id);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
