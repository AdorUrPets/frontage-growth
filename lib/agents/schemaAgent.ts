import { getDb, newId } from "../db/client";
import { listSitePages } from "../db/crawls";
import { getLatestBusinessProfile } from "./businessUnderstanding";
import type { ClientRow, SiteRow } from "../types";

export interface SchemaAgentResult {
  ok: boolean;
  proposalsCreated: number;
  error?: string;
}

// Deterministic — no AI call, no invented facts. Only emits fields we
// actually have real data for (§24/§64: never fabricate ratings, reviews,
// prices, or address/phone we were never given).
export async function runSchemaAgent(client: ClientRow, site: SiteRow): Promise<SchemaAgentResult> {
  const profile = getLatestBusinessProfile(client.id);
  if (!profile) {
    return { ok: false, proposalsCreated: 0, error: "No business profile yet — run Business Understanding first." };
  }

  const pages = listSitePages(site.id);
  const homepage = pages.find((p) => p.page_type === "home") ?? pages[0];
  if (!homepage) {
    return { ok: false, proposalsCreated: 0, error: "No crawled pages found — run Site Recon first." };
  }

  const db = getDb();
  const insert = db.prepare(`INSERT INTO schema_findings (id, page_id, schema_type, proposed_json) VALUES (?, ?, ?, ?)`);
  db.prepare(`DELETE FROM schema_findings WHERE page_id IN (SELECT id FROM pages WHERE site_id = ?) AND status = 'proposed'`).run(site.id);

  let count = 0;

  const organization: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": profile.serviceArea ? "LocalBusiness" : "Organization",
    name: client.business_name || client.name,
    url: site.url,
  };
  if (profile.summary) organization.description = profile.summary;
  if (profile.serviceArea) organization.areaServed = profile.serviceArea;
  if (profile.industry) organization.knowsAbout = profile.industry;
  insert.run(newId(), homepage.id, profile.serviceArea ? "LocalBusiness" : "Organization", JSON.stringify(organization));
  count++;

  insert.run(
    newId(),
    homepage.id,
    "WebSite",
    JSON.stringify({ "@context": "https://schema.org", "@type": "WebSite", name: client.business_name || client.name, url: site.url })
  );
  count++;

  const servicePages = pages.filter((p) => p.page_type === "service");
  for (const page of servicePages) {
    if (!page.title) continue;
    const service: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Service",
      name: page.title,
      provider: { "@type": "Organization", name: client.business_name || client.name },
    };
    if (profile.serviceArea) service.areaServed = profile.serviceArea;
    if (page.meta_description) service.description = page.meta_description;
    insert.run(newId(), page.id, "Service", JSON.stringify(service));
    count++;
  }

  // Product schema — only the fields we actually extracted from the page's
  // own JSON-LD during Site Recon (real price, when present). Never
  // fabricates rating/review data, which is the #1 way naive "SEO tools"
  // get caught emitting fake structured data.
  const productPages = pages.filter((p) => p.page_type === "product");
  for (const page of productPages) {
    if (!page.title) continue;
    const product: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: page.title,
    };
    if (page.meta_description) product.description = page.meta_description;
    if (page.price != null) {
      product.offers = {
        "@type": "Offer",
        price: page.price,
        priceCurrency: page.price_currency ?? "NZD",
        url: page.url,
      };
    }
    insert.run(newId(), page.id, "Product", JSON.stringify(product));
    count++;
  }

  return { ok: true, proposalsCreated: count };
}
