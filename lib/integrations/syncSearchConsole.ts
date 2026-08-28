import { getDb, newId } from "../db/client";
import { getSiteGoogleStatus, getFreshAccessTokenForSite } from "../db/googleAuth";
import { fetchSearchAnalytics } from "./searchConsole";

export interface SyncResult {
  ok: boolean;
  rowsStored: number;
  error?: string;
}

const PERIOD = "last_28_days";

export async function syncSearchConsoleData(siteId: string): Promise<SyncResult> {
  const { connected, property } = getSiteGoogleStatus(siteId);
  if (!connected || !property) {
    return { ok: false, rowsStored: 0, error: "Search Console isn't connected for this site yet." };
  }

  let accessToken: string | null;
  try {
    accessToken = await getFreshAccessTokenForSite(siteId);
  } catch (err) {
    return { ok: false, rowsStored: 0, error: err instanceof Error ? err.message : "Failed to refresh Google access token." };
  }
  if (!accessToken) return { ok: false, rowsStored: 0, error: "Search Console isn't connected for this site yet." };

  let rows;
  try {
    rows = await fetchSearchAnalytics(property, accessToken);
  } catch (err) {
    return { ok: false, rowsStored: 0, error: err instanceof Error ? err.message : "Search Console query failed." };
  }

  const db = getDb();
  const pageByUrl = new Map(
    (db.prepare(`SELECT id, url FROM pages WHERE site_id = ?`).all(siteId) as { id: string; url: string }[]).map((p) => [p.url, p.id])
  );

  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM search_console_snapshots WHERE site_id = ? AND period = ?`).run(siteId, PERIOD);
    const insert = db.prepare(
      `INSERT INTO search_console_snapshots (id, site_id, page_id, query, period, clicks, impressions, ctr, avg_position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const r of rows) {
      insert.run(newId(), siteId, pageByUrl.get(r.page) ?? null, r.query, PERIOD, r.clicks, r.impressions, r.ctr, r.position);
    }
  });
  tx();

  return { ok: true, rowsStored: rows.length };
}
