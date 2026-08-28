"use client";

import { useEffect, useState, useCallback } from "react";
import { Panel } from "../../../components/hud/Panel";
import { StatusPill } from "../../../components/hud/StatusPill";
import { Cable, KeyRound, Copy, RefreshCw, Unlink, Check } from "lucide-react";

interface Status {
  issued: boolean;
  issuedAt: string | null;
}

const SNIPPET = `// SERVER-SIDE ONLY — e.g. a Cloud Run / API route / server component.
// Never call this from client-side code: FRONTAGE_GROWTH_TOKEN would end up
// in the browser bundle, same rule Google AI Studio uses for Gemini keys.
const res = await fetch(
  \`https://<your-mission-control-host>/api/public/seo?url=\${encodeURIComponent(canonicalUrl)}\`,
  { headers: { Authorization: \`Bearer \${process.env.FRONTAGE_GROWTH_TOKEN}\` } }
);
const overrides = res.ok ? await res.json() : null;
// overrides: { title, metaDescription, h1 } — any field can be null
// (nothing approved yet for it). Merge over your own defaults, e.g.:
const title = overrides?.title ?? defaultTitle;
const metaDescription = overrides?.metaDescription ?? defaultMetaDescription;
const h1 = overrides?.h1 ?? defaultH1;`;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — nothing to fall back to here
    }
  }
  return (
    <button className="fg-btn w-fit" onClick={copy}>
      {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function GrowthAgentPanel({ clientId }: { clientId: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}/growth-agent`);
    if (res.ok) setStatus(await res.json());
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  async function generate() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/growth-agent`, { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not generate a token.");
      return;
    }
    setToken(data.token);
    load();
  }

  async function revoke() {
    setBusy(true);
    await fetch(`/api/clients/${clientId}/growth-agent`, { method: "DELETE" });
    setBusy(false);
    setToken(null);
    load();
  }

  return (
    <Panel
      title="Growth Agent (Live Site Integration)"
      icon={<Cable size={13} />}
      right={<StatusPill status={status?.issued ? "online" : "disabled"} label={status?.issued ? "token issued" : "not set up"} />}
    >
      {error ? <p className="mb-3 text-xs text-[var(--fg-red)]">{error}</p> : null}
      <p className="mb-3 text-[10.5px] text-[var(--fg-text-dim)]">
        For sites you build and host yourself — the site calls Mission Control directly to fetch its own currently-approved title/meta
        description/H1, using the token below. Nothing here pushes anything; the token only authenticates reads.
      </p>

      {token ? (
        <div className="mb-4 flex flex-col gap-2 rounded-lg border border-[color-mix(in_srgb,var(--fg-amber)_45%,transparent)] bg-[color-mix(in_srgb,var(--fg-amber)_8%,transparent)] p-3">
          <p className="text-[11px] text-[var(--fg-amber)]">This token is shown once — copy it now, it can&apos;t be retrieved again.</p>
          <code className="break-all rounded bg-[var(--fg-panel)] px-2 py-1 text-[10.5px] text-[var(--fg-text)]">{token}</code>
          <CopyButton text={token} />
        </div>
      ) : null}

      <div className="mb-4 flex items-center gap-2">
        {status?.issued ? (
          <>
            <span className="text-[10.5px] text-[var(--fg-text-faint)]">
              Issued {status.issuedAt ? new Date(status.issuedAt.replace(" ", "T") + "Z").toLocaleString() : ""}
            </span>
            <button className="fg-btn w-fit" onClick={generate} disabled={busy}>
              <RefreshCw size={12} /> Regenerate
            </button>
            <button className="fg-btn fg-btn--danger w-fit" onClick={revoke} disabled={busy}>
              <Unlink size={12} /> Revoke
            </button>
          </>
        ) : (
          <button className="fg-btn fg-btn--primary w-fit" onClick={generate} disabled={busy}>
            <KeyRound size={13} /> {busy ? "Generating…" : "Generate Token"}
          </button>
        )}
      </div>

      <details className="text-xs text-[var(--fg-text-dim)]">
        <summary className="cursor-pointer font-semibold text-[var(--fg-text)]">Integration snippet (paste into your site&apos;s code)</summary>
        <div className="mt-2 flex flex-col gap-2">
          <pre className="fg-scroll overflow-x-auto whitespace-pre rounded-lg border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] p-3 text-[10.5px] text-[var(--fg-text-dim)]">
            {SNIPPET}
          </pre>
          <CopyButton text={SNIPPET} />
          <p className="text-[10px] text-[var(--fg-text-faint)]">
            Set <code>FRONTAGE_GROWTH_TOKEN</code> as a server-side env var/secret (Google AI Studio supports this the same way it handles
            Gemini API keys) and call this from server-side code only — never a client component — wherever your app renders a page&apos;s
            title/meta/H1 for the request&apos;s canonical URL.
          </p>
        </div>
      </details>
    </Panel>
  );
}
