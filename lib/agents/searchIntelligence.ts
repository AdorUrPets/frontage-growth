import { getDb, newId } from "../db/client";
import { liveSearch } from "../ai/providers/serpapi";
import { getLatestBusinessProfile } from "./businessUnderstanding";
import type { ClientRow, SiteRow } from "../types";

const MAX_QUERIES = 8;
const MAX_RESULTS_PER_QUERY = 6;

export interface SearchIntelligenceResult {
  ok: boolean;
  queriesRun: number;
  resultsStored: number;
  provider?: string;
  error?: string;
}

function buildQueries(clientName: string, services: string[], location: string | null): string[] {
  const queries = new Set<string>();
  // Defensive guard regardless of what Business Understanding produced: a
  // real location is a short place name, not a topical description — don't
  // bake something like "AI safety and research" into a search query.
  const rawLoc = location?.trim();
  const loc = rawLoc && rawLoc.length <= 40 && rawLoc.split(/\s+/).length <= 5 ? rawLoc : undefined;

  for (const service of services.slice(0, 5)) {
    queries.add(loc ? `${service} ${loc}` : service);
  }
  if (loc) queries.add(`${services[0] ?? clientName} near me`);
  queries.add(clientName);

  return [...queries].slice(0, MAX_QUERIES);
}

// Real Serper/SerpApi calls per query — this is the live Google research
// step. Raw evidence is stored (§16: "store raw evidence") as `keywords` +
// `serp_results` rows for the Keyword Research agent to cluster next.
export async function runSearchIntelligence(client: ClientRow, site: SiteRow): Promise<SearchIntelligenceResult> {
  const profile = getLatestBusinessProfile(client.id);
  if (!profile) {
    return { ok: false, queriesRun: 0, resultsStored: 0, error: "No business profile yet — run Business Understanding first." };
  }
  if (profile.services.length === 0) {
    return { ok: false, queriesRun: 0, resultsStored: 0, error: "Business profile has no identified services to research." };
  }

  const queries = buildQueries(client.name, profile.services, profile.serviceArea);
  const db = getDb();
  const insertKeyword = db.prepare(
    `INSERT INTO keywords (id, site_id, keyword, intent, location, service, evidence_source) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const insertSerp = db.prepare(
    `INSERT INTO serp_results (id, keyword_id, position, result_url, result_title, result_domain, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  let resultsStored = 0;
  let lastProvider: string | undefined;
  let queriesRun = 0;
  const errors: string[] = [];

  for (const query of queries) {
    const res = await liveSearch(query);
    queriesRun++;
    if (!res.ok || !res.items) {
      errors.push(`"${query}": ${res.error}`);
      continue;
    }
    lastProvider = res.provider;

    const service = profile.services.find((s) => query.toLowerCase().includes(s.toLowerCase())) ?? null;
    const intent = query.includes("near me") || (profile.serviceArea && query.includes(profile.serviceArea)) ? "LOCAL" : "COMMERCIAL";
    const keywordId = newId();
    insertKeyword.run(keywordId, site.id, query, intent, profile.serviceArea, service, `${res.provider}`);

    for (const item of res.items.slice(0, MAX_RESULTS_PER_QUERY)) {
      let domain = "";
      try {
        domain = new URL(item.link).hostname;
      } catch {
        // skip malformed result URL for domain extraction only
      }
      insertSerp.run(newId(), keywordId, item.position, item.link, item.title, domain, JSON.stringify(item));
      resultsStored++;
    }
  }

  if (resultsStored === 0) {
    return { ok: false, queriesRun, resultsStored: 0, error: errors.join(" · ") || "No search results returned." };
  }

  return { ok: true, queriesRun, resultsStored, provider: lastProvider };
}
