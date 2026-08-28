import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { decide } from "@/lib/db/approvals";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const change = db
    .prepare(
      `SELECT sc.id, p.site_id FROM seo_changes sc JOIN pages p ON p.id = sc.page_id WHERE sc.id = ?`
    )
    .get(id) as { id: string; site_id: string } | undefined;
  if (!change) return NextResponse.json({ error: "Change not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const status = body.status === "approved" || body.status === "rejected" ? body.status : null;
  if (!status) return NextResponse.json({ error: "status must be 'approved' or 'rejected'." }, { status: 400 });

  const approval = decide({
    siteId: change.site_id,
    category: "seo_change",
    subjectType: "seo_change",
    subjectId: id,
    status,
    summary: typeof body.summary === "string" ? body.summary.trim() : undefined,
  });

  db.prepare(`UPDATE seo_changes SET approval_id = ? WHERE id = ?`).run(approval.id, id);

  return NextResponse.json({ ok: true, approval });
}
