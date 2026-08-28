import { getDb, newId } from "../db/client";
import { getProtocol } from "../protocols/definitions";
import { runSiteRecon } from "../agents/siteRecon";
import { runBusinessUnderstanding } from "../agents/businessUnderstanding";
import { runSearchIntelligence } from "../agents/searchIntelligence";
import { runKeywordResearch } from "../agents/keywordResearch";
import { runSerpAnalysis } from "../agents/serpAnalysis";
import { runTechnicalSeo } from "../agents/technicalSeo";
import { runLocalSeo } from "../agents/localSeo";
import { runOnPageSeo } from "../agents/onPageSeo";
import { runSchemaAgent } from "../agents/schemaAgent";
import { runAudienceDiscovery } from "../agents/audienceDiscovery";
import { runTrafficStrategist } from "../agents/trafficStrategist";
import { runContentOpportunity } from "../agents/contentOpportunity";
import { runSeoWriter } from "../agents/seoWriter";
import { runSeoQa } from "../agents/seoQa";
import { runContentDistribution } from "../agents/contentDistribution";
import { runGrowthCommander } from "../agents/growthCommander";
import { runConversionAgent } from "../agents/conversionAgent";
import { runPerformanceAnalyst } from "../agents/performanceAnalyst";
import { runSeoPublisher } from "../agents/seoPublisher";
import { runEmailDnsHealth } from "../agents/emailDns";
import type { ClientRow, SiteRow } from "../types";

export interface AgentOutcome {
  ok: boolean;
  output?: unknown;
  error?: string;
  provider?: string;
  model?: string;
  // Distinguishes "this agent has legitimately nothing to do" (e.g. Local
  // SEO on a business with no physical service area) from a real failure.
  // A skip completes the step and moves the protocol on; a failure aborts
  // the remaining steps. Without this, e.g. every non-local client would
  // silently lose On-Page SEO and Schema whenever Local SEO ran first.
  skipped?: boolean;
}

// Every agent takes (client, site) and reads/writes the DB itself — the
// executor below doesn't thread data between steps in memory, each agent
// pulls what it needs (crawl pages, business profile, keywords) straight
// from the DB, so steps compose cleanly regardless of protocol order.
// Exported so the standalone (non-protocol) agent-run endpoint can reuse it.
export const AGENT_RUNNERS: Record<string, (client: ClientRow, site: SiteRow) => Promise<AgentOutcome>> = {
  site_recon: async (_client, site) => {
    const r = await runSiteRecon(site);
    return { ok: r.ok, output: { pagesDiscovered: r.pagesDiscovered, crawlId: r.crawlId }, error: r.error };
  },
  business_understanding: async (client, site) => {
    const r = await runBusinessUnderstanding(client, site);
    return { ok: r.ok, output: r.profile, error: r.error, provider: r.provider, model: r.model };
  },
  search_intelligence: async (client, site) => {
    const r = await runSearchIntelligence(client, site);
    return { ok: r.ok, output: { queriesRun: r.queriesRun, resultsStored: r.resultsStored }, error: r.error, provider: r.provider };
  },
  keyword_research: async (_client, site) => {
    const r = await runKeywordResearch(site);
    return { ok: r.ok, output: { clustersCreated: r.clustersCreated }, error: r.error, provider: r.provider, model: r.model };
  },
  technical_seo: async (_client, site) => {
    const r = await runTechnicalSeo(site);
    return { ok: r.ok, output: { findingsCreated: r.findingsCreated }, error: r.error };
  },
  onpage_seo: async (client, site) => {
    const r = await runOnPageSeo(client, site);
    return {
      ok: r.ok,
      output: { proposalsCreated: r.proposalsCreated, pagesProcessed: r.pagesProcessed, pagesFailed: r.pagesFailed },
      error: r.error,
      provider: r.provider,
      model: r.model,
    };
  },
  schema_agent: async (client, site) => {
    const r = await runSchemaAgent(client, site);
    return { ok: r.ok, output: { proposalsCreated: r.proposalsCreated }, error: r.error };
  },
  audience_discovery: async (client, site) => {
    const r = await runAudienceDiscovery(client, site);
    return { ok: r.ok, output: { audiencesCreated: r.audiencesCreated }, error: r.error, provider: r.provider, model: r.model };
  },
  traffic_strategist: async (client, site) => {
    const r = await runTrafficStrategist(client, site);
    return { ok: r.ok, output: { channelsCreated: r.channelsCreated }, error: r.error, provider: r.provider, model: r.model };
  },
  serp_analysis: async (_client, site) => {
    const r = await runSerpAnalysis(site);
    return { ok: r.ok, output: { keywordsAnalysed: r.keywordsAnalysed, competitorsFound: r.competitorsFound }, error: r.error };
  },
  local_seo: async (client, site) => {
    const r = await runLocalSeo(client, site);
    return { ok: r.ok, output: { findingsCreated: r.findingsCreated }, error: r.error, skipped: r.skipped };
  },
  content_opportunity: async (_client, site) => {
    const r = await runContentOpportunity(site);
    return { ok: r.ok, output: { opportunitiesCreated: r.opportunitiesCreated }, error: r.error, provider: r.provider, model: r.model, skipped: r.skipped };
  },
  seo_writer: async (client, site) => {
    const r = await runSeoWriter(client, site);
    return { ok: r.ok, output: { draftsCreated: r.draftsCreated }, error: r.error, provider: r.provider, model: r.model, skipped: r.skipped };
  },
  seo_qa: async (client, site) => {
    const r = await runSeoQa(client, site);
    return { ok: r.ok, output: { reviewed: r.reviewed, passed: r.passed, flagged: r.flagged }, error: r.error, provider: r.provider, model: r.model, skipped: r.skipped };
  },
  content_distribution: async (_client, site) => {
    const r = await runContentDistribution(site);
    return { ok: r.ok, output: { assetsCreated: r.assetsCreated }, error: r.error, provider: r.provider, model: r.model, skipped: r.skipped };
  },
  growth_commander: async (client, site) => {
    const r = await runGrowthCommander(client, site);
    return { ok: r.ok, output: { actions: r.actions }, error: r.error, provider: r.provider, model: r.model };
  },
  conversion_agent: async (_client, site) => {
    const r = await runConversionAgent(site);
    return { ok: r.ok, output: r, error: r.ok ? undefined : "Conversion agent failed unexpectedly." };
  },
  performance_analyst: async (_client, site) => {
    const r = await runPerformanceAnalyst(site);
    return { ok: r.ok, output: r, error: r.ok ? undefined : "Performance analyst failed unexpectedly." };
  },
  seo_publisher: async (_client, site) => {
    const r = await runSeoPublisher(site);
    return { ok: r.ok, output: r, error: r.error };
  },
  email_dns_health: async (_client, site) => {
    const r = await runEmailDnsHealth(site);
    const message = r.ok
      ? r.findingsCreated === 0
        ? `${r.domain}: MX, SPF, DMARC and DKIM (common selectors) all look correctly configured.`
        : `${r.findingsCreated} email/DNS issue(s) found for ${r.domain} — see the PDF report for the corrected records to publish.`
      : undefined;
    return { ok: r.ok, output: { findingsCreated: r.findingsCreated, domain: r.domain, message }, error: r.error };
  },
};

