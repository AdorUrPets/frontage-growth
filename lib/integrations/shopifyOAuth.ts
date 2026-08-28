import crypto from "crypto";

// Shopify's OAuth authorization code flow for custom apps. Unlike Google,
// each client's own Shopify store has its own Client ID/Secret (the app is
// created inside that store's admin), so there's no single app-wide
// credential to configure once — see lib/db/shopify.ts / the
// shopify_oauth_pending table for how the per-site secret is handled.

const SCOPES = "read_products,write_products,read_content,write_content";

export function getShopifyAuthUrl(shopDomain: string, clientId: string, redirectUri: string, state: string): string {
  const url = new URL(`https://${shopDomain}/admin/oauth/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

// Verifies the callback request genuinely came from Shopify, per their
// documented HMAC scheme — every query param except `hmac` itself,
// alphabetically sorted, HMAC-SHA256'd with the app's client secret.
export function verifyShopifyHmac(searchParams: URLSearchParams, clientSecret: string): boolean {
  const hmac = searchParams.get("hmac");
  if (!hmac) return false;

  const pairs: string[] = [];
  for (const [key, value] of searchParams.entries()) {
    if (key === "hmac" || key === "signature") continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const message = pairs.join("&");

  const computed = crypto.createHmac("sha256", clientSecret).update(message).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(hmac, "hex"));
  } catch {
    return false;
  }
}

interface TokenResponse {
  access_token: string;
  scope: string;
  errors?: unknown;
}

export async function exchangeShopifyCode(shopDomain: string, clientId: string, clientSecret: string, code: string): Promise<string> {
  const res = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    signal: AbortSignal.timeout(10000),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || !data.access_token) {
    throw new Error(typeof data.errors === "string" ? data.errors : `Shopify token exchange failed (HTTP ${res.status}).`);
  }
  return data.access_token;
}
