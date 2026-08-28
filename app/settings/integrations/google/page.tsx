"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Panel } from "../../../components/hud/Panel";
import { Link2, Trash2 } from "lucide-react";

interface Connection {
  id: string;
  label: string | null;
  googleEmail: string | null;
  createdAt: string;
}

export default function GoogleIntegrationPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const load = useCallback(async () => {
    const res = await fetch("/api/google/connections");
    const data = await res.json();
    setConnections(data.connections ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const google = searchParams.get("google");
    if (google === "error") setError(searchParams.get("message"));
    if (google === "connected") setConnected(true);
    if (google) router.replace(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function remove(id: string) {
    if (!window.confirm("Disconnect this Google account? Any client sites using it will lose Search Console access until you assign a different connection.")) return;
    await fetch(`/api/google/connections?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold text-[var(--fg-text)]">Google Integrations</h1>
        <p className="mt-1 text-xs text-[var(--fg-text-dim)]">
          Connect a Google account once here — every client's site (once verified in Search Console under that
          account) can then use it. No need to reconnect per client.
        </p>
      </div>

      {error ? <p className="text-xs text-[var(--fg-red)]">{error}</p> : null}
      {connected ? <p className="text-xs text-[var(--fg-accent)]">Google account connected.</p> : null}

      <Panel title="Connected Accounts" right={<a className="fg-btn fg-btn--primary" href="/api/auth/google/connect?returnTo=/settings/integrations/google"><Link2 size={13} /> Connect Google Account</a>}>
        {connections.length === 0 ? (
          <p className="text-xs text-[var(--fg-text-dim)]">No Google accounts connected yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {connections.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] px-4 py-3 text-xs">
                <div>
                  <div className="font-semibold text-[var(--fg-text)]">{c.googleEmail ?? "(email unavailable)"}</div>
                  <div className="text-[10px] text-[var(--fg-text-faint)]">connected {new Date(c.createdAt).toLocaleDateString()}</div>
                </div>
                <button className="fg-btn fg-btn--danger" onClick={() => remove(c.id)}>
                  <Trash2 size={13} /> Disconnect
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <p className="text-[10px] text-[var(--fg-text-faint)]">
        Go to a client's page → Google Search Console panel to assign one of these connections and pick its verified
        property.
      </p>
    </div>
  );
}
