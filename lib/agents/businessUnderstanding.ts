import { getDb, newId } from "../db/client";
import { getLatestCrawlPages } from "../db/crawls";
import { routeTask } from "../ai/router";
import type { ClientRow, SiteRow } from "../types";

export interface BusinessProfile {
  industry: string | null;
  serviceArea: string | null;
  services: string[];
  likelyCustomers: string[];
  primaryConversion: string | null;
  secondaryConversion: string | null;
  summary: string;
}

export interface BusinessUnderstandingResult {
  ok: boolean;
  provider?: string;
  model?: string;
  profile?: BusinessProfile;
  error?: string;
}

function extractJsonObject(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in the model's response.");
  return JSON.parse(raw.slice(start, end + 1));
}

export async function runBusinessUnderstanding(client: ClientRow, site: SiteRow): Promise<BusinessUnderstandingResult> {
  const pages = getLatestCrawlPages(site.id);
  const pageSummaries = pages
    .filter((p) => p.title || p.metaDescription || p.h1)
    .slice(0, 15)
    .map((p) => `- ${p.url}\n  title: ${p.title ?? "(none)"}\n  meta: ${p.metaDescription ?? "(none)"}\n  h1: ${p.h1 ?? "(none)"}`)
    .join("\n");

  if (!pageSummaries) {
    return { ok: false, error: "Site Recon found no readable page content to analyse (run Site Recon first)." };
  }

  const prompt = `You are analysing a real business's website from crawled data. Do not invent anything not supported by this data — if something isn't evident, use null or an empty array.

Business name (as entered by the operator): ${client.name}
Website: ${site.url}
Pages crawled (${pages.length} total, showing up to 15):
${pageSummaries}

Return ONLY a single JSON object, no other text, with this exact shape:
{
  "industry": string or null,
  "serviceArea": string or null (a real, short geographic place name only, e.g. "Tauranga" or "Bay of Plenty, NZ" — null if the business isn't tied to a physical service area; never describe what the business does in this field),
  "services": string[],
  "likelyCustomers": string[],
  "primaryConversion": string or null,
  "secondaryConversion": string or null,
  "summary": string (2-3 sentences)
}`;

  const result = await routeTask("business_classification", [{ role: "user", content: prompt }]);
  if (!result.ok || !result.text) {
    return { ok: false, error: result.error ?? "No response from any configured AI provider." };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = extractJsonObject(result.text);
  } catch {
    return { ok: false, error: "The model's response wasn't valid JSON — see Settings → AI Models → Usage for the raw call." };
  }

  const profile: BusinessProfile = {
    industry: typeof parsed.industry === "string" ? parsed.industry : null,
    serviceArea: typeof parsed.serviceArea === "string" ? parsed.serviceArea : null,
    services: Array.isArray(parsed.services) ? parsed.services.filter((s): s is string => typeof s === "string") : [],
    likelyCustomers: Array.isArray(parsed.likelyCustomers) ? parsed.likelyCustomers.filter((s): s is string => typeof s === "string") : [],
    primaryConversion: typeof parsed.primaryConversion === "string" ? parsed.primaryConversion : null,
    secondaryConversion: typeof parsed.secondaryConversion === "string" ? parsed.secondaryConversion : null,
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
  };

  getDb()
    .prepare(
      `INSERT INTO business_profiles (id, client_id, industry, service_area, services_json, likely_customers_json, primary_conversion, secondary_conversion, summary, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ai_analysis')`
    )
    .run(
      newId(),
      client.id,
      profile.industry,
      profile.serviceArea,
      JSON.stringify(profile.services),
      JSON.stringify(profile.likelyCustomers),
      profile.primaryConversion,
      profile.secondaryConversion,
      profile.summary
    );

  return { ok: true, provider: result.provider, model: result.model, profile };
}

export function getLatestBusinessProfile(clientId: string): BusinessProfile | null {
  const row = getDb()
    .prepare(`SELECT * FROM business_profiles WHERE client_id = ? ORDER BY created_at DESC LIMIT 1`)
    .get(clientId) as
    | {
        industry: string | null;
        service_area: string | null;
        services_json: string;
        likely_customers_json: string;
        primary_conversion: string | null;
        secondary_conversion: string | null;
        summary: string;
      }
    | undefined;
  if (!row) return null;
  return {
    industry: row.industry,
    serviceArea: row.service_area,
    services: JSON.parse(row.services_json || "[]"),
    likelyCustomers: JSON.parse(row.likely_customers_json || "[]"),
    primaryConversion: row.primary_conversion,
    secondaryConversion: row.secondary_conversion,
    summary: row.summary,
  };
}
