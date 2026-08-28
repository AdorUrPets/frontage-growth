export interface GscProperty {
  siteUrl: string;
  permissionLevel: string;
}

export async function listSearchConsoleProperties(accessToken: string): Promise<GscProperty[]> {
  const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message || `Search Console sites list failed (HTTP ${res.status}).`);
  }
  const data = await res.json();
  return (data.siteEntry ?? []) as GscProperty[];
}

export interface GscRow {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

// Real query+page performance for the last `days` days — the actual data
// Performance Analyst and the Search Opportunity Engine (later) need.
export async function fetchSearchAnalytics(propertyUrl: string, accessToken: string, days = 28): Promise<GscRow[]> {
  const end = new Date();
  end.setDate(end.getDate() - 3); // GSC data has a ~2-3 day lag
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(propertyUrl)}/searchAnalytics/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      startDate: fmt(start),
      endDate: fmt(end),
      dimensions: ["query", "page"],
      rowLimit: 250,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message || `Search Console query failed (HTTP ${res.status}).`);
  }
  const data = await res.json();
  return ((data.rows ?? []) as { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[]).map((r) => ({
    query: r.keys[0],
    page: r.keys[1],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
}
