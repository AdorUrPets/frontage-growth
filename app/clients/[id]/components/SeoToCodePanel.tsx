"use client";

import { useEffect, useState, useCallback } from "react";
import { Panel } from "../../../components/hud/Panel";
import { StatusPill } from "../../../components/hud/StatusPill";
import { GitCommit, Loader2, Save } from "lucide-react";

interface StatusResp {
  repoLocalPath: string | null;
  cms: string | null;
  supported: boolean;
  pendingCount: number;
  lastDeployment: { id: string; summary: string | null; created_at: string } | null;
}

interface ApplyResult {
  ok: boolean;
  error?: string;
  applied: { id: string; pageUrl: string; field: string; file: string }[];
  skipped: { id: string; pageUrl: string; field: string; reason: string }[];
  commitSha?: string;
}

export function SeoToCodePanel({ clientId }: { clientId: string }) {
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [pathInput, setPathInput] = useState("");
  const [savingPath, setSavingPath] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}/seo-to-code`);
    if (res.ok) {
      const data = await res.json();
      setStatus(data);
      setPathInput(data.repoLocalPath ?? "");
    }
  }, [clientId]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  async function savePath() {
    setSavingPath(true);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoLocalPath: pathInput.trim() || null }),
    });
    setSavingPath(false);
    if (!res.ok) {
      setError("Could not save the repo path.");
      return;
    }
    loadStatus();
  }

  async function apply() {
    setApplying(true);
    setError(null);
    setResult(null);
    const res = await fetch(`/api/clients/${clientId}/seo-to-code`, { method: "POST" });
    const data = (await res.json()) as ApplyResult;
    setApplying(false);
    if (!res.ok || !data.ok) {
      setError(data.error ?? "Apply failed.");
      setResult(data);
      return;
    }
    setResult(data);
    loadStatus();
  }

  const hasPath = !!status?.repoLocalPath;

  return (
    <Panel
      title="SEO → Code (local commit only)"
      icon={<GitCommit size={13} />}
      right={
        status ? (
          <StatusPill
            status={hasPath && status.supported ? "online" : "disabled"}
            label={!hasPath ? "no repo path" : !status.supported ? `unsupported (${status.cms})` : "static HTML"}
          />
        ) : null
      }
    >
      <p className="mb-3 text-xs text-[var(--fg-text-dim)]">
        Applies approved SEO changes (title / meta description / h1) to the real files in this site&apos;s local
        checkout and commits locally — v1 supports static HTML only. Never pushes; pushing is a single,
        human-authorized action in Pentest Mission Control once both apps are ready.
      </p>

      <div className="mb-4 flex items-center gap-2">
        <input
          className="fg-input flex-1 text-xs"
          placeholder="Local checkout path, e.g. E:\clients\acme-site"
          value={pathInput}
          onChange={(e) => setPathInput(e.target.value)}
        />
        <button className="fg-btn" onClick={savePath} disabled={savingPath}>
          {savingPath ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
        </button>
      </div>

      {error ? <p className="mb-3 text-xs text-[var(--fg-red)]">{error}</p> : null}

      {status ? (
        <div className="mb-3 grid grid-cols-2 gap-4 text-xs sm:grid-cols-3">
          <div><div className="fg-field-label">Approved &amp; Unapplied</div><div className="text-[var(--fg-text)]">{status.pendingCount}</div></div>
          <div><div className="fg-field-label">CMS</div><div className="text-[var(--fg-text)]">{status.cms ?? "(static html)"}</div></div>
          <div><div className="fg-field-label">Last Local Commit</div><div className="text-[var(--fg-text)]">{status.lastDeployment ? new Date(status.lastDeployment.created_at).toLocaleString() : "never"}</div></div>
        </div>
      ) : null}

      <button
        className="fg-btn fg-btn--primary"
        onClick={apply}
        disabled={applying || !hasPath || !status?.supported || (status?.pendingCount ?? 0) === 0}
      >
        {applying ? <Loader2 size={13} className="animate-spin" /> : <GitCommit size={13} />}
        {applying ? "Applying…" : `Apply & Commit Locally (${status?.pendingCount ?? 0})`}
      </button>

      {result ? (
        <div className="mt-3 flex flex-col gap-1 text-[11px]">
          {result.commitSha ? <p className="text-[var(--fg-accent)]">Committed locally: {result.commitSha.slice(0, 8)}</p> : null}
          {result.applied.map((a) => (
            <p key={a.id} className="text-[var(--fg-text-dim)]">✓ {a.field} — {a.pageUrl} ({a.file})</p>
          ))}
          {result.skipped.map((s) => (
            <p key={s.id} className="text-[var(--fg-text-faint)]">skipped: {s.field} — {s.pageUrl}: {s.reason}</p>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}
