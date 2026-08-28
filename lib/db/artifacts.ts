/**
 * Cross-client reads of the work the agents have actually produced, for the
 * SEO / Traffic / Conversions / Results section pages.
 *
 * Every function here reads real rows the agents wrote. Nothing is
 * synthesized — when a table is empty the caller renders an honest empty
 * state rather than a placeholder figure.
 */
import { getDb } from "./client";

export interface ClientScoped {
  client_id: string;
  client_name: string;
}

// ---------------- SEO ----------------

export interface SeoCounts {
  pages: number;
  sitesCrawled: number;
  findingsOpen: number;
  findingsHigh: number;
  findingsMedium: number;
  findingsLow: number;
  proposalsPending: number;
  proposalsApproved: number;
  proposalsLive: number;
  schemaProposals: number;
  keywords: number;
  clusters: number;
  competitors: number;
}

export function seoCounts(): SeoCounts {
  const db = getDb();
  const one = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  return {
    pages: one(`SELECT COUNT(*) n FROM pages`),
    sitesCrawled: one(`SELECT COUNT(DISTINCT site_id) n FROM crawls WHERE status = 'complete'`),
    findingsOpen: one(`SELECT COUNT(*) n FROM technical_findings WHERE status = 'open'`),
    findingsHigh: one(`SELECT COUNT(*) n FROM technical_findings WHERE status = 'open' AND severity IN ('CRITICAL','HIGH')`),
    findingsMedium: one(`SELECT COUNT(*) n FROM technical_findings WHERE status = 'open' AND severity = 'MEDIUM'`),
    findingsLow: one(`SELECT COUNT(*) n FROM technical_findings WHERE status = 'open' AND severity NOT IN ('CRITICAL','HIGH','MEDIUM')`),
    proposalsPending: one(`SELECT COUNT(*) n FROM seo_changes WHERE approval_id IS NULL`),
    proposalsApproved: one(`SELECT COUNT(*) n FROM seo_changes WHERE approval_id IS NOT NULL AND applied_at IS NULL`),
    proposalsLive: one(`SELECT COUNT(*) n FROM seo_changes WHERE applied_at IS NOT NULL`),
    schemaProposals: one(`SELECT COUNT(*) n FROM schema_findings`),
    keywords: one(`SELECT COUNT(*) n FROM keywords`),
    clusters: one(`SELECT COUNT(*) n FROM keyword_clusters`),
    competitors: one(`SELECT COUNT(*) n FROM competitors`),
  };
}

export interface TechnicalFindingRow extends ClientScoped {
  id: string;
  category: string;
  severity: string;
  finding: string;
  page_url: string | null;
}

export function listTechnicalFindings(limit = 60): TechnicalFindingRow[] {
  return getDb()
    .prepare(
      `SELECT tf.id, tf.category, tf.severity, tf.finding, p.url as page_url, c.id as client_id, c.name as client_name
       FROM technical_findings tf
       JOIN sites s ON s.id = tf.site_id
       JOIN clients c ON c.id = s.client_id
       LEFT JOIN pages p ON p.id = tf.page_id
       WHERE tf.status = 'open'
       ORDER BY CASE tf.severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
                tf.created_at DESC
       LIMIT ?`
    )
    .all(limit) as TechnicalFindingRow[];
}

export function findingCategoryCounts(): { category: string; n: number }[] {
  return getDb()
    .prepare(`SELECT category, COUNT(*) n FROM technical_findings WHERE status = 'open' GROUP BY category ORDER BY n DESC`)
    .all() as { category: string; n: number }[];
}

export interface SeoChangeRow extends ClientScoped {
  id: string;
  field: string;
  before_value: string | null;
  after_value: string | null;
  reason: string | null;
  applied_at: string | null;
  approval_id: string | null;
  page_url: string;
}

export function listSeoChanges(limit = 40): SeoChangeRow[] {
  return getDb()
    .prepare(
      `SELECT sc.id, sc.field, sc.before_value, sc.after_value, sc.reason, sc.applied_at, sc.approval_id,
              p.url as page_url, c.id as client_id, c.name as client_name
       FROM seo_changes sc
       JOIN pages p ON p.id = sc.page_id
       JOIN sites s ON s.id = p.site_id
       JOIN clients c ON c.id = s.client_id
       ORDER BY sc.applied_at DESC, sc.created_at DESC
       LIMIT ?`
    )
    .all(limit) as SeoChangeRow[];
}

