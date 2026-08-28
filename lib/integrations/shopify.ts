// Shopify Admin GraphQL API. Writes go through metafieldsSet on the
// well-established `global.title_tag` / `global.description_tag` metafields
// — the same fields Shopify's own admin "Search engine listing preview" UI
// reads/writes, and the one mechanism that's consistent across Product,
// Collection, Page and Shop (unlike the newer typed `seo` input field,
// which isn't available on every resource's update mutation).

const API_VERSION = "2024-10";

function endpoint(shopDomain: string): string {
  return `https://${shopDomain}/admin/api/${API_VERSION}/graphql.json`;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

async function shopifyGraphQL<T>(shopDomain: string, accessToken: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(endpoint(shopDomain), {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15000),
  });
  const json = (await res.json()) as GraphQLResponse<T>;
  if (!res.ok) throw new Error(`Shopify API request failed (HTTP ${res.status}).`);
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
  if (!json.data) throw new Error("Shopify API returned no data.");
  return json.data;
}

export async function testShopifyConnection(shopDomain: string, accessToken: string): Promise<{ ok: boolean; shopName?: string; error?: string }> {
  try {
    const data = await shopifyGraphQL<{ shop: { name: string } }>(shopDomain, accessToken, `query { shop { name } }`);
    return { ok: true, shopName: data.shop.name };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Connection test failed." };
  }
}

export type ShopifyResourceType = "product" | "collection" | "page" | "shop" | "unsupported";

export interface ResolvedResource {
  type: ShopifyResourceType;
  gid: string | null;
  reason?: string; // set when type is "unsupported" or resolution failed
}

// Maps a crawled page URL to a real Shopify resource GID by parsing the
// path and querying Shopify for that handle — nothing is guessed or
// invented; if the handle doesn't resolve, that's reported back honestly.
export async function resolveShopifyResource(shopDomain: string, accessToken: string, pageUrl: string): Promise<ResolvedResource> {
  let path: string;
  try {
    path = new URL(pageUrl).pathname.replace(/\/+$/, "");
  } catch {
    return { type: "unsupported", gid: null, reason: "Invalid URL." };
  }

  if (path === "" || path === "/") {
    const data = await shopifyGraphQL<{ shop: { id: string } }>(shopDomain, accessToken, `query { shop { id } }`);
    return { type: "shop", gid: data.shop.id };
  }

  const productMatch = path.match(/^\/products\/([^/]+)$/);
  if (productMatch) {
    const data = await shopifyGraphQL<{ productByHandle: { id: string } | null }>(
      shopDomain,
      accessToken,
      `query($handle: String!) { productByHandle(handle: $handle) { id } }`,
      { handle: productMatch[1] }
    );
    return data.productByHandle
      ? { type: "product", gid: data.productByHandle.id }
      : { type: "unsupported", gid: null, reason: `No product found with handle "${productMatch[1]}".` };
  }

  const collectionMatch = path.match(/^\/collections\/([^/]+)$/);
  if (collectionMatch) {
    const data = await shopifyGraphQL<{ collectionByHandle: { id: string } | null }>(
      shopDomain,
      accessToken,
      `query($handle: String!) { collectionByHandle(handle: $handle) { id } }`,
      { handle: collectionMatch[1] }
    );
    return data.collectionByHandle
      ? { type: "collection", gid: data.collectionByHandle.id }
      : { type: "unsupported", gid: null, reason: `No collection found with handle "${collectionMatch[1]}".` };
  }

  const pageMatch = path.match(/^\/pages\/([^/]+)$/);
  if (pageMatch) {
    const data = await shopifyGraphQL<{ pages: { edges: { node: { id: string; handle: string } }[] } }>(
      shopDomain,
      accessToken,
      `query($q: String!) { pages(first: 1, query: $q) { edges { node { id handle } } } }`,
      { q: `handle:${pageMatch[1]}` }
    );
    const node = data.pages.edges[0]?.node;
    return node
      ? { type: "page", gid: node.id }
      : { type: "unsupported", gid: null, reason: `No page found with handle "${pageMatch[1]}".` };
  }

  return { type: "unsupported", gid: null, reason: `Page type not supported for publishing yet (blog articles, custom templates, etc.) — apply this one manually in Shopify admin.` };
}

export interface PublishSeoResult {
  ok: boolean;
  error?: string;
}

// Sets title_tag / description_tag metafields on a resolved resource.
// Either field can be omitted to leave it unchanged.
export async function pushSeoMetafields(
  shopDomain: string,
  accessToken: string,
  resourceGid: string,
  fields: { title?: string; description?: string }
): Promise<PublishSeoResult> {
  const metafields: Record<string, unknown>[] = [];
  if (fields.title !== undefined) {
    metafields.push({ ownerId: resourceGid, namespace: "global", key: "title_tag", type: "single_line_text_field", value: fields.title });
  }
  if (fields.description !== undefined) {
    metafields.push({ ownerId: resourceGid, namespace: "global", key: "description_tag", type: "multi_line_text_field", value: fields.description });
  }
  if (metafields.length === 0) return { ok: true };

  try {
    const data = await shopifyGraphQL<{ metafieldsSet: { userErrors: { field: string[]; message: string }[] } }>(
      shopDomain,
      accessToken,
      `mutation SetSeo($metafields: [MetafieldsSetInput!]!) {
         metafieldsSet(metafields: $metafields) {
           metafields { id key value }
           userErrors { field message }
         }
       }`,
      { metafields }
    );
    const errors = data.metafieldsSet.userErrors;
    if (errors.length > 0) return { ok: false, error: errors.map((e) => e.message).join("; ") };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Shopify push failed." };
  }
}
