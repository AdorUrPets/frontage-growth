import { getDb, newId } from "../db/client";
import { listSitePages } from "../db/crawls";
import { routeTask } from "../ai/router";
import type { SiteRow } from "../types";

interface ClusterRow {
  id: string;
  label: string;
  primary_intent: string | null;
}
interface KeywordRow {
  keyword: string;
  opportunity: string | null;
}

interface OpportunityProposal {
  clusterLabel: string;
  proposedUrl: string;
  title: string;
  suggestedStructure: string;
  businessRelevance: string;
}

function extractJsonArray(text: string): unknown[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("No JSON array found in the model's response.");
  return JSON.parse(raw.slice(start, end + 1));
}

export interface ContentOpportunityResult {
  ok: boolean;
  opportunitiesCreated: number;
  provider?: string;
  model?: string;
  error?: string;
  skipped?: boolean;
}

// Only proposes pages for keyword clusters that don't already have a
// reasonably matching crawled page — grounded in real search demand
// (already fetched by Search Intelligence) and real site content (Site
// Recon), not invented topics.
export async function runContentOpportunity(site: SiteRow): Promise<ContentOpportunityResult> {
  const db = getDb();
  const clusters = db.prepare(`SELECT id, label, primary_intent FROM keyword_clusters WHERE site_id = ?`).all(site.id) as ClusterRow[];
  if (clusters.length === 0) {
    return { ok: false, opportunitiesCreated: 0, error: "No keyword clusters found — run Keyword Research first." };
  }

  const existingPages = listSitePages(site.id);
  const existingTitles = existingPages.map((p) => `${p.url} — ${p.title ?? "(no title)"}`).join("\n");

  const getKeywords = db.prepare(`SELECT keyword, opportunity FROM keywords WHERE cluster_id = ?`);
  const clusterListing = clusters
    .map((c) => {
      const kws = (getKeywords.all(c.id) as KeywordRow[]).map((k) => k.keyword).join(", ");
      return `- Cluster "${c.label}" (${c.primary_intent ?? "unknown intent"}): ${kws}`;
    })
    .join("\n");

  const prompt = `Real keyword research clusters (from live search) for this site:
${clusterListing}

Pages that already exist on the site:
${existingTitles || "(none crawled)"}

For each cluster that ISN'T already reasonably covered by an existing page, propose ONE new page. Do not propose a page for a cluster that's already covered. Do not invent services or claims not implied by the cluster's own keywords.

Return ONLY a JSON array, no other text: [{ "clusterLabel": string (must match a cluster label above), "proposedUrl": string (a realistic URL path, e.g. "/retaining-walls-tauranga"), "title": string, "suggestedStructure": string (2-3 sentence outline), "businessRelevance": string (why this follows from the cluster) }]`;

  const result = await routeTask("content_writing", [{ role: "user", content: prompt }]);
  if (!result.ok || !result.text) {
    return { ok: false, opportunitiesCreated: 0, error: result.error ?? "No response from any configured AI provider." };
  }

  let proposals: OpportunityProposal[];
  try {
    proposals = extractJsonArray(result.text) as OpportunityProposal[];
  } catch {
    return { ok: false, opportunitiesCreated: 0, error: "The model's response wasn't valid JSON." };
  }

  db.prepare(`DELETE FROM content_opportunities WHERE site_id = ? AND status = 'proposed'`).run(site.id);
  const insert = db.prepare(
    `INSERT INTO content_opportunities (id, site_id, proposed_url, title, search_opportunity, business_relevance, suggested_structure, evidence_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let count = 0;
  const clusterByLabel = new Map(clusters.map((c) => [c.label, c]));
  for (const p of proposals) {
    const cluster = clusterByLabel.get(p.clusterLabel);
    if (!cluster || !p.title) continue;
    const keywords = (getKeywords.all(cluster.id) as KeywordRow[]).map((k) => k.keyword);
    insert.run(
      newId(),
      site.id,
      p.proposedUrl ?? null,
      p.title,
      `Grounded in real search queries: ${keywords.join(", ")}`,
      p.businessRelevance ?? "",
      p.suggestedStructure ?? "",
      JSON.stringify({ clusterId: cluster.id, keywords })
    );
    count++;
  }

  if (count === 0) {
    return { ok: true, skipped: true, opportunitiesCreated: 0, error: "No content gaps found — every keyword cluster already has a reasonably matching page." };
  }
  return { ok: true, opportunitiesCreated: count, provider: result.provider, model: result.model };
}
