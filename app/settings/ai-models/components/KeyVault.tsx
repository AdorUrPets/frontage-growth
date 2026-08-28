"use client";

import { useEffect, useState, useCallback } from "react";
import { Panel } from "../../../components/hud/Panel";
import { StatusPill } from "../../../components/hud/StatusPill";
import { Plus, Trash2, FlaskConical, CheckCircle2, XCircle, Gauge } from "lucide-react";
import type { ApiKeySummary, ProviderCode } from "@/lib/types";

interface TestOutcome {
  ok: boolean;
  error?: string;
  at: number;
}

interface QuotaInfo {
  available: boolean;
  remaining?: number;
  limit?: number;
  unit?: string;
  error?: string;
  note?: string;
}

// All three key-vault providers get a real capacity row — SerpApi/OpenRouter
// via a live quota lookup, Gemini via an honest explanation (Google exposes
// no per-key quota API at all, so there's no live call to make for it).
const QUOTA_SUPPORTED: ProviderCode[] = ["serpapi", "openrouter", "gemini"];

export function KeyVault({ providerCode, providerLabel }: { providerCode: ProviderCode; providerLabel: string }) {
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestOutcome>>({});
  const [quotas, setQuotas] = useState<Record<string, QuotaInfo>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/keys?provider=${providerCode}`);
    const data = await res.json();
    const loadedKeys: ApiKeySummary[] = data.keys ?? [];
    setKeys(loadedKeys);
    setLoading(false);

    // Quota lookups hit a free, no-cost account-info endpoint (not the
    // billed API itself) — safe to auto-fetch for every enabled key.
    if (QUOTA_SUPPORTED.includes(providerCode)) {
      for (const k of loadedKeys.filter((k) => k.enabled)) {
        fetch(`/api/keys/${k.id}/quota`)
          .then((r) => r.json())
          .then((q: QuotaInfo) => setQuotas((prev) => ({ ...prev, [k.id]: q })))
          .catch(() => {});
      }
    }
  }, [providerCode]);

  useEffect(() => {
    load();
  }, [load]);

  async function addKey(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: providerCode, value, label }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setValue("");
    setLabel("");
    load();
  }

  async function toggleEnabled(id: string, enabled: boolean) {
    await fetch(`/api/keys/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/keys/${id}`, { method: "DELETE" });
    load();
  }

  async function testKey(id: string) {
    setTesting(id);
    setTestResults((prev) => ({ ...prev, [id]: undefined as unknown as TestOutcome }));
    try {
      const res = await fetch(`/api/keys/${id}/test`, { method: "POST" });
      const data = await res.json();
      setTestResults((prev) => ({ ...prev, [id]: { ok: data.ok, error: data.error, at: Date.now() } }));
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [id]: { ok: false, error: err instanceof Error ? err.message : "Request failed.", at: Date.now() },
      }));
    }
    setTesting(null);
    load();
  }

  const emptySlots = Math.max(0, 10 - keys.length);

  return (
    <div className="flex flex-col gap-4">
      <Panel title={`${providerLabel} key pool`} right={<span className="text-[10px] text-[var(--fg-text-faint)]">{keys.length} configured · {emptySlots} of 10 default slots open</span>}>
        <form onSubmit={addKey} className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <label className="fg-field-label">API Key</label>
            <input className="fg-input" type="password" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Paste key…" required />
          </div>
          <div className="w-40">
            <label className="fg-field-label">Label (optional)</label>
            <input className="fg-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. account-2" />
          </div>
          <button type="submit" className="fg-btn fg-btn--primary">
            <Plus size={14} /> Add
          </button>
        </form>
        {error ? <p className="mb-3 text-xs text-[var(--fg-red)]">{error}</p> : null}

        {loading ? (
          <p className="text-xs text-[var(--fg-text-dim)]">Loading…</p>
        ) : keys.length === 0 ? (
          <p className="text-xs text-[var(--fg-text-dim)]">No keys configured yet.</p>
        ) : (
          <div className="fg-scroll flex flex-col gap-2 overflow-x-auto">
            {keys.map((k) => {
              const result = testResults[k.id];
              const quota = quotas[k.id];
              return (
                <div key={k.id} className="flex flex-col gap-2 rounded-lg border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-xs font-semibold text-[var(--fg-text)]">
                        {k.label ?? "Unlabeled"} <span className="font-mono text-[var(--fg-text-faint)]">{k.masked}</span>
                      </span>
                      <span className="text-[10px] text-[var(--fg-text-faint)]">
                        {k.successCount} ok · {k.failureCount} failed · priority {k.priority}
                        {k.lastUsedAt ? ` · last used ${new Date(k.lastUsedAt).toLocaleString()}` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusPill status={k.enabled ? k.status : "disabled"} />
                      <button className="fg-btn" onClick={() => testKey(k.id)} disabled={testing === k.id}>
                        <FlaskConical size={13} className={testing === k.id ? "animate-pulse" : ""} />{" "}
                        {testing === k.id ? "Calling provider…" : "Test"}
                      </button>
                      <button className="fg-btn" onClick={() => toggleEnabled(k.id, !k.enabled)}>
                        {k.enabled ? "Disable" : "Enable"}
                      </button>
                      <button className="fg-btn fg-btn--danger" onClick={() => remove(k.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  {QUOTA_SUPPORTED.includes(providerCode) && k.enabled ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-[11px] text-[var(--fg-text-dim)]">
                        <Gauge size={12} className="text-[var(--fg-text-faint)]" />
                        {!quota ? (
                          <span className="text-[var(--fg-text-faint)]">Checking real quota…</span>
                        ) : quota.available && quota.remaining != null ? (
                          <>
                            <span className={quota.limit && quota.remaining / quota.limit < 0.15 ? "text-[var(--fg-amber)]" : "text-[var(--fg-text)]"}>
                              {quota.remaining.toLocaleString()}{quota.limit ? ` / ${quota.limit.toLocaleString()}` : ""} {quota.unit} left
                            </span>
                            {quota.limit ? (
                              <span className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--fg-border)]">
                                <span
                                  className="block h-full rounded-full bg-[var(--fg-accent)]"
                                  style={{ width: `${Math.max(2, Math.min(100, (quota.remaining / quota.limit) * 100))}%` }}
                                />
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-[var(--fg-text-faint)]">{quota.error ?? "Quota not available for this key."}</span>
                        )}
                      </div>
                      {quota?.note ? <span className="pl-5 text-[10px] text-[var(--fg-text-faint)]">{quota.note}</span> : null}
                    </div>
                  ) : null}
                  {result ? (
                    <div
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-[11px] ${
                        result.ok
                          ? "border-[color-mix(in_srgb,var(--fg-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--fg-accent)_10%,transparent)] text-[var(--fg-accent)]"
                          : "border-[color-mix(in_srgb,var(--fg-red)_45%,transparent)] bg-[color-mix(in_srgb,var(--fg-red)_10%,transparent)] text-[var(--fg-red)]"
                      }`}
                    >
                      {result.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                      <span>
                        {result.ok
                          ? `Live call to ${providerLabel} succeeded just now.`
                          : `Live call to ${providerLabel} failed: ${result.error}`}
                      </span>
                      <span className="ml-auto text-[var(--fg-text-faint)]">{new Date(result.at).toLocaleTimeString()}</span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
