// Google Analytics (GA4) — Admin API for listing/verifying properties, Data
// API for real report numbers. Mirrors lib/integrations/searchConsole.ts.

export interface Ga4Property {
  propertyId: string; // numeric id, e.g. "123456789" (no "properties/" prefix)
  displayName: string;
  account: string;
}

// accountSummaries is the one call that returns every GA4 property the
// connected account can see, without having to know an account id up front.
export async function listAnalyticsProperties(accessToken: string): Promise<Ga4Property[]> {
  const res = await fetch("https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message || `Analytics account list failed (HTTP ${res.status}).`);
  }
  const data = await res.json();
  const accountSummaries = (data.accountSummaries ?? []) as {
    account: string;
    displayName: string;
    propertySummaries?: { property: string; displayName: string }[];
  }[];

  const properties: Ga4Property[] = [];
  for (const acct of accountSummaries) {
    for (const p of acct.propertySummaries ?? []) {
      properties.push({
        propertyId: p.property.replace(/^properties\//, ""),
        displayName: p.displayName,
        account: acct.displayName,
      });
    }
  }
  return properties;
}

// The real pre-flight check that must pass before analytics_connected is ever set true — a GET
// on the property itself, not just membership in the list above (the property could have been
// typed in or gone stale since). Throws with Google's own message on any failure.
export async function verifyAnalyticsProperty(propertyId: string, accessToken: string): Promise<{ displayName: string }> {
  const res = await fetch(`https://analyticsadmin.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message || `Analytics property could not be verified (HTTP ${res.status}).`);
  }
  const data = await res.json();
  return { displayName: typeof data.displayName === "string" ? data.displayName : propertyId };
}

export interface Ga4Row {
  date: string;
  sessions: number;
  organicSessions: number;
}

// Real session counts for the last `days` days, split out organic-search traffic via a
// sessionDefaultChannelGroup dimension filter - the actual data analytics_snapshots exists to
// hold (see lib/db/schema.ts), currently unpopulated because no caller has ever had a real
// property + token to query with until this module existed.
export async function fetchAnalyticsSessions(propertyId: string, accessToken: string, days = 28): Promise<Ga4Row[]> {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
      dimensions: [{ name: "date" }, { name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }],
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message || `Analytics report query failed (HTTP ${res.status}).`);
  }
  const data = await res.json();
  const rows = (data.rows ?? []) as { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[];

  const byDate = new Map<string, { sessions: number; organicSessions: number }>();
  for (const row of rows) {
    const date = row.dimensionValues[0]?.value ?? "";
    const channel = row.dimensionValues[1]?.value ?? "";
    const sessions = Number(row.metricValues[0]?.value ?? 0);
    const entry = byDate.get(date) ?? { sessions: 0, organicSessions: 0 };
    entry.sessions += sessions;
    if (channel === "Organic Search") entry.organicSessions += sessions;
    byDate.set(date, entry);
  }
  return Array.from(byDate.entries())
    .map(([date, v]) => ({ date, sessions: v.sessions, organicSessions: v.organicSessions }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
