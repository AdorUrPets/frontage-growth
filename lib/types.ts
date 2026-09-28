export type ProviderCode = "ollama" | "gemini" | "openrouter" | "serpapi";

export type KeyStatus = "online" | "ready" | "untested" | "busy" | "cooldown" | "rate_limited" | "error" | "disabled";

export interface ApiKeyRow {
  id: string;
  provider_code: ProviderCode;
  label: string | null;
  key_ciphertext: string;
  key_iv: string;
  key_tag: string;
  key_last4: string;
  priority: number;
  status: KeyStatus;
  enabled: number;
  success_count: number;
  failure_count: number;
  last_used_at: string | null;
  cooldown_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiKeySummary {
  id: string;
  providerCode: ProviderCode;
  label: string | null;
  masked: string;
  priority: number;
  status: KeyStatus;
  enabled: boolean;
  successCount: number;
  failureCount: number;
  lastUsedAt: string | null;
  cooldownUntil: string | null;
}

export interface ModelRow {
  id: string;
  provider_code: string;
  model_id: string;
  display_name: string | null;
  enabled: number;
  priority: number;
  use_case: string | null;
  fallback_position: number | null;
  created_at: string;
}

export interface RoutingRuleRow {
  id: string;
  task_type: string;
  rank: number;
  provider_code: string;
  model_id: string | null;
}

export interface ProviderHealthRow {
  id: string;
  provider_code: string;
  status: string;
  configured_count: number;
  available_count: number;
  requests_today: number;
  failures_today: number;
  fallback_events_today: number;
  avg_response_ms: number | null;
  last_checked_at: string | null;
  updated_at: string;
}

export interface ClientRow {
  id: string;
  name: string;
  business_name: string | null;
  primary_location: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SiteRow {
  id: string;
  client_id: string;
  url: string;
  cms: string | null;
  repo_url: string | null;
  hosting: string | null;
  search_console_connected: number;
  analytics_connected: number;
  search_console_property: string | null;
  analytics_property_id: string | null;
  google_connection_id: string | null;
  repo_local_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  task_type: string;
  enabled: number;
  system_prompt: string | null;
  prompt_version: number;
  output_schema_json: string | null;
  temperature: number | null;
}

export interface OllamaModelInfo {
  name: string;
  sizeBytes: number;
  modifiedAt: string;
}