export function schemaTypeCounts(): { schema_type: string; n: number }[] {
  return getDb()
    .prepare(`SELECT schema_type, COUNT(*) n FROM schema_findings GROUP BY schema_type ORDER BY n DESC`)
    .all() as { schema_type: string; n: number }[];
}

export interface KeywordRow extends ClientScoped {
  id: string;
  keyword: string;
  intent: string | null;
  priority: string | null;
  opportunity: string | null;
  cluster_label: string | null;
}

export function listKeywords(limit = 60): KeywordRow[] {
  return getDb()
    .prepare(
      `SELECT k.id, k.keyword, k.intent, k.priority, k.opportunity, kc.label as cluster_label,
              c.id as client_id, c.name as client_name
       FROM keywords k
       JOIN sites s ON s.id = k.site_id
       JOIN clients c ON c.id = s.client_id
       LEFT JOIN keyword_clusters kc ON kc.id = k.cluster_id
       ORDER BY k.priority ASC, k.created_at DESC
       LIMIT ?`
    )
    .all(limit) as KeywordRow[];
}

export function listCompetitors(limit = 60): (ClientScoped & { id: string; domain: string })[] {
  return getDb()
    .prepare(
      `SELECT cp.id, cp.domain, c.id as client_id, c.name as client_name
       FROM competitors cp
       JOIN sites s ON s.id = cp.site_id
       JOIN clients c ON c.id = s.client_id
       ORDER BY cp.domain ASC LIMIT ?`
    )
    .all(limit) as (ClientScoped & { id: string; domain: string })[];
}

// ---------------- Traffic ----------------

export interface AudienceRow extends ClientScoped {
  id: string;
  label: string;
  description: string | null;
}

export function listAudiences(): AudienceRow[] {
  return getDb()
    .prepare(
      `SELECT a.id, a.label, a.description, c.id as client_id, c.name as client_name
       FROM audiences a JOIN sites s ON s.id = a.site_id JOIN clients c ON c.id = s.client_id
       ORDER BY a.created_at ASC`
    )
    .all() as AudienceRow[];
}

export interface ChannelRow extends ClientScoped {
  id: string;
  name: string;
  relevance_reason: string | null;
  enabled: number;
}

export function listChannels(): ChannelRow[] {
  return getDb()
    .prepare(
      `SELECT ch.id, ch.name, ch.relevance_reason, ch.enabled, c.id as client_id, c.name as client_name
       FROM channels ch JOIN sites s ON s.id = ch.site_id JOIN clients c ON c.id = s.client_id
       ORDER BY ch.enabled DESC, ch.name ASC`
    )
    .all() as ChannelRow[];
}

export interface OpportunityRow extends ClientScoped {
  id: string;
  title: string;
  proposed_url: string | null;
  search_opportunity: string | null;
  business_relevance: string | null;
  status: string;
}

export function listContentOpportunities(): OpportunityRow[] {
  return getDb()
    .prepare(
      `SELECT co.id, co.title, co.proposed_url, co.search_opportunity, co.business_relevance, co.status,
              c.id as client_id, c.name as client_name
       FROM content_opportunities co JOIN sites s ON s.id = co.site_id JOIN clients c ON c.id = s.client_id
       ORDER BY co.created_at DESC`
    )
    .all() as OpportunityRow[];
}

export interface ContentAssetRow extends ClientScoped {
  id: string;
  channel: string | null;
  format: string | null;
  status: string;
  body: string | null;
  published_at: string | null;
}

export function listContentAssets(): ContentAssetRow[] {
  return getDb()
    .prepare(
      `SELECT ca.id, ca.channel, ca.format, ca.status, ca.body, ca.published_at,
              c.id as client_id, c.name as client_name
       FROM content_assets ca JOIN sites s ON s.id = ca.site_id JOIN clients c ON c.id = s.client_id
       ORDER BY ca.created_at DESC`
    )
    .all() as ContentAssetRow[];
}

// ---------------- Conversions ----------------

export interface ConversionGoal extends ClientScoped {
  primary_conversion: string | null;
  secondary_conversion: string | null;
  industry: string | null;
}

export function listConversionGoals(): ConversionGoal[] {
  return getDb()
    .prepare(
      `SELECT bp.primary_conversion, bp.secondary_conversion, bp.industry, c.id as client_id, c.name as client_name
       FROM business_profiles bp JOIN clients c ON c.id = bp.client_id
       ORDER BY c.name ASC`
    )
    .all() as ConversionGoal[];
}

