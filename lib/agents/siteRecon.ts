import * as cheerio from "cheerio";
import { getDb, newId } from "../db/client";
import type { SiteRow } from "../types";

// Static-HTML crawl (fetch + cheerio, no browser) — fast and dependency-light,
// trades off not seeing JS-rendered content. Good enough for the marketing
// sites Frontage builds; a Playwright-based pass (matching lead-finder's
// app/lib/inspect.ts) can be added later for JS-heavy sites without changing
// this agent's output shape.
//
// MAX_PAGES exists purely as a runaway-crawl safety valve, not a "sample a
// few pages" cap — it was previously set to 15, which silently dropped the
// vast majority of any real e-commerce catalog (a 100+ product Shopify
// store never got past its first page of the sitemap). Set high enough that
// no realistic client site actually hits it.

const USER_AGENT = "Mozilla/5.0 (compatible; FrontageGrowthBot/1.0; +https://frontage.co.nz)";
const FETCH_TIMEOUT_MS = 8000;
const MAX_PAGES = 2000;
const BATCH_SIZE = 6;

interface FetchResult {
  ok: boolean;
  html?: string;
  status?: number;
  error?: string;
  headers?: Headers;
}

async function fetchHtml(url: string): Promise<FetchResult> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}`, headers: res.headers };
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return { ok: false, status: res.status, error: `Not HTML (${contentType || "unknown content-type"})`, headers: res.headers };
    const html = await res.text();
    return { ok: true, html, status: res.status, headers: res.headers };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Fetch failed." };
  }
}

// Real platform fingerprinting from the homepage response we already fetched
// — no extra requests. Stored as `sites.cms` so later work (technical
// findings, manual fixes) knows what stack a client's site actually runs on.
function detectPlatform(html: string, headers: Headers | undefined): string | null {
  if (headers?.has("x-shopid") || headers?.has("x-shopify-stage") || headers?.has("x-sorting-hat-shopid")) return "shopify";
  if (/cdn\.shopify(cdn)?\.(com|net)/i.test(html) || /Shopify\.(shop|theme)\b/.test(html) || /shopify-features/i.test(html)) return "shopify";
  if (/wp-content|wp-includes/i.test(html)) return "wordpress";
  if (/website-files\.com|data-wf-(site|page)=/i.test(html)) return "webflow";
  if (/static1\.squarespace\.com|squarespace-cdn\.com/i.test(html)) return "squarespace";
  if (/wixstatic\.com|wix\.com\/api/i.test(html)) return "wix";
  return null;
}

// Sitemaps are served as application/xml (sometimes text/xml), never
// text/html — fetchHtml's content-type gate exists to skip PDFs/images
// found via <a> tags, but it was also silently discarding every real
// sitemap fetch. Separate, ungated fetch for sitemap URLs specifically.
async function fetchXml(url: string): Promise<FetchResult> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    const text = await res.text();
    return { ok: true, html: text, status: res.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Fetch failed." };
  }
}

function guessPageType(url: string): string {
  const path = new URL(url).pathname.toLowerCase();
  if (path === "/" || path === "") return "home";
  if (/contact/.test(path)) return "contact";
  if (/about/.test(path)) return "about";
  if (/(blog|news|article|insights)/.test(path)) return "blog";
  if (/(product|shop)/.test(path)) return "product";
  if (/collections?/.test(path)) return "collection";
  if (/services?/.test(path)) return "service";
  if (/(privacy|terms|legal|cookie)/.test(path)) return "legal";
  return "other";
}

// Real price straight from the page's own JSON-LD Product structured data —
// the same data Google itself reads for rich results. Never invented: if a
// page has no Product JSON-LD, price stays null rather than being guessed.
// Shopify emits two shapes: a plain "Product" for single-variant items, or
// a "ProductGroup" wrapping a hasVariant[] array (each a real "Product"
// with its own offers.price) for anything with size/color options — the
// first variant's real price is used as the representative one.
function extractPrice($: cheerio.CheerioAPI): { price: number | null; currency: string | null } {
  let price: number | null = null;
  let currency: string | null = null;

  function takeOffer(offers: unknown): boolean {
    const offer = Array.isArray(offers) ? offers[0] : offers;
    const rawPrice = (offer as { price?: unknown } | undefined)?.price;
    if (rawPrice == null) return false;
    const n = Number(rawPrice);
    if (Number.isNaN(n)) return false;
    price = n;
    const c = (offer as { priceCurrency?: unknown }).priceCurrency;
    currency = typeof c === "string" ? c : null;
    return true;
  }

  $('script[type="application/ld+json"]').each((_, el) => {
    if (price !== null) return;
    try {
      const parsed = JSON.parse($(el).contents().text());
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of candidates) {
        if (price !== null) break;
        const type = node["@type"];
        const isProduct = type === "Product" || (Array.isArray(type) && type.includes("Product"));
        const isProductGroup = type === "ProductGroup";
        if (isProduct) {
          takeOffer(node.offers);
        } else if (isProductGroup && Array.isArray(node.hasVariant) && node.hasVariant.length > 0) {
          takeOffer(node.hasVariant[0]?.offers);
        }
      }
    } catch {
      // not valid JSON-LD — skip
    }
  });

  return { price, currency };
}

async function discoverUrls(baseUrl: string, homepageHtml: string): Promise<string[]> {
  const origin = new URL(baseUrl).origin;
  const urls = new Set<string>([baseUrl]);

  // Sitemap index support: Shopify (and most e-commerce platforms) serve a
  // top-level sitemap.xml that's itself an index of per-type sub-sitemaps
  // (products_1.xml, collections_1.xml, pages_1.xml, ...) rather than
  // listing every URL directly — both forms are handled here.
  async function ingestSitemap(url: string, depth: number): Promise<void> {
    if (depth > 2) return; // sitemap indexes are never more than 1-2 levels deep in practice
    const res = await fetchXml(url);
    if (!res.ok || !res.html) return;

    if (res.html.includes("<sitemapindex")) {
      const subSitemaps = [...res.html.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
      for (const sub of subSitemaps) await ingestSitemap(sub, depth + 1);
      return;
    }

    if (res.html.includes("<urlset")) {
      for (const m of res.html.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
        try {
          const u = new URL(m[1]);
          if (u.origin === origin) urls.add(u.toString());
        } catch {
          // skip malformed sitemap entry
        }
      }
    }
  }

  await ingestSitemap(`${origin}/sitemap.xml`, 0);

  const $ = cheerio.load(homepageHtml);
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const u = new URL(href, baseUrl);
      if (u.origin === origin && !/\.(pdf|jpe?g|png|gif|svg|zip|docx?|xlsx?|webp)$/i.test(u.pathname)) {
        u.hash = "";
        urls.add(u.toString());
      }
    } catch {
      // skip malformed href
    }
  });

  return [...urls].slice(0, MAX_PAGES);
}

export interface CrawledPage {
  url: string;
  statusCode: number | null;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  canonical: string | null;
  pageType: string;
  price: number | null;
  priceCurrency: string | null;
  error?: string;
}

export interface SiteReconResult {
  ok: boolean;
  crawlId: string;
  pagesDiscovered: number;
  pages: CrawledPage[];
  detectedPlatform?: string | null;
  error?: string;
}

export async function runSiteRecon(site: SiteRow): Promise<SiteReconResult> {
  const db = getDb();
  const crawlId = newId();
  db.prepare(`INSERT INTO crawls (id, site_id, status, started_at) VALUES (?, ?, 'running', datetime('now'))`).run(crawlId, site.id);

  const home = await fetchHtml(site.url);
  if (!home.ok || !home.html) {
    const error = `Could not reach ${site.url}: ${home.error}`;
    db.prepare(`UPDATE crawls SET status = 'failed', error = ?, completed_at = datetime('now') WHERE id = ?`).run(error, crawlId);
    return { ok: false, crawlId, pagesDiscovered: 0, pages: [], error };
  }

  const detectedPlatform = detectPlatform(home.html, home.headers);
  db.prepare(`UPDATE sites SET cms = ?, updated_at = datetime('now') WHERE id = ?`).run(detectedPlatform, site.id);

  const urls = await discoverUrls(site.url, home.html);
  const pages: CrawledPage[] = [];

  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (url): Promise<CrawledPage> => {
        const res = url === site.url ? home : await fetchHtml(url);
        if (!res.ok || !res.html) {
          return {
            url,
            statusCode: res.status ?? null,
            title: null,
            metaDescription: null,
            h1: null,
            canonical: null,
            pageType: guessPageType(url),
            price: null,
            priceCurrency: null,
            error: res.error,
          };
        }
        const $ = cheerio.load(res.html);
        const { price, currency } = extractPrice($);
        return {
          url,
          statusCode: res.status ?? 200,
          title: $("title").first().text().trim() || null,
          metaDescription: $('meta[name="description"]').attr("content")?.trim() || null,
          h1: $("h1").first().text().trim() || null,
          canonical: $('link[rel="canonical"]').attr("href") || null,
          pageType: guessPageType(url),
          price,
          priceCurrency: currency,
        };
      })
    );
    pages.push(...batchResults);
  }

  const insertCrawlPage = db.prepare(
    `INSERT INTO crawl_pages (id, crawl_id, url, status_code, page_type, title, meta_description, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const upsertPage = db.prepare(
    `INSERT INTO pages (id, site_id, url, page_type, title, meta_description, h1, canonical_url, indexable, price, price_currency)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT(site_id, url) DO UPDATE SET
       page_type = excluded.page_type, title = excluded.title, meta_description = excluded.meta_description,
       h1 = excluded.h1, canonical_url = excluded.canonical_url, price = excluded.price, price_currency = excluded.price_currency,
       updated_at = datetime('now')`
  );

  for (const p of pages) {
    insertCrawlPage.run(newId(), crawlId, p.url, p.statusCode, p.pageType, p.title, p.metaDescription, JSON.stringify(p));
    if (p.statusCode && p.statusCode < 400) {
      upsertPage.run(newId(), site.id, p.url, p.pageType, p.title, p.metaDescription, p.h1, p.canonical, p.price, p.priceCurrency);
    }
  }

  db.prepare(`UPDATE crawls SET status = 'complete', pages_discovered = ?, completed_at = datetime('now') WHERE id = ?`).run(pages.length, crawlId);

  return { ok: true, crawlId, pagesDiscovered: pages.length, pages, detectedPlatform };
}
