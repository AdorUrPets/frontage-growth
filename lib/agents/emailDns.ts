import { promises as dnsPromises } from "node:dns";
import { getDb, newId } from "../db/client";
import type { SiteRow } from "../types";

export interface EmailDnsResult {
  ok: boolean;
  findingsCreated: number;
  domain?: string;
  error?: string;
}

// Node's default resolver is unreliable on some Windows setups — it's
// supposed to fall back through every DNS server the OS reports, but on a
// dual-stack machine with an IPv6 link-local resolver listed first, it can
// end up defaulting to 127.0.0.1 with nothing listening there
// (dns.getServers() confirms this happens even though `ipconfig` and the
// OS's own resolver both work fine — Windows' own DNS Client service
// clearly reaches the real router, Node's just doesn't discover it the
// same way). A scoped Resolver pointed at well-known public resolvers
// sidesteps that entirely, without touching the process-wide default
// (other code in this long-running server keeps whatever DNS behavior it
// already had). Using public resolvers is also arguably more accurate for
// this use case anyway — it reflects what the wider internet resolves,
// not a possibly-stale or filtered local cache.
function createResolver(): dnsPromises.Resolver {
  const resolver = new dnsPromises.Resolver();
  resolver.setServers(["1.1.1.1", "8.8.8.8"]);
  return resolver;
}

// DKIM selectors are provider-specific and not discoverable without the
// provider telling you — this list only covers the handful of common
// defaults (Google Workspace, Microsoft 365, common ESPs). A miss here
// means "not found under a common selector", not "DKIM is broken".
const COMMON_DKIM_SELECTORS = ["google", "selector1", "selector2", "default", "k1", "mail", "dkim", "smtp", "s1", "s2"];

// Node's resolver distinguishes "this name genuinely has no such record"
// (ENOTFOUND/ENODATA) from "the lookup itself couldn't complete"
// (ECONNREFUSED/ETIMEOUT/ESERVFAIL/EREFUSED — a blocked/unreachable
// resolver, a flaky network). Only the former is real evidence of a
// misconfigured domain; treating the latter as "no record" would produce
// confident-looking false findings on a network that simply can't do
// direct DNS lookups (e.g. outbound port 53 blocked by a firewall).
function isDefinitiveMiss(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException)?.code;
  return code === "ENOTFOUND" || code === "ENODATA";
}

interface LookupOutcome<T> {
  value: T | null;
  inconclusive: boolean;
}

async function safeLookup<T>(fn: () => Promise<T>): Promise<LookupOutcome<T>> {
  try {
    return { value: await fn(), inconclusive: false };
  } catch (err) {
    if (isDefinitiveMiss(err)) return { value: null, inconclusive: false };
    return { value: null, inconclusive: true };
  }
}

async function resolveTxtJoined(resolver: dnsPromises.Resolver, hostname: string): Promise<LookupOutcome<string[]>> {
  const result = await safeLookup(() => resolver.resolveTxt(hostname));
  if (!result.value) return { value: null, inconclusive: result.inconclusive };
  return { value: result.value.map((parts) => parts.join("")), inconclusive: false };
}