export function conversionCounts(): { total: number; byType: { event_type: string; n: number }[]; sitesWithAnalytics: number } {
  const db = getDb();
  return {
    total: (db.prepare(`SELECT COUNT(*) n FROM conversions`).get() as { n: number }).n,
    byType: db.prepare(`SELECT event_type, COUNT(*) n FROM conversions GROUP BY event_type ORDER BY n DESC`).all() as {
      event_type: string;
      n: number;
    }[],
    sitesWithAnalytics: (db.prepare(`SELECT COUNT(*) n FROM sites WHERE analytics_connected = 1`).get() as { n: number }).n,
  };
}

// ---------------- Results ----------------

export interface DeploymentRow extends ClientScoped {
  id: string;
  adapter: string;
  status: string;
  summary: string | null;
  deployed_at: string | null;
}

export function listDeployments(): DeploymentRow[] {
  return getDb()
    .prepare(
      `SELECT d.id, d.adapter, d.status, d.summary, d.deployed_at, c.id as client_id, c.name as client_name
       FROM deployments d JOIN sites s ON s.id = d.site_id JOIN clients c ON c.id = s.client_id
       ORDER BY d.deployed_at DESC, d.created_at DESC`
    )
    .all() as DeploymentRow[];
}

export interface MissionRow extends ClientScoped {
  id: string;
  protocol: string;
  label: string;
  status: string;
  completed_at: string | null;
  steps_total: number;
  steps_complete: number;
}

export function listMissions(): MissionRow[] {
  return getDb()
    .prepare(
      `SELECT m.id, m.protocol, m.label, m.status, m.completed_at, c.id as client_id, c.name as client_name,
              (SELECT COUNT(*) FROM mission_steps ms WHERE ms.mission_id = m.id) as steps_total,
              (SELECT COUNT(*) FROM mission_steps ms WHERE ms.mission_id = m.id AND ms.status = 'complete') as steps_complete
       FROM missions m JOIN sites s ON s.id = m.site_id JOIN clients c ON c.id = s.client_id
       ORDER BY COALESCE(m.completed_at, m.created_at) DESC`
    )
    .all() as MissionRow[];
}

// ---------------- Reports ----------------

export interface ClientReport {
  client: { id: string; name: string; businessName: string | null; primaryLocation: string | null; siteUrl: string | null };
  profile: {
    industry: string | null;
    serviceArea: string | null;
    summary: string | null;
    primaryConversion: string | null;
    secondaryConversion: string | null;
  } | null;
  missions: { id: string; protocol: string; status: string; completedAt: string | null; stepsDone: number; stepsTotal: number }[];
  technical: { critical: number; high: number; medium: number; low: number };
  onPage: { pending: number; approved: number; live: number };
  schema: { total: number; byType: { schema_type: string; n: number }[] };
  keywords: { total: number; clusters: number };
  content: { opportunities: number; draftsReady: number; published: number };
  traffic: { audiences: number; channelsRelevant: number; channelsTotal: number };
  deployments: { id: string; adapter: string; status: string; summary: string | null; deployedAt: string | null }[];
  searchConsole: { connected: boolean; clicks: number; impressions: number; avgPosition: number | null; snapshotRows: number };
  pagesCrawled: number;
  competitorsFound: number;
}

