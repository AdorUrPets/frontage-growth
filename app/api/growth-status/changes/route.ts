import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { findSiteForDomain } from "@/lib/growthStatus";

// Real before/after SEO edits for this domain, for the combined
// pentest+Frontage-Growth review — actual rows from seo_changes /
// schema_findings / technical_findings, never a synthesized summary.
export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain");
  if (!domain) return NextResponse.json({ error: "domain query param is required." }, { status: 400 });

  const match = findSiteForDomain(domain);
  if (!match) return NextResponse.json({ found: false });

  const { site } = match;
  const db = getDb();

  const seoChanges = db
    .prepare(
      `SELECT sc.id, sc.page_id, p.url as page_url, sc.field, sc.before_value, sc.after_value, sc.reason,
              sc.applied_at, sc.created_at
       FROM seo_changes sc JOIN pages p ON p.id = sc.page_id
       WHERE p.site_id = ? ORDER BY sc.created_at DESC`
    )
    .all(site.id);

  const schemaFindings = db
    .prepare(
      `SELECT sf.id, sf.page_id, p.url as page_url, sf.schema_type, sf.proposed_json, sf.status, sf.created_at
       FROM schema_findings sf JOIN pages p ON p.id = sf.page_id
       WHERE p.site_id = ? ORDER BY sf.created_at DESC`
    )
    .all(site.id);

  const technicalFindings = db
    .prepare(
      `SELECT id, page_id, category, severity, finding, evidence_json, status, created_at
       FROM technical_findings WHERE site_id = ? ORDER BY severity, created_at DESC`
    )
    .all(site.id);

  return NextResponse.json({
    found: true,
    siteId: site.id,
    seoChanges,
    schemaFindings,
    technicalFindings,
  });
}