// Real DNS lookups only (Node's dns module against the live resolver) — no
// AI, no external API, no cost, same "SEO is free" pattern as
// technicalSeo.ts. Produces the exact corrected record text the operator
// can paste into their DNS host; never writes DNS itself.
export async function runEmailDnsHealth(site: SiteRow): Promise<EmailDnsResult> {
  let domain: string;
  try {
    domain = new URL(site.url).hostname.replace(/^www\./i, "");
  } catch {
    return { ok: false, findingsCreated: 0, error: "This site has no valid URL on file." };
  }

  const resolver = createResolver();

  // Canary: confirm DNS lookups can actually complete on this network
  // before drawing any conclusions. A connectivity-class failure here
  // aborts the whole check rather than risk writing false findings.
  const canary = await safeLookup(() => resolver.resolveMx(domain));
  if (canary.inconclusive) {
    return {
      ok: false,
      findingsCreated: 0,
      error: "DNS lookups could not be completed on this network (the resolver refused or timed out) — this doesn't mean the domain is misconfigured. Check that outbound DNS (port 53) isn't blocked, then try again.",
    };
  }

  const db = getDb();
  db.prepare(
    `DELETE FROM technical_findings WHERE site_id = ? AND category IN ('mx', 'spf', 'dmarc', 'dkim', 'dns') AND status = 'open'`
  ).run(site.id);
  const insertFinding = db.prepare(
    `INSERT INTO technical_findings (id, site_id, page_id, category, severity, finding, evidence_json) VALUES (?, ?, NULL, ?, ?, ?, ?)`
  );
  let count = 0;
  let skipped = 0;
  const add = (category: string, severity: string, finding: string, evidence: unknown) => {
    insertFinding.run(newId(), site.id, category, severity, finding, JSON.stringify(evidence));
    count++;
  };

  // DNS resolves at all (A or AAAA)
  const a = await safeLookup(() => resolver.resolve4(domain));
  if (!a.inconclusive && (!a.value || a.value.length === 0)) {
    const aaaa = await safeLookup(() => resolver.resolve6(domain));
    if (aaaa.inconclusive) skipped++;
    else if (!aaaa.value || aaaa.value.length === 0) {
      add("dns", "CRITICAL", `${domain} does not resolve to an A or AAAA record — the domain may be misconfigured or not pointed at hosting`, { domain });
    }
  } else if (a.inconclusive) {
    skipped++;
  }

  // MX (reuse the canary result — it's the same lookup)
  if (canary.value && canary.value.length > 0) {
    // has MX, nothing to flag
  } else {
    add("mx", "HIGH", `No MX records found for ${domain} — email cannot be delivered to this domain`, { domain });
  }

  // SPF
  const rootTxt = await resolveTxtJoined(resolver, domain);
  if (rootTxt.inconclusive) {
    skipped++;
  } else {
    const spfRecords = (rootTxt.value ?? []).filter((t) => t.toLowerCase().startsWith("v=spf1"));
    if (spfRecords.length === 0) {
      add(
        "spf",
        "HIGH",
        `No SPF record found for ${domain} — mail servers can't verify who's allowed to send email as this domain, which hurts deliverability and allows spoofing`,
        { domain, recommendedTemplate: "v=spf1 include:<your-mail-provider's-spf-include> ~all" }
      );
    } else if (spfRecords.length > 1) {
      add(
        "spf",
        "HIGH",
        `${domain} has ${spfRecords.length} SPF records — only one is permitted per RFC 7208, having multiple can cause SPF validation to fail entirely`,
        { domain, records: spfRecords }
      );
    } else if (!/[-~?]all\s*$/i.test(spfRecords[0].trim())) {
      add("spf", "MEDIUM", `SPF record for ${domain} has no "all" mechanism at the end — some validators treat this as incomplete`, {
        domain,
        record: spfRecords[0],
      });
    }
  }

  // DMARC
  const dmarcTxt = await resolveTxtJoined(resolver, `_dmarc.${domain}`);
  if (dmarcTxt.inconclusive) {
    skipped++;
  } else {
    const dmarcRecords = (dmarcTxt.value ?? []).filter((t) => t.toLowerCase().startsWith("v=dmarc1"));
    if (dmarcRecords.length === 0) {
      add(
        "dmarc",
        "HIGH",
        `No DMARC record found for ${domain} — without one, spoofed email using this domain isn't reported or blocked by receiving mail servers`,
        { domain, recommendedTemplate: `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@${domain}; pct=100`, recordName: `_dmarc.${domain}` }
      );
    } else {
      const dmarc = dmarcRecords[0];
      const policy = dmarc.match(/p=(\w+)/i)?.[1]?.toLowerCase();
      if (policy === "none") {
        add(
          "dmarc",
          "MEDIUM",
          `DMARC policy for ${domain} is "p=none" — monitoring only, spoofed mail is not actually quarantined or rejected. Move to "quarantine" or "reject" once SPF/DKIM are confirmed aligned`,
          { domain, record: dmarc }
        );
      }
      if (!/rua=/i.test(dmarc)) {
        add("dmarc", "LOW", `DMARC record for ${domain} has no "rua" reporting address — aggregate spoofing reports aren't being sent anywhere`, {
          domain,
          record: dmarc,
        });
      }
    }
  }

  // DKIM — best-effort against common selectors only. A lookup failure per
  // selector is treated as "not found under that selector", not skipped,
  // since NXDOMAIN on a non-existent subdomain is the expected/common case.
  const foundSelectors: string[] = [];
  let dkimInconclusive = false;
  for (const selector of COMMON_DKIM_SELECTORS) {
    const recs = await resolveTxtJoined(resolver, `${selector}._domainkey.${domain}`);
    if (recs.inconclusive) dkimInconclusive = true;
    else if ((recs.value ?? []).some((r) => /v=dkim1/i.test(r) || /p=/i.test(r))) foundSelectors.push(selector);
  }
  if (foundSelectors.length === 0 && !dkimInconclusive) {
    add(
      "dkim",
      "LOW",
      `No DKIM record found under common selectors for ${domain} (best-effort check only — checked: ${COMMON_DKIM_SELECTORS.join(", ")}). DKIM selectors are provider-specific; if this domain's mail provider uses a custom selector, verify DKIM directly with them`,
      { domain, checkedSelectors: COMMON_DKIM_SELECTORS }
    );
  } else if (foundSelectors.length === 0 && dkimInconclusive) {
    skipped++;
  }

  if (skipped > 0 && count === 0) {
    return {
      ok: false,
      findingsCreated: 0,
      error: `DNS lookups were incomplete for ${domain} (${skipped} check(s) couldn't reach the resolver) — try again once network/DNS access is reliable.`,
    };
  }

  return { ok: true, findingsCreated: count, domain };
}