export function getClientReport(clientId: string): ClientReport | null {
  const db = getDb();

  const client = db
    .prepare(`SELECT c.id, c.name, c.business_name, c.primary_location, s.id as site_id, s.url as site_url
               FROM clients c LEFT JOIN sites s ON s.client_id = c.id
               WHERE c.id = ? ORDER BY s.created_at ASC LIMIT 1`)
    .get(clientId) as
    | { id: string; name: string; business_name: string | null; primary_location: string | null; site_id: string | null; site_url: string | null }
    | undefined;
  if (!client) return null;

  const profileRow = db
    .prepare(`SELECT industry, service_area, summary, primary_conversion, secondary_conversion FROM business_profiles WHERE client_id = ?`)
    .get(clientId) as
    | { industry: string | null; service_area: string | null; summary: string | null; primary_conversion: string | null; secondary_conversion: string | null }
    | undefined;

  const missions = db
    .prepare(
      `SELECT m.id, m.protocol, m.status, m.completed_at,
              (SELECT COUNT(*) FROM mission_steps ms WHERE ms.mission_id = m.id) as steps_total,
              (SELECT COUNT(*) FROM mission_steps ms WHERE ms.mission_id = m.id AND ms.status = 'complete') as steps_done
       FROM missions m JOIN sites s ON s.id = m.site_id WHERE s.client_id = ?
       ORDER BY COALESCE(m.completed_at, m.created_at) DESC`
    )
    .all(clientId) as { id: string; protocol: string; status: string; completed_at: string | null; steps_total: number; steps_done: number }[];

  const technical = db
    .prepare(
      `SELECT
         SUM(CASE WHEN tf.severity = 'CRITICAL' THEN 1 ELSE 0 END) as critical,
         SUM(CASE WHEN tf.severity = 'HIGH' THEN 1 ELSE 0 END) as high,
         SUM(CASE WHEN tf.severity = 'MEDIUM' THEN 1 ELSE 0 END) as medium,
         SUM(CASE WHEN tf.severity NOT IN ('CRITICAL','HIGH','MEDIUM') THEN 1 ELSE 0 END) as low
       FROM technical_findings tf JOIN sites s ON s.id = tf.site_id WHERE s.client_id = ? AND tf.status = 'open'`
    )
    .get(clientId) as { critical: number | null; high: number | null; medium: number | null; low: number | null };

  const onPage = db
    .prepare(
      `SELECT
         SUM(CASE WHEN sc.approval_id IS NULL THEN 1 ELSE 0 END) as pending,
         SUM(CASE WHEN sc.approval_id IS NOT NULL AND sc.applied_at IS NULL THEN 1 ELSE 0 END) as approved,
         SUM(CASE WHEN sc.applied_at IS NOT NULL THEN 1 ELSE 0 END) as live
       FROM seo_changes sc JOIN pages p ON p.id = sc.page_id JOIN sites s ON s.id = p.site_id WHERE s.client_id = ?`
    )
    .get(clientId) as { pending: number | null; approved: number | null; live: number | null };

  const schemaByType = db
    .prepare(
      `SELECT sf.schema_type, COUNT(*) n FROM schema_findings sf
       JOIN pages p ON p.id = sf.page_id JOIN sites s ON s.id = p.site_id WHERE s.client_id = ?
       GROUP BY sf.schema_type ORDER BY n DESC`
    )
    .all(clientId) as { schema_type: string; n: number }[];

  const keywordCounts = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM keywords k JOIN sites s ON s.id = k.site_id WHERE s.client_id = ?) as total,
         (SELECT COUNT(*) FROM keyword_clusters kc JOIN sites s ON s.id = kc.site_id WHERE s.client_id = ?) as clusters`
    )
    .get(clientId, clientId) as { total: number; clusters: number };

  const contentCounts = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM content_opportunities co JOIN sites s ON s.id = co.site_id WHERE s.client_id = ?) as opportunities,
         (SELECT COUNT(*) FROM content_assets ca JOIN sites s ON s.id = ca.site_id WHERE s.client_id = ? AND ca.status = 'draft') as drafts,
         (SELECT COUNT(*) FROM content_assets ca JOIN sites s ON s.id = ca.site_id WHERE s.client_id = ? AND ca.published_at IS NOT NULL) as published`
    )
    .get(clientId, clientId, clientId) as { opportunities: number; drafts: number; published: number };

  const trafficCounts = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM audiences a JOIN sites s ON s.id = a.site_id WHERE s.client_id = ?) as audiences,
         (SELECT COUNT(*) FROM channels ch JOIN sites s ON s.id = ch.site_id WHERE s.client_id = ? AND ch.enabled = 1) as relevant,
         (SELECT COUNT(*) FROM channels ch JOIN sites s ON s.id = ch.site_id WHERE s.client_id = ?) as total`
    )
    .get(clientId, clientId, clientId) as { audiences: number; relevant: number; total: number };

  const deployments = db
    .prepare(
      `SELECT d.id, d.adapter, d.status, d.summary, d.deployed_at FROM deployments d
       JOIN sites s ON s.id = d.site_id WHERE s.client_id = ?
       ORDER BY d.deployed_at DESC, d.created_at DESC`
    )
    .all(clientId) as { id: string; adapter: string; status: string; summary: string | null; deployed_at: string | null }[];

  const scRow = db
    .prepare(
      `SELECT SUM(scs.clicks) clicks, SUM(scs.impressions) impressions, AVG(scs.avg_position) pos, COUNT(*) n
       FROM search_console_snapshots scs JOIN sites s ON s.id = scs.site_id WHERE s.client_id = ?`
    )
    .get(clientId) as { clicks: number | null; impressions: number | null; pos: number | null; n: number };

  const connected = client.site_id
    ? Boolean((db.prepare(`SELECT search_console_connected FROM sites WHERE id = ?`).get(client.site_id) as { search_console_connected: number } | undefined)?.search_console_connected)
    : false;

  const pagesCrawled = (db.prepare(`SELECT COUNT(*) n FROM pages p JOIN sites s ON s.id = p.site_id WHERE s.client_id = ?`).get(clientId) as { n: number }).n;
  const competitorsFound = (
    db.prepare(`SELECT COUNT(*) n FROM competitors cp JOIN sites s ON s.id = cp.site_id WHERE s.client_id = ?`).get(clientId) as { n: number }
  ).n;

  return {
    client: { id: client.id, name: client.name, businessName: client.business_name, primaryLocation: client.primary_location, siteUrl: client.site_url },
    profile: profileRow
      ? {
          industry: profileRow.industry,
          serviceArea: profileRow.service_area,
          summary: profileRow.summary,
          primaryConversion: profileRow.primary_conversion,
          secondaryConversion: profileRow.secondary_conversion,
        }
      : null,
    missions: missions.map((m) => ({ id: m.id, protocol: m.protocol, status: m.status, completedAt: m.completed_at, stepsDone: m.steps_done, stepsTotal: m.steps_total })),
    technical: { critical: technical.critical ?? 0, high: technical.high ?? 0, medium: technical.medium ?? 0, low: technical.low ?? 0 },
    onPage: { pending: onPage.pending ?? 0, approved: onPage.approved ?? 0, live: onPage.live ?? 0 },
    schema: { total: schemaByType.reduce((n, r) => n + r.n, 0), byType: schemaByType },
    keywords: { total: keywordCounts.total, clusters: keywordCounts.clusters },
    content: { opportunities: contentCounts.opportunities, draftsReady: contentCounts.drafts, published: contentCounts.published },
    traffic: { audiences: trafficCounts.audiences, channelsRelevant: trafficCounts.relevant, channelsTotal: trafficCounts.total },
    deployments: deployments.map((d) => ({ id: d.id, adapter: d.adapter, status: d.status, summary: d.summary, deployedAt: d.deployed_at })),
    searchConsole: { connected, clicks: scRow.clicks ?? 0, impressions: scRow.impressions ?? 0, avgPosition: scRow.pos, snapshotRows: scRow.n },
    pagesCrawled,
    competitorsFound,
  };
}

export function listReportableClients(): { id: string; name: string }[] {
  return getDb().prepare(`SELECT id, name FROM clients ORDER BY created_at DESC`).all() as { id: string; name: string }[];
}

export interface SearchConsoleState {
  connectedSites: number;
  snapshotRows: number;
  totalClicks: number;
  totalImpressions: number;
  avgPosition: number | null;
  topQueries: { query: string; clicks: number; impressions: number; avg_position: number }[];
}

export function searchConsoleState(): SearchConsoleState {
  const db = getDb();
  const totals = db
    .prepare(`SELECT SUM(clicks) clicks, SUM(impressions) impressions, AVG(avg_position) pos FROM search_console_snapshots`)
    .get() as { clicks: number | null; impressions: number | null; pos: number | null };
  return {
    connectedSites: (db.prepare(`SELECT COUNT(*) n FROM sites WHERE search_console_connected = 1`).get() as { n: number }).n,
    snapshotRows: (db.prepare(`SELECT COUNT(*) n FROM search_console_snapshots`).get() as { n: number }).n,
    totalClicks: totals.clicks ?? 0,
    totalImpressions: totals.impressions ?? 0,
    avgPosition: totals.pos,
    topQueries: db
      .prepare(
        `SELECT query, SUM(clicks) clicks, SUM(impressions) impressions, AVG(avg_position) avg_position
         FROM search_console_snapshots WHERE query IS NOT NULL
         GROUP BY query ORDER BY clicks DESC LIMIT 15`
      )
      .all() as { query: string; clicks: number; impressions: number; avg_position: number }[],
  };
}
