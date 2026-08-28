import { listKeys } from "../db/keys";
import { refreshProviderCounts } from "../db/providers";
import { discoverOllamaModels } from "./providers/ollama";
import type { ProviderCode, OllamaModelInfo } from "../types";

export type OllamaHealth = { online: true; models: OllamaModelInfo[] } | { online: false; error: string };

// Shared by the Health settings tab AND the Dashboard — both need
// provider_health to reflect what's actually configured *right now*, not
// whatever it was last time someone happened to open the Health tab.
// "Available" mirrors what lib/ai/keyPool.ts actually pulls from: enabled
// and not currently in cooldown (a stale one-off "error" status from a past
// test doesn't remove a key from rotation, so it shouldn't count as
// unavailable here either).
export async function refreshAllProviderHealth(): Promise<{ ollama: OllamaHealth }> {
  const now = Date.now();
  for (const provider of ["gemini", "openrouter", "serpapi"] as ProviderCode[]) {
    const keys = listKeys(provider);
    const enabled = keys.filter((k) => k.enabled);
    const available = enabled.filter((k) => !k.cooldownUntil || new Date(k.cooldownUntil).getTime() <= now);
    refreshProviderCounts(provider, keys.length, available.length);
  }

  const ollama = await discoverOllamaModels();
  refreshProviderCounts("ollama", ollama.ok ? ollama.models.length : 0, ollama.ok ? ollama.models.length : 0);

  return {
    ollama: ollama.ok ? { online: true, models: ollama.models } : { online: false, error: ollama.error },
  };
}
