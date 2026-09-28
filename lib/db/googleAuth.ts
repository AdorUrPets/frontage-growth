import { getDb, newId } from "./client";
import { encryptKey, decryptKey } from "../crypto/vault";
import { refreshAccessToken } from "../integrations/googleAuth";

export interface GoogleConnection {
  id: string;
  label: string | null;
  googleEmail: string | null;
  createdAt: string;
}

export function listGoogleConnections(): GoogleConnection[] {
  const rows = getDb()
    .prepare(`SELECT id, label, google_email, created_at FROM google_connections ORDER BY created_at DESC`)
    .all() as { id: string; label: string | null; google_email: string | null; created_at: string }[];
  return rows.map((r) => ({ id: r.id, label: r.label, googleEmail: r.google_email, createdAt: r.created_at }));
}

// One Google login, reusable across every client's site. Connecting again
// with the same account (matched by email) updates the existing row's
// token in place rather than creating a duplicate.
export function saveGoogleConnection(refreshToken: string, email: string | null): string {
  const db = getDb();
  const enc = encryptKey(refreshToken);

  if (email) {
    const existing = db.prepare(`SELECT id FROM google_connections WHERE google_email = ?`).get(email) as { id: string } | undefined;
    if (existing) {
      db.prepare(
        `UPDATE google_connections SET refresh_token_ciphertext = ?, refresh_token_iv = ?, refresh_token_tag = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(enc.ciphertext, enc.iv, enc.tag, existing.id);
      return existing.id;
    }
  }

  const id = newId();
  db.prepare(
    `INSERT INTO google_connections (id, label, google_email, refresh_token_ciphertext, refresh_token_iv, refresh_token_tag) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, email, email, enc.ciphertext, enc.iv, enc.tag);
  return id;
}

export function deleteGoogleConnection(id: string): void {
  getDb().prepare(`DELETE FROM google_connections WHERE id = ?`).run(id);
}

export async function getConnectionAccessToken(connectionId: string): Promise<string> {
  const row = getDb()
    .prepare(`SELECT refresh_token_ciphertext, refresh_token_iv, refresh_token_tag FROM google_connections WHERE id = ?`)
    .get(connectionId) as { refresh_token_ciphertext: string; refresh_token_iv: string; refresh_token_tag: string } | undefined;
  if (!row) throw new Error("Google connection not found — it may have been disconnected.");

  const refreshToken = decryptKey({ ciphertext: row.refresh_token_ciphertext, iv: row.refresh_token_iv, tag: row.refresh_token_tag });
  const { accessToken } = await refreshAccessToken(refreshToken);
  return accessToken;
}

// --- per-site: which connection + which verified property this site uses ---

export function assignSiteGoogleConnection(siteId: string, connectionId: string): void {
  getDb()
    .prepare(`UPDATE sites SET google_connection_id = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(connectionId, siteId);
}

export function setSearchConsoleProperty(siteId: string, propertyUrl: string): void {
  getDb()
    .prepare(`UPDATE sites SET search_console_property = ?, search_console_connected = 1, updated_at = datetime('now') WHERE id = ?`)
    .run(propertyUrl, siteId);
}

export function disconnectSiteSearchConsole(siteId: string): void {
  getDb()
    .prepare(
      `UPDATE sites SET google_connection_id = NULL, search_console_property = NULL, search_console_connected = 0, updated_at = datetime('now') WHERE id = ?`
    )
    .run(siteId);
}

export interface SiteGoogleStatus {
  connected: boolean;
  connectionId: string | null;
  connectionEmail: string | null;
  property: string | null;
}

export function getSiteGoogleStatus(siteId: string): SiteGoogleStatus {
  const row = getDb()
    .prepare(
      `SELECT s.search_console_connected, s.search_console_property, s.google_connection_id, gc.google_email
       FROM sites s LEFT JOIN google_connections gc ON gc.id = s.google_connection_id
       WHERE s.id = ?`
    )
    .get(siteId) as
    | { search_console_connected: number; search_console_property: string | null; google_connection_id: string | null; google_email: string | null }
    | undefined;
  return {
    connected: row?.search_console_connected === 1,
    connectionId: row?.google_connection_id ?? null,
    connectionEmail: row?.google_email ?? null,
    property: row?.search_console_property ?? null,
  };
}

// --- per-site: Analytics (GA4) connection, same shared google_connection_id as Search Console ---

// Only ever call this after a real successful verifyAnalyticsProperty() round-trip against
// Google's own API - never set analytics_connected on the strength of a list response alone,
// since the caller may be re-selecting a stale/typed-in id.
export function setAnalyticsProperty(siteId: string, propertyId: string): void {
  getDb()
    .prepare(`UPDATE sites SET analytics_property_id = ?, analytics_connected = 1, updated_at = datetime('now') WHERE id = ?`)
    .run(propertyId, siteId);
}

export function disconnectSiteAnalytics(siteId: string): void {
  getDb()
    .prepare(`UPDATE sites SET analytics_property_id = NULL, analytics_connected = 0, updated_at = datetime('now') WHERE id = ?`)
    .run(siteId);
}

export interface SiteAnalyticsStatus {
  connected: boolean;
  connectionId: string | null;
  connectionEmail: string | null;
  propertyId: string | null;
}

export function getSiteAnalyticsStatus(siteId: string): SiteAnalyticsStatus {
  const row = getDb()
    .prepare(
      `SELECT s.analytics_connected, s.analytics_property_id, s.google_connection_id, gc.google_email
       FROM sites s LEFT JOIN google_connections gc ON gc.id = s.google_connection_id
       WHERE s.id = ?`
    )
    .get(siteId) as
    | { analytics_connected: number; analytics_property_id: string | null; google_connection_id: string | null; google_email: string | null }
    | undefined;
  return {
    connected: row?.analytics_connected === 1,
    connectionId: row?.google_connection_id ?? null,
    connectionEmail: row?.google_email ?? null,
    propertyId: row?.analytics_property_id ?? null,
  };
}

// Resolves a fresh access token for whichever Google connection a site is
// assigned to. Returns null if the site has no connection assigned yet.
export async function getFreshAccessTokenForSite(siteId: string): Promise<string | null> {
  const row = getDb().prepare(`SELECT google_connection_id FROM sites WHERE id = ?`).get(siteId) as
    | { google_connection_id: string | null }
    | undefined;
  if (!row?.google_connection_id) return null;
  return getConnectionAccessToken(row.google_connection_id);
}
