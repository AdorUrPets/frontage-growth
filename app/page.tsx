import { getDb } from "@/lib/db/client";
import { listProviderHealth } from "@/lib/db/providers";
import { countClients } from "@/lib/db/clients";
import { refreshAllProviderHealth } from "@/lib/ai/health";
import { Globe2, Gauge, Eye, TrendingUp, Target, Bot } from "lucide-react";

import { KpiCard } from "./components/dashboard/KpiCard";
import { AgentNetwork } from "./components/dashboard/AgentNetwork";
import type { AgentNodeData } from "./components/dashboard/AgentNode";
import { AGENT_META } from "./components/dashboard/agentMeta";
import { MissionPipeline } from "./components/dashboard/MissionPipeline";
import { AutomationLogic } from "./components/dashboard/AutomationLogic";
import { AiInfrastructurePanel } from "./components/dashboard/AiInfrastructurePanel";
import { ApprovalsQueue, type ApprovalItem } from "./components/dashboard/ApprovalsQueue";
import { MissionDetails, type MissionDetailsData } from "./components/dashboard/MissionDetails";
import { RecentActivity, type ActivityItem } from "./components/dashboard/RecentActivity";
import { AnalyticsCard, AnalyticsLineChart, ChannelDonut } from "./components/dashboard/AnalyticsCharts";
import { relativeTime } from "./components/dashboard/relativeTime";
import {
  DEMO_KPIS,
  DEMO_COMMANDER,
  DEMO_TRAFFIC,
  DEMO_VISIBILITY,
  DEMO_CONVERSIONS,
  DEMO_CHANNELS,
  DEMO_MONTH_LABELS,
  DEMO_TOOLTIP,
} from "./components/dashboard/demoData";

export const dynamic = "force-dynamic";

