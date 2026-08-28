"use client";

import { useEffect, useState, useCallback } from "react";
import { Panel } from "../../../components/hud/Panel";
import { Plus, Trash2 } from "lucide-react";
import type { ModelRow } from "@/lib/types";

export function ModelRegistry({
  providerCode,
  providerLabel,
  placeholder,
}: {
  providerCode: string;
  providerLabel: string;
  placeholder: string;
}) {
  const [models, setModels] = useState<ModelRow[]>([]);
  const [modelId, setModelId] = useState("");
  const [displayName, setDisplayName] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/models?provider=${providerCode}`);
    const data = await res.json();
    setModels(data.models ?? []);
  }, [providerCode]);

  useEffect(() => {
    load();
  }, [load]);

  async function addModel(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerCode, modelId, displayName }),
    });
    setModelId("");
    setDisplayName("");
    load();
  }

  async function toggleEnabled(id: string, enabled: boolean) {
    await fetch("/api/models", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled }),
    });
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/models?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <Panel title={`${providerLabel} models`}>
      <form onSubmit={addModel} className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label className="fg-field-label">Model ID</label>
          <input className="fg-input" value={modelId} onChange={(e) => setModelId(e.target.value)} placeholder={placeholder} required />
        </div>
        <div className="w-48">
          <label className="fg-field-label">Display Name</label>
          <input className="fg-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <button type="submit" className="fg-btn fg-btn--primary">
          <Plus size={14} /> Add
        </button>
      </form>
      {models.length === 0 ? (
        <p className="text-xs text-[var(--fg-text-dim)]">
          No models registered — the router falls back to its built-in default until one is added.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {models.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] px-4 py-2">
              <div className="text-xs">
                <span className="font-semibold text-[var(--fg-text)]">{m.display_name || m.model_id}</span>{" "}
                <span className="font-mono text-[var(--fg-text-faint)]">{m.model_id}</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="fg-btn" onClick={() => toggleEnabled(m.id, m.enabled !== 1)}>
                  {m.enabled === 1 ? "Enabled" : "Disabled"}
                </button>
                <button className="fg-btn fg-btn--danger" onClick={() => remove(m.id)}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
