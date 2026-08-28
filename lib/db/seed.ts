import type Database from "better-sqlite3";
import { newId } from "./client";

// Providers, default routing rules, and the 19-agent registry (§39) are
// seeded once. Idempotent — safe to call on every startup.

const PROVIDERS: { code: string; name: string; kind: string; base_url: string | null }[] = [
  { code: "ollama", name: "Ollama (local)", kind: "local", base_url: "http://localhost:11434" },
  { code: "gemini", name: "Gemini", kind: "cloud", base_url: "https://generativelanguage.googleapis.com" },
  { code: "openrouter", name: "OpenRouter", kind: "cloud", base_url: "https://openrouter.ai/api/v1" },
  { code: "serpapi", name: "SerpApi", kind: "search", base_url: "https://serpapi.com" },
];

// task_type -> ordered [provider_code] fallback chain. model_id left null =
// router uses the highest-priority enabled model for that provider (or a
// sensible built-in default if none configured yet).
const ROUTING_DEFAULTS: Record<string, string[]> = {
  crawling_analysis: ["ollama", "gemini"],
  business_classification: ["ollama", "gemini"],
  keyword_analysis: ["gemini", "openrouter", "ollama"],
  search_intent: ["ollama", "gemini"],
  technical_seo: ["ollama", "gemini"],
  content_writing: ["gemini", "openrouter"],
  meta_generation: ["ollama", "gemini"],
  schema_generation: ["ollama", "gemini"],
  traffic_strategy: ["gemini", "openrouter"],
  competitor_analysis: ["gemini", "openrouter"],
  audience_identification: ["gemini", "openrouter"],
  conversion_analysis: ["gemini", "openrouter"],
  final_qa: ["gemini", "openrouter", "ollama"],
  growth_synthesis: ["gemini", "openrouter", "ollama"],
  live_search: ["serpapi"],
};

const AGENTS: { code: string; name: string; description: string; task_type: string }[] = [
  { code: "growth_commander", name: "Growth Commander", description: "Coordinates every specialist agent, synthesizes next-best-actions from stored evidence.", task_type: "growth_synthesis" },
  { code: "site_recon", name: "Site Recon Agent", description: "Crawls the client's site and builds the website map.", task_type: "crawling_analysis" },
  { code: "business_understanding", name: "Business Understanding Agent", description: "Builds the business profile: industry, services, likely customers, conversions.", task_type: "business_classification" },
  { code: "search_intelligence", name: "Search Intelligence Agent", description: "Runs live Google/SERP research via SerpApi for the client's real search environment.", task_type: "live_search" },
  { code: "keyword_research", name: "Keyword Research Agent", description: "Builds keyword clusters with intent, priority and evidence.", task_type: "keyword_analysis" },
  { code: "serp_analysis", name: "SERP Analysis Agent", description: "Inspects top results per keyword and produces SERP gap reports.", task_type: "search_intent" },
  { code: "technical_seo", name: "Technical SEO Agent", description: "Audits crawlability, indexability, performance and markup health.", task_type: "technical_seo" },
  { code: "onpage_seo", name: "On-Page SEO Agent", description: "Proposes improved titles, meta, headings and internal linking per page.", task_type: "meta_generation" },
  { code: "schema_agent", name: "Schema Agent", description: "Recommends structured data supported by real page/business information only.", task_type: "schema_generation" },
  { code: "local_seo", name: "Local SEO Agent", description: "Local-business signals: NAP, service area, local landing pages, local structured data.", task_type: "technical_seo" },
  { code: "content_opportunity", name: "Content Opportunity Agent", description: "Identifies genuinely useful missing pages backed by real search demand.", task_type: "content_writing" },
  { code: "seo_writer", name: "SEO Writer", description: "Drafts approved content opportunities end to end.", task_type: "content_writing" },
  { code: "seo_qa", name: "SEO QA Agent", description: "Fact/SEO/duplication/grammar/location/intent/brand QA before approval.", task_type: "final_qa" },
  { code: "seo_publisher", name: "SEO Publisher", description: "Applies approved changes through the site adapter, with rollback capability.", task_type: "final_qa" },
  { code: "audience_discovery", name: "Audience Discovery Agent", description: "Determines who the client's real customers are and where they are.", task_type: "audience_identification" },
  { code: "traffic_strategist", name: "Traffic Strategist", description: "Evaluates relevant organic channels and builds traffic campaigns.", task_type: "traffic_strategy" },
  { code: "content_distribution", name: "Content Distribution Agent", description: "Adapts a piece of content into channel-specific formats.", task_type: "content_writing" },
  { code: "conversion_agent", name: "Conversion Agent", description: "Analyses traffic vs. conversions to find friction and opportunity.", task_type: "conversion_analysis" },
  { code: "performance_analyst", name: "Performance Analyst", description: "Tracks real measurable outcomes over time for the Results screen.", task_type: "conversion_analysis" },
  { code: "email_dns_health", name: "Email & DNS Health Agent", description: "Checks MX/SPF/DMARC/DKIM via real DNS lookups and produces the corrected records to publish.", task_type: "technical_seo" },
];

export function seedDefaults(db: Database.Database): void {
  const insertProvider = db.prepare(
    `INSERT OR IGNORE INTO model_providers (id, code, name, kind, base_url) VALUES (?, ?, ?, ?, ?)`
  );
  for (const p of PROVIDERS) insertProvider.run(newId(), p.code, p.name, p.kind, p.base_url);

  const insertHealth = db.prepare(
    `INSERT OR IGNORE INTO provider_health (id, provider_code, status) VALUES (?, ?, 'unknown')`
  );
  for (const p of PROVIDERS) insertHealth.run(newId(), p.code);

  const insertRule = db.prepare(
    `INSERT OR IGNORE INTO routing_rules (id, task_type, rank, provider_code, model_id) VALUES (?, ?, ?, ?, NULL)`
  );
  for (const [taskType, chain] of Object.entries(ROUTING_DEFAULTS)) {
    chain.forEach((provider, i) => insertRule.run(newId(), taskType, i + 1, provider));
  }

  const insertAgent = db.prepare(
    `INSERT OR IGNORE INTO agents (id, code, name, description, task_type) VALUES (?, ?, ?, ?, ?)`
  );
  for (const a of AGENTS) insertAgent.run(newId(), a.code, a.name, a.description, a.task_type);
}
