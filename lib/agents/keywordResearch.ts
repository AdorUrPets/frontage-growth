import { getDb, newId } from "../db/client";
import { routeTask } from "../ai/router";
import type { SiteRow } from "../types";

interface KeywordRow {
  id: string;
  keyword: string;
  intent: string | null;
  location: string | null;
  service: string | null;
}

interface ClusterProposal {
  label: string;
  primaryIntent: string;
  keywords: { keyword: string; priority: "P1" | "P2" | "P3" | "P4"; opportunity: string }[];
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.search(/[[{]/);
  const end = Math.max(raw.lastIndexOf("]"), raw.lastIndexOf("}"));
  if (start === -1 || end === -1) throw new Error("No JSON found in the model's response.");
  return JSON.parse(raw.slice(start, end + 1));
}

export interface KeywordResearchResult {
  ok: boolean;
  clustersCreated: number;
  provider?: string;
  model?: string;
  error?: string;
}

// Clusters the raw keyword evidence Search Intelligence just gathered — this
// is reasoning over real, already-fetched search data, not new fabrication.
export async function runKeywordResearch(site: SiteRow): Promise<KeywordResearchResult> {
  const db = getDb();
  const keywords = db
    .prepare(`SELECT id, keyword, intent, location, service FROM keywords WHERE site_id = ? AND cluster_id IS NULL`)
    .all(site.id) as KeywordRow[];

  if (keywords.length === 0) {
    return { ok: false, clustersCreated: 0, error: "No unclustered keywords found — run Search Intelligence first." };
  }

  const listing = keywords.map((k) => `- "${k.keyword}" (service: ${k.service ?? "?"}, intent guess: ${k.intent ?? "?"})`).join("\n");
  const prompt = `Group these real search queries (already researched via live search) into keyword clusters for an SEO plan. Do not invent search volume or ranking data — you weren't given any, so don't mention numbers you don't have.

Queries:
${listing}

Return ONLY a JSON array, no other text, of clusters with this shape:
[{
  "label": string (short cluster name),
  "primaryIntent": "INFORMATIONAL" | "COMMERCIAL" | "TRANSACTIONAL" | "LOCAL" | "NAVIGATIONAL",
  "keywords": [{ "keyword": string (must exactly match one of the queries above), "priority": "P1"|"P2"|"P3"|"P4", "opportunity": string (one sentence, grounded in the query itself, e.g. whether it's high-intent/local/branded) }]
}]`;

  const result = await routeTask("keyword_analysis", [{ role: "user", content: prompt }]);
  if (!result.ok || !result.text) {
    return { ok: false, clustersCreated: 0, error: result.error ?? "No response from any configured AI provider." };
  }

  let clusters: ClusterProposal[];
  try {
    const parsed = extractJson(result.text);
    if (!Array.isArray(parsed)) throw new Error("Expected a JSON array.");
    clusters = parsed as ClusterProposal[];
  } catch {
    return { ok: false, clustersCreated: 0, error: "The model's response wasn't valid JSON." };
  }

  const keywordByText = new Map(keywords.map((k) => [k.keyword, k.id]));
  const insertCluster = db.prepare(`INSERT INTO keyword_clusters (id, site_id, label, primary_intent) VALUES (?, ?, ?, ?)`);
  const updateKeyword = db.prepare(`UPDATE keywords SET cluster_id = ?, intent = ?, priority = ?, opportunity = ? WHERE id = ?`);

  let clustersCreated = 0;
  const tx = db.transaction(() => {
    for (const cluster of clusters) {
      if (!cluster.label || !Array.isArray(cluster.keywords) || cluster.keywords.length === 0) continue;
      const clusterId = newId();
      insertCluster.run(clusterId, site.id, cluster.label, cluster.primaryIntent ?? null);
      let matched = false;
      for (const k of cluster.keywords) {
        const keywordId = keywordByText.get(k.keyword);
        if (!keywordId) continue;
        updateKeyword.run(clusterId, cluster.primaryIntent ?? null, k.priority ?? null, k.opportunity ?? null, keywordId);
        matched = true;
      }
      if (matched) clustersCreated++;
    }
  });
  tx();

  if (clustersCreated === 0) {
    return { ok: false, clustersCreated: 0, error: "The model's clusters didn't match any of the researched keywords." };
  }

  return { ok: true, clustersCreated, provider: result.provider, model: result.model };
}
