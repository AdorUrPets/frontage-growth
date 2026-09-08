import { getDb } from "../db/client";
import { getClient, type ClientWithSite } from "../db/clients";

export interface ReportFinding {
  severity: string;
  category: string;
  finding: string;
  url: string | null;
  /** Concrete fix guidance pulled out of the finding's stored evidence — the
   * corrected record text, the list of affected pages, etc. Empty when the
   * finding text alone is already the complete explanation. */
  details: string[];
}

export interface ClientReportData {
  client: ClientWithSite;
  generatedAt: string;
  findings: ReportFinding[];
}

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const MAX_LISTED_URLS = 12;

// Turns a finding's raw evidence_json into short, readable "what to fix"
// lines — the recommended record to publish, the pages a duplicate title
// actually appears on, etc. This is exactly the detail a fix needs and was
// previously captured by agents but never surfaced anywhere.
function extractDetails(evidenceJson: string | null): string[] {
  if (!evidenceJson) return [];
  let evidence: Record<string, unknown>;
  try {
    evidence = JSON.parse(evidenceJson);
  } catch {
    return [];
  }
  if (!evidence || typeof evidence !== "object") return [];

  const lines: string[] = [];

  if (typeof evidence.recommendedTemplate === "string") {
    lines.push(`Recommended record: ${evidence.recommendedTemplate}`);
  }
  if (typeof evidence.recordName === "string") {
    lines.push(`Record name: ${evidence.recordName}`);
  }
  if (typeof evidence.record === "string") {
    lines.push(`Current record: ${evidence.record}`);
  }
  if (Array.isArray(evidence.records) && evidence.records.length > 0) {
    lines.push(`Current records: ${evidence.records.join(" | ")}`);
  }
  if (Array.isArray(evidence.urls) && evidence.urls.length > 0) {
    const urls = evidence.urls as string[];
    const shown = urls.slice(0, MAX_LISTED_URLS).join(", ");
    const more = urls.length > MAX_LISTED_URLS ? ` (+${urls.length - MAX_LISTED_URLS} more)` : "";
    lines.push(`Affected pages: ${shown}${more}`);
  }
  if (typeof evidence.preview === "string") {
    lines.push(`Preview: "${evidence.preview}"`);
  }
  if (typeof evidence.title === "string" && !lines.some((l) => l.includes(evidence.title as string))) {
    lines.push(`Title on file: "${evidence.title}"`);
  }
  if (Array.isArray(evidence.checkedSelectors) && evidence.checkedSelectors.length > 0) {
    lines.push(`Checked DKIM selectors: ${(evidence.checkedSelectors as string[]).join(", ")}`);
  }
  if (typeof evidence.viewport === "string") {
    lines.push(`Current viewport tag: ${evidence.viewport}`);
  }

  return lines;
}

// Pulls the same real findings every agent already wrote to the DB into
// one export-ready shape — nothing here is generated fresh, it's a
// read-only view over existing evidence. Only open findings ("what needs
// fixing"), not proposals/drafts — this report exists to be handed off as
// a fix list, not a status dashboard.
export function buildClientReportData(clientId: string): ClientReportData | null {
  const client = getClient(clientId);
  if (!client || !client.site) return null;
  const db = getDb();
  const siteId = client.site.id;

  const rows = db
    .prepare(
      `SELECT tf.severity as severity, tf.category as category, tf.finding as finding, tf.evidence_json as evidenceJson, p.url as url
       FROM technical_findings tf LEFT JOIN pages p ON p.id = tf.page_id
       WHERE tf.site_id = ? AND tf.status = 'open'
       ORDER BY CASE tf.severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END, tf.created_at DESC`
    )
    .all(siteId) as { severity: string; category: string; finding: string; evidenceJson: string | null; url: string | null }[];

  const findings: ReportFinding[] = rows
    .map((r) => ({
      severity: r.severity,
      category: r.category,
      finding: r.finding,
      url: r.url,
      details: extractDetails(r.evidenceJson),
    }))
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));

  return {
    client,
    generatedAt: new Date().toISOString(),
    findings,
  };
}
