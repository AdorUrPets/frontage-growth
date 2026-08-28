"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Panel } from "../../../components/hud/Panel";
import { StatusPill } from "../../../components/hud/StatusPill";
import { Link2, Unlink, ShoppingBag, ShieldQuestion } from "lucide-react";

interface Status {
  connected: boolean;
  shopDomain: string | null;
  detectedPlatform: string | null;
  platform: string | null;
}

const PLATFORM_LABEL: Record<string, string> = {
  shopify: "Shopify",
  wordpress: "WordPress",
  webflow: "Webflow",
  squarespace: "Squarespace",
  wix: "Wix",
};

export function ShopifyPanel({ clientId }: { clientId: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [status, setStatus] = useState<Status | null>(null);
  const [shopDomain, setShopDomain] = useState("");
  const [shopifyClientId, setShopifyClientId] = useState("");
  const [shopifyClientSecret, setShopifyClientSecret] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [declaring, setDeclaring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}/shopify`);
    if (res.ok) setStatus(await res.json());
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const shopify = searchParams.get("shopify");
    if (!shopify) return;
    if (shopify === "error") setError(searchParams.get("message") ?? "Shopify connection failed.");
    else if (shopify === "connected") setSuccess("Shopify connected.");
    load();
    router.replace(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setConnecting(true);
    setError(null);
    setSuccess(null);
    const res = await fetch(`/api/clients/${clientId}/shopify/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopDomain, clientId: shopifyClientId, clientSecret: shopifyClientSecret }),
    });
    const data = await res.json();
    if (!res.ok) {
      setConnecting(false);
      setError(data.error ?? "Could not start the connection.");
      return;
    }
    window.location.href = data.authorizeUrl; // real Shopify OAuth consent screen
  }

  async function disconnect() {
    await fetch(`/api/clients/${clientId}/shopify`, { method: "DELETE" });
    load();
  }

  async function declareShopify() {
    setDeclaring(true);
    setError(null);
    await fetch(`/api/clients/${clientId}/shopify/declare`, { method: "POST" });
    setDeclaring(false);
    load();
  }

  async function undeclareShopify() {
    await fetch(`/api/clients/${clientId}/shopify/declare`, { method: "DELETE" });
    load();
  }

  return (
    <Panel
      title="Shopify (Push to Site)"
      icon={<ShoppingBag size={13} />}
      right={<StatusPill status={status?.connected ? "online" : "disabled"} label={status?.connected ? "connected" : "not connected"} />}
    >
      {error ? <p className="mb-3 text-xs text-[var(--fg-red)]">{error}</p> : null}
      {success ? <p className="mb-3 text-xs text-[var(--fg-accent)]">{success}</p> : null}

      {status?.connected ? (
        <div className="flex flex-col gap-3">
          <div className="text-xs">
            <div className="fg-field-label">Shop</div>
            <div className="text-[var(--fg-text)]">{status.shopDomain}</div>
          </div>
          <button className="fg-btn fg-btn--danger w-fit" onClick={disconnect}>
            <Unlink size={13} /> Disconnect
          </button>
          <p className="text-[10px] text-[var(--fg-text-faint)]">
            Approved title/meta description changes can now be pushed live from the On-Page SEO Proposals panel above.
          </p>
        </div>
      ) : status?.platform !== "shopify" ? (
        <div className="flex flex-col gap-4">
          {status?.detectedPlatform === "shopify" ? (
            <p className="rounded-lg border border-[color-mix(in_srgb,var(--fg-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--fg-accent)_8%,transparent)] px-3 py-2 text-[11px] text-[var(--fg-text)]">
              Site recon detected Shopify signals on this site — click <strong>Add Shopify</strong> below to confirm and set up the connection.
            </p>
          ) : status?.detectedPlatform ? (
            <p className="rounded-lg border border-[color-mix(in_srgb,var(--fg-amber)_45%,transparent)] bg-[color-mix(in_srgb,var(--fg-amber)_8%,transparent)] px-3 py-2 text-[11px] text-[var(--fg-amber)]">
              Site recon detected this site is running on <strong>{PLATFORM_LABEL[status.detectedPlatform] ?? status.detectedPlatform}</strong>, not Shopify.
              Only click Add Shopify if this is actually (or is backed by) a Shopify store — e.g. headless/proxied.
            </p>
          ) : (
            <p className="text-[10.5px] text-[var(--fg-text-faint)]">
              Site recon hasn&apos;t detected Shopify signals on this site — only add Shopify if this really is (or is backed by) a Shopify store.
            </p>
          )}
          <button className="fg-btn fg-btn--primary w-fit" onClick={declareShopify} disabled={declaring}>
            <ShoppingBag size={13} /> {declaring ? "Adding…" : "Add Shopify"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <details className="text-xs text-[var(--fg-text-dim)]" open>
            <summary className="cursor-pointer font-semibold text-[var(--fg-text)]">Set up this store&apos;s custom app (one-time)</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>Shopify admin → <strong>Settings → Apps and sales channels → Develop apps</strong> → create an app (or use one you already made)</li>
              <li>Open the app → <strong>Configure Admin API scopes</strong> → enable: <code>read_products</code>, <code>write_products</code>, <code>read_content</code>, <code>write_content</code></li>
              <li>Under <strong>Credentials</strong>, add this app&apos;s allowed redirect URL: <code className="break-all">http://localhost:3920/api/shopify/oauth/callback</code></li>
              <li>Copy the <strong>Client ID</strong> and <strong>Client Secret</strong> shown there — <em>not</em> the App automation token, that's for a different purpose (deploying app code, not Admin API data access)</li>
              <li>Your shop domain is the <code>.myshopify.com</code> address in Settings → Domains</li>
            </ol>
          </details>
          <form onSubmit={connect} className="flex flex-col gap-3">
            <div>
              <label className="fg-field-label">Shop Domain</label>
              <input className="fg-input" placeholder="your-store.myshopify.com" value={shopDomain} onChange={(e) => setShopDomain(e.target.value)} required />
            </div>
            <div>
              <label className="fg-field-label">Client ID</label>
              <input className="fg-input" value={shopifyClientId} onChange={(e) => setShopifyClientId(e.target.value)} required />
            </div>
            <div>
              <label className="fg-field-label">Client Secret</label>
              <input className="fg-input" type="password" placeholder="shpss_..." value={shopifyClientSecret} onChange={(e) => setShopifyClientSecret(e.target.value)} required />
            </div>
            <button type="submit" className="fg-btn fg-btn--primary w-fit" disabled={connecting}>
              <Link2 size={13} /> {connecting ? "Redirecting to Shopify…" : "Connect Shopify"}
            </button>
          </form>
          <button className="flex w-fit items-center gap-1 text-[10.5px] text-[var(--fg-text-faint)] hover:text-[var(--fg-text-dim)]" onClick={undeclareShopify}>
            <ShieldQuestion size={11} /> Not actually Shopify — undo
          </button>
        </div>
      )}
    </Panel>
  );
}
