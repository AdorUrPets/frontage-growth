// Fires one cheap live call against a single specific key (not the pool) —
// backs the per-key "Test" button in Settings → AI Models.

export async function testProviderKey(providerCode: string, keyValue: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (providerCode === "gemini") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${keyValue}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: data?.error?.message || `HTTP ${res.status}` };
      }
      return { ok: true };
    }

    if (providerCode === "openrouter") {
      const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
        headers: { Authorization: `Bearer ${keyValue}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: data?.error?.message || `HTTP ${res.status}` };
      }
      return { ok: true };
    }

    if (providerCode === "serpapi") {
      const res = await fetch(`https://serpapi.com/account.json?api_key=${encodeURIComponent(keyValue)}`, {
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) {
        return { ok: false, error: data?.error || `HTTP ${res.status}` };
      }
      return { ok: true };
    }

    return { ok: false, error: `Unknown provider "${providerCode}".` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Request failed." };
  }
}

export interface QuotaInfo {
  available: boolean; // false = provider has no API for this, not "zero remaining"
  remaining?: number;
  limit?: number;
  unit?: string; // "searches this month", "USD credit", etc.
  error?: string;
  note?: string; // extra real fact shown alongside, even when remaining/limit can't be computed
}

// Real remaining-quota lookups, only for providers that actually expose one.
// Gemini's free tier has no endpoint for this at all (quota is tracked per
// Google Cloud project, not per key — confirmed against ai.google.dev/gemini-api/docs/rate-limits,
// there's no REST call that reads it back with just an API key) —
// reporting a made-up number there would violate the same no-fabrication
// rule as everywhere else in this app, so it's honestly "available: false"
// with an explanation, not "0 left" or silence.
export async function getProviderQuota(providerCode: string, keyValue: string): Promise<QuotaInfo> {
  try {
    if (providerCode === "serpapi") {
      const res = await fetch(`https://serpapi.com/account.json?api_key=${encodeURIComponent(keyValue)}`, {
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) return { available: false, error: data?.error || `HTTP ${res.status}` };
      const remaining = data.plan_searches_left ?? data.total_searches_left;
      const limit = data.searches_per_month;
      if (typeof remaining !== "number") return { available: false };
      return { available: true, remaining, limit: typeof limit === "number" ? limit : undefined, unit: "searches this month" };
    }

    if (providerCode === "openrouter") {
      const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
        headers: { Authorization: `Bearer ${keyValue}` },
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { available: false, error: data?.error?.message || `HTTP ${res.status}` };
      const limit = data?.data?.limit;
      const usage = data?.data?.usage;
      const rateLimit = data?.data?.rate_limit as { requests?: number; interval?: string } | undefined;
      const note = rateLimit?.requests && rateLimit?.interval ? `Rate limit: ${rateLimit.requests} requests / ${rateLimit.interval}` : undefined;
      if (typeof limit !== "number") {
        // Free-tier and pay-as-you-go keys both report limit: null — OpenRouter
        // doesn't distinguish which in this response, so there's no fixed
        // credit ceiling to compute "remaining" against. The per-key request
        // rate limit is still real and always present, so surface that instead
        // of showing nothing.
        return {
          available: false,
          error: typeof usage === "number" ? `No fixed credit limit on this key — $${usage.toFixed(2)} used to date.` : "No fixed credit limit on this key.",
          note,
        };
      }
      return { available: true, remaining: Math.max(0, limit - usage), limit, unit: "USD credit", note };
    }

    if (providerCode === "gemini") {
      return {
        available: false,
        error: "Gemini quota is tracked per Google Cloud project, not exposed per key — no API call can read it back.",
        note: "Check real limits at ai.google.dev/gemini-api/docs/rate-limits or your project's Google AI Studio page.",
      };
    }

    return { available: false };
  } catch (err) {
    return { available: false, error: err instanceof Error ? err.message : "Request failed." };
  }
}
