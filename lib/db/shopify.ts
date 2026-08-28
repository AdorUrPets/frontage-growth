import { getDb, newId } from "./client";
import { encryptKey, decryptKey } from "../crypto/vault";

export interface ShopifyConnectionStatus {
  connected: boolean;
  shopDomain: string | null;
  detectedPlatform: string | null;
  platform: string | null;
}

// Durable, human-declared platform (set only via the "Add Shopify" action) —
// deliberately separate from `cms` (a passive crawl-time guess) and from
// `shopify_shop_domain` (whether OAuth has been completed). This is what
// actually gates whether the Shopify connect UI/flow is shown at all.
export function setSitePlatform(siteId: string, platform: string | null): void {
  getDb().prepare(`UPDATE sites SET platform = ?, updated_at = datetime('now') WHERE id = ?`).run(platform, siteId);
}

export function saveShopifyConnection(siteId: string, shopDomain: string, accessToken: string): void {
  const enc = encryptKey(accessToken);
  getDb()
    .prepare(
      `UPDATE sites SET shopify_shop_domain = ?, shopify_access_token_ciphertext = ?, shopify_access_token_iv = ?, shopify_access_token_tag = ?, updated_at = datetime('now') WHERE id = ?`
    )
    .run(shopDomain, enc.ciphertext, enc.iv, enc.tag, siteId);
}

export function disconnectShopify(siteId: string): void {
  getDb()
    .prepare(
      `UPDATE sites SET shopify_shop_domain = NULL, shopify_access_token_ciphertext = NULL, shopify_access_token_iv = NULL, shopify_access_token_tag = NULL, updated_at = datetime('now') WHERE id = ?`
    )
    .run(siteId);
}

export function getShopifyStatus(siteId: string): ShopifyConnectionStatus {
  const row = getDb().prepare(`SELECT shopify_shop_domain, cms, platform FROM sites WHERE id = ?`).get(siteId) as
    | { shopify_shop_domain: string | null; cms: string | null; platform: string | null }
    | undefined;
  return {
    connected: !!row?.shopify_shop_domain,
    shopDomain: row?.shopify_shop_domain ?? null,
    detectedPlatform: row?.cms ?? null,
    platform: row?.platform ?? null,
  };
}

export function getShopifyCredentials(siteId: string): { shopDomain: string; accessToken: string } | null {
  const row = getDb()
    .prepare(`SELECT shopify_shop_domain, shopify_access_token_ciphertext, shopify_access_token_iv, shopify_access_token_tag FROM sites WHERE id = ?`)
    .get(siteId) as
    | { shopify_shop_domain: string | null; shopify_access_token_ciphertext: string | null; shopify_access_token_iv: string | null; shopify_access_token_tag: string | null }
    | undefined;
  if (!row?.shopify_shop_domain || !row.shopify_access_token_ciphertext || !row.shopify_access_token_iv || !row.shopify_access_token_tag) return null;
  const accessToken = decryptKey({ ciphertext: row.shopify_access_token_ciphertext, iv: row.shopify_access_token_iv, tag: row.shopify_access_token_tag });
  return { shopDomain: row.shopify_shop_domain, accessToken };
}

// --- transient OAuth handshake state ---

export function createPendingShopifyOAuth(siteId: string, shopDomain: string, clientId: string, clientSecret: string): string {
  const db = getDb();
  db.prepare(`DELETE FROM shopify_oauth_pending WHERE site_id = ?`).run(siteId); // one in-flight attempt per site
  db.prepare(`DELETE FROM shopify_oauth_pending WHERE created_at < datetime('now', '-15 minutes')`).run(); // sweep stale attempts

  const id = newId();
  const enc = encryptKey(clientSecret);
  db.prepare(
    `INSERT INTO shopify_oauth_pending (id, site_id, shop_domain, client_id, client_secret_ciphertext, client_secret_iv, client_secret_tag)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, siteId, shopDomain, clientId, enc.ciphertext, enc.iv, enc.tag);
  return id;
}

export interface PendingShopifyOAuth {
  siteId: string;
  shopDomain: string;
  clientId: string;
  clientSecret: string;
}

export function consumePendingShopifyOAuth(id: string): PendingShopifyOAuth | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM shopify_oauth_pending WHERE id = ?`).get(id) as
    | { site_id: string; shop_domain: string; client_id: string; client_secret_ciphertext: string; client_secret_iv: string; client_secret_tag: string }
    | undefined;
  if (!row) return null;
  db.prepare(`DELETE FROM shopify_oauth_pending WHERE id = ?`).run(id);
  return {
    siteId: row.site_id,
    shopDomain: row.shop_domain,
    clientId: row.client_id,
    clientSecret: decryptKey({ ciphertext: row.client_secret_ciphertext, iv: row.client_secret_iv, tag: row.client_secret_tag }),
  };
}
