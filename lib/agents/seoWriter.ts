import { getDb, newId } from "../db/client";
import { routeTask } from "../ai/router";
import { getLatestBusinessProfile } from "./businessUnderstanding";
import type { ClientRow, SiteRow } from "../types";

interface OpportunityRow {
  id: string;
  proposed_url: string | null;
  title: string;
  search_opportunity: string | null;
  business_relevance: string | null;
  suggested_structure: string | null;
}

export interface SeoWriterResult {
  ok: boolean;
  draftsCreated: number;
  provider?: string;
  model?: string;
  error?: string;
  skipped?: boolean;
}

const MAX_OPPORTUNITIES = 5;

// Drafts real page copy for approved-shape content opportunities. Grounded
// strictly in the business profile + the opportunity's own evidence — no
// invented pricing, credentials, or claims.
export async function runSeoWriter(client: ClientRow, site: SiteRow): Promise<SeoWriterResult> {
  const db = getDb();
  const profile = getLatestBusinessProfile(client.id);
  const opportunities = db
    .prepare(`SELECT id, proposed_url, title, search_opportunity, business_relevance, suggested_structure FROM content_opportunities WHERE site_id = ? AND status = 'proposed'`)
    .all(site.id) as OpportunityRow[];

  if (opportunities.length === 0) {
    return { ok: true, skipped: true, draftsCreated: 0, error: "Nothing to draft — no open content opportunities (either none were found, or everything's already been written)." };
  }

  const businessContext = profile
    ? `Business: ${profile.industry ?? "unknown industry"} in ${profile.serviceArea ?? "unknown area"}. Services: ${profile.services.join(", ") || "unknown"}. Do not mention pricing, certifications, awards, or guarantees unless they appear here.`
    : "No business profile available — write generically, no invented claims.";

  const insert = db.prepare(
    `INSERT INTO content_assets (id, opportunity_id, site_id, channel, format, body, status) VALUES (?, ?, ?, 'website', 'page', ?, 'draft')`
  );
  const markDrafted = db.prepare(`UPDATE content_opportunities SET status = 'drafted' WHERE id = ?`);

  let created = 0;
  let provider: string | undefined;
  let model: string | undefined;

  for (const opp of opportunities.slice(0, MAX_OPPORTUNITIES)) {
    const prompt = `${businessContext}

Write a full webpage draft for this real content opportunity:
Title: ${opp.title}
URL: ${opp.proposed_url ?? "(not set)"}
Why this page: ${opp.business_relevance ?? ""}
Structure guidance: ${opp.suggested_structure ?? ""}

Write real, publishable copy: an H1, 3-5 short sections with subheadings, and a closing call-to-action appropriate to the business's primary conversion. Plain text with markdown-style headings (## for subheadings). Do not invent facts, prices, testimonials, or credentials not given above.`;

    const result = await routeTask("content_writing", [{ role: "user", content: prompt }]);
    if (result.ok && result.text) {
      insert.run(newId(), opp.id, site.id, result.text);
      markDrafted.run(opp.id);
      created++;
      provider = result.provider;
      model = result.model;
    }
  }

  if (created === 0) return { ok: false, draftsCreated: 0, error: "No drafts were produced — the AI provider(s) failed for every opportunity." };
  return { ok: true, draftsCreated: created, provider, model };
}
