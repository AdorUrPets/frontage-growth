import { getDb, newId } from "../db/client";
import { routeTask } from "../ai/router";
import type { SiteRow } from "../types";

interface AssetRow {
  id: string;
  opportunity_id: string | null;
  body: string;
}
interface ChannelRow {
  name: string;
}

export interface ContentDistributionResult {
  ok: boolean;
  assetsCreated: number;
  provider?: string;
  model?: string;
  error?: string;
  skipped?: boolean;
}

// Adapts QA-passed website copy into channel-specific formats — but only
// for channels Traffic Strategist actually marked relevant (enabled=1), not
// every platform by default (§34/§32).
export async function runContentDistribution(site: SiteRow): Promise<ContentDistributionResult> {
  const db = getDb();
  const source = db.prepare(`SELECT id, opportunity_id, body FROM content_assets WHERE site_id = ? AND status = 'qa_passed'`).all(site.id) as AssetRow[];
  if (source.length === 0) {
    return { ok: true, skipped: true, assetsCreated: 0, error: "Nothing QA-passed yet to distribute." };
  }

  const channels = db.prepare(`SELECT name FROM channels WHERE site_id = ? AND enabled = 1 AND name != 'Google Search (SEO)'`).all(site.id) as ChannelRow[];
  if (channels.length === 0) {
    return { ok: true, skipped: true, assetsCreated: 0, error: "No relevant distribution channels — either Traffic hasn't run yet, or none of the recommended channels support content posts." };
  }

  const insert = db.prepare(`INSERT INTO content_assets (id, opportunity_id, site_id, channel, format, body, status) VALUES (?, ?, ?, ?, ?, ?, 'draft')`);

  let created = 0;
  let provider: string | undefined;
  let model: string | undefined;

  for (const asset of source.slice(0, 3)) {
    const channelList = channels.map((c) => c.name).join(", ");
    const prompt = `Source webpage copy:
${asset.body.slice(0, 2500)}

Adapt this into a short post for EACH of these channels — do not just copy the same text everywhere, match each platform's real format and length: ${channelList}.

Return ONLY a JSON array, no other text: [{ "channel": string (must match one of the names above exactly), "format": string (e.g. "post", "short_script", "carousel_outline"), "body": string }]`;

    const result = await routeTask("content_writing", [{ role: "user", content: prompt }]);
    if (!result.ok || !result.text) continue;
    provider = result.provider;
    model = result.model;

    try {
      const fenced = result.text.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const raw = fenced ? fenced[1] : result.text;
      const start = raw.indexOf("[");
      const end = raw.lastIndexOf("]");
      const parsed = JSON.parse(raw.slice(start, end + 1)) as { channel: string; format: string; body: string }[];
      for (const p of parsed) {
        if (!channels.some((c) => c.name === p.channel) || !p.body) continue;
        insert.run(newId(), asset.opportunity_id, site.id, p.channel, p.format ?? "post", p.body);
        created++;
      }
    } catch {
      // skip malformed response for this source asset, continue with others
    }
  }

  if (created === 0) return { ok: false, assetsCreated: 0, error: "No distribution assets were produced." };
  return { ok: true, assetsCreated: created, provider, model };
}
