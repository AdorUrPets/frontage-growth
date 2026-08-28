import { getDb, newId } from "../db/client";
import { routeTask } from "../ai/router";
import { getLatestBusinessProfile } from "./businessUnderstanding";
import type { ClientRow, SiteRow } from "../types";

interface ChannelProposal {
  name: string;
  relevant: boolean;
  reason: string;
}

function extractJsonArray(text: string): unknown[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("No JSON array found in the model's response.");
  return JSON.parse(raw.slice(start, end + 1));
}

const CANDIDATE_CHANNELS = [
  "Google Search (SEO)",
  "Google Business Profile",
  "Facebook",
  "Instagram",
  "TikTok",
  "YouTube",
  "LinkedIn",
  "Pinterest",
  "Local Directories",
  "Community Sites",
  "Referral Sources",
];

export interface TrafficStrategistResult {
  ok: boolean;
  channelsCreated: number;
  provider?: string;
  model?: string;
  error?: string;
}

// Organic-only per the spec — this agent never recommends paid advertising.
export async function runTrafficStrategist(client: ClientRow, site: SiteRow): Promise<TrafficStrategistResult> {
  const profile = getLatestBusinessProfile(client.id);
  if (!profile) {
    return { ok: false, channelsCreated: 0, error: "No business profile yet — run the SEO protocol first." };
  }

  const db = getDb();
  const audiences = db.prepare(`SELECT label FROM audiences WHERE site_id = ?`).all(site.id) as { label: string }[];

  const prompt = `Business: ${profile.industry ?? "unknown industry"} in ${profile.serviceArea ?? "unknown area"}. Services: ${profile.services.join(", ") || "none identified"}.
Audience segments: ${audiences.map((a) => a.label).join(", ") || "none identified yet"}.

Evaluate ONLY these organic (non-paid) channels for this specific business — do not recommend every channel by default, only the ones that genuinely fit:
${CANDIDATE_CHANNELS.join(", ")}

Return ONLY a JSON array, no other text, one entry per channel:
[{ "name": string (must exactly match one of the channel names above), "relevant": boolean, "reason": string (one sentence, grounded in the business/audience data — say why it fits or why it doesn't) }]`;

  const result = await routeTask("traffic_strategy", [{ role: "user", content: prompt }]);
  if (!result.ok || !result.text) {
    return { ok: false, channelsCreated: 0, error: result.error ?? "No response from any configured AI provider." };
  }

  let channels: ChannelProposal[];
  try {
    channels = extractJsonArray(result.text) as ChannelProposal[];
  } catch {
    return { ok: false, channelsCreated: 0, error: "The model's response wasn't valid JSON." };
  }

  db.prepare(`DELETE FROM channels WHERE site_id = ?`).run(site.id);
  const insert = db.prepare(`INSERT INTO channels (id, site_id, name, relevance_reason, enabled) VALUES (?, ?, ?, ?, ?)`);
  let count = 0;
  for (const c of channels) {
    if (!c.name || !CANDIDATE_CHANNELS.includes(c.name)) continue;
    insert.run(newId(), site.id, c.name, c.reason ?? "", c.relevant ? 1 : 0);
    count++;
  }

  if (count === 0) return { ok: false, channelsCreated: 0, error: "The model returned no usable channel recommendations." };
  return { ok: true, channelsCreated: count, provider: result.provider, model: result.model };
}
