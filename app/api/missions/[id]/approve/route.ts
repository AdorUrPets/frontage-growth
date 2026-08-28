import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { decide } from "@/lib/db/approvals";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const mission = db.prepare(`SELECT * FROM missions WHERE id = ?`).get(id) as
    | { id: string; site_id: string; protocol: string; status: string; label: string }
    | undefined;
  if (!mission) return NextResponse.json({ error: "Mission not found." }, { status: 404 });
  if (mission.status !== "awaiting_approval") {
    return NextResponse.json({ error: `Mission is "${mission.status}", not awaiting approval.` }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));

  decide({
    siteId: mission.site_id,
    category: "protocol",
    subjectType: "mission",
    subjectId: mission.id,
    status: "approved",
    summary: typeof body.summary === "string" ? body.summary : `${mission.label} protocol approved.`,
  });

  db.prepare(`UPDATE missions SET status = 'complete' WHERE id = ?`).run(mission.id);

  return NextResponse.json({ ok: true });
}
