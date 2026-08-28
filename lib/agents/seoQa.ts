import { getDb } from "../db/client";
import { routeTask } from "../ai/router";
import { getLatestBusinessProfile } from "./businessUnderstanding";
import type { ClientRow, SiteRow } from "../types";

interface DraftRow {
  id: string;
  body: string;
}

interface QaVerdict {
  id: string;
  pass: boolean;
  issues: string[];
}

export interface SeoQaResult {
  ok: boolean;
  reviewed: number;
  passed: number;
  flagged: number;
  provider?: string;
  model?: string;
  error?: string;
  skipped?: boolean;
}

// Fact/consistency/duplication check against the real business profile —
// the exact QA gate from §63/§27 before a human ever sees these as
// publish-ready. Flags anything that looks fabricated; never rewrites
// silently.
export async function runSeoQa(client: ClientRow, site: SiteRow): Promise<SeoQaResult> {
  const db = getDb();
  const profile = getLatestBusinessProfile(client.id);
  const drafts = db
    .prepare(`SELECT ca.id, ca.body FROM content_assets ca WHERE ca.site_id = ? AND ca.status = 'draft'`)
    .all(site.id) as DraftRow[];

  if (drafts.length === 0) {
    return { ok: true, skipped: true, reviewed: 0, passed: 0, flagged: 0, error: "No draft content waiting on QA." };
  }

  const businessFacts = profile
    ? `Known real facts: industry=${profile.industry ?? "?"}, area=${profile.serviceArea ?? "?"}, services=${profile.services.join(", ") || "?"}. Nothing else is confirmed — no prices, no certifications, no years-in-business, no testimonials, no guarantees exist in our records.`
    : "No business profile on file — flag any specific factual claim as unverifiable.";

  const draftListing = drafts.map((d) => `--- DRAFT ${d.id} ---\n${d.body.slice(0, 2000)}`).join("\n\n");

  const prompt = `${businessFacts}

Review these drafts for fabricated claims — anything stated as fact that isn't in the known real facts above (specific prices, "award-winning", "10+ years experience", named certifications, testimonials/quotes, guarantees, statistics). General marketing language ("quality service", "friendly team") is fine; SPECIFIC unverifiable factual claims are not.

${draftListing}

Return ONLY a JSON array, no other text: [{ "id": string (the DRAFT id exactly as given), "pass": boolean, "issues": string[] (empty if pass is true) }]`;

  const result = await routeTask("final_qa", [{ role: "user", content: prompt }]);
  if (!result.ok || !result.text) {
    return { ok: false, reviewed: 0, passed: 0, flagged: 0, error: result.error ?? "No response from any configured AI provider." };
  }

  let verdicts: QaVerdict[];
  try {
    const fenced = result.text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const raw = fenced ? fenced[1] : result.text;
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    verdicts = JSON.parse(raw.slice(start, end + 1)) as QaVerdict[];
  } catch {
    return { ok: false, reviewed: 0, passed: 0, flagged: 0, error: "The model's QA response wasn't valid JSON." };
  }

  const updateStatus = db.prepare(`UPDATE content_assets SET status = ? WHERE id = ?`);
  let passed = 0;
  let flagged = 0;
  for (const v of verdicts) {
    if (!drafts.some((d) => d.id === v.id)) continue;
    updateStatus.run(v.pass ? "qa_passed" : "qa_flagged", v.id);
    if (v.pass) passed++;
    else flagged++;
  }

  return { ok: true, reviewed: passed + flagged, passed, flagged, provider: result.provider, model: result.model };
}
