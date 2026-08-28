import { getDb, newId } from "../db/client";
import { listSitePages, type PageRow } from "../db/crawls";
import { routeTask } from "../ai/router";
import { getLatestBusinessProfile } from "./businessUnderstanding";
import { getFeedbackContext } from "./feedback";
import type { ClientRow, SiteRow } from "../types";

// Chunked, not capped: every page in the site gets processed, just in
// batches of CHUNK_SIZE per AI call rather than one giant prompt (which
// degrades quality and blows context limits once a catalog is more than a
// handful of pages — a 100+ product store needs ~7-10 calls here, not 1).
const CHUNK_SIZE = 12;

interface PageProposal {
  url: string;
  proposedTitle?: string;
  proposedMetaDescription?: string;
  proposedH1?: string;
  reason?: string;
}

function extractJsonArray(text: string): unknown[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("No JSON array found in the model's response.");
  return JSON.parse(raw.slice(start, end + 1));
}

export interface OnPageSeoResult {
  ok: boolean;
  proposalsCreated: number;
  pagesProcessed: number;
  pagesFailed: number;
  provider?: string;
  model?: string;
  error?: string;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Proposes real per-page title/meta/H1 changes as seo_changes rows —
// nothing is written to the live site here. Each row needs its own
// approval via the Approvals API before Push to Site can touch it.
export async function runOnPageSeo(client: ClientRow, site: SiteRow): Promise<OnPageSeoResult> {
  const profile = getLatestBusinessProfile(client.id);
  const pages: PageRow[] = listSitePages(site.id);
  if (pages.length === 0) {
    return { ok: false, proposalsCreated: 0, pagesProcessed: 0, pagesFailed: 0, error: "No crawled pages found — run Site Recon first." };
  }

  const businessContext = profile
    ? `Business: ${profile.industry ?? "unknown industry"} in ${profile.serviceArea ?? "unknown area"}. Services: ${profile.services.join(", ") || "unknown"}.`
    : "No business profile available yet — write generically improved SEO copy.";

  const feedback = getFeedbackContext(site.id);
  const feedbackBlock = feedback ? `\n${feedback}\n` : "";

  const db = getDb();
  const insertChange = db.prepare(
    `INSERT INTO seo_changes (id, page_id, field, before_value, after_value, reason, agent_id, model_used) VALUES (?, ?, ?, ?, ?, ?, (SELECT id FROM agents WHERE code = 'onpage_seo'), ?)`
  );

  // Clear previous un-actioned proposals for this site's pages so re-runs
  // don't pile up stale duplicates (already-approved/applied ones are left alone).
  db.prepare(
    `DELETE FROM seo_changes WHERE page_id IN (SELECT id FROM pages WHERE site_id = ?) AND approval_id IS NULL AND applied_at IS NULL`
  ).run(site.id);

  let totalCount = 0;
  let pagesProcessed = 0;
  let pagesFailed = 0;
  let provider: string | undefined;
  let model: string | undefined;
  let lastError: string | undefined;

  for (const batch of chunk(pages, CHUNK_SIZE)) {
    const pageListing = batch
      .map(
        (p) =>
          `- url: ${p.url}\n  current title: ${p.title ?? "(none)"}\n  current meta: ${p.meta_description ?? "(none)"}\n  current h1: ${p.h1 ?? "(none)"}\n  page type: ${p.page_type}${p.price != null ? `\n  real price: ${p.price} ${p.price_currency ?? ""}` : ""}`
      )
      .join("\n");

    const prompt = `${businessContext}
${feedbackBlock}
For each of these real crawled pages, propose an improved SEO title (under 60 chars), meta description (under 160 chars), and H1 — grounded ONLY in the business context, page type, and real price (if given) above. Do not invent services, locations, prices, or claims not stated above. If a current value is already good, you may propose the same value.

Pages:
${pageListing}

Return ONLY a JSON array, no other text, one object per page:
[{ "url": string, "proposedTitle": string, "proposedMetaDescription": string, "proposedH1": string, "reason": string (one sentence) }]`;

    const result = await routeTask("meta_generation", [{ role: "user", content: prompt }]);
    if (!result.ok || !result.text) {
      pagesFailed += batch.length;
      lastError = result.error ?? "No response from any configured AI provider.";
      continue;
    }
    provider = result.provider;
    model = result.model;

    let proposals: PageProposal[];
    try {
      proposals = extractJsonArray(result.text) as PageProposal[];
    } catch {
      pagesFailed += batch.length;
      lastError = "The model's response wasn't valid JSON for this batch.";
      continue;
    }

    const pageByUrl = new Map(batch.map((p) => [p.url, p]));
    const tx = db.transaction(() => {
      for (const p of proposals) {
        const page = pageByUrl.get(p.url);
        if (!page) continue;
        const reason = p.reason ?? "AI-proposed on-page improvement.";
        if (p.proposedTitle && p.proposedTitle !== page.title) {
          insertChange.run(newId(), page.id, "title", page.title, p.proposedTitle, reason, model ?? null);
          totalCount++;
        }
        if (p.proposedMetaDescription && p.proposedMetaDescription !== page.meta_description) {
          insertChange.run(newId(), page.id, "meta_description", page.meta_description, p.proposedMetaDescription, reason, model ?? null);
          totalCount++;
        }
        if (p.proposedH1 && p.proposedH1 !== page.h1) {
          insertChange.run(newId(), page.id, "h1", page.h1, p.proposedH1, reason, model ?? null);
          totalCount++;
        }
      }
    });
    tx();
    pagesProcessed += batch.length;
  }

  if (totalCount === 0) {
    return {
      ok: false,
      proposalsCreated: 0,
      pagesProcessed,
      pagesFailed,
      error: lastError ?? "No proposals matched crawled pages, or all proposed values were unchanged.",
    };
  }

  return { ok: true, proposalsCreated: totalCount, pagesProcessed, pagesFailed, provider, model };
}
