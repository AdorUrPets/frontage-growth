import { getDb, newId } from "../db/client";
import { routeTask } from "../ai/router";
import { getLatestBusinessProfile } from "./businessUnderstanding";
import type { ClientRow, SiteRow } from "../types";

interface AudienceProposal {
  label: string;
  description: string;
  evidence: string;
}

function extractJsonArray(text: string): unknown[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("No JSON array found in the model's response.");
  return JSON.parse(raw.slice(start, end + 1));
}

export interface AudienceDiscoveryResult {
  ok: boolean;
  audiencesCreated: number;
  provider?: string;
  model?: string;
  error?: string;
}

export async function runAudienceDiscovery(client: ClientRow, site: SiteRow): Promise<AudienceDiscoveryResult> {
  const profile = getLatestBusinessProfile(client.id);
  if (!profile) {
    return { ok: false, audiencesCreated: 0, error: "No business profile yet — run the SEO protocol first." };
  }

  const prompt = `Business: ${profile.industry ?? "unknown industry"} in ${profile.serviceArea ?? "unknown area"}.
Services: ${profile.services.join(", ") || "none identified"}.
Likely customers already identified: ${profile.likelyCustomers.join(", ") || "none identified"}.

Identify 2-4 distinct real-world audience segments for this business. Ground every segment in the business/services/location above — do not invent demographics, income levels, or statistics you weren't given.

Return ONLY a JSON array, no other text:
[{ "label": string (short segment name), "description": string (1-2 sentences), "evidence": string (why this segment follows from the business data above) }]`;

  const result = await routeTask("audience_identification", [{ role: "user", content: prompt }]);
  if (!result.ok || !result.text) {
    return { ok: false, audiencesCreated: 0, error: result.error ?? "No response from any configured AI provider." };
  }

  let audiences: AudienceProposal[];
  try {
    audiences = extractJsonArray(result.text) as AudienceProposal[];
  } catch {
    return { ok: false, audiencesCreated: 0, error: "The model's response wasn't valid JSON." };
  }

  const db = getDb();
  db.prepare(`DELETE FROM audiences WHERE site_id = ?`).run(site.id);
  const insert = db.prepare(`INSERT INTO audiences (id, site_id, label, description, evidence_json) VALUES (?, ?, ?, ?, ?)`);
  let count = 0;
  for (const a of audiences) {
    if (!a.label) continue;
    insert.run(newId(), site.id, a.label, a.description ?? "", JSON.stringify({ evidence: a.evidence ?? "" }));
    count++;
  }

  if (count === 0) return { ok: false, audiencesCreated: 0, error: "The model returned no usable audience segments." };
  return { ok: true, audiencesCreated: count, provider: result.provider, model: result.model };
}
