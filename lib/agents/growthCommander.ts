import { getDb } from "../db/client";
import { routeTask } from "../ai/router";
import { getLatestBusinessProfile } from "./businessUnderstanding";
import type { ClientRow, SiteRow } from "../types";

export interface NextAction {
  priority: "P1" | "P2" | "P3" | "P4";
  action: string;
  evidence: string;
}

export interface GrowthCommanderResult {
  ok: boolean;
  actions?: NextAction[];
  provider?: string;
  model?: string;
  error?: string;
}

// Does not do specialist work itself — reads real evidence every other
// agent already produced and ranks what to do next. No Search Console
// data exists yet, so this never invents impressions/clicks/position; it
// reasons only from findings, pending approvals, and content/channel gaps
// that are actually on record.
export async function runGrowthCommander(client: ClientRow, site: SiteRow): Promise<GrowthCommanderResult> {
  const db = getDb();
  const profile = getLatestBusinessProfile(client.id);

  const openFindings = db
    .prepare(`SELECT severity, finding FROM technical_findings WHERE site_id = ? AND status = 'open' ORDER BY severity LIMIT 15`)
    .all(site.id) as { severity: string; finding: string }[];
  const pendingChanges = (
    db.prepare(`SELECT COUNT(*) as n FROM seo_changes sc JOIN pages p ON p.id = sc.page_id WHERE p.site_id = ? AND sc.approval_id IS NULL`).get(site.id) as { n: number }
  ).n;
  const draftContent = (
    db.prepare(`SELECT COUNT(*) as n FROM content_assets WHERE site_id = ? AND status IN ('draft', 'qa_passed')`).get(site.id) as { n: number }
  ).n;
  const openOpportunities = (
    db.prepare(`SELECT COUNT(*) as n FROM content_opportunities WHERE site_id = ? AND status = 'proposed'`).get(site.id) as { n: number }
  ).n;
  const channels = db.prepare(`SELECT name FROM channels WHERE site_id = ? AND enabled = 1`).all(site.id) as { name: string }[];

  if (openFindings.length === 0 && pendingChanges === 0 && draftContent === 0 && openOpportunities === 0) {
    return { ok: false, error: "No evidence to reason over yet — run the SEO protocol first." };
  }

  const prompt = `Business: ${profile?.industry ?? "unknown"} in ${profile?.serviceArea ?? "unknown area"}.

Real evidence on record right now:
- Open technical findings (${openFindings.length}): ${openFindings.map((f) => `[${f.severity}] ${f.finding}`).join(" | ") || "none"}
- Pending on-page SEO changes awaiting your approval: ${pendingChanges}
- Drafted content awaiting review/publish: ${draftContent}
- Content opportunities not yet drafted: ${openOpportunities}
- Channels marked relevant for traffic: ${channels.map((c) => c.name).join(", ") || "none yet"}

No Search Console or analytics data is connected yet — do not invent impressions, clicks, position, or traffic numbers.

Rank the next 3-5 concrete actions the operator should take, grounded ONLY in the evidence above. Return ONLY a JSON array, no other text: [{ "priority": "P1"|"P2"|"P3"|"P4", "action": string, "evidence": string (cite the specific finding/count above) }]`;

  const result = await routeTask("growth_synthesis", [{ role: "user", content: prompt }]);
  if (!result.ok || !result.text) {
    return { ok: false, error: result.error ?? "No response from any configured AI provider." };
  }

  try {
    const fenced = result.text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const raw = fenced ? fenced[1] : result.text;
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    const actions = JSON.parse(raw.slice(start, end + 1)) as NextAction[];
    return { ok: true, actions, provider: result.provider, model: result.model };
  } catch {
    return { ok: false, error: "The model's response wasn't valid JSON." };
  }
}
