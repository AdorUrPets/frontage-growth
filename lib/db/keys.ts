import { getDb, newId } from "./client";
import { encryptKey, decryptKey, maskKey } from "../crypto/vault";
import type { ApiKeyRow, ApiKeySummary, ProviderCode, KeyStatus } from "../types";

function toSummary(row: ApiKeyRow): ApiKeySummary {
  return {
    id: row.id,
    providerCode: row.provider_code,
    label: row.label,
    masked: maskKey(row.key_last4),
    priority: row.priority,
    status: row.status,
    enabled: row.enabled === 1,
    successCount: row.success_count,
    failureCount: row.failure_count,
    lastUsedAt: row.last_used_at,
    cooldownUntil: row.cooldown_until,
  };
}

export function listKeys(providerCode: ProviderCode): ApiKeySummary[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT * FROM api_keys WHERE provider_code = ? ORDER BY priority ASC, created_at ASC`)
    .all(providerCode) as ApiKeyRow[];
  return rows.map(toSummary);
}

export function addKey(providerCode: ProviderCode, plaintext: string, label?: string): ApiKeySummary {
  const db = getDb();
  const enc = encryptKey(plaintext.trim());
  const id = newId();
  const maxPriority = db
    .prepare(`SELECT COALESCE(MAX(priority), 0) as max FROM api_keys WHERE provider_code = ?`)
    .get(providerCode) as { max: number };
  // Status starts 'untested' (not 'ready') — a key that's never actually been
  // called shouldn't claim readiness. It flips to 'ready' only once a live
  // Test call (or a real routed request) succeeds against it.
  db.prepare(
    `INSERT INTO api_keys (id, provider_code, label, key_ciphertext, key_iv, key_tag, key_last4, priority, status, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'untested', 1)`
  ).run(id, providerCode, label ?? null, enc.ciphertext, enc.iv, enc.tag, enc.last4, maxPriority.max + 10);
  const row = db.prepare(`SELECT * FROM api_keys WHERE id = ?`).get(id) as ApiKeyRow;
  return toSummary(row);
}

export function removeKey(id: string): void {
  getDb().prepare(`DELETE FROM api_keys WHERE id = ?`).run(id);
}

export function setKeyEnabled(id: string, enabled: boolean): void {
  getDb()
    .prepare(`UPDATE api_keys SET enabled = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(enabled ? 1 : 0, id);
}

export function setKeyPriority(id: string, priority: number): void {
  getDb()
    .prepare(`UPDATE api_keys SET priority = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(priority, id);
}

export function renameKey(id: string, label: string): void {
  getDb()
    .prepare(`UPDATE api_keys SET label = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(label, id);
}

export function setKeyStatus(id: string, status: KeyStatus, cooldownUntil?: string | null): void {
  getDb()
    .prepare(`UPDATE api_keys SET status = ?, cooldown_until = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(status, cooldownUntil ?? null, id);
}

export function recordKeySuccess(id: string): void {
  getDb()
    .prepare(
      `UPDATE api_keys SET success_count = success_count + 1, status = 'ready', last_used_at = datetime('now'), cooldown_until = NULL, updated_at = datetime('now') WHERE id = ?`
    )
    .run(id);
}

export function recordKeyFailure(id: string, status: KeyStatus, cooldownUntil: string | null): void {
  getDb()
    .prepare(
      `UPDATE api_keys SET failure_count = failure_count + 1, status = ?, last_used_at = datetime('now'), cooldown_until = ?, updated_at = datetime('now') WHERE id = ?`
    )
    .run(status, cooldownUntil, id);
}

// Server-only: returns decrypted, healthy (enabled, not in cooldown), ordered
// keys for a provider. Used exclusively by lib/ai/keyPool.ts.
export function getHealthyDecryptedKeys(providerCode: ProviderCode): { id: string; value: string }[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM api_keys
       WHERE provider_code = ? AND enabled = 1
         AND (cooldown_until IS NULL OR cooldown_until <= datetime('now'))
       ORDER BY priority ASC, created_at ASC`
    )
    .all(providerCode) as ApiKeyRow[];
  return rows.map((row) => ({
    id: row.id,
    value: decryptKey({ ciphertext: row.key_ciphertext, iv: row.key_iv, tag: row.key_tag }),
  }));
}

export function testDecryptKey(id: string): string {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM api_keys WHERE id = ?`).get(id) as ApiKeyRow | undefined;
  if (!row) throw new Error("Key not found");
  return decryptKey({ ciphertext: row.key_ciphertext, iv: row.key_iv, tag: row.key_tag });
}
