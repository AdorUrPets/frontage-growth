import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { setSearchConsoleProperty } from "@/lib/db/googleAuth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = getDb().prepare(`SELECT id FROM sites WHERE client_id = ? ORDER BY created_at ASC LIMIT 1`).get(id) as
    | { id: string }
    | undefined;
  if (!site) return NextResponse.json({ error: "Client has no site." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const propertyUrl = typeof body.propertyUrl === "string" ? body.propertyUrl : "";
  if (!propertyUrl) return NextResponse.json({ error: "propertyUrl is required." }, { status: 400 });

  setSearchConsoleProperty(site.id, propertyUrl);
  return NextResponse.json({ ok: true });
}
