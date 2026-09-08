import { getDb, newId } from "../db/client";
import { listSitePages } from "../db/crawls";
import type { SiteRow } from "../types";

const USER_AGENT = "Mozilla/5.0 (compatible; FrontageGrowthBot/1.0; +https://frontage.co.nz)";

export interface TechnicalSeoResult {
  ok: boolean;
  findingsCreated: number;
  error?: string;
}

async function urlExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "GET", headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(6000) });
    return res.ok;
  } catch {
    return false;
  }
}

// `user-scalable=no` disables pinch-zoom outright; `maximum-scale=1` (or
// less) has the same practical effect even without user-scalable present.
// Either hurts mobile usability and Google's mobile-friendliness signal.
function viewportDisablesZoom(viewport: string): boolean {
  if (/user-scalable\s*=\s*no/i.test(viewport)) return true;
  const maxScale = viewport.match(/maximum-scale\s*=\s*([\d.]+)/i);
  return maxScale !== null && parseFloat(maxScale[1]) <= 1;
}

// Purely rule-based over data Site Recon already fetched — no AI call, no
// external cost, matches the "SEO is free" principle: this finds real,
// concrete issues (missing/duplicate titles and meta, missing canonical,
// missing sitemap/robots.txt) with zero API spend.
export async function runTechnicalSeo(site: SiteRow): Promise<TechnicalSeoResult> {
  const pages = listSitePages(site.id);
  if (pages.length === 0) {
    return { ok: false, findingsCreated: 0, error: "No crawled pages found — run Site Recon first." };
  }

  const db = getDb();
  const insertFinding = db.prepare(
    `INSERT INTO technical_findings (id, site_id, page_id, category, severity, finding, evidence_json) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  // Clear previous open findings for this site so re-runs don't pile up duplicates.
  db.prepare(`DELETE FROM technical_findings WHERE site_id = ? AND status = 'open'`).run(site.id);

  let count = 0;
  const add = (pageId: string | null, category: string, severity: string, finding: string, evidence: unknown) => {
    insertFinding.run(newId(), site.id, pageId, category, severity, finding, JSON.stringify(evidence));
    count++;
  };

  const titleSeen = new Map<string, string[]>();
  const metaSeen = new Map<string, string[]>();

  for (const page of pages) {
    if (!page.title) {
      add(page.id, "meta", "HIGH", `Missing page title`, { url: page.url });
    } else {
      if (page.title.length < 15) add(page.id, "meta", "MEDIUM", `Title is very short (${page.title.length} chars) — likely not descriptive enough for search`, { url: page.url, title: page.title });
      if (page.title.length > 65) add(page.id, "meta", "LOW", `Title is long (${page.title.length} chars) — may get truncated in search results`, { url: page.url, title: page.title });
      titleSeen.set(page.title, [...(titleSeen.get(page.title) ?? []), page.url]);
    }

    if (!page.meta_description) {
      add(page.id, "meta", "HIGH", `Missing meta description`, { url: page.url });
    } else {
      if (page.meta_description.length < 50) add(page.id, "meta", "LOW", `Meta description is short (${page.meta_description.length} chars)`, { url: page.url });
      if (page.meta_description.length > 165) add(page.id, "meta", "LOW", `Meta description is long (${page.meta_description.length} chars) — may get truncated`, { url: page.url });
      metaSeen.set(page.meta_description, [...(metaSeen.get(page.meta_description) ?? []), page.url]);
    }

    if (!page.h1) add(page.id, "content", "MEDIUM", `Missing H1 heading`, { url: page.url });
    if (!page.canonical_url) add(page.id, "indexability", "LOW", `Missing canonical tag`, { url: page.url });

    if (page.has_lorem_ipsum) {
      add(page.id, "content", "HIGH", `Placeholder "Lorem ipsum" text is still live on this page`, { url: page.url });
    }

    if (page.images_total && page.images_missing_alt) {
      add(
        page.id,
        "accessibility",
        "LOW",
        `${page.images_missing_alt} of ${page.images_total} image(s) missing alt text`,
        { url: page.url }
      );
    }

    if (!page.viewport_content) {
      add(page.id, "mobile", "MEDIUM", `No viewport meta tag — page won't be treated as mobile-friendly by Google`, { url: page.url });
    } else if (viewportDisablesZoom(page.viewport_content)) {
      add(
        page.id,
        "mobile",
        "MEDIUM",
        `Viewport meta disables pinch-zoom — hurts mobile usability and accessibility`,
        { url: page.url, viewport: page.viewport_content }
      );
    }
  }

  for (const [title, urls] of titleSeen) {
    if (urls.length > 1) add(null, "duplication", "HIGH", `Duplicate title "${title}" used on ${urls.length} pages`, { urls });
  }
  for (const [meta, urls] of metaSeen) {
    if (urls.length > 1) add(null, "duplication", "MEDIUM", `Duplicate meta description used on ${urls.length} pages`, { urls, preview: meta.slice(0, 80) });
  }

  const origin = new URL(site.url).origin;
  const [hasSitemap, hasRobots] = await Promise.all([urlExists(`${origin}/sitemap.xml`), urlExists(`${origin}/robots.txt`)]);
  if (!hasSitemap) add(null, "crawlability", "MEDIUM", "No sitemap.xml found at the site root", { checked: `${origin}/sitemap.xml` });
  if (!hasRobots) add(null, "crawlability", "LOW", "No robots.txt found at the site root", { checked: `${origin}/robots.txt` });
  if (!site.url.startsWith("https://")) add(null, "security", "CRITICAL", "Site is not served over HTTPS", { url: site.url });

  return { ok: true, findingsCreated: count };
}
