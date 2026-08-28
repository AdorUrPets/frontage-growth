/**
 * ============================================================
 * SIMULATED PRESENTATION DATA — NOT PRODUCTION VALUES
 * ============================================================
 * Every value in this file is a demo figure used ONLY when the
 * matching real data source is not connected yet (empty DB, no
 * Search Console link, no missions run). The dashboard always
 * prefers real values; anything rendered from here carries a
 * `title` tooltip marking it as simulated.
 *
 * Figures deliberately mirror the approved reference design so a
 * fresh install previews the intended final look.
 */

export const DEMO_TOOLTIP = "Simulated preview value — connects to live data automatically once this source is wired up.";

/** 30-day KPI strip */
export const DEMO_KPIS = {
  managedSites: { value: "146", delta: "+12.4%", spark: [24, 28, 26, 32, 35, 33, 40, 44, 42, 49, 53, 58, 56, 62, 66] },
  seoHealth: { value: "92", suffix: "/100", delta: "+8.7%", spark: [40, 42, 45, 43, 48, 52, 50, 56, 58, 61, 60, 64, 67, 66, 70] },
  searchVisibility: { value: "68.3%", delta: "+15.6%", spark: [30, 34, 32, 38, 41, 39, 45, 44, 50, 53, 51, 57, 60, 63, 66] },
  organicTraffic: { value: "1.24M", delta: "+22.3%", spark: [22, 26, 30, 28, 35, 39, 37, 44, 48, 46, 54, 58, 62, 60, 68] },
  conversions: { value: "24,871", delta: "+18.9%", spark: [25, 28, 26, 33, 31, 38, 42, 40, 47, 45, 52, 56, 54, 61, 65] },
  activeMissions: { value: "38", delta: "+11", deltaSub: "in progress", spark: [30, 33, 31, 36, 40, 38, 43, 41, 47, 51, 49, 54, 58, 56, 62] },
};

/** Commander center readout */
export const DEMO_COMMANDER = {
  agentsActive: 142,
  tasksProcessing: 326,
  uptimeLabel: "7D 14H 32M",
};

/** Bottom analytics — 29 daily points (May 1 → May 29 shape from reference) */
export const DEMO_MONTH_LABELS = ["May 1", "May 8", "May 15", "May 22", "May 29"];

export const DEMO_TRAFFIC = {
  total: "1.24M",
  delta: "+22.3%",
  series: [420, 445, 430, 470, 495, 520, 505, 548, 570, 555, 600, 632, 615, 660, 690, 672, 718, 745, 730, 780, 812, 795, 845, 880, 862, 915, 950, 995, 1040],
  yLabels: ["1.5M", "1.0M", "500K", "0"],
};

export const DEMO_VISIBILITY = {
  total: "68.3%",
  delta: "+15.6%",
  series: [38, 40, 39, 43, 45, 44, 47, 50, 48, 52, 54, 53, 56, 58, 57, 60, 59, 62, 64, 63, 65, 64, 66, 67, 66, 68, 67, 68, 68.3],
  yLabels: ["100%", "75%", "50%", "25%", "0%"],
};

export const DEMO_CONVERSIONS = {
  total: "24,871",
  delta: "+18.9%",
  series: [9.2, 9.8, 9.5, 10.4, 11.0, 10.6, 11.5, 12.2, 11.8, 12.8, 13.4, 13.0, 14.1, 14.8, 14.3, 15.5, 15.0, 16.2, 17.0, 16.5, 17.8, 17.2, 18.6, 19.4, 18.9, 20.5, 21.4, 22.8, 24.9],
  yLabels: ["30K", "20K", "10K", "0"],
};

/** Traffic-by-channel donut */
export const DEMO_CHANNELS = {
  centerValue: "1.24M",
  centerLabel: "Total",
  segments: [
    { label: "Organic Search", pct: 68.3, color: "var(--fg-cyan)" },
    { label: "Direct", pct: 18.7, color: "var(--fg-blue)" },
    { label: "Referral", pct: 7.6, color: "var(--fg-violet)" },
    { label: "Social", pct: 4.2, color: "var(--fg-amber)" },
    { label: "Other", pct: 1.2, color: "var(--fg-text-faint)" },
  ],
};

/** Right rail — provider pool preview when no keys are configured */
export const DEMO_PROVIDER_SUB: Record<string, { pct: number; note: string }> = {
  ollama: { pct: 96, note: "12 MODELS ACTIVE" },
  gemini: { pct: 94, note: "8 MODELS ACTIVE" },
  openrouter: { pct: 92, note: "14 MODELS ACTIVE" },
  serpapi: { pct: 98, note: "1.2M QUERIES TODAY" },
};

/** Approvals queue preview rows */
export const DEMO_APPROVALS = [
  { id: "demo-appr-1", title: "Content Brief: Best CRM Platforms", priority: "high" as const, when: "5m ago" },
  { id: "demo-appr-2", title: "New Page: /ai-automation-tools", priority: "medium" as const, when: "12m ago" },
  { id: "demo-appr-3", title: "Schema Update: Product", priority: "medium" as const, when: "18m ago" },
];

/** Mission details preview */
export const DEMO_MISSION = {
  label: "Enterprise SEO Scale-Up",
  clientName: "Global Finance Co.",
  progressPct: 68,
  tasksDone: 142,
  tasksTotal: 210,
  eta: "2h 45m",
};

/** Recent mission activity preview rows */
export const DEMO_ACTIVITY = [
  { id: "demo-act-1", agentName: "Content Opportunity Agent", description: "Discovered 12 new content opportunities", when: "2m ago", tone: "blue" },
  { id: "demo-act-2", agentName: "Technical SEO Agent", description: "Crawled 1,248 pages", when: "3m ago", tone: "cyan" },
  { id: "demo-act-3", agentName: "SEO Publisher", description: "Published 4 new pages", when: "5m ago", tone: "green" },
  { id: "demo-act-4", agentName: "Performance Analyst", description: "Traffic anomaly detected", when: "7m ago", tone: "amber" },
];
