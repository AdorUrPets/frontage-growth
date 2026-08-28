import { getDb, newId } from "../db/client";
import { listSitePages } from "../db/crawls";
import { getLatestBusinessProfile } from "./businessUnderstanding";
import type { ClientRow, SiteRow } from "../types";

export interface LocalSeoResult {
  ok: boolean;
  findingsCreated: number;
  error?: string;
  skipped?: boolean;
}

// Deterministic checks against real crawled content — no fabricated
// address/phone/reviews (§24/§64: we were never given NAP data at
// onboarding, so this never invents it; it only flags that it's missing).
export async function runLocalSeo(client: ClientRow, site: SiteRow): Promise<LocalSeoResult> {
  const profile = getLatestBusinessProfile(client.id);
  if (!profile) {
    return { ok: false, findingsCreated: 0, error: "No business profile yet — run Business Understanding first." };
  }
  if (!profile.serviceArea) {
    return {
      ok: true,
      skipped: true,
      findingsCreated: 0,
      error: "Not a location-bound business (no service area identified) — local SEO doesn't apply, skipped.",
    };
  }

  const pages = listSitePages(site.id);
  if (pages.length === 0) {
    return { ok: false, findingsCreated: 0, error: "No crawled pages found — run Site Recon first." };
  }

  const db = getDb();
  db.prepare(`DELETE FROM technical_findings WHERE site_id = ? AND category = 'local' AND status = 'open'`).run(site.id);
  const insert = db.prepare(
    `INSERT INTO technical_findings (id, site_id, page_id, category, severity, finding, evidence_json) VALUES (?, ?, ?, 'local', ?, ?, ?)`
  );

  let count = 0;
  const areaLower = profile.serviceArea.toLowerCase();
  const homepage = pages.find((p) => p.page_type === "home") ?? pages[0];

  const homepageMentionsArea =
    (homepage.title ?? "").toLowerCase().includes(areaLower) || (homepage.meta_description ?? "").toLowerCase().includes(areaLower);
  if (!homepageMentionsArea) {
    insert.run(newId(), site.id, homepage.id, "MEDIUM", `Homepage title/meta doesn't mention "${profile.serviceArea}" — weak local intent signal`, JSON.stringify({
      title: homepage.title,
      meta: homepage.meta_description,
    }));
    count++;
  }

  const servicePages = pages.filter((p) => p.page_type === "service");
  const servicePagesWithArea = servicePages.filter((p) => (p.title ?? "").toLowerCase().includes(areaLower));
  if (servicePages.length > 0 && servicePagesWithArea.length === 0) {
    insert.run(newId(), site.id, servicePages[0].id, "MEDIUM", `None of ${servicePages.length} service page(s) mention "${profile.serviceArea}" in the title — a location-specific service page (e.g. "Service in ${profile.serviceArea}") usually converts local search better than a generic one`, JSON.stringify({
      servicePages: servicePages.map((p) => p.url),
    }));
    count++;
  }

  // No address/phone was collected at onboarding — say so honestly rather
  // than fabricate it, and note what it would unlock (a real LocalBusiness
  // schema with NAP, which the Schema agent currently can't emit).
  insert.run(
    newId(),
    site.id,
    homepage.id,
    "LOW",
    "No business address or phone number on file — add it in the client's Overview notes to unlock full LocalBusiness structured data (currently limited to name/url/area).",
    JSON.stringify({ hasAddress: false, hasPhone: false })
  );
  count++;

  return { ok: true, findingsCreated: count };
}
