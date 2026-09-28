import { getDb, newId } from "../db/client";
import { getSiteAnalyticsStatus, getFreshAccessTokenForSite } from "../db/googleAuth";
import { fetchAnalyticsSessions } from "./analytics";

export interface SyncResult {
  ok: boolean;
  rowsStored: number;
  error?: string;
}

const PERIOD = "last_28_days";

export async function syncAnalyticsData(siteId: string): Promise<SyncResult> {
  const { connected, propertyId } = getSiteAnalyticsStatus(siteId);
  if (!connected || !propertyId) {
    return { ok: false, rowsStored: 0, error: "Analytics isn't connected for this site yet." };
  }

  let accessToken: string | null;
  try {
    accessToken = await getFreshAccessTokenForSite(siteId);
  } catch (err) {
    return { ok: false, rowsStored: 0, error: err instanceof Error ? err.message : "Failed to refresh Google access token." };
  }
  if (!accessToken) return { ok: false, rowsStored: 0, error: "Analytics isn't connected for this site yet." };

  let rows;
  try {
    rows = await fetchAnalyticsSessions(propertyId, accessToken);
  } catch (err) {
    return { ok: false, rowsStored: 0, error: err instanceof Error ? err.message : "Analytics query failed." };
  }

  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM analytics_snapshots WHERE site_id = ? AND period = ?`).run(siteId, PERIOD);
    const insert = db.prepare(
      `INSERT INTO analytics_snapshots (id, site_id, period, sessions, organic_sessions, raw_json) VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const r of rows) {
      insert.run(newId(), siteId, `${PERIOD}:${r.date}`, r.sessions, r.organicSessions, JSON.stringify(r));
    }
  });
  tx();

  return { ok: true, rowsStored: rows.length };
}
