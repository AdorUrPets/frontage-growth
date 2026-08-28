import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { createPendingShopifyOAuth } from "@/lib/db/shopify";
import { getShopifyAuthUrl } from "@/lib/integrations/shopifyOAuth";

function redirectUri(): string {
  return process.env.SHOPIFY_OAUTH_REDIRECT_URI || "http://localhost:3920/api/shopify/oauth/callback";
}

// Starts the OAuth handshake — unlike Google, each client's Shopify store
// has its own Client ID/Secret (the app lives inside that store), so this
// takes all three every time rather than reusing one app-wide credential.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = getDb().prepare(`SELECT id FROM sites WHERE client_id = ? ORDER BY created_at ASC LIMIT 1`).get(id) as
    | { id: string }
    | undefined;
  if (!site) return NextResponse.json({ error: "Client has no site." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const shopDomain = typeof body.shopDomain === "string" ? body.shopDomain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "") : "";
  const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
  const clientSecret = typeof body.clientSecret === "string" ? body.clientSecret.trim() : "";

  if (!shopDomain || !clientId || !clientSecret) {
    return NextResponse.json({ error: "shopDomain, clientId and clientSecret are all required." }, { status: 400 });
  }
  if (!shopDomain.endsWith(".myshopify.com")) {
    return NextResponse.json({ error: 'shopDomain should look like "your-store.myshopify.com".' }, { status: 400 });
  }

  const state = createPendingShopifyOAuth(site.id, shopDomain, clientId, clientSecret);
  const authorizeUrl = getShopifyAuthUrl(shopDomain, clientId, redirectUri(), state);
  return NextResponse.json({ authorizeUrl });
}
