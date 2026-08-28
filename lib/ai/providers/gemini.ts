import { withKeyPool, isRotationError } from "../keyPool";

export interface GeminiContent {
  role?: "user" | "model";
  parts: { text: string }[];
}

export interface ProviderCallResult {
  ok: boolean;
  text?: string;
  error?: string;
  model?: string;
  keyId?: string | null;
}

const DEFAULT_MODEL = "gemini-3.5-flash";

export async function callGemini(contents: GeminiContent[], model = DEFAULT_MODEL): Promise<ProviderCallResult> {
  const outcome = await withKeyPool<string>("gemini", async (key) => {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key.value}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        const message = data?.error?.message || `Gemini request failed (HTTP ${res.status}).`;
        return { attempt: { ok: false, rotate: isRotationError(res.status, message), errorMessage: message } };
      }
      const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      if (!text) return { attempt: { ok: false, rotate: false, errorMessage: "Gemini returned an empty response." } };
      return { result: text, attempt: { ok: true, rotate: false } };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reach Gemini API.";
      return { attempt: { ok: false, rotate: false, errorMessage: message } };
    }
  });

  if (outcome.ok) return { ok: true, text: outcome.result, model, keyId: outcome.keyId };
  return { ok: false, error: outcome.error, model };
}
