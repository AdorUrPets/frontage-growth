import { getHealthyDecryptedKeys, recordKeySuccess, recordKeyFailure } from "../db/keys";
import type { ProviderCode } from "../types";

// Generalizes lead-finder's gemini.ts/serpApiPool.ts rotation pattern and
// Jarvis_kit's per-key cooldown map into a single DB-backed pool for any
// cloud provider. Env vars remain an additional fallback layer beneath the
// DB-stored pool, matching lead-finder's PRIMARY/_BACKUP/_KEYS convention.

const ROTATION_STATUS_CODES = new Set([401, 403, 429]);
const ROTATION_MESSAGE_HINTS = [
  "resource_exhausted",
  "quota",
  "rate limit",
  "permission_denied",
  "api key not valid",
  "api key expired",
  "invalid api key",
];

export function isRotationError(status: number, message: string): boolean {
  if (ROTATION_STATUS_CODES.has(status)) return true;
  const m = message.toLowerCase();
  return ROTATION_MESSAGE_HINTS.some((hint) => m.includes(hint));
}

function envKeyPool(providerCode: ProviderCode): string[] {
  const envPrefix = providerCode.toUpperCase();
  const raw = [
    process.env[`${envPrefix}_API_KEY`],
    process.env[`${envPrefix}_API_KEY_BACKUP`],
    ...(process.env[`${envPrefix}_API_KEYS`]?.split(",") ?? []),
  ];
  const seen = new Set<string>();
  const pool: string[] = [];
  for (const value of raw) {
    const key = (value ?? "").trim();
    if (key.length < 8 || key.startsWith("YOUR_") || key.startsWith("PASTE_")) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push(key);
  }
  return pool;
}

export interface PoolKey {
  id: string | null; // null for an env-sourced key (nothing to record status against)
  value: string;
}

export function loadPool(providerCode: ProviderCode): PoolKey[] {
  const dbKeys = getHealthyDecryptedKeys(providerCode).map((k) => ({ id: k.id, value: k.value }));
  const envKeys = envKeyPool(providerCode)
    .filter((v) => !dbKeys.some((k) => k.value === v))
    .map((value) => ({ id: null, value }));
  return [...dbKeys, ...envKeys];
}

export interface CallAttemptResult {
  ok: boolean;
  rotate: boolean; // if false and !ok, stop trying more keys — the request itself is bad
  errorMessage?: string;
}

// Runs `attempt` against each key in the pool in order until one succeeds or
// the pool is exhausted. `attempt` reports back whether the failure is
// key-specific (rotate) or a fixed property of the request (stop).
export async function withKeyPool<T>(
  providerCode: ProviderCode,
  attempt: (key: PoolKey) => Promise<{ result?: T; attempt: CallAttemptResult }>
): Promise<{ ok: true; result: T; keyId: string | null } | { ok: false; error: string }> {
  const pool = loadPool(providerCode);
  if (pool.length === 0) {
    return { ok: false, error: `No ${providerCode} keys configured (Settings → AI Models → ${providerCode}).` };
  }

  let lastError = `${providerCode} request failed.`;
  for (const key of pool) {
    const { result, attempt: outcome } = await attempt(key);
    if (outcome.ok && result !== undefined) {
      if (key.id) recordKeySuccess(key.id);
      return { ok: true, result, keyId: key.id };
    }
    lastError = outcome.errorMessage ?? lastError;
    if (key.id) {
      const cooldownUntil = outcome.rotate ? new Date(Date.now() + 5 * 60_000).toISOString() : null;
      recordKeyFailure(key.id, outcome.rotate ? "rate_limited" : "error", cooldownUntil);
    }
    if (!outcome.rotate) {
      return { ok: false, error: lastError };
    }
    // else: rotate to next key in pool
  }
  return { ok: false, error: `All ${providerCode} keys exhausted. Last error: ${lastError}` };
}
