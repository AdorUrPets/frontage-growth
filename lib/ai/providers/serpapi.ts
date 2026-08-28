import { withKeyPool, isRotationError } from "../keyPool";

export interface SerperOrganicResult {
  title: string;
  link: string;
  snippet?: string;
  position: number;
}

export interface SerperSearchResult {
  ok: boolean;
  items?: SerperOrganicResult[];
  error?: string;
  keyId?: string | null;
}

// serpapi.com — separate accounts pooled here each add another full
// monthly-renewing free quota (250 searches/month/key on the free plan).
// Mirrors lead-finder's app/lib/serpApiPool.ts.
//
// Deliberately does NOT forward the caller's free-text location as SerpApi's
// `location=` param: that field is validated against Google's canonicalized
// location taxonomy, and an AI-derived business-profile string (e.g. "AI
// safety and research" for a non-local business) very often won't match it,
// which fails the whole call. The query text already carries geo intent
// (buildQueries() bakes the location into the query itself), and `gl`
// narrows by country — that combination is robust to arbitrary input.
export async function serpApiSearch(query: string): Promise<SerperSearchResult> {
  const outcome = await withKeyPool<SerperOrganicResult[]>("serpapi", async (key) => {
    try {
      const url = new URL("https://serpapi.com/search");
      url.searchParams.set("engine", "google");
      url.searchParams.set("q", query);
      url.searchParams.set("gl", "nz");
      url.searchParams.set("api_key", key.value);

      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
      const data = await res.json();
      if (!res.ok || data?.error) {
        const message = data?.error || `SerpApi request failed (HTTP ${res.status}).`;
        return { attempt: { ok: false, rotate: isRotationError(res.status, message), errorMessage: message } };
      }
      const items: SerperOrganicResult[] = (data?.organic_results ?? []).map(
        (r: { title: string; link: string; snippet?: string; position: number }) => ({
          title: r.title,
          link: r.link,
          snippet: r.snippet,
          position: r.position,
        })
      );
      return { result: items, attempt: { ok: true, rotate: false } };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reach SerpApi.";
      return { attempt: { ok: false, rotate: false, errorMessage: message } };
    }
  });

  if (outcome.ok) return { ok: true, items: outcome.result, keyId: outcome.keyId };
  return { ok: false, error: outcome.error };
}

export async function liveSearch(query: string): Promise<SerperSearchResult & { provider?: "serpapi" }> {
  const result = await serpApiSearch(query);
  return result.ok ? { ...result, provider: "serpapi" } : result;
}
