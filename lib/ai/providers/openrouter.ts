import { withKeyPool, isRotationError } from "../keyPool";
import type { ProviderCallResult } from "./gemini";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function callOpenRouter(messages: ChatMessage[], model: string): Promise<ProviderCallResult> {
  if (!model) return { ok: false, error: "No OpenRouter model selected (Settings → AI Models → OpenRouter)." };

  const outcome = await withKeyPool<string>("openrouter", async (key) => {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key.value}`,
          "HTTP-Referer": "https://frontage.local",
          "X-Title": "Frontage Growth",
        },
        body: JSON.stringify({ model, messages }),
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data?.error?.message || `OpenRouter request failed (HTTP ${res.status}).`;
        return { attempt: { ok: false, rotate: isRotationError(res.status, message), errorMessage: message } };
      }
      const text: string = data?.choices?.[0]?.message?.content?.trim() || "";
      if (!text) return { attempt: { ok: false, rotate: false, errorMessage: "OpenRouter returned an empty response." } };
      return { result: text, attempt: { ok: true, rotate: false } };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reach OpenRouter API.";
      return { attempt: { ok: false, rotate: false, errorMessage: message } };
    }
  });

  if (outcome.ok) return { ok: true, text: outcome.result, model, keyId: outcome.keyId };
  return { ok: false, error: outcome.error, model };
}
