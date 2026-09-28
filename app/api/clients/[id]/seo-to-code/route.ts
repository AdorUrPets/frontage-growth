import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { applySeoChangesToCode } from "@/lib/seoToCode/applyChanges";
import { isStaticHtmlSite } from "@/lib/seoToCode/htmlMapper";

function getSite(clientId: string) {
  return getDb().prepare(`SELECT id, cms, repo_local_path FROM sites WHERE client_id = ? ORDER BY created_at ASC LIMIT 1`).get(clientId) as
    | { id: string; cms: string | null; repo_local_path: string | null }
    | undefined;
}

// Real count of approved-and-unapplied seo_changes, so the UI can show
// whether there's anything for the writer to do without triggering a commit.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = getSite(id);
  if (!site) return NextResponse.json({ error: "Client has no site." }, { status: 404 });

  const pendingCount = (
    getDb()
      .prepare(
        `SELECT COUNT(*) as n FROM seo_changes sc
         JOIN pages p ON p.id = sc.page_id
         JOIN approvals ap ON ap.subject_type = 'seo_change' AND ap.subject_id = sc.id
         WHERE p.site_id = ? AND ap.status = 'approved' AND sc.applied_at IS NULL`
      )
      .get(site.id) as { n: number }
  ).n;

  const lastDeployment = getDb()
    .prepare(`SELECT id, summary, created_at FROM deployments WHERE site_id = ? AND status = 'committed' ORDER BY created_at DESC LIMIT 1`)
    .get(site.id);

  return NextResponse.json({
    repoLocalPath: site.repo_local_path,
    cms: site.cms,
    supported: isStaticHtmlSite(site.cms),
    pendingCount,
    lastDeployment: lastDeployment ?? null,
  });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = getSite(id);
  if (!site) return NextResponse.json({ error: "Client has no site." }, { status: 404 });

  const result = await applySeoChangesToCode(site.id);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
