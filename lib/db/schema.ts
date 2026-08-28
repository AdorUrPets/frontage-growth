// Full schema for Frontage Growth. Created up front (Phase 1) even though most
// tables are only populated starting in later phases — see the build plan.
// Mirrors lead-finder's convention: CREATE TABLE IF NOT EXISTS inline, no ORM.

export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

-- ===================== Core =====================

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  business_name TEXT,
  primary_location TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One Google login can cover every client whose site is verified under that
-- account in Search Console — connect once here, then each site just picks
-- its own property. (sites.google_refresh_token_* below is the old,
-- deprecated per-site design kept only so lib/db/client.ts can migrate any
-- already-stored token forward into this table.)
CREATE TABLE IF NOT EXISTS google_connections (
  id TEXT PRIMARY KEY,
  label TEXT,
  google_email TEXT,
  refresh_token_ciphertext TEXT NOT NULL,
  refresh_token_iv TEXT NOT NULL,
  refresh_token_tag TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  cms TEXT,
  platform TEXT,
  repo_url TEXT,
  hosting TEXT,
  search_console_connected INTEGER NOT NULL DEFAULT 0,
  analytics_connected INTEGER NOT NULL DEFAULT 0,
  search_console_property TEXT,
  google_connection_id TEXT REFERENCES google_connections(id) ON DELETE SET NULL,
  google_refresh_token_ciphertext TEXT,
  google_refresh_token_iv TEXT,
  google_refresh_token_tag TEXT,
  shopify_shop_domain TEXT,
  shopify_access_token_ciphertext TEXT,
  shopify_access_token_iv TEXT,
  shopify_access_token_tag TEXT,
  growth_agent_token_hash TEXT,
  growth_agent_token_created_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sites_client ON sites(client_id);

-- Short-lived: holds a site's Shopify custom-app Client ID/Secret only for
-- the few seconds between starting the OAuth redirect and the callback
-- completing the token exchange. Deleted immediately after use (or expired
-- rows cleaned up) — never a long-term store, unlike sites.shopify_*.
CREATE TABLE IF NOT EXISTS shopify_oauth_pending (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  shop_domain TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_secret_ciphertext TEXT NOT NULL,
  client_secret_iv TEXT NOT NULL,
  client_secret_tag TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  page_type TEXT,
  title TEXT,
  meta_description TEXT,
  h1 TEXT,
  canonical_url TEXT,
  indexable INTEGER,
  price REAL,
  price_currency TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pages_site ON pages(site_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pages_site_url ON pages(site_id, url);

-- ===================== Recon =====================

CREATE TABLE IF NOT EXISTS crawls (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued',
  pages_discovered INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_crawls_site ON crawls(site_id);

CREATE TABLE IF NOT EXISTS crawl_pages (
  id TEXT PRIMARY KEY,
  crawl_id TEXT NOT NULL REFERENCES crawls(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  status_code INTEGER,
  page_type TEXT,
  title TEXT,
  meta_description TEXT,
  raw_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_crawl_pages_crawl ON crawl_pages(crawl_id);

CREATE TABLE IF NOT EXISTS business_profiles (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  industry TEXT,
  service_area TEXT,
  services_json TEXT,
  likely_customers_json TEXT,
  primary_conversion TEXT,
  secondary_conversion TEXT,
  summary TEXT,
  source TEXT NOT NULL DEFAULT 'ai_analysis',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_business_profiles_client ON business_profiles(client_id);

-- ===================== Search intelligence =====================

CREATE TABLE IF NOT EXISTS keywords (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  intent TEXT,
  location TEXT,
  service TEXT,
  priority TEXT,
  existing_page_id TEXT REFERENCES pages(id) ON DELETE SET NULL,
  recommended_page TEXT,
  current_ranking INTEGER,
  opportunity TEXT,
  evidence_source TEXT,
  cluster_id TEXT REFERENCES keyword_clusters(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_keywords_site ON keywords(site_id);

CREATE TABLE IF NOT EXISTS keyword_clusters (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  primary_intent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_keyword_clusters_site ON keyword_clusters(site_id);

CREATE TABLE IF NOT EXISTS serp_results (
  id TEXT PRIMARY KEY,
  keyword_id TEXT NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
  position INTEGER,
  result_url TEXT,
  result_title TEXT,
  result_domain TEXT,
  is_local_pack INTEGER NOT NULL DEFAULT 0,
  raw_json TEXT,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_serp_results_keyword ON serp_results(keyword_id);

CREATE TABLE IF NOT EXISTS competitors (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  name TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_competitors_site ON competitors(site_id);

-- ===================== SEO =====================

CREATE TABLE IF NOT EXISTS seo_findings (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  finding TEXT NOT NULL,
  evidence_json TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_seo_findings_page ON seo_findings(page_id);

CREATE TABLE IF NOT EXISTS seo_changes (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  before_value TEXT,
  after_value TEXT,
  reason TEXT,
  agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
  model_used TEXT,
  approval_id TEXT REFERENCES approvals(id) ON DELETE SET NULL,
  deployment_id TEXT REFERENCES deployments(id) ON DELETE SET NULL,
  performance_before_json TEXT,
  performance_after_json TEXT,
  applied_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_seo_changes_page ON seo_changes(page_id);

CREATE TABLE IF NOT EXISTS technical_findings (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  page_id TEXT REFERENCES pages(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  finding TEXT NOT NULL,
  evidence_json TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_technical_findings_site ON technical_findings(site_id);

CREATE TABLE IF NOT EXISTS schema_findings (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  schema_type TEXT NOT NULL,
  proposed_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_schema_findings_page ON schema_findings(page_id);

-- ===================== Content =====================

CREATE TABLE IF NOT EXISTS content_opportunities (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  proposed_url TEXT,
  title TEXT NOT NULL,
  search_opportunity TEXT,
  business_relevance TEXT,
  suggested_structure TEXT,
  evidence_json TEXT,
  status TEXT NOT NULL DEFAULT 'proposed',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_content_opportunities_site ON content_opportunities(site_id);

CREATE TABLE IF NOT EXISTS content_assets (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT REFERENCES content_opportunities(id) ON DELETE SET NULL,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  channel TEXT,
  format TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_content_assets_site ON content_assets(site_id);

-- ===================== Traffic =====================

CREATE TABLE IF NOT EXISTS audiences (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audiences_site ON audiences(site_id);

CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relevance_reason TEXT,
  enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_channels_site ON channels(site_id);

CREATE TABLE IF NOT EXISTS traffic_campaigns (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  audience_id TEXT REFERENCES audiences(id) ON DELETE SET NULL,
  location TEXT,
  service TEXT,
  goal TEXT,
  landing_page_id TEXT REFERENCES pages(id) ON DELETE SET NULL,
  channels_json TEXT,
  cta TEXT,
  status TEXT NOT NULL DEFAULT 'idea',
  start_date TEXT,
  traffic INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_traffic_campaigns_site ON traffic_campaigns(site_id);

-- ===================== Conversions & analytics =====================

CREATE TABLE IF NOT EXISTS conversions (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  page_id TEXT REFERENCES pages(id) ON DELETE SET NULL,
  campaign_id TEXT REFERENCES traffic_campaigns(id) ON DELETE SET NULL,
  source TEXT,
  device TEXT,
  occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
  raw_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_conversions_site ON conversions(site_id);

CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  sessions INTEGER,
  organic_sessions INTEGER,
  raw_json TEXT,
  captured_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_site ON analytics_snapshots(site_id);

CREATE TABLE IF NOT EXISTS search_console_snapshots (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  page_id TEXT REFERENCES pages(id) ON DELETE SET NULL,
  query TEXT,
  period TEXT NOT NULL,
  clicks INTEGER,
  impressions INTEGER,
  ctr REAL,
  avg_position REAL,
  captured_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sc_snapshots_site ON search_console_snapshots(site_id);

-- ===================== Orchestration =====================

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  system_prompt TEXT,
  prompt_version INTEGER NOT NULL DEFAULT 1,
  output_schema_json TEXT,
  temperature REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  protocol TEXT NOT NULL DEFAULT 'seo',
  status TEXT NOT NULL DEFAULT 'queued',
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_missions_site ON missions(site_id);

CREATE TABLE IF NOT EXISTS mission_steps (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
  step_order INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  depends_on_step_id TEXT REFERENCES mission_steps(id) ON DELETE SET NULL,
  started_at TEXT,
  completed_at TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mission_steps_mission ON mission_steps(mission_id);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  mission_step_id TEXT REFERENCES mission_steps(id) ON DELETE SET NULL,
  site_id TEXT REFERENCES sites(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued',
  provider TEXT,
  model TEXT,
  input_json TEXT,
  output_json TEXT,
  confidence REAL,
  evidence_json TEXT,
  error TEXT,
  started_at TEXT,
  completed_at TEXT,
  duration_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent ON agent_runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_site ON agent_runs(site_id);

-- ===================== Governance =====================

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  decided_at TEXT,
  decided_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_approvals_site ON approvals(site_id);

CREATE TABLE IF NOT EXISTS deployments (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  adapter TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  summary TEXT,
  rollback_ref TEXT,
  deployed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_deployments_site ON deployments(site_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL DEFAULT 'system',
  action TEXT NOT NULL,
  subject_type TEXT,
  subject_id TEXT,
  detail_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_subject ON audit_logs(subject_type, subject_id);

-- ===================== AI infrastructure =====================

CREATE TABLE IF NOT EXISTS model_providers (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  base_url TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,
  provider_code TEXT NOT NULL REFERENCES model_providers(code) ON DELETE CASCADE,
  model_id TEXT NOT NULL,
  display_name TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 100,
  use_case TEXT,
  fallback_position INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(provider_code, model_id)
);
CREATE INDEX IF NOT EXISTS idx_models_provider ON models(provider_code);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  provider_code TEXT NOT NULL REFERENCES model_providers(code) ON DELETE CASCADE,
  label TEXT,
  key_ciphertext TEXT NOT NULL,
  key_iv TEXT NOT NULL,
  key_tag TEXT NOT NULL,
  key_last4 TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'ready',
  enabled INTEGER NOT NULL DEFAULT 1,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  cooldown_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_api_keys_provider ON api_keys(provider_code);

CREATE TABLE IF NOT EXISTS provider_usage (
  id TEXT PRIMARY KEY,
  provider_code TEXT NOT NULL REFERENCES model_providers(code) ON DELETE CASCADE,
  api_key_id TEXT REFERENCES api_keys(id) ON DELETE SET NULL,
  model_id TEXT,
  task_type TEXT,
  status TEXT NOT NULL,
  duration_ms INTEGER,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_provider_usage_provider ON provider_usage(provider_code);
CREATE INDEX IF NOT EXISTS idx_provider_usage_created ON provider_usage(created_at);

CREATE TABLE IF NOT EXISTS provider_health (
  id TEXT PRIMARY KEY,
  provider_code TEXT NOT NULL UNIQUE REFERENCES model_providers(code) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'unknown',
  configured_count INTEGER NOT NULL DEFAULT 0,
  available_count INTEGER NOT NULL DEFAULT 0,
  requests_today INTEGER NOT NULL DEFAULT 0,
  failures_today INTEGER NOT NULL DEFAULT 0,
  fallback_events_today INTEGER NOT NULL DEFAULT 0,
  avg_response_ms INTEGER,
  last_checked_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS routing_rules (
  id TEXT PRIMARY KEY,
  task_type TEXT NOT NULL,
  rank INTEGER NOT NULL,
  provider_code TEXT NOT NULL REFERENCES model_providers(code) ON DELETE CASCADE,
  model_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(task_type, rank)
);
CREATE INDEX IF NOT EXISTS idx_routing_rules_task ON routing_rules(task_type);
`;
