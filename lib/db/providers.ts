import { getDb, newId } from "./client";
import type { ModelRow, RoutingRuleRow, ProviderHealthRow } from "../types";

export function listModels(providerCode?: string): ModelRow[] {
  const db = getDb();
  if (providerCode) {
    return db
      .prepare(`SELECT * FROM models WHERE provider_code = ? ORDER BY priority ASC`)
      .all(providerCode) as ModelRow[];
  }
  return db.prepare(`SELECT * FROM models ORDER BY provider_code, priority ASC`).all() as ModelRow[];
}

export function upsertModel(input: {
  providerCode: string;
  modelId: string;
  displayName?: string;
  useCase?: string;
  priority?: number;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO models (id, provider_code, model_id, display_name, use_case, priority)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(provider_code, model_id) DO UPDATE SET
       display_name = excluded.display_name,
       use_case = excluded.use_case,
       priority = excluded.priority`
  ).run(newId(), input.providerCode, input.modelId, input.displayName ?? null, input.useCase ?? null, input.priority ?? 100);
}

export function setModelEnabled(id: string, enabled: boolean): void {
  getDb().prepare(`UPDATE models SET enabled = ? WHERE id = ?`).run(enabled ? 1 : 0, id);
}

export function removeModel(id: string): void {
  getDb().prepare(`DELETE FROM models WHERE id = ?`).run(id);
}

export function listRoutingRules(): RoutingRuleRow[] {
  const db = getDb();
  return db.prepare(`SELECT * FROM routing_rules ORDER BY task_type, rank ASC`).all() as RoutingRuleRow[];
}

export function setRoutingChain(taskType: string, chain: { providerCode: string; modelId?: string | null }[]): void {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM routing_rules WHERE task_type = ?`).run(taskType);
    const insert = db.prepare(
      `INSERT INTO routing_rules (id, task_type, rank, provider_code, model_id) VALUES (?, ?, ?, ?, ?)`
    );
    chain.forEach((entry, i) => insert.run(newId(), taskType, i + 1, entry.providerCode, entry.modelId ?? null));
  });
  tx();
}

export function listProviderHealth(): ProviderHealthRow[] {
  const db = getDb();
  return db.prepare(`SELECT * FROM provider_health ORDER BY provider_code`).all() as ProviderHealthRow[];
}

export function refreshProviderCounts(providerCode: string, configuredCount: number, availableCount: number): void {
  getDb()
    .prepare(
      `UPDATE provider_health SET configured_count = ?, available_count = ?, status = ?, last_checked_at = datetime('now'), updated_at = datetime('now') WHERE provider_code = ?`
    )
    .run(configuredCount, availableCount, availableCount > 0 ? "online" : configuredCount > 0 ? "degraded" : "unconfigured", providerCode);
}

export function recordUsage(input: {
  providerCode: string;
  apiKeyId?: string | null;
  modelId?: string | null;
  taskType?: string | null;
  status: "success" | "error";
  durationMs?: number | null;
  error?: string | null;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO provider_usage (id, provider_code, api_key_id, model_id, task_type, status, duration_ms, error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    newId(),
    input.providerCode,
    input.apiKeyId ?? null,
    input.modelId ?? null,
    input.taskType ?? null,
    input.status,
    input.durationMs ?? null,
    input.error ?? null
  );
  db.prepare(
    `UPDATE provider_health SET
       requests_today = requests_today + 1,
       failures_today = failures_today + ?,
       updated_at = datetime('now')
     WHERE provider_code = ?`
  ).run(input.status === "error" ? 1 : 0, input.providerCode);
}

export function recordFallbackEvent(providerCode: string): void {
  getDb()
    .prepare(`UPDATE provider_health SET fallback_events_today = fallback_events_today + 1, updated_at = datetime('now') WHERE provider_code = ?`)
    .run(providerCode);
}

export function usageSummary(sinceHours = 24): { providerCode: string; total: number; failures: number }[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT provider_code as providerCode, COUNT(*) as total, SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failures
       FROM provider_usage
       WHERE created_at >= datetime('now', ?)
       GROUP BY provider_code`
    )
    .all(`-${sinceHours} hours`) as { providerCode: string; total: number; failures: number }[];
}
