import type { ChatMessage } from "./openrouter";
import type { ProviderCallResult } from "./gemini";
import type { OllamaModelInfo } from "../../types";

function ollamaHost(): string {
  return (process.env.OLLAMA_HOST || "http://localhost:11434").replace(/\/$/, "");
}

export async function discoverOllamaModels(): Promise<{ ok: true; models: OllamaModelInfo[] } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${ollamaHost()}/api/tags`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return { ok: false, error: `Ollama returned HTTP ${res.status}.` };
    const data = await res.json();
    const models: OllamaModelInfo[] = (data?.models ?? []).map((m: { name: string; size: number; modified_at: string }) => ({
      name: m.name,
      sizeBytes: m.size,
      modifiedAt: m.modified_at,
    }));
    return { ok: true, models };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not reach Ollama.";
    return { ok: false, error: `Ollama is not reachable at ${ollamaHost()} (${message}). Is \`ollama serve\` running?` };
  }
}

export interface OllamaRunningModel {
  name: string;
  sizeBytes: number;
  sizeVramBytes: number;
  expiresAt: string;
}

// Ollama has no quota to check — it's self-hosted, unmetered compute, not a
// billed API — so there's no "remaining" number to fetch. /api/ps is the
// honest real-data equivalent: what's actually loaded in memory right now.
export async function getOllamaRunningModels(): Promise<{ ok: true; models: OllamaRunningModel[] } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${ollamaHost()}/api/ps`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return { ok: false, error: `Ollama returned HTTP ${res.status}.` };
    const data = await res.json();
    const models: OllamaRunningModel[] = (data?.models ?? []).map((m: { name: string; size: number; size_vram: number; expires_at: string }) => ({
      name: m.name,
      sizeBytes: m.size,
      sizeVramBytes: m.size_vram,
      expiresAt: m.expires_at,
    }));
    return { ok: true, models };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not reach Ollama.";
    return { ok: false, error: `Ollama is not reachable at ${ollamaHost()} (${message}).` };
  }
}

export async function callOllama(messages: ChatMessage[], model: string): Promise<ProviderCallResult> {
  if (!model) return { ok: false, error: "No Ollama model selected (Settings → AI Models → Ollama)." };
  try {
    const res = await fetch(`${ollamaHost()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, stream: false }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `Ollama request failed (HTTP ${res.status}). ${text}`.trim(), model };
    }
    const data = await res.json();
    const text: string = data?.message?.content?.trim() || "";
    if (!text) return { ok: false, error: "Ollama returned an empty response.", model };
    return { ok: true, text, model, keyId: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reach Ollama.";
    return { ok: false, error: message, model };
  }
}
