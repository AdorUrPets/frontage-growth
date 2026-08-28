import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get("siteId");
  if (!siteId) return NextResponse.json({ error: "siteId is required." }, { status: 400 });

  const rows = getDb()
    .prepare(
      `SELECT sc.*, p.url as page_url, ap.status as approval_status, ap.summary as approval_summary
       FROM seo_changes sc
       JOIN pages p ON p.id = sc.page_id
       LEFT JOIN approvals ap ON ap.subject_type = 'seo_change' AND ap.subject_id = sc.id
       WHERE p.site_id = ?
       ORDER BY sc.created_at DESC`
    )
    .all(siteId);

  return NextResponse.json({ changes: rows });
}
