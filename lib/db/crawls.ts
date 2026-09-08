import { getDb } from "./client";
import type { CrawledPage } from "../agents/siteRecon";

interface CrawlRow {
  id: string;
  site_id: string;
  status: string;
  pages_discovered: number;
  error: string | null;
}

interface CrawlPageRow {
  raw_json: string;
}

export interface PageRow {
  id: string;
  site_id: string;
  url: string;
  page_type: string | null;
  title: string | null;
  meta_description: string | null;
  h1: string | null;
  canonical_url: string | null;
  price: number | null;
  price_currency: string | null;
  images_total: number | null;
  images_missing_alt: number | null;
  viewport_content: string | null;
  has_lorem_ipsum: number | null;
}

export function getLatestCrawl(siteId: string): CrawlRow | null {
  const row = getDb()
    .prepare(`SELECT * FROM crawls WHERE site_id = ? ORDER BY created_at DESC LIMIT 1`)
    .get(siteId) as CrawlRow | undefined;
  return row ?? null;
}

// Reconstructs the CrawledPage[] shape from the most recent completed crawl
// so downstream agents (Business Understanding, On-Page SEO, Schema) can
// read real crawl data straight from the DB instead of needing it threaded
// through in memory from Site Recon's return value.
export function getLatestCrawlPages(siteId: string): CrawledPage[] {
  const db = getDb();
  const crawl = db
    .prepare(`SELECT id FROM crawls WHERE site_id = ? AND status = 'complete' ORDER BY created_at DESC LIMIT 1`)
    .get(siteId) as { id: string } | undefined;
  if (!crawl) return [];
  const rows = db.prepare(`SELECT raw_json FROM crawl_pages WHERE crawl_id = ?`).all(crawl.id) as CrawlPageRow[];
  return rows.map((r) => JSON.parse(r.raw_json) as CrawledPage);
}

export function listSitePages(siteId: string): PageRow[] {
  return getDb().prepare(`SELECT * FROM pages WHERE site_id = ? ORDER BY page_type, url`).all(siteId) as PageRow[];
}
