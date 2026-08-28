"use client";

import { useEffect, useState, useCallback } from "react";
import { Panel } from "../../../components/hud/Panel";
import { StatusPill } from "../../../components/hud/StatusPill";
import { ModelRegistry } from "../components/ModelRegistry";
import { RefreshCw, Plus, Gauge } from "lucide-react";
import type { OllamaModelInfo } from "@/lib/types";

interface OllamaRunningModel {
  name: string;
  sizeBytes: number;
  sizeVramBytes: number;
  expiresAt: string;
}

function formatSize(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1024 ** 2).toFixed(0)} MB`;
}

export default function OllamaSettingsPage() {
  const [models, setModels] = useState<OllamaModelInfo[]>([]);
  const [online, setOnline] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [registeredKey, setRegisteredKey] = useState(0);
  const [running, setRunning] = useState<OllamaRunningModel[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [modelsRes, psRes] = await Promise.all([
      fetch("/api/ollama/models").then((r) => r.json()),
      fetch("/api/ollama/ps").then((r) => r.json()).catch(() => ({ ok: false, models: [] })),
    ]);
    setOnline(modelsRes.ok);
    setModels(modelsRes.models ?? []);
    setError(modelsRes.error ?? null);
    setRunning(psRes.models ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function useModel(name: string) {
    await fetch("/api/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerCode: "ollama", modelId: name, displayName: name }),
    });
    setRegisteredKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Ollama (local)"
        right={
          <div className="flex items-center gap-2">
            <StatusPill status={online ? "online" : "disabled"} />
            <button className="fg-btn" onClick={load} disabled={loading}>
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        }
      >
        {!online && error ? <p className="mb-3 text-xs text-[var(--fg-red)]">{error}</p> : null}
        {online ? (
          <div className="mb-3 flex flex-col gap-1 rounded-lg border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] px-4 py-2.5">
            <div className="flex items-center gap-2 text-[11px] text-[var(--fg-text)]">
              <Gauge size={12} className="text-[var(--fg-text-faint)]" />
              <span>Unlimited — self-hosted on your own hardware, no API quota to track.</span>
            </div>
            <span className="pl-5 text-[10px] text-[var(--fg-text-faint)]">
              {running.length === 0
                ? "No models currently loaded in memory."
                : `Loaded now: ${running.map((m) => `${m.name} (${formatSize(m.sizeVramBytes || m.sizeBytes)} in memory)`).join(", ")}.`}
            </span>
          </div>
        ) : null}
        {online && models.length === 0 ? (
          <p className="text-xs text-[var(--fg-text-dim)]">Ollama is online but no models are installed yet.</p>
        ) : null}
        <div className="flex flex-col gap-2">
          {models.map((m) => (
            <div key={m.name} className="flex items-center justify-between rounded-lg border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] px-4 py-2">
              <span className="font-mono text-xs text-[var(--fg-text)]">{m.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-[var(--fg-text-faint)]">
                  {formatSize(m.sizeBytes)} · modified {new Date(m.modifiedAt).toLocaleDateString()}
                </span>
                <button className="fg-btn" onClick={() => useModel(m.name)}>
                  <Plus size={12} /> Use for jobs
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[10px] text-[var(--fg-text-faint)]">
          Discovered live from {process.env.NEXT_PUBLIC_OLLAMA_HOST ?? "http://localhost:11434"}/api/tags. If no
          model is registered below, the router auto-picks whatever Ollama reports first — register one (or a
          priority-ordered few) to control that instead.
        </p>
      </Panel>

      <div key={registeredKey}>
        <ModelRegistry providerCode="ollama" providerLabel="Ollama" placeholder="llama3.1:8b" />
      </div>
    </div>
  );
}
