"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Panel } from "../../../components/hud/Panel";
import { ProviderBadge } from "../../../components/hud/ProviderBadge";
import { Save } from "lucide-react";
import type { RoutingRuleRow } from "@/lib/types";

const PROVIDERS = ["ollama", "gemini", "openrouter", "serpapi", "none"];

export default function RoutingSettingsPage() {
  const [rules, setRules] = useState<RoutingRuleRow[]>([]);
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [savingTask, setSavingTask] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/routing");
    const data = await res.json();
    const rows: RoutingRuleRow[] = data.rules ?? [];
    setRules(rows);
    const byTask: Record<string, string[]> = {};
    for (const r of rows) {
      byTask[r.task_type] = byTask[r.task_type] ?? [];
      byTask[r.task_type][r.rank - 1] = r.provider_code;
    }
    setDraft(byTask);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const taskTypes = useMemo(() => Object.keys(draft).sort(), [draft]);

  function setRank(taskType: string, rankIndex: number, provider: string) {
    setDraft((prev) => {
      const chain = [...(prev[taskType] ?? [])];
      chain[rankIndex] = provider;
      return { ...prev, [taskType]: chain };
    });
  }

  async function save(taskType: string) {
    setSavingTask(taskType);
    const chain = (draft[taskType] ?? []).filter((p) => p && p !== "none").map((providerCode) => ({ providerCode }));
    await fetch("/api/routing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskType, chain }),
    });
    setSavingTask(null);
    load();
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Task routing">
        <p className="mb-4 text-xs text-[var(--fg-text-dim)]">
          Every agent calls <code>routeTask(taskType, …)</code> instead of a provider directly. Primary tried
          first; on a rotation-eligible failure (quota/auth) it falls to Secondary, then Tertiary.
        </p>
        <div className="flex flex-col gap-3">
          {taskTypes.map((taskType) => {
            const chain = draft[taskType] ?? [];
            return (
              <div key={taskType} className="rounded-lg border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--fg-text)]">{taskType}</span>
                  <button className="fg-btn" onClick={() => save(taskType)} disabled={savingTask === taskType}>
                    <Save size={12} /> {savingTask === taskType ? "Saving…" : "Save"}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {["Primary", "Secondary", "Tertiary"].map((rankLabel, i) => (
                    <div key={rankLabel} className="flex items-center gap-2">
                      <span className="text-[10px] uppercase text-[var(--fg-text-faint)]">{rankLabel}</span>
                      <select
                        className="fg-select w-36"
                        value={chain[i] ?? "none"}
                        onChange={(e) => setRank(taskType, i, e.target.value)}
                      >
                        {PROVIDERS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  {chain.filter(Boolean).map((p, i) => (
                    <ProviderBadge key={i} provider={p} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
      <p className="text-[10px] text-[var(--fg-text-faint)]">{rules.length} routing rules stored.</p>
    </div>
  );
}
