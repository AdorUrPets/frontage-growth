import { getDb } from "../db/client";
import { getClient, type ClientWithSite } from "../db/clients";

export interface ReportFinding {
  severity: string;
  category: string;
  finding: string;
  url: string | null;
}

export interface ReportSchemaProposal {
  schemaType: string;
  url: string;
}

export interface ReportPendingChange {
  field: string;
  before: string | null;
  after: string | null;
  url: string;
}

export interface ReportContentOpportunity {
  title: string;
  url: string | null;
  opportunity: string | null;
}

export interface ClientReportData {
  client: ClientWithSite;
  generatedAt: string;
  findings: ReportFinding[];
  schemaProposals: ReportSchemaProposal[];
  pendingChanges: ReportPendingChange[];
  contentOpportunities: ReportContentOpportunity[];
}

// Pulls the same real findings/proposals every agent already wrote to the
// DB into one export-ready shape — nothing here is generated fresh, it's a
// read-only view over existing evidence so the PDF can never say something
// the dashboard doesn't already show.
export function buildClientReportData(clientId: string): ClientReportData | null {
  const client = getClient(clientId);
  if (!client || !client.site) return null;
  const db = getDb();
  const siteId = client.site.id;

  const findings = db
    .prepare(
      `SELECT tf.severity as severity, tf.category as category, tf.finding as finding, p.url as url
       FROM technical_findings tf LEFT JOIN pages p ON p.id = tf.page_id
       WHERE tf.site_id = ? AND tf.status = 'open'
       ORDER BY CASE tf.severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END, tf.created_at DESC`
    )
    .all(siteId) as ReportFinding[];

  const schemaProposals = db
    .prepare(
      `SELECT sf.schema_type as schemaType, p.url as url
       FROM schema_findings sf JOIN pages p ON p.id = sf.page_id
       WHERE p.site_id = ? AND sf.status = 'proposed'
       ORDER BY sf.created_at DESC`
    )
    .all(siteId) as ReportSchemaProposal[];

  const pendingChanges = db
    .prepare(
      `SELECT sc.field as field, sc.before_value as before, sc.after_value as after, p.url as url
       FROM seo_changes sc JOIN pages p ON p.id = sc.page_id
       WHERE p.site_id = ? AND sc.approval_id IS NULL
       ORDER BY sc.created_at DESC`
    )
    .all(siteId) as ReportPendingChange[];

  const contentOpportunities = db
    .prepare(
      `SELECT title as title, proposed_url as url, search_opportunity as opportunity
       FROM content_opportunities WHERE site_id = ? AND status = 'proposed'
       ORDER BY created_at DESC`
    )
    .all(siteId) as ReportContentOpportunity[];

  return {
    client,
    generatedAt: new Date().toISOString(),
    findings,
    schemaProposals,
    pendingChanges,
    contentOpportunities,
  };
}
