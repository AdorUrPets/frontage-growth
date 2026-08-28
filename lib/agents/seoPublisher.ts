import { getDb, newId } from "../db/client";
import { getShopifyCredentials } from "../db/shopify";
import { resolveShopifyResource, pushSeoMetafields } from "../integrations/shopify";
import type { SiteRow } from "../types";

interface ChangeRow {
  id: string;
  field: string;
  after_value: string;
  page_url: string;
  page_id: string;
}

export interface PublishDetail {
  pageUrl: string;
  field: string;
  ok: boolean;
  error?: string;
}

export interface PublishResult {
  ok: boolean;
  pushed: number;
  failed: number;
  skipped: number;
  details: PublishDetail[];
  error?: string;
}

// Publishes every APPROVED, not-yet-applied title/meta_description change
// for a site to the live Shopify store — nothing else. H1 and any other
// field never reaches this path (see lib/agents/onPageSeo.ts's comment on
// why content changes stay manual).
export async function runSeoPublisher(site: SiteRow): Promise<PublishResult> {
  const creds = getShopifyCredentials(site.id);
  if (!creds) {
    return { ok: false, pushed: 0, failed: 0, skipped: 0, details: [], error: "Shopify isn't connected for this site yet." };
  }

  const db = getDb();
  const changes = db
    .prepare(
      `SELECT sc.id, sc.field, sc.after_value, p.url as page_url, p.id as page_id
       FROM seo_changes sc
       JOIN pages p ON p.id = sc.page_id
       JOIN approvals ap ON ap.subject_type = 'seo_change' AND ap.subject_id = sc.id
       WHERE p.site_id = ? AND ap.status = 'approved' AND sc.applied_at IS NULL AND sc.field IN ('title', 'meta_description')`
    )
    .all(site.id) as ChangeRow[];

  if (changes.length === 0) {
    return { ok: false, pushed: 0, failed: 0, skipped: 0, details: [], error: "No approved, unpublished title/meta changes to push." };
  }

  const byPage = new Map<string, { pageUrl: string; changes: ChangeRow[] }>();
  for (const c of changes) {
    if (!byPage.has(c.page_id)) byPage.set(c.page_id, { pageUrl: c.page_url, changes: [] });
    byPage.get(c.page_id)!.changes.push(c);
  }

  const details: PublishDetail[] = [];
  let pushed = 0;
  let failed = 0;
  let skipped = 0;

  const markApplied = db.prepare(`UPDATE seo_changes SET applied_at = datetime('now') WHERE id = ?`);

  for (const { pageUrl, changes: pageChanges } of byPage.values()) {
    const resolved = await resolveShopifyResource(creds.shopDomain, creds.accessToken, pageUrl);
    if (!resolved.gid) {
      for (const c of pageChanges) {
        details.push({ pageUrl, field: c.field, ok: false, error: resolved.reason });
        skipped++;
      }
      continue;
    }

    const fields: { title?: string; description?: string } = {};
    for (const c of pageChanges) {
      if (c.field === "title") fields.title = c.after_value;
      if (c.field === "meta_description") fields.description = c.after_value;
    }

    const result = await pushSeoMetafields(creds.shopDomain, creds.accessToken, resolved.gid, fields);
    for (const c of pageChanges) {
      if (result.ok) {
        markApplied.run(c.id);
        details.push({ pageUrl, field: c.field, ok: true });
        pushed++;
      } else {
        details.push({ pageUrl, field: c.field, ok: false, error: result.error });
        failed++;
      }
    }
  }

  db.prepare(`INSERT INTO deployments (id, site_id, adapter, status, summary, deployed_at) VALUES (?, ?, 'shopify', ?, ?, datetime('now'))`).run(
    newId(),
    site.id,
    failed > 0 || skipped > 0 ? "partial" : "success",
    `${pushed} pushed, ${failed} failed, ${skipped} skipped`
  );

  return { ok: pushed > 0, pushed, failed, skipped, details };
}

export interface RollbackResult {
  ok: boolean;
  error?: string;
}

// Pushes a change's original before_value back to the live site and clears
// applied_at — real rollback, not just a DB status flip.
export async function rollbackSeoChange(changeId: string): Promise<RollbackResult> {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT sc.field, sc.before_value, p.url as page_url, p.site_id
       FROM seo_changes sc JOIN pages p ON p.id = sc.page_id
       WHERE sc.id = ? AND sc.applied_at IS NOT NULL`
    )
    .get(changeId) as { field: string; before_value: string | null; page_url: string; site_id: string } | undefined;
  if (!row) return { ok: false, error: "Change not found, or it was never applied." };

  const creds = getShopifyCredentials(row.site_id);
  if (!creds) return { ok: false, error: "Shopify isn't connected for this site." };

  const resolved = await resolveShopifyResource(creds.shopDomain, creds.accessToken, row.page_url);
  if (!resolved.gid) return { ok: false, error: resolved.reason };

  const fields: { title?: string; description?: string } = {};
  if (row.field === "title") fields.title = row.before_value ?? "";
  if (row.field === "meta_description") fields.description = row.before_value ?? "";

  const result = await pushSeoMetafields(creds.shopDomain, creds.accessToken, resolved.gid, fields);
  if (result.ok) db.prepare(`UPDATE seo_changes SET applied_at = NULL WHERE id = ?`).run(changeId);
  return result;
}
