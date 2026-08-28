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