function getAgentId(code: string): string {
  const row = getDb().prepare(`SELECT id FROM agents WHERE code = ?`).get(code) as { id: string } | undefined;
  if (!row) throw new Error(`Agent "${code}" is not registered.`);
  return row.id;
}

// On-demand agents (Growth Commander, Conversion Agent, Performance
// Analyst) aren't part of the fixed protocol sequence — they're re-run
// whenever the operator wants a fresh read, not gated behind approval since
// they only read/reason, they never propose a site change. Runs
// synchronously (a single button click, not a multi-step pipeline) and
// records a real agent_runs row with mission_step_id = NULL.
export async function runStandaloneAgent(agentCode: string, clientId: string): Promise<AgentOutcome> {
  const db = getDb();
  const client = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(clientId) as ClientRow | undefined;
  const site = db.prepare(`SELECT * FROM sites WHERE client_id = ? ORDER BY created_at ASC LIMIT 1`).get(clientId) as SiteRow | undefined;
  if (!client) throw new Error("Client not found.");
  if (!site) throw new Error("This client has no site on file.");

  const runner = AGENT_RUNNERS[agentCode];
  if (!runner) throw new Error(`No implementation registered for agent "${agentCode}".`);

  const runId = newId();
  db.prepare(
    `INSERT INTO agent_runs (id, agent_id, mission_step_id, site_id, status, started_at) VALUES (?, ?, NULL, ?, 'running', datetime('now'))`
  ).run(runId, getAgentId(agentCode), site.id);

  let outcome: AgentOutcome;
  try {
    outcome = await runner(client, site);
  } catch (err) {
    outcome = { ok: false, error: err instanceof Error ? err.message : `${agentCode} crashed unexpectedly.` };
  }

  db.prepare(
    `UPDATE agent_runs SET
       status = ?, output_json = ?, error = ?, provider = ?, model = ?,
       completed_at = datetime('now'),
       duration_ms = CAST((julianday('now') - julianday(started_at)) * 86400000 AS INTEGER)
     WHERE id = ?`
  ).run(outcome.ok ? "complete" : "failed", JSON.stringify(outcome.output ?? null), outcome.error ?? null, outcome.provider ?? null, outcome.model ?? null, runId);

  return outcome;
}

