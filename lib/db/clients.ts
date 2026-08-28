import { getDb, newId } from "./client";
import type { ClientRow, SiteRow } from "../types";

export interface ClientWithSite extends ClientRow {
  site: SiteRow | null;
}

export function listClients(query?: string): ClientWithSite[] {
  const db = getDb();
  const clients = (
    query && query.trim()
      ? db
          .prepare(`SELECT * FROM clients WHERE name LIKE ? OR business_name LIKE ? ORDER BY created_at DESC`)
          .all(`%${query.trim()}%`, `%${query.trim()}%`)
      : db.prepare(`SELECT * FROM clients ORDER BY created_at DESC`).all()
  ) as ClientRow[];
  const siteStmt = db.prepare(`SELECT * FROM sites WHERE client_id = ? ORDER BY created_at ASC LIMIT 1`);
  return clients.map((c) => ({ ...c, site: (siteStmt.get(c.id) as SiteRow | undefined) ?? null }));
}

export function getClient(id: string): ClientWithSite | null {
  const db = getDb();
  const client = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(id) as ClientRow | undefined;
  if (!client) return null;
  const site = db.prepare(`SELECT * FROM sites WHERE client_id = ? ORDER BY created_at ASC LIMIT 1`).get(id) as
    | SiteRow
    | undefined;
  return { ...client, site: site ?? null };
}

export function createClient(input: {
  name: string;
  businessName?: string;
  primaryLocation?: string;
  notes?: string;
  websiteUrl: string;
}): ClientWithSite {
  const db = getDb();
  const clientId = newId();
  const siteId = newId();
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO clients (id, name, business_name, primary_location, notes) VALUES (?, ?, ?, ?, ?)`
    ).run(clientId, input.name, input.businessName ?? null, input.primaryLocation ?? null, input.notes ?? null);
    db.prepare(`INSERT INTO sites (id, client_id, url) VALUES (?, ?, ?)`).run(siteId, clientId, input.websiteUrl);
  });
  tx();
  return getClient(clientId)!;
}

export function countClients(): number {
  const db = getDb();
  return (db.prepare(`SELECT COUNT(*) as n FROM clients`).get() as { n: number }).n;
}

export function updateClient(
  id: string,
  input: {
    name?: string;
    businessName?: string | null;
    primaryLocation?: string | null;
    notes?: string | null;
    websiteUrl?: string;
  }
): ClientWithSite | null {
  const db = getDb();
  const current = getClient(id);
  if (!current) return null;

  db.prepare(
    `UPDATE clients SET name = ?, business_name = ?, primary_location = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    input.name ?? current.name,
    input.businessName !== undefined ? input.businessName : current.business_name,
    input.primaryLocation !== undefined ? input.primaryLocation : current.primary_location,
    input.notes !== undefined ? input.notes : current.notes,
    id
  );

  if (input.websiteUrl && current.site) {
    db.prepare(`UPDATE sites SET url = ?, updated_at = datetime('now') WHERE id = ?`).run(input.websiteUrl, current.site.id);
  }

  return getClient(id);
}

// Cascades to sites/crawls/pages/etc. via ON DELETE CASCADE (foreign_keys is
// on — see lib/db/client.ts).
export function deleteClient(id: string): void {
  getDb().prepare(`DELETE FROM clients WHERE id = ?`).run(id);
}

export interface ClearGrowthDataResult {
  ok: boolean;
  error?: string;
}

// Wipes every report/finding the agents have produced for this client's
// site — crawl data, findings, keywords, content, missions/agent runs,
// the business profile — so the pipeline is back to "never scanned" and
// a fresh protocol run starts clean instead of piling duplicates onto old
// data. Deliberately keeps the site row itself (URL, Search Console
// connection) and real synced Search Console/Analytics history, since
// those aren't agent-generated findings and re-syncing costs a real API
// call — only the AI/crawl-derived report data is cleared.
export function clearGrowthData(clientId: string): ClearGrowthDataResult {
  const db = getDb();
  const site = db.prepare(`SELECT id FROM sites WHERE client_id = ? ORDER BY created_at ASC LIMIT 1`).get(clientId) as { id: string } | undefined;
  if (!site) return { ok: false, error: "This client has no site on file." };

  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM pages WHERE site_id = ?`).run(site.id); // cascades seo_findings, seo_changes, schema_findings
    db.prepare(`DELETE FROM crawls WHERE site_id = ?`).run(site.id); // cascades crawl_pages
    db.prepare(`DELETE FROM technical_findings WHERE site_id = ?`).run(site.id);
    db.prepare(`DELETE FROM keywords WHERE site_id = ?`).run(site.id); // cascades serp_results
    db.prepare(`DELETE FROM keyword_clusters WHERE site_id = ?`).run(site.id);
    db.prepare(`DELETE FROM competitors WHERE site_id = ?`).run(site.id);
    db.prepare(`DELETE FROM content_opportunities WHERE site_id = ?`).run(site.id);
    db.prepare(`DELETE FROM content_assets WHERE site_id = ?`).run(site.id);
    db.prepare(`DELETE FROM audiences WHERE site_id = ?`).run(site.id);
    db.prepare(`DELETE FROM channels WHERE site_id = ?`).run(site.id);
    db.prepare(`DELETE FROM traffic_campaigns WHERE site_id = ?`).run(site.id);
    db.prepare(`DELETE FROM conversions WHERE site_id = ?`).run(site.id);
    db.prepare(`DELETE FROM missions WHERE site_id = ?`).run(site.id); // cascades mission_steps
    db.prepare(`DELETE FROM agent_runs WHERE site_id = ?`).run(site.id);
    db.prepare(`DELETE FROM approvals WHERE site_id = ?`).run(site.id);
    db.prepare(`DELETE FROM deployments WHERE site_id = ?`).run(site.id);
    db.prepare(`DELETE FROM business_profiles WHERE client_id = ?`).run(clientId);
  });
  tx();

  return { ok: true };
}
