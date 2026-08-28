"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Panel } from "../../../components/hud/Panel";
import { StatusPill } from "../../../components/hud/StatusPill";
import { Link2, Unlink, RefreshCw, Search, ExternalLink, Copy, Check } from "lucide-react";

interface GscProperty {
  siteUrl: string;
  permissionLevel: string;
}
interface Connection {
  id: string;
  googleEmail: string | null;
}
interface Status {
  connected: boolean;
  connectionId: string | null;
  connectionEmail: string | null;
  property: string | null;
  snapshotCount: number;
  lastSyncedAt: string | null;
}

export function SearchConsolePanel({ clientId, siteId, siteUrl }: { clientId: string; siteId: string; siteUrl: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [status, setStatus] = useState<Status | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [properties, setProperties] = useState<GscProperty[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function copyUrl() {
    navigator.clipboard.writeText(siteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const loadStatus = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}/search-console`);
    if (res.ok) setStatus(await res.json());
  }, [clientId]);

  const loadConnections = useCallback(async () => {
    const res = await fetch("/api/google/connections");
    const data = await res.json();
    setConnections(data.connections ?? []);
  }, []);

  useEffect(() => { loadStatus(); loadConnections(); }, [loadStatus, loadConnections]);

  // Handle the redirect back from /api/auth/google/callback (only reaches
  // here if the operator clicked "Connect" from this panel via returnTo).
  useEffect(() => {
    const google = searchParams.get("google");
    if (!google) return;
    if (google === "error") setError(searchParams.get("message") ?? "Google connection failed.");
    else if (google === "connected") loadConnections();
    router.replace(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function loadProperties() {
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/search-console/properties`);
    const data = await res.json();
    if (res.ok) setProperties(data.properties ?? []);
    else setError(data.error);
  }

  async function assignConnection(connectionId: string) {
    await fetch(`/api/clients/${clientId}/search-console/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId }),
    });
    loadStatus();
    loadProperties();
  }

  async function selectProperty(propertyUrl: string) {
    await fetch(`/api/clients/${clientId}/search-console/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyUrl }),
    });
    setProperties(null);
    loadStatus();
  }

  async function sync() {
    setSyncing(true);
    setError(null);
    setSyncResult(null);
    const res = await fetch(`/api/clients/${clientId}/search-console/sync`, { method: "POST" });
    const data = await res.json();
    setSyncing(false);
    if (!res.ok) {
      setError(data.error ?? "Sync failed.");
      return;
    }
    setSyncResult(`Pulled ${data.rowsStored} real row(s) from Search Console.`);
    loadStatus();
  }

  async function disconnect() {
    await fetch(`/api/clients/${clientId}/search-console`, { method: "DELETE" });
    setProperties(null);
    loadStatus();
  }

  const returnTo = `/clients/${clientId}`;
  const hasConnection = !!status?.connectionId;

  return (
    <Panel
      title="Google Search Console"
      icon={<Search size={13} />}
      right={<StatusPill status={status?.connected ? "online" : "disabled"} label={status?.connected ? "connected" : "not connected"} />}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] px-3 py-2">
        <span className="text-[11px] text-[var(--fg-text-dim)]">
          Not verified in Search Console yet? Verification (meta tag or DNS TXT) always happens on Google's site, not
          here.
        </span>
        <div className="ml-auto flex gap-2">
          <button className="fg-btn" onClick={copyUrl}>
            {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy Site URL"}
          </button>
          <a className="fg-btn" href="https://search.google.com/search-console/welcome" target="_blank" rel="noreferrer">
            <ExternalLink size={12} /> Open Search Console
          </a>
        </div>
      </div>

      {error ? <p className="mb-3 text-xs text-[var(--fg-red)]">{error}</p> : null}
      {syncResult ? <p className="mb-3 text-xs text-[var(--fg-accent)]">{syncResult}</p> : null}

      {properties ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[var(--fg-text-dim)]">Pick the verified property for this site:</p>
          {properties.length === 0 ? (
            <p className="text-xs text-[var(--fg-red)]">No verified Search Console properties found on this Google account.</p>
          ) : (
            properties.map((p) => (
              <button key={p.siteUrl} className="fg-btn justify-start" onClick={() => selectProperty(p.siteUrl)}>
                {p.siteUrl} <span className="ml-auto text-[10px] text-[var(--fg-text-faint)]">{p.permissionLevel}</span>
              </button>
            ))
          )}
        </div>
      ) : status?.connected ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
            <div><div className="fg-field-label">Google Account</div><div className="text-[var(--fg-text)]">{status.connectionEmail ?? "—"}</div></div>
            <div><div className="fg-field-label">Property</div><div className="text-[var(--fg-text)]">{status.property}</div></div>
            <div><div className="fg-field-label">Rows Synced</div><div className="text-[var(--fg-text)]">{status.snapshotCount}</div></div>
            <div><div className="fg-field-label">Last Synced</div><div className="text-[var(--fg-text)]">{status.lastSyncedAt ? new Date(status.lastSyncedAt).toLocaleString() : "never"}</div></div>
          </div>
          <div className="flex gap-2">
            <button className="fg-btn fg-btn--primary" onClick={sync} disabled={syncing}>
              <RefreshCw size={13} className={syncing ? "animate-spin" : ""} /> {syncing ? "Syncing…" : "Sync Now"}
            </button>
            <button className="fg-btn fg-btn--danger" onClick={disconnect}>
              <Unlink size={13} /> Disconnect
            </button>
          </div>
        </div>
      ) : hasConnection ? (
        <div>
          <p className="mb-3 text-xs text-[var(--fg-text-dim)]">
            Google account connected ({status?.connectionEmail ?? "unknown"}) but no property selected yet for this
            site.
          </p>
          <button className="fg-btn fg-btn--primary" onClick={loadProperties}>
            <Search size={13} /> Choose Property
          </button>
        </div>
      ) : connections.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[var(--fg-text-dim)]">Use an already-connected Google account for this site:</p>
          {connections.map((c) => (
            <button key={c.id} className="fg-btn justify-start" onClick={() => assignConnection(c.id)}>
              {c.googleEmail ?? "(unnamed connection)"}
            </button>
          ))}
          <a className="fg-btn mt-1" href={`/api/auth/google/connect?returnTo=${encodeURIComponent(returnTo)}`}>
            <Link2 size={13} /> Connect a different Google account
          </a>
        </div>
      ) : (
        <div>
          <p className="mb-3 text-xs text-[var(--fg-text-dim)]">
            Free — connects your Google account once (reusable for every client afterward). The site must already be
            verified in Search Console under that account.
          </p>
          <a className="fg-btn fg-btn--primary" href={`/api/auth/google/connect?returnTo=${encodeURIComponent(returnTo)}`}>
            <Link2 size={13} /> Connect Search Console
          </a>
        </div>
      )}
    </Panel>
  );
}
