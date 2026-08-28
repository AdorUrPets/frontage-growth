import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { verifyGrowthAgentToken } from "@/lib/db/growthAgent";

interface ChangeRow {
  field: string;
  after_value: string;
  created_at: string;
}

// Public, token-authenticated read API for the Growth Agent embedded in a
// live client site — the site calls this itself to fetch its own
// currently-approved SEO values. Pure read: no writes, no applied_at/
// deployments bookkeeping — the site is the source of truth for what it
// renders, and just asks "what's currently approved" on every call.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  const site = verifyGrowthAgentToken(token);
  if (!site) return NextResponse.json({ error: "Invalid or missing token." }, { status: 401 });

  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing ?url= query param." }, { status: 400 });

  const db = getDb();
  const page = db.prepare(`SELECT id FROM pages WHERE site_id = ? AND url = ?`).get(site.id, url) as { id: string } | undefined;
  if (!page) return NextResponse.json({ error: "No known page for that URL." }, { status: 404 });

  const changes = db
    .prepare(
      `SELECT sc.field, sc.after_value, sc.created_at
       FROM seo_changes sc
       JOIN approvals ap ON ap.subject_type = 'seo_change' AND ap.subject_id = sc.id
       WHERE sc.page_id = ? AND ap.status = 'approved' AND sc.field IN ('title', 'meta_description', 'h1')
       ORDER BY sc.created_at DESC`
    )
    .all(page.id) as ChangeRow[];

  const latest: Record<string, string> = {};
  for (const c of changes) {
    if (!(c.field in latest)) latest[c.field] = c.after_value;
  }

  return NextResponse.json({
    title: latest.title ?? null,
    metaDescription: latest.meta_description ?? null,
    h1: latest.h1 ?? null,
  });
}
