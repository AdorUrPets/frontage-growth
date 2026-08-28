"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Panel } from "../../../components/hud/Panel";
import { StatusPill } from "../../../components/hud/StatusPill";
import { ProviderBadge } from "../../../components/hud/ProviderBadge";
import {
  Rocket,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Circle,
  ArrowRight,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";

// ---------- shared types ----------

interface MissionStep {
  id: string;
  agent_code: string;
  agent_name: string;
  status: string;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
}
interface AgentRun {
  id: string;
  mission_step_id: string;
  status: string;
  provider: string | null;
  model: string | null;
  duration_ms: number | null;
  error: string | null;
  input_json: string | null;
  output_json: string | null;
  confidence: number | null;
}
interface Mission {
  id: string;
  status: string;
  protocol: string;
  started_at: string | null;
  completed_at: string | null;
}
interface CrawlPage {
  url: string;
  status_code: number | null;
  page_type: string;
  title: string | null;
}
interface Crawl {
  id: string;
  status: string;
  pages_discovered: number;
  error: string | null;
}
interface BusinessProfile {
  industry: string | null;
  service_area: string | null;
  services_json: string;
  likely_customers_json: string;
  primary_conversion: string | null;
  secondary_conversion: string | null;
  summary: string;
}
interface TechnicalFinding {
  id: string;
  category: string;
  severity: string;
  finding: string;
}
interface SchemaFinding {
  id: string;
  schema_type: string;
  proposed_json: string;
}
interface Keyword {
  id: string;
  keyword: string;
  intent: string | null;
  priority: string | null;
  opportunity: string | null;
  cluster_id: string | null;
}
interface KeywordCluster {
  id: string;
  label: string;
  primary_intent: string | null;
}
interface Audience {
  id: string;
  label: string;
  description: string;
}
interface Channel {
  id: string;
  name: string;
  relevance_reason: string;
  enabled: number;
}
interface SeoChange {
  id: string;
  page_url: string;
  field: string;
  before_value: string | null;
  after_value: string | null;
  reason: string | null;
  approval_status: string | null;
  approval_summary: string | null;
  applied_at: string | null;
}
interface ProtocolInfo {
  code: string;
  label: string;
  description: string;
}
interface Competitor {
  id: string;
  domain: string;
}
interface ContentOpportunity {
  id: string;
  title: string;
  proposed_url: string | null;
  business_relevance: string | null;
  suggested_structure: string | null;
}
interface ContentAsset {
  id: string;
  channel: string;
  format: string;
  body: string;
  status: string;
  opportunity_id: string | null;
}
interface GrowthData {
  profile: BusinessProfile | null;
  crawl: Crawl | null;
  pages: CrawlPage[];
  missions: Mission[];
  technicalFindings: TechnicalFinding[];
  schemaFindings: SchemaFinding[];
  keywordClusters: KeywordCluster[];
  keywords: Keyword[];
  audiences: Audience[];
  channels: Channel[];
  competitors: Competitor[];
  contentOpportunities: ContentOpportunity[];
  contentAssets: ContentAsset[];
  currentProtocol: ProtocolInfo | null;
  nextProtocol: ProtocolInfo | null;
}

const PROTOCOLS = [
  { code: "seo", label: "SEO" },
  { code: "traffic", label: "Traffic" },
  { code: "content", label: "Content" },
];

const STEP_ICON: Record<string, typeof Circle> = { pending: Circle, running: Loader2, complete: CheckCircle2, failed: XCircle };
const SEVERITY_COLOR: Record<string, string> = { CRITICAL: "error", HIGH: "error", MEDIUM: "warn", LOW: "idle", INFO: "idle" };

// ---------- pipeline (protocol runner + approve/next) ----------

function ProtocolPipeline({ clientId, growth, onAdvance }: { clientId: string; growth: GrowthData | null; onAdvance: () => void }) {
  const [mission, setMission] = useState<Mission | null>(null);
  const [steps, setSteps] = useState<MissionStep[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [starting, setStarting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeMissionId = growth?.missions[0]?.id ?? null;
  const activeStatus = growth?.missions[0]?.status ?? null;

  const fetchMission = useCallback(async (id: string) => {
    const res = await fetch(`/api/missions/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    setMission(data.mission);
    setSteps(data.steps);
    setRuns(data.runs);
    return data.mission.status as string;
  }, []);

  const poll = useCallback((id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const status = await fetchMission(id);
      if (status && status !== "running") {
        if (pollRef.current) clearInterval(pollRef.current);
        onAdvance();
      }
    }, 1500);
  }, [fetchMission, onAdvance]);

  useEffect(() => {
    if (!activeMissionId) return;
    if (activeStatus === "running") {
      if (!pollRef.current) poll(activeMissionId);
    } else {
      // Non-running mission (failed/complete/awaiting_approval): fetch its steps once so
      // the pipeline list (and step error detail) is visible after a page reload, not just
      // while the mission was live-polled during this session.
      fetchMission(activeMissionId);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMissionId, activeStatus]);

  async function startProtocol(protocolCode: string) {
    setStarting(true);
    setError(null);
    setSteps([]);
    setRuns([]);
    const res = await fetch(`/api/clients/${clientId}/protocols`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ protocol: protocolCode }),
    });
    const data = await res.json();
    setStarting(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to start protocol.");
      return;
    }
    setMission({ id: data.missionId, status: "running", protocol: protocolCode, started_at: null, completed_at: null });
    poll(data.missionId);
  }

  // Always available (never gated behind "pipeline complete") — clears
  // every prior report/finding for this site first so re-running doesn't
  // pile duplicate keywords/opportunities/findings on top of old ones,
  // then starts the SEO protocol fresh from Site Recon.
  async function rescan() {
    if (
      !window.confirm(
        "Rescan this site from scratch? This clears every existing report and finding first (crawl data, findings, keywords, content, missions, business profile), then starts a fresh SEO protocol run. This can't be undone."
      )
    ) {
      return;
    }
    setRescanning(true);
    setError(null);
    const resetRes = await fetch(`/api/clients/${clientId}/reset`, { method: "POST" });
    if (!resetRes.ok) {
      setRescanning(false);
      const data = await resetRes.json().catch(() => ({}));
      setError(data.error ?? "Failed to clear existing data before rescanning.");
      return;
    }
    setMission(null);
    setRescanning(false);
    onAdvance();
    await startProtocol("seo");
  }

  async function approve() {
    if (!activeMissionId) return;
    setApproving(true);
    const res = await fetch(`/api/missions/${activeMissionId}/approve`, { method: "POST" });
    setApproving(false);
    if (res.ok) onAdvance();
    else setError("Failed to approve.");
  }

  const displayMission = mission ?? (growth?.missions[0] ?? null);
  const displaySteps = steps.length > 0 ? steps : [];
  const isRunning = displayMission?.status === "running" || starting;
  const isAwaitingApproval = displayMission?.status === "awaiting_approval" && !isRunning;
  const isFailed = displayMission?.status === "failed" && !isRunning;

  return (
    <Panel
      id="pipeline"
      title="Growth Mission Pipeline"
      right={
        <button className="fg-btn" onClick={rescan} disabled={isRunning || rescanning}>
          {rescanning ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} {rescanning ? "Rescanning…" : "Rescan"}
        </button>
      }
    >
      {error ? <p className="mb-3 text-xs text-[var(--fg-red)]">{error}</p> : null}

      {/* Protocol sequence bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        {PROTOCOLS.map(({ code, label }, i) => {
          const isCurrent = displayMission?.protocol === code;
          const isDone = growth?.missions.some((m) => m.protocol === code && m.status === "complete");
          return (
            <div key={code} className="flex items-center gap-2">
              <span
                className={`rounded-full border px-3 py-1 font-bold uppercase tracking-wide ${
                  isDone
                    ? "border-[var(--fg-accent-dim)] text-[var(--fg-accent)]"
                    : isCurrent
                    ? "border-[var(--fg-border-bright)] text-[var(--fg-text)]"
                    : "border-[var(--fg-border)] text-[var(--fg-text-faint)]"
                }`}
              >
                {isDone ? <CheckCircle2 size={11} className="mr-1 inline" /> : null}
                {label}
              </span>
              {i < PROTOCOLS.length - 1 ? <ArrowRight size={12} className="text-[var(--fg-text-faint)]" /> : null}
            </div>
          );
        })}
      </div>

      {/* Idle: nothing running, a protocol is available to start */}
      {!isRunning && !isAwaitingApproval && !isFailed && growth?.nextProtocol ? (
        <div>
          <p className="mb-3 text-xs text-[var(--fg-text-dim)]">{growth.nextProtocol.description}</p>
          <button className="fg-btn fg-btn--primary" onClick={() => startProtocol(growth.nextProtocol!.code)} disabled={starting}>
            {starting ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
            {starting ? "Starting…" : growth.missions.length === 0 ? "Initiate First Protocol" : `Start ${growth.nextProtocol.label} Protocol`}
          </button>
        </div>
      ) : null}

      {!isRunning && !isAwaitingApproval && !isFailed && !growth?.nextProtocol && growth && growth.missions.length > 0 ? (
        <p className="text-xs text-[var(--fg-accent)]">Every protocol in the current pipeline is complete.</p>
      ) : null}

      {/* Running or just-finished: live step list */}
      {(isRunning || displaySteps.length > 0) ? (
        <div className="flex flex-col gap-2">
          {displaySteps.map((step) => {
            const Icon = STEP_ICON[step.status] ?? Circle;
            const run = runs.find((r) => r.mission_step_id === step.id);
            const hasDetail = Boolean(step.error || run?.error || run?.output_json || run?.input_json);
            return (
              <details
                key={step.id}
                className="group flex flex-col gap-1 rounded-lg border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] px-4 py-3"
              >
                <summary className={`flex items-center justify-between ${hasDetail ? "cursor-pointer" : "cursor-default marker:content-['']"}`}>
                  <div className="flex items-center gap-2 text-xs">
                    <Icon
                      size={14}
                      className={
                        step.status === "running"
                          ? "animate-spin text-[var(--fg-accent)]"
                          : step.status === "complete"
                          ? "text-[var(--fg-accent)]"
                          : step.status === "failed"
                          ? "text-[var(--fg-red)]"
                          : "text-[var(--fg-text-faint)]"
                      }
                    />
                    <span className="font-semibold text-[var(--fg-text)]">{step.agent_name}</span>
                    {run?.provider ? <ProviderBadge provider={run.provider} model={run.model} /> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {run?.duration_ms ? <span className="text-[10px] text-[var(--fg-text-faint)]">{(run.duration_ms / 1000).toFixed(1)}s</span> : null}
                    <StatusPill status={step.status} />
                  </div>
                </summary>
                {step.error ? (
                  <p className={`text-[11px] ${step.status === "skipped" ? "text-[var(--fg-text-faint)]" : "text-[var(--fg-red)]"}`}>{step.error}</p>
                ) : null}
                {hasDetail ? (
                  <div className="mt-2 flex flex-col gap-2 border-t border-[var(--fg-border)] pt-2 text-[10.5px]">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div>
                        <div className="fg-field-label !mb-1">Started</div>
                        <div className="text-[var(--fg-text)]">{step.started_at ? new Date(step.started_at.replace(" ", "T") + "Z").toLocaleString() : "—"}</div>
                      </div>
                      <div>
                        <div className="fg-field-label !mb-1">Completed</div>
                        <div className="text-[var(--fg-text)]">{step.completed_at ? new Date(step.completed_at.replace(" ", "T") + "Z").toLocaleString() : "—"}</div>
                      </div>
                      <div>
                        <div className="fg-field-label !mb-1">Model</div>
                        <div className="truncate text-[var(--fg-text)]">{run?.model ?? "—"}</div>
                      </div>
                      <div>
                        <div className="fg-field-label !mb-1">Confidence</div>
                        <div className="text-[var(--fg-text)]">{run?.confidence != null ? run.confidence.toFixed(2) : "—"}</div>
                      </div>
                    </div>
                    {run?.error && run.error !== step.error ? (
                      <div>
                        <div className="fg-field-label !mb-1">Agent Run Error</div>
                        <pre className="fg-scroll overflow-x-auto whitespace-pre-wrap text-[10px] text-[var(--fg-red)]">{run.error}</pre>
                      </div>
                    ) : null}
                    {run?.input_json ? (
                      <div>
                        <div className="fg-field-label !mb-1">Input</div>
                        <pre className="fg-scroll max-h-48 overflow-auto whitespace-pre-wrap text-[10px] text-[var(--fg-text-dim)]">
                          {(() => {
                            try {
                              return JSON.stringify(JSON.parse(run.input_json), null, 2);
                            } catch {
                              return run.input_json;
                            }
                          })()}
                        </pre>
                      </div>
                    ) : null}
                    {run?.output_json ? (
                      <div>
                        <div className="fg-field-label !mb-1">Output</div>
                        <pre className="fg-scroll max-h-64 overflow-auto whitespace-pre-wrap text-[10px] text-[var(--fg-text-dim)]">
                          {(() => {
                            try {
                              return JSON.stringify(JSON.parse(run.output_json), null, 2);
                            } catch {
                              return run.output_json;
                            }
                          })()}
                        </pre>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </details>
            );
          })}
        </div>
      ) : null}

      {/* Awaiting approval: gate to Next */}
      {isAwaitingApproval ? (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-[var(--fg-accent-dim)] bg-[color-mix(in_srgb,var(--fg-accent)_8%,transparent)] px-4 py-3">
          <span className="text-xs text-[var(--fg-text)]">
            {PROTOCOLS.find((p) => p.code === displayMission?.protocol)?.label ?? displayMission?.protocol} protocol complete — review the findings below, then approve to continue.
          </span>
          <button className="fg-btn fg-btn--primary" onClick={approve} disabled={approving}>
            <ThumbsUp size={14} /> {approving ? "Approving…" : "Approve & Continue"}
          </button>
        </div>
      ) : null}

      {isFailed ? (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-[color-mix(in_srgb,var(--fg-red)_45%,transparent)] bg-[color-mix(in_srgb,var(--fg-red)_8%,transparent)] px-4 py-3">
          <span className="text-xs text-[var(--fg-red)]">This protocol failed — fix the underlying issue (see step errors above) then retry.</span>
          <button className="fg-btn" onClick={() => startProtocol(displayMission!.protocol)} disabled={starting}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      ) : null}
    </Panel>
  );
}

// ---------- read-only result panels ----------

function WebsiteMapPanel({ crawl, pages }: { crawl: Crawl; pages: CrawlPage[] }) {
  return (
    <Panel id="website-map" title="Website Map" right={<span className="text-[10px] text-[var(--fg-text-faint)]">{crawl.pages_discovered} page(s) · REAL DATA</span>}>
      {crawl.status === "failed" ? (
        <p className="text-xs text-[var(--fg-red)]">{crawl.error}</p>
      ) : (
        <div className="fg-scroll flex flex-col gap-1 overflow-x-auto">
          {pages.map((p) => (
            <div key={p.url} className="flex items-center gap-3 rounded-md border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] px-3 py-2 text-xs">
              <span className="w-16 shrink-0 uppercase text-[10px] font-bold text-[var(--fg-text-faint)]">{p.page_type}</span>
              <span className="min-w-0 flex-1 truncate text-[var(--fg-text)]">{p.title ?? "(no title)"}</span>
              <span className="shrink-0 text-[10px] text-[var(--fg-text-faint)]">{p.status_code ?? "—"}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function BusinessProfilePanel({ profile }: { profile: BusinessProfile }) {
  const services = JSON.parse(profile.services_json || "[]") as string[];
  const customers = JSON.parse(profile.likely_customers_json || "[]") as string[];
  return (
    <Panel id="business-profile" title="Business Profile" right={<span className="fg-metric-tag">AI ANALYSIS</span>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div><div className="fg-field-label">Industry</div><div className="text-xs text-[var(--fg-text)]">{profile.industry ?? "—"}</div></div>
        <div><div className="fg-field-label">Service Area</div><div className="text-xs text-[var(--fg-text)]">{profile.service_area ?? "—"}</div></div>
        <div><div className="fg-field-label">Services</div><div className="text-xs text-[var(--fg-text)]">{services.join(", ") || "—"}</div></div>
        <div><div className="fg-field-label">Likely Customers</div><div className="text-xs text-[var(--fg-text)]">{customers.join(", ") || "—"}</div></div>
        <div><div className="fg-field-label">Primary Conversion</div><div className="text-xs text-[var(--fg-text)]">{profile.primary_conversion ?? "—"}</div></div>
        <div><div className="fg-field-label">Secondary Conversion</div><div className="text-xs text-[var(--fg-text)]">{profile.secondary_conversion ?? "—"}</div></div>
      </div>
      {profile.summary ? <p className="mt-4 text-xs text-[var(--fg-text-dim)]">{profile.summary}</p> : null}
    </Panel>
  );
}

function TechnicalFindingsPanel({ findings }: { findings: TechnicalFinding[] }) {
  if (findings.length === 0) return null;
  return (
    <Panel id="technical-findings" title="Technical SEO Findings" right={<span className="fg-metric-tag">REAL DATA</span>}>
      <div className="fg-scroll flex flex-col gap-1 overflow-x-auto">
        {findings.map((f) => (
          <div key={f.id} className="flex items-center gap-3 rounded-md border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] px-3 py-2 text-xs">
            <StatusPill status={SEVERITY_COLOR[f.severity] ?? "idle"} label={f.severity} />
            <span className="w-20 shrink-0 uppercase text-[10px] font-bold text-[var(--fg-text-faint)]">{f.category}</span>
            <span className="min-w-0 flex-1 text-[var(--fg-text)]">{f.finding}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function KeywordsPanel({ clusters, keywords }: { clusters: KeywordCluster[]; keywords: Keyword[] }) {
  if (clusters.length === 0) return null;
  return (
    <Panel id="keywords" title="Keyword Clusters" right={<span className="fg-metric-tag">AI ANALYSIS · from real search results</span>}>
      <div className="flex flex-col gap-3">
        {clusters.map((c) => (
          <div key={c.id} className="rounded-lg border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--fg-text)]">{c.label}</span>
              {c.primary_intent ? <span className="fg-metric-tag">{c.primary_intent}</span> : null}
            </div>
            <div className="flex flex-col gap-1">
              {keywords.filter((k) => k.cluster_id === c.id).map((k) => (
                <div key={k.id} className="flex items-center gap-2 text-[11px] text-[var(--fg-text-dim)]">
                  <span className="w-8 shrink-0 font-bold text-[var(--fg-text-faint)]">{k.priority ?? "—"}</span>
                  <span className="text-[var(--fg-text)]">{k.keyword}</span>
                  {k.opportunity ? <span className="text-[var(--fg-text-faint)]">— {k.opportunity}</span> : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function SeoChangesPanel({ siteId }: { siteId: string }) {
  const [changes, setChanges] = useState<SeoChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/seo-changes?siteId=${siteId}`);
    const data = await res.json();
    setChanges(data.changes ?? []);
    setLoading(false);
  }, [siteId]);

  useEffect(() => { load(); }, [load]);

  async function decideChange(id: string, status: "approved" | "rejected") {
    setDeciding(id);
    await fetch(`/api/seo-changes/${id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setDeciding(null);
    load();
  }

  if (loading || changes.length === 0) return null;

  return (
    <Panel id="seo-proposals" title="On-Page SEO Proposals" right={<span className="fg-metric-tag">AI ANALYSIS</span>}>
      <div className="flex flex-col gap-3">
        {changes.map((c) => (
          <div key={c.id} className="rounded-lg border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="truncate text-[11px] text-[var(--fg-text-faint)]">{c.page_url} · {c.field}</span>
              <div className="flex items-center gap-2">
                {c.applied_at ? (
                  <StatusPill status="online" label="live on site" />
                ) : c.approval_status ? (
                  <StatusPill status={c.approval_status === "approved" ? "warn" : "error"} label={c.approval_status === "approved" ? "approved, not live" : "rejected"} />
                ) : (
                  <div className="flex gap-2">
                    <button className="fg-btn" onClick={() => decideChange(c.id, "approved")} disabled={deciding === c.id}>
                      <ThumbsUp size={12} /> Approve
                    </button>
                    <button className="fg-btn fg-btn--danger" onClick={() => decideChange(c.id, "rejected")} disabled={deciding === c.id}>
                      <ThumbsDown size={12} /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <div className="fg-field-label">Current</div>
                <div className="text-xs text-[var(--fg-text-faint)] line-through">{c.before_value || "(empty)"}</div>
              </div>
              <div>
                <div className="fg-field-label">Proposed</div>
                <div className="text-xs text-[var(--fg-text)]">{c.after_value}</div>
              </div>
            </div>
            {c.reason ? <p className="mt-2 text-[11px] text-[var(--fg-text-dim)]">{c.reason}</p> : null}
            {c.field === "h1" ? <p className="mt-2 text-[10px] text-[var(--fg-text-faint)]">H1 changes touch page content — apply this one manually, it's not auto-published.</p> : null}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function SchemaPanel({ findings }: { findings: SchemaFinding[] }) {
  if (findings.length === 0) return null;
  return (
    <Panel id="schema-proposals" title="Schema Proposals" right={<span className="fg-metric-tag">REAL FIELDS ONLY — no fabricated ratings/reviews</span>}>
      <div className="fg-scroll flex flex-col gap-2 overflow-x-auto">
        {findings.map((f) => (
          <details key={f.id} className="rounded-lg border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] p-3">
            <summary className="cursor-pointer text-xs font-semibold text-[var(--fg-text)]">{f.schema_type}</summary>
            <pre className="mt-2 overflow-x-auto text-[10px] text-[var(--fg-text-dim)]">{JSON.stringify(JSON.parse(f.proposed_json), null, 2)}</pre>
          </details>
        ))}
      </div>
    </Panel>
  );
}

function TrafficPanel({ audiences, channels }: { audiences: Audience[]; channels: Channel[] }) {
  if (audiences.length === 0 && channels.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {audiences.length > 0 ? (
        <Panel id="audiences" title="Audience Segments" right={<span className="fg-metric-tag">AI ANALYSIS</span>}>
          <div className="flex flex-col gap-2">
            {audiences.map((a) => (
              <div key={a.id} className="rounded-lg border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] p-3">
                <div className="text-xs font-bold text-[var(--fg-text)]">{a.label}</div>
                <div className="mt-1 text-[11px] text-[var(--fg-text-dim)]">{a.description}</div>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
      {channels.length > 0 ? (
        <Panel id="channels" title="Organic Channels" right={<span className="fg-metric-tag">AI RECOMMENDATION — no ads</span>}>
          <div className="flex flex-col gap-2">
            {channels.map((c) => (
              <div key={c.id} className="flex items-start gap-3 rounded-lg border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] p-3">
                <StatusPill status={c.enabled ? "online" : "idle"} label={c.enabled ? "relevant" : "not relevant"} />
                <div>
                  <div className="text-xs font-bold text-[var(--fg-text)]">{c.name}</div>
                  <div className="mt-1 text-[11px] text-[var(--fg-text-dim)]">{c.relevance_reason}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function CompetitorsPanel({ competitors }: { competitors: Competitor[] }) {
  if (competitors.length === 0) return null;
  return (
    <Panel id="competitors" title="Competitors Seen in Real Search Results" right={<span className="fg-metric-tag">REAL DATA</span>}>
      <div className="flex flex-wrap gap-2">
        {competitors.map((c) => (
          <span key={c.id} className="rounded-full border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] px-3 py-1 text-[11px] text-[var(--fg-text)]">
            {c.domain}
          </span>
        ))}
      </div>
    </Panel>
  );
}

function ContentOpportunitiesPanel({ opportunities }: { opportunities: ContentOpportunity[] }) {
  if (opportunities.length === 0) return null;
  return (
    <Panel id="content-opportunities" title="Content Opportunities" right={<span className="fg-metric-tag">AI ANALYSIS — from real keyword gaps</span>}>
      <div className="flex flex-col gap-2">
        {opportunities.map((o) => (
          <div key={o.id} className="rounded-lg border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--fg-text)]">{o.title}</span>
              {o.proposed_url ? <span className="font-mono text-[10px] text-[var(--fg-text-faint)]">{o.proposed_url}</span> : null}
            </div>
            {o.business_relevance ? <p className="mt-1 text-[11px] text-[var(--fg-text-dim)]">{o.business_relevance}</p> : null}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ContentAssetsPanel({ assets }: { assets: ContentAsset[] }) {
  if (assets.length === 0) return null;
  return (
    <Panel id="content-drafts" title="Content Drafts" right={<span className="fg-metric-tag">AI ANALYSIS — nothing published yet</span>}>
      <div className="flex flex-col gap-2">
        {assets.map((a) => (
          <details key={a.id} className="rounded-lg border border-[var(--fg-border)] bg-[var(--fg-panel-raised)] p-3">
            <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-[var(--fg-text)]">
              {a.channel} <span className="fg-metric-tag">{a.format}</span>
              <StatusPill status={a.status === "qa_passed" ? "online" : a.status === "qa_flagged" ? "error" : "idle"} label={a.status} />
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-[11px] text-[var(--fg-text-dim)]">{a.body}</pre>
          </details>
        ))}
      </div>
    </Panel>
  );
}

// ---------- top-level ----------

export function GrowthMissionPanel({ clientId, siteId }: { clientId: string; siteId: string }) {
  const [growth, setGrowth] = useState<GrowthData | null>(null);

  const loadGrowth = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}/growth`);
    if (res.ok) setGrowth(await res.json());
  }, [clientId]);

  useEffect(() => { loadGrowth(); }, [loadGrowth]);

  return (
    <div className="flex flex-col gap-4">
      <ProtocolPipeline clientId={clientId} growth={growth} onAdvance={loadGrowth} />
      {growth?.crawl ? <WebsiteMapPanel crawl={growth.crawl} pages={growth.pages} /> : null}
      {growth?.profile ? <BusinessProfilePanel profile={growth.profile} /> : null}
      {growth ? <TechnicalFindingsPanel findings={growth.technicalFindings} /> : null}
      {growth ? <KeywordsPanel clusters={growth.keywordClusters} keywords={growth.keywords} /> : null}
      {growth ? <CompetitorsPanel competitors={growth.competitors} /> : null}
      <SeoChangesPanel siteId={siteId} />
      {growth ? <SchemaPanel findings={growth.schemaFindings} /> : null}
      {growth ? <TrafficPanel audiences={growth.audiences} channels={growth.channels} /> : null}
      {growth ? <ContentOpportunitiesPanel opportunities={growth.contentOpportunities} /> : null}
      {growth ? <ContentAssetsPanel assets={growth.contentAssets} /> : null}
    </div>
  );
}