const TREND_TOOLTIP = "Value is live — the trend line is a simulated preview until enough history is recorded.";

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}D ${h}H ${m}M`;
  if (h > 0) return `${h}H ${m}M`;
  return `${m}M`;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US");
}

function formatRuntime(ms: number | null): string | null {
  if (ms == null) return null;
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

function axisLabels(max: number): string[] {
  const top = max * 1.15;
  return [formatCompact(Math.round(top)), formatCompact(Math.round((top * 2) / 3)), formatCompact(Math.round(top / 3)), "0"];
}

function dateLabels(dates: string[]): string[] {
  if (dates.length < 2) return dates;
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  const mid = dates[Math.floor(dates.length / 2)];
  return [fmt(dates[0]), fmt(mid), fmt(dates[dates.length - 1])];
}

export default async function DashboardPage() {
  const { ollama } = await refreshAllProviderHealth();
  const db = getDb();
  const [health, clientCount] = [listProviderHealth(), countClients()];

  // ---------- KPI strip (real value first; simulated preview when the source isn't wired yet) ----------

  const activeMissionsCount = (
    db.prepare(`SELECT COUNT(*) as n FROM missions WHERE status IN ('running', 'awaiting_approval')`).get() as { n: number }
  ).n;

  const { critical, high } = db
    .prepare(
      `SELECT
         SUM(CASE WHEN severity = 'CRITICAL' THEN 1 ELSE 0 END) as critical,
         SUM(CASE WHEN severity = 'HIGH' THEN 1 ELSE 0 END) as high
       FROM technical_findings WHERE status = 'open'`
    )
    .get() as { critical: number | null; high: number | null };
  const hasAudited = (
    db.prepare(`SELECT COUNT(*) as n FROM missions WHERE protocol = 'seo' AND status = 'complete'`).get() as { n: number }
  ).n > 0;
  const seoHealthScore = hasAudited ? Math.max(0, 100 - 5 * (critical ?? 0) - 2 * (high ?? 0)) : null;

  const connectedSitesCount = (
    db.prepare(`SELECT COUNT(*) as n FROM sites WHERE search_console_connected = 1`).get() as { n: number }
  ).n;
  const gscTotals = db
    .prepare(`SELECT SUM(clicks) as clicks, SUM(impressions) as impressions FROM search_console_snapshots`)
    .get() as { clicks: number | null; impressions: number | null };
  const avgCtrPct = gscTotals.impressions ? ((gscTotals.clicks ?? 0) / gscTotals.impressions) * 100 : null;

  const conversionsTotal = (db.prepare(`SELECT COUNT(*) as n FROM conversions`).get() as { n: number }).n;

  // ---------- Growth Commander network (real agent roster + latest-run status) ----------

  interface AgentRow {
    id: string;
    code: string;
    name: string;
    description: string | null;
    last_status: string | null;
    last_completed_at: string | null;
    last_duration_ms: number | null;
    last_client_id: string | null;
  }
  const agentRows = db
    .prepare(
      `SELECT a.id, a.code, a.name, a.description, lr.status as last_status, lr.completed_at as last_completed_at,
              lr.duration_ms as last_duration_ms, lr.client_id as last_client_id
       FROM agents a
       LEFT JOIN (
         SELECT ar1.agent_id, ar1.status, ar1.completed_at, ar1.duration_ms, c.id as client_id
         FROM agent_runs ar1
         LEFT JOIN sites s ON s.id = ar1.site_id
         LEFT JOIN clients c ON c.id = s.client_id
         INNER JOIN (
           SELECT agent_id, MAX(COALESCE(started_at, created_at)) as max_t FROM agent_runs GROUP BY agent_id
         ) latest ON latest.agent_id = ar1.agent_id AND COALESCE(ar1.started_at, ar1.created_at) = latest.max_t
       ) lr ON lr.agent_id = a.id
       WHERE a.code != 'growth_commander'
       GROUP BY a.id`
    )
    .all() as AgentRow[];

  // Each node opens that agent's own page — role, live status, activity log
  // and raw execution log — rather than dumping every agent on one client panel.
  const fallbackClientId =
    (
      db
        .prepare(
          `SELECT c.id FROM clients c
           LEFT JOIN sites s ON s.client_id = c.id
           LEFT JOIN missions m ON m.site_id = s.id
           GROUP BY c.id ORDER BY COUNT(m.id) DESC, c.created_at DESC LIMIT 1`
        )
        .get() as { id: string } | undefined
    )?.id ?? null;

  function toNodeStatus(s: string | null): AgentNodeData["status"] {
    if (s === "running") return "running";
    if (s === "failed") return "failed";
    if (s === "complete") return "complete";
    return "idle";
  }
  function toDetail(row: AgentRow): string {
    if (row.last_status === "running") return "Running now…";
    if (row.last_status === "complete") return `Completed ${relativeTime(row.last_completed_at)}`;
    if (row.last_status === "failed") return `Failed ${relativeTime(row.last_completed_at)}`;
    if (row.last_status === "skipped") return `Skipped ${relativeTime(row.last_completed_at)}`;
    return row.description ?? "Idle — never run yet.";
  }

  const allAgentNodes: AgentNodeData[] = agentRows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    status: toNodeStatus(r.last_status),
    detail: toDetail(r),
    runtimeLabel: formatRuntime(r.last_duration_ms),
    href: `/missions/${r.code}`,
  }));
  const bySide = (side: "left" | "right") =>
    allAgentNodes
      .filter((a) => AGENT_META[a.code]?.side === side)
      .sort((a, b) => (AGENT_META[a.code]?.order ?? 99) - (AGENT_META[b.code]?.order ?? 99));
  const leftAgents = bySide("left");
  const rightAgents = bySide("right");

  const activeAgentsNow = (db.prepare(`SELECT COUNT(*) as n FROM agent_runs WHERE status = 'running'`).get() as { n: number }).n;
  const queuedSteps = (db.prepare(`SELECT COUNT(*) as n FROM mission_steps WHERE status = 'pending'`).get() as { n: number }).n;
  const totalAgentsRegistered = (db.prepare(`SELECT COUNT(*) as n FROM agents`).get() as { n: number }).n;
  const systemActive = health.some((h) => h.status === "online") || ollama.online;

  const commanderIsDemo = totalAgentsRegistered === 0;
  const commander = {
    systemActive,
    agentsActive: commanderIsDemo ? DEMO_COMMANDER.agentsActive : totalAgentsRegistered,
    tasksProcessing: commanderIsDemo ? DEMO_COMMANDER.tasksProcessing : queuedSteps + activeAgentsNow,
    uptimeLabel: formatUptime(process.uptime()),
    demoTooltip: commanderIsDemo ? DEMO_TOOLTIP : undefined,
  };

  // ---------- Mission pipeline + mission details (real most-active mission) ----------

  const activeMission = db
    .prepare(
      `SELECT m.id, m.protocol, m.status, m.label, c.id as client_id, c.name as client_name
       FROM missions m JOIN sites s ON s.id = m.site_id JOIN clients c ON c.id = s.client_id
       WHERE m.status IN ('running', 'awaiting_approval')
       ORDER BY COALESCE(m.started_at, m.created_at) DESC LIMIT 1`
    )
    .get() as { id: string; protocol: string; status: string; label: string; client_id: string; client_name: string } | undefined;

  // Map real mission state onto the canonical six-stage pipeline
  const pipelineActiveIndex = activeMission ? (activeMission.status === "awaiting_approval" ? 4 : 3) : null;

  let missionDetails: MissionDetailsData | null = null;
  if (activeMission) {
    const stepCounts = db
      .prepare(
        `SELECT
           SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) as done,
           COUNT(*) as total
         FROM mission_steps WHERE mission_id = ?`
      )
      .get(activeMission.id) as { done: number | null; total: number };
    const done = stepCounts.done ?? 0;
    missionDetails = {
      clientId: activeMission.client_id,
      clientName: activeMission.client_name,
      label: activeMission.label,
      progressPct: stepCounts.total > 0 ? Math.round((done / stepCounts.total) * 100) : 0,
      tasksDone: done,
      tasksTotal: stepCounts.total,
      etaLabel: activeMission.status === "awaiting_approval" ? "awaiting approval" : "—",
    };
  }

  // ---------- Approvals queue (real, wired to real approve/reject endpoints) ----------

  const awaitingMissions = db
    .prepare(
      `SELECT m.id, m.protocol, m.label, m.completed_at, c.id as client_id, c.name as client_name
       FROM missions m JOIN sites s ON s.id = m.site_id JOIN clients c ON c.id = s.client_id
       WHERE m.status = 'awaiting_approval' ORDER BY m.completed_at DESC`
    )
    .all() as { id: string; protocol: string; label: string; completed_at: string | null; client_id: string; client_name: string }[];

  const pendingSeoChanges = db
    .prepare(
      `SELECT sc.id, sc.field, sc.created_at, p.url as page_url, c.id as client_id, c.name as client_name
       FROM seo_changes sc JOIN pages p ON p.id = sc.page_id JOIN sites s ON s.id = p.site_id JOIN clients c ON c.id = s.client_id
       WHERE sc.approval_id IS NULL ORDER BY sc.created_at DESC`
    )
    .all() as { id: string; field: string; created_at: string; page_url: string; client_id: string; client_name: string }[];

  const approvalItems: ApprovalItem[] = [
    ...awaitingMissions.map((m) => ({
      kind: "mission" as const,
      id: m.id,
      clientId: m.client_id,
      clientName: m.client_name,
      summary: `${m.protocol.toUpperCase()} protocol complete — review and approve`,
      sinceLabel: relativeTime(m.completed_at),
    })),
    ...pendingSeoChanges.map((c) => ({
      kind: "seo_change" as const,
      id: c.id,
      clientId: c.client_id,
      clientName: c.client_name,
      summary: `${c.field} · ${c.page_url}`,
      sinceLabel: relativeTime(c.created_at),
    })),
  ];

  // "View All Approvals" must land on the panel that actually holds the
  // proposals (client → On-Page SEO Proposals, where the Push-to-Shopify
  // button lives) — prefer whoever has something pending, else whoever has
  // the most proposals on file.
  const proposalsClientId =
    approvalItems[0]?.clientId ??
    (
      db
        .prepare(
          `SELECT c.id, COUNT(*) as n
           FROM seo_changes sc
           JOIN pages p ON p.id = sc.page_id
           JOIN sites s ON s.id = p.site_id
           JOIN clients c ON c.id = s.client_id
           GROUP BY c.id ORDER BY n DESC LIMIT 1`
        )
        .get() as { id: string; n: number } | undefined
    )?.id ??
    fallbackClientId;
  const approvalsHref = proposalsClientId ? `/clients/${proposalsClientId}#seo-proposals` : "/clients";

  // ---------- Bottom analytics (real series when Search Console / conversions exist) ----------

  const gscDaily = db
    .prepare(
      `SELECT date(captured_at) as d, SUM(clicks) as clicks, SUM(impressions) as impressions
       FROM search_console_snapshots GROUP BY date(captured_at) ORDER BY d ASC`
    )
    .all() as { d: string; clicks: number; impressions: number }[];

  const conversionsDaily = db
    .prepare(`SELECT date(occurred_at) as d, COUNT(*) as n FROM conversions GROUP BY date(occurred_at) ORDER BY d ASC`)
    .all() as { d: string; n: number }[];

  const hasTrafficSeries = gscDaily.length >= 2;
  const trafficPanel = hasTrafficSeries
    ? {
        value: formatCompact(gscTotals.clicks ?? 0),
        delta: undefined as string | undefined,
        series: gscDaily.map((r) => r.clicks),
        yLabels: axisLabels(Math.max(...gscDaily.map((r) => r.clicks))),
        xLabels: dateLabels(gscDaily.map((r) => r.d)),
        demoTooltip: undefined as string | undefined,
      }
    : {
        value: DEMO_TRAFFIC.total,
        delta: DEMO_TRAFFIC.delta,
        series: DEMO_TRAFFIC.series,
        yLabels: DEMO_TRAFFIC.yLabels,
        xLabels: DEMO_MONTH_LABELS,
        demoTooltip: DEMO_TOOLTIP,
      };

  const visibilitySeries = gscDaily.filter((r) => r.impressions > 0).map((r) => (r.clicks / r.impressions) * 100);
  const hasVisibilitySeries = visibilitySeries.length >= 2;
  const visibilityPanel = hasVisibilitySeries
    ? {
        value: `${(avgCtrPct ?? 0).toFixed(1)}%`,
        delta: undefined as string | undefined,
        series: visibilitySeries,
        yLabels: ["100%", "75%", "50%", "25%", "0%"],
        xLabels: dateLabels(gscDaily.filter((r) => r.impressions > 0).map((r) => r.d)),
        demoTooltip: undefined as string | undefined,
      }
    : {
        value: DEMO_VISIBILITY.total,
        delta: DEMO_VISIBILITY.delta,
        series: DEMO_VISIBILITY.series,
        yLabels: DEMO_VISIBILITY.yLabels,
        xLabels: DEMO_MONTH_LABELS,
        demoTooltip: DEMO_TOOLTIP,
      };

  const hasConversionSeries = conversionsDaily.length >= 2;
  const conversionsPanel = hasConversionSeries
    ? {
        value: formatCompact(conversionsTotal),
        delta: undefined as string | undefined,
        series: conversionsDaily.map((r) => r.n),
        yLabels: axisLabels(Math.max(...conversionsDaily.map((r) => r.n))),
        xLabels: dateLabels(conversionsDaily.map((r) => r.d)),
        demoTooltip: undefined as string | undefined,
      }
    : {
        value: DEMO_CONVERSIONS.total,
        delta: DEMO_CONVERSIONS.delta,
        series: DEMO_CONVERSIONS.series,
        yLabels: DEMO_CONVERSIONS.yLabels,
        xLabels: DEMO_MONTH_LABELS,
        demoTooltip: DEMO_TOOLTIP,
      };

  // ---------- Recent activity feed (real agent_runs) ----------

  const activityRows = db
    .prepare(
      `SELECT ar.id, ar.status, ar.error, ar.duration_ms, ar.started_at, ar.completed_at,
              a.name as agent_name, a.code as agent_code, c.name as client_name, c.id as client_id
       FROM agent_runs ar
       JOIN agents a ON a.id = ar.agent_id
       LEFT JOIN sites s ON s.id = ar.site_id
       LEFT JOIN clients c ON c.id = s.client_id
       ORDER BY COALESCE(ar.completed_at, ar.started_at, ar.created_at) DESC
       LIMIT 6`
    )
    .all() as { id: string; status: string; error: string | null; duration_ms: number | null; started_at: string | null; completed_at: string | null; agent_name: string; agent_code: string; client_name: string | null; client_id: string | null }[];

  const activityItems: ActivityItem[] = activityRows.map((r) => ({
    id: r.id,
    agentName: r.agent_name,
    agentCode: r.agent_code,
    clientName: r.client_name,
    clientId: r.client_id,
    status: r.status,
    description:
      r.status === "running"
        ? "Running now…"
        : r.status === "failed"
        ? `Failed — ${r.error ?? "no error detail recorded"}`
        : r.status === "skipped"
        ? r.error ?? "Skipped — nothing to do."
        : r.duration_ms
        ? `Completed in ${formatRuntime(r.duration_ms)}`
        : "Completed",
    whenLabel: relativeTime(r.completed_at ?? r.started_at),
  }));

  // ---------- Compose the reference layout ----------

  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
      {/* ===== main column ===== */}
      <div className="flex min-w-0 flex-col gap-4">
        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
          <KpiCard
            icon={Globe2}
            label="Managed Sites"
            value={clientCount > 0 ? clientCount : DEMO_KPIS.managedSites.value}
            delta={DEMO_KPIS.managedSites.delta}
            spark={DEMO_KPIS.managedSites.spark}
            accent="blue"
            demoTooltip={clientCount > 0 ? TREND_TOOLTIP : DEMO_TOOLTIP}
          />
          <KpiCard
            icon={Gauge}
            label="SEO Health"
            value={seoHealthScore ?? DEMO_KPIS.seoHealth.value}
            suffix="/100"
            delta={DEMO_KPIS.seoHealth.delta}
            spark={DEMO_KPIS.seoHealth.spark}
            accent="green"
            demoTooltip={seoHealthScore != null ? TREND_TOOLTIP : DEMO_TOOLTIP}
          />
          <KpiCard
            icon={Eye}
            label="Search Visibility"
            value={avgCtrPct != null ? `${avgCtrPct.toFixed(1)}%` : DEMO_KPIS.searchVisibility.value}
            delta={DEMO_KPIS.searchVisibility.delta}
            spark={DEMO_KPIS.searchVisibility.spark}
            accent="violet"
            demoTooltip={avgCtrPct != null ? TREND_TOOLTIP : DEMO_TOOLTIP}
          />
          <KpiCard
            icon={TrendingUp}
            label="Organic Traffic"
            value={gscTotals.clicks ? formatCompact(gscTotals.clicks) : DEMO_KPIS.organicTraffic.value}
            delta={DEMO_KPIS.organicTraffic.delta}
            spark={DEMO_KPIS.organicTraffic.spark}
            accent="cyan"
            demoTooltip={gscTotals.clicks ? TREND_TOOLTIP : DEMO_TOOLTIP}
          />
          <KpiCard
            icon={Target}
            label="Conversions"
            value={conversionsTotal > 0 ? formatCompact(conversionsTotal) : DEMO_KPIS.conversions.value}
            delta={DEMO_KPIS.conversions.delta}
            spark={DEMO_KPIS.conversions.spark}
            accent="amber"
            demoTooltip={conversionsTotal > 0 ? TREND_TOOLTIP : DEMO_TOOLTIP}
          />
          <KpiCard
            icon={Bot}
            label="Active Missions"
            value={activeMissionsCount > 0 ? activeMissionsCount : DEMO_KPIS.activeMissions.value}
            delta={activeMissionsCount > 0 ? `${activeAgentsNow}` : DEMO_KPIS.activeMissions.delta}
            deltaSub="in progress"
            spark={DEMO_KPIS.activeMissions.spark}
            accent="coral"
            demoTooltip={activeMissionsCount > 0 ? TREND_TOOLTIP : DEMO_TOOLTIP}
          />
        </div>

        {/* Growth Commander — the dominant central panel */}
        <section className="fg-cmdr-panel">
          <div className="fg-cmdr-stage overflow-x-auto px-4 pb-1 pt-4">
            <AgentNetwork leftAgents={leftAgents} rightAgents={rightAgents} commander={commander} />
            <div className="flex justify-center pb-4">
              <MissionPipeline
                activeIndex={pipelineActiveIndex}
                missionLabel={activeMission?.label}
                clientName={activeMission?.client_name}
              />
            </div>
          </div>
          <AutomationLogic />
        </section>

        {/* Bottom analytics */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-4">
          <AnalyticsCard title="Organic Traffic" value={trafficPanel.value} delta={trafficPanel.delta} demoTooltip={trafficPanel.demoTooltip}>
            <AnalyticsLineChart
              series={trafficPanel.series}
              yLabels={trafficPanel.yLabels}
              xLabels={trafficPanel.xLabels}
              color="var(--fg-cyan)"
              gradientId="fg-chart-traffic"
            />
          </AnalyticsCard>

          <AnalyticsCard title="Search Visibility" value={visibilityPanel.value} delta={visibilityPanel.delta} demoTooltip={visibilityPanel.demoTooltip}>
            <AnalyticsLineChart
              series={visibilityPanel.series}
              yLabels={visibilityPanel.yLabels}
              xLabels={visibilityPanel.xLabels}
              color="var(--fg-blue)"
              gradientId="fg-chart-visibility"
            />
          </AnalyticsCard>

          <AnalyticsCard
            title="Traffic by Channel"
            compare="vs last 30 days"
            value=""
            demoTooltip={DEMO_TOOLTIP}
          >
            <ChannelDonut
              segments={DEMO_CHANNELS.segments}
              centerValue={hasTrafficSeries ? formatCompact(gscTotals.clicks ?? 0) : DEMO_CHANNELS.centerValue}
              centerLabel={DEMO_CHANNELS.centerLabel}
            />
          </AnalyticsCard>

          <AnalyticsCard title="Conversions" value={conversionsPanel.value} delta={conversionsPanel.delta} demoTooltip={conversionsPanel.demoTooltip}>
            <AnalyticsLineChart
              series={conversionsPanel.series}
              yLabels={conversionsPanel.yLabels}
              xLabels={conversionsPanel.xLabels}
              color="var(--fg-green)"
              gradientId="fg-chart-conversions"
            />
          </AnalyticsCard>
        </div>
      </div>

      {/* ===== right rail ===== */}
      <div className="flex min-w-0 flex-col gap-4">
        <AiInfrastructurePanel ollama={ollama} health={health} />
        <ApprovalsQueue items={approvalItems} viewAllHref={approvalsHref} />
        <MissionDetails mission={missionDetails} />
        <RecentActivity items={activityItems} />
      </div>
    </div>
  );
}
