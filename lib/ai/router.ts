import { getDb } from "../db/client";
import { recordUsage, recordFallbackEvent } from "../db/providers";
import { callGemini } from "./providers/gemini";
import { callOpenRouter, type ChatMessage } from "./providers/openrouter";
import { callOllama } from "./providers/ollama";
import { discoverOllamaModels } from "./providers/ollama";
import type { RoutingRuleRow, ModelRow } from "../types";

export interface RouteResult {
  ok: boolean;
  text?: string;
  error?: string;
  provider?: string;
  model?: string;
  attempts: { provider: string; model?: string; ok: boolean; error?: string; durationMs: number }[];
}

async function pickModel(providerCode: string, explicitModelId: string | null): Promise<string> {
  if (explicitModelId) return explicitModelId;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT model_id FROM models WHERE provider_code = ? AND enabled = 1 ORDER BY priority ASC LIMIT 1`
    )
    .get(providerCode) as Pick<ModelRow, "model_id"> | undefined;
  if (row) return row.model_id;

  // No model registered in Settings → AI Models yet — fall back to something
  // that actually works instead of failing outright.
  if (providerCode === "gemini") return "gemini-3.5-flash";
  if (providerCode === "ollama") {
    const discovered = await discoverOllamaModels();
    return discovered.ok && discovered.models.length > 0 ? discovered.models[0].name : "";
  }
  return "";
}

// Central entrypoint every agent calls instead of a provider client directly.
// Reads routing_rules for taskType (edited from Settings → AI Models →
// Routing), tries each provider in rank order, records every attempt to
// provider_usage, and reports back which provider/model actually served the
// request — the "which model is working" requirement for the mission board.
export async function routeTask(taskType: string, messages: ChatMessage[]): Promise<RouteResult> {
  const db = getDb();
  const rules = db
    .prepare(`SELECT * FROM routing_rules WHERE task_type = ? ORDER BY rank ASC`)
    .all(taskType) as RoutingRuleRow[];

  if (rules.length === 0) {
    return { ok: false, error: `No routing rule configured for task type "${taskType}".`, attempts: [] };
  }

  const attempts: RouteResult["attempts"] = [];

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    const model = await pickModel(rule.provider_code, rule.model_id);
    const started = Date.now();

    if (!model) {
      attempts.push({ provider: rule.provider_code, ok: false, error: `No ${rule.provider_code} model available (none registered and none discoverable).`, durationMs: 0 });
      if (i < rules.length - 1) recordFallbackEvent(rule.provider_code);
      continue;
    }

    let result;
    if (rule.provider_code === "gemini") {
      result = await callGemini(messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })), model);
    } else if (rule.provider_code === "openrouter") {
      result = await callOpenRouter(messages, model);
    } else if (rule.provider_code === "ollama") {
      result = await callOllama(messages, model);
    } else {
      result = { ok: false, error: `Task type "${taskType}" routed to unsupported provider "${rule.provider_code}".` };
    }

    const durationMs = Date.now() - started;
    attempts.push({ provider: rule.provider_code, model, ok: result.ok, error: result.error, durationMs });
    recordUsage({
      providerCode: rule.provider_code,
      modelId: model || null,
      taskType,
      status: result.ok ? "success" : "error",
      durationMs,
      error: result.ok ? null : result.error,
    });

    if (result.ok) return { ok: true, text: result.text, provider: rule.provider_code, model, attempts };

    if (i < rules.length - 1) recordFallbackEvent(rule.provider_code);
  }

  const summary = attempts.map((a) => `${a.provider}: ${a.error}`).join(" · ");
  return { ok: false, error: `All routed providers failed for "${taskType}". ${summary}`, attempts };
}