// Starts exactly one protocol and returns immediately — execution continues
// in the background (this is a long-running local Node process, not
// serverless, so that's reliable here). The mission stops at
// 'awaiting_approval' once every step in the protocol completes; nothing
// past that point runs until POST /api/missions/[id]/approve is called.
export function startProtocol(clientId: string, protocolCode: string): string {
  const protocol = getProtocol(protocolCode);
  if (!protocol) throw new Error(`Unknown protocol "${protocolCode}".`);

  const db = getDb();
  const client = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(clientId) as ClientRow | undefined;
  const site = db.prepare(`SELECT * FROM sites WHERE client_id = ? ORDER BY created_at ASC LIMIT 1`).get(clientId) as SiteRow | undefined;
  if (!client) throw new Error("Client not found.");
  if (!site) throw new Error("This client has no site on file.");

  const missionId = newId();
  db.prepare(
    `INSERT INTO missions (id, site_id, label, protocol, status, started_at) VALUES (?, ?, ?, ?, 'running', datetime('now'))`
  ).run(missionId, site.id, protocol.label, protocol.code);

  const stepIds = protocol.agentCodes.map((code, i) => {
    const stepId = newId();
    db.prepare(`INSERT INTO mission_steps (id, mission_id, agent_id, step_order, status) VALUES (?, ?, ?, ?, 'pending')`).run(
      stepId,
      missionId,
      getAgentId(code),
      i + 1
    );
    return stepId;
  });

  void executeProtocol(missionId, protocol.agentCodes, stepIds, client, site);

  return missionId;
}

function beginAgentRun(agentCode: string, stepId: string, siteId: string): string {
  const db = getDb();
  const runId = newId();
  db.prepare(
    `INSERT INTO agent_runs (id, agent_id, mission_step_id, site_id, status, started_at) VALUES (?, ?, ?, ?, 'running', datetime('now'))`
  ).run(runId, getAgentId(agentCode), stepId, siteId);
  db.prepare(`UPDATE mission_steps SET status = 'running', started_at = datetime('now') WHERE id = ?`).run(stepId);
  return runId;
}

function finishAgentRun(runId: string, stepId: string, outcome: AgentOutcome) {
  const db = getDb();
  const status = outcome.skipped ? "skipped" : outcome.ok ? "complete" : "failed";
  db.prepare(
    `UPDATE agent_runs SET
       status = ?, output_json = ?, error = ?, provider = ?, model = ?,
       completed_at = datetime('now'),
       duration_ms = CAST((julianday('now') - julianday(started_at)) * 86400000 AS INTEGER)
     WHERE id = ?`
  ).run(status, JSON.stringify(outcome.output ?? null), outcome.error ?? null, outcome.provider ?? null, outcome.model ?? null, runId);
  db.prepare(`UPDATE mission_steps SET status = ?, completed_at = datetime('now'), error = ? WHERE id = ?`).run(
    status,
    outcome.skipped ? outcome.error ?? null : outcome.ok ? null : outcome.error ?? null,
    stepId
  );
}

async function executeProtocol(missionId: string, agentCodes: string[], stepIds: string[], client: ClientRow, site: SiteRow) {
  const db = getDb();

  for (let i = 0; i < agentCodes.length; i++) {
    const agentCode = agentCodes[i];
    const stepId = stepIds[i];
    const runner = AGENT_RUNNERS[agentCode];

    const runId = beginAgentRun(agentCode, stepId, site.id);
    let outcome: AgentOutcome;
    try {
      outcome = runner ? await runner(client, site) : { ok: false, error: `No implementation registered for agent "${agentCode}".` };
    } catch (err) {
      outcome = { ok: false, error: err instanceof Error ? err.message : `${agentCode} crashed unexpectedly.` };
    }
    finishAgentRun(runId, stepId, outcome);

    if (!outcome.ok) {
      for (let j = i + 1; j < stepIds.length; j++) {
        db.prepare(`UPDATE mission_steps SET status = 'failed', error = 'skipped: earlier step failed' WHERE id = ?`).run(stepIds[j]);
      }
      db.prepare(`UPDATE missions SET status = 'failed', completed_at = datetime('now') WHERE id = ?`).run(missionId);
      return;
    }
  }

  // Every step succeeded — pause here for human review. Nothing further
  // happens until the mission is explicitly approved.
  db.prepare(`UPDATE missions SET status = 'awaiting_approval', completed_at = datetime('now') WHERE id = ?`).run(missionId);
}
