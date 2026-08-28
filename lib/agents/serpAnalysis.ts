import { getDb, newId } from "../db/client";
import { routeTask } from "../ai/router";
import type { SiteRow } from "../types";

interface KeywordWithResults {
  id: string;
  keyword: string;
  opportunity: string | null;
}
interface SerpRow {
  result_url: string;
  result_domain: string;
  position: number;
}

export interface SerpAnalysisResult {
  ok: boolean;
  keywordsAnalysed: number;
  competitorsFound: number;
  error?: string;
}

// Real gap analysis over the SERP evidence Search Intelligence already
// fetched — never fabricates rankings or volume, only reasons about which
// domains actually appeared and whether the client's own site did.
export async function runSerpAnalysis(site: SiteRow): Promise<SerpAnalysisResult> {
  const db = getDb();
  const ownDomain = new URL(site.url).hostname.replace(/^www\./, "");

  const keywords = db
    .prepare(`SELECT id, keyword, opportunity FROM keywords WHERE site_id = ?`)
    .all(site.id) as KeywordWithResults[];
  if (keywords.length === 0) {
    return { ok: false, keywordsAnalysed: 0, competitorsFound: 0, error: "No researched keywords found — run Search Intelligence first." };
  }

  const insertCompetitor = db.prepare(
    `INSERT INTO competitors (id, site_id, domain, name) SELECT ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM competitors WHERE site_id = ? AND domain = ?)`
  );
  const updateKeyword = db.prepare(`UPDATE keywords SET opportunity = ? WHERE id = ?`);

  const getSerp = db.prepare(`SELECT result_url, result_domain, position FROM serp_results WHERE keyword_id = ? ORDER BY position ASC`);

  let competitorsFound = 0;
  let analysed = 0;
  const seenDomains = new Set<string>();

  const lines: string[] = [];
  for (const kw of keywords) {
    const results = getSerp.all(kw.id) as SerpRow[];
    if (results.length === 0) continue;

    const clientRanks = results.some((r) => r.result_domain.replace(/^www\./, "") === ownDomain);
    const competitorDomains = [...new Set(results.map((r) => r.result_domain.replace(/^www\./, "")).filter((d) => d && d !== ownDomain))];

    for (const domain of competitorDomains) {
      if (!seenDomains.has(domain)) {
        insertCompetitor.run(newId(), site.id, domain, domain, site.id, domain);
        seenDomains.add(domain);
        competitorsFound++;
      }
    }

    lines.push(`- "${kw.keyword}": client ${clientRanks ? "APPEARS" : "does NOT appear"} in the top results; ${competitorDomains.length} distinct competing domain(s): ${competitorDomains.slice(0, 5).join(", ") || "none"}.`);
    analysed++;
  }

  if (analysed === 0) {
    return { ok: false, keywordsAnalysed: 0, competitorsFound: 0, error: "No SERP results stored for any researched keyword." };
  }

  const prompt = `Real SERP evidence for a client's target keywords (from live search, already fetched — do not invent rankings or search volume, only reason about presence/absence and domain overlap):

${lines.join("\n")}

For each keyword, write ONE short sentence of gap analysis: is the client visible, who's occupying the space, and what that implies. Return ONLY a JSON array, no other text: [{ "keyword": string (must match exactly), "gap": string }]`;

  const result = await routeTask("search_intent", [{ role: "user", content: prompt }]);
  if (result.ok && result.text) {
    try {
      const fenced = result.text.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const raw = fenced ? fenced[1] : result.text;
      const start = raw.indexOf("[");
      const end = raw.lastIndexOf("]");
      const parsed = JSON.parse(raw.slice(start, end + 1)) as { keyword: string; gap: string }[];
      const byKeyword = new Map(keywords.map((k) => [k.keyword, k.id]));
      for (const p of parsed) {
        const id = byKeyword.get(p.keyword);
        if (id && p.gap) updateKeyword.run(p.gap, id);
      }
    } catch {
      // Non-fatal — the deterministic competitor data is already stored either way.
    }
  }

  return { ok: true, keywordsAnalysed: analysed, competitorsFound };
}
