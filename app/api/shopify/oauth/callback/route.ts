import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { consumePendingShopifyOAuth, saveShopifyConnection } from "@/lib/db/shopify";
import { verifyShopifyHmac, exchangeShopifyCode } from "@/lib/integrations/shopifyOAuth";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const shop = searchParams.get("shop");

  const fail = (message: string, clientId?: string) =>
    NextResponse.redirect(`${origin}${clientId ? `/clients/${clientId}` : "/clients"}?shopify=error&message=${encodeURIComponent(message)}`);

  if (!state) return fail("Missing state — start the connection again from the client page.");

  const pending = consumePendingShopifyOAuth(state);
  if (!pending) return fail("This connection attempt expired or was already used — start again from the client page.");

  const site = getDb().prepare(`SELECT client_id FROM sites WHERE id = ?`).get(pending.siteId) as { client_id: string } | undefined;
  const clientId = site?.client_id;

  if (!code) return fail("Missing authorization code.", clientId);
  if (shop && shop !== pending.shopDomain) return fail("Shop domain mismatch — start again from the correct client.", clientId);
  if (!verifyShopifyHmac(searchParams, pending.clientSecret)) return fail("Could not verify this request came from Shopify (HMAC check failed).", clientId);

  try {
    const accessToken = await exchangeShopifyCode(pending.shopDomain, pending.clientId, pending.clientSecret, code);
    saveShopifyConnection(pending.siteId, pending.shopDomain, accessToken);
    return NextResponse.redirect(`${origin}/clients/${clientId}?shopify=connected`);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Token exchange failed.", clientId);
  }
}
