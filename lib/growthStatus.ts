// Shared domain-matching helper for the cross-app growth-status endpoints
// (app/api/growth-status/*). Pentest Mission Control only knows bare
// hostnames (target.hosts[0]); sites.url here is unnormalized free text
// ("https://www.example.com", "example.com/", mixed case, etc.) — so every
// comparison goes through this same normalization on both sides.

import { getDb } from "./db/client";

export function normalizeHost(input: string): string {
  const trimmed = input.trim().toLowerCase();
  const withProto = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProto).hostname.replace(/^www\./, "");
  } catch {
    // Not parseable as a URL at all — fall back to a best-effort strip.
    return trimmed.replace(/^www\./, "").replace(/\/.*$/, "");
  }
}

export interface SiteMatch {
  site: { id: string; client_id: string; url: string; repo_local_path: string | null };
  client: { id: string; name: string };
}

export function findSiteForDomain(domain: string): SiteMatch | null {
  const target = normalizeHost(domain);
  const db = getDb();
  const sites = db.prepare(`SELECT id, client_id, url, repo_local_path FROM sites`).all() as {
    id: string;
    client_id: string;
    url: string;
    repo_local_path: string | null;
  }[];

  for (const site of sites) {
    if (!site.url) continue;
    if (normalizeHost(site.url) === target) {
      const client = db.prepare(`SELECT id, name FROM clients WHERE id = ?`).get(site.client_id) as
        | { id: string; name: string }
        | undefined;
      if (client) return { site, client };
    }
  }
  return null;
}
