import {
  Radar,
  Building2,
  Search,
  Hash,
  ListOrdered,
  Wrench,
  MapPin,
  FileText,
  Braces,
  Users,
  Route,
  Lightbulb,
  PenTool,
  CheckSquare,
  Share2,
  Target,
  LineChart,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";

/**
 * Cosmetic-only mapping for the Growth Commander network: icon, which side
 * of the hub an agent renders on, its position in the reference layout,
 * the verb shown while working, and its connector accent. Every live field
 * on a node (name, status, runtime, last activity) comes from the real
 * `agents`/`agent_runs` tables, never from here. growth_commander itself
 * isn't listed — it's the center hub.
 */
export interface AgentMeta {
  icon: LucideIcon;
  side: "left" | "right";
  order: number;
  verb: string;
  accent: string; // CSS color value for glow/connector identity
  /**
   * Anchor id of the client-page panel that renders this agent's real
   * output, so clicking a node on the network jumps straight to its work.
   * Must match an `id` passed to <Panel> in GrowthMissionPanel /
   * StandaloneAgents.
   */
  anchor: string;
}

export const AGENT_META: Record<string, AgentMeta> = {
  // left wing — recon & technical (blue / violet / indigo)
  site_recon: { icon: Radar, side: "left", order: 1, verb: "Scanning", accent: "var(--fg-blue)", anchor: "website-map" },
  business_understanding: { icon: Building2, side: "left", order: 2, verb: "Analyzing", accent: "var(--fg-violet)", anchor: "business-profile" },
  search_intelligence: { icon: Search, side: "left", order: 3, verb: "Monitoring", accent: "var(--fg-blue)", anchor: "competitors" },
  keyword_research: { icon: Hash, side: "left", order: 4, verb: "Researching", accent: "var(--fg-violet)", anchor: "keywords" },
  serp_analysis: { icon: ListOrdered, side: "left", order: 5, verb: "Analyzing", accent: "var(--fg-blue)", anchor: "competitors" },
  technical_seo: { icon: Wrench, side: "left", order: 6, verb: "Auditing", accent: "var(--fg-violet)", anchor: "technical-findings" },
  onpage_seo: { icon: FileText, side: "left", order: 7, verb: "Optimizing", accent: "var(--fg-blue)", anchor: "seo-proposals" },
  schema_agent: { icon: Braces, side: "left", order: 8, verb: "Validating", accent: "var(--fg-violet)", anchor: "schema-proposals" },
  // local_seo writes technical_findings rows with category 'local'
  local_seo: { icon: MapPin, side: "left", order: 9, verb: "Tracking", accent: "var(--fg-blue)", anchor: "technical-findings" },

  // right wing — content & growth (cyan / teal / green)
  content_opportunity: { icon: Lightbulb, side: "right", order: 1, verb: "Discovering", accent: "var(--fg-cyan)", anchor: "content-opportunities" },
  seo_writer: { icon: PenTool, side: "right", order: 2, verb: "Writing", accent: "var(--fg-teal)", anchor: "content-drafts" },
  seo_qa: { icon: CheckSquare, side: "right", order: 3, verb: "Reviewing", accent: "var(--fg-cyan)", anchor: "content-drafts" },
  seo_publisher: { icon: UploadCloud, side: "right", order: 4, verb: "Publishing", accent: "var(--fg-green)", anchor: "seo-proposals" },
  audience_discovery: { icon: Users, side: "right", order: 5, verb: "Analyzing", accent: "var(--fg-teal)", anchor: "audiences" },
  traffic_strategist: { icon: Route, side: "right", order: 6, verb: "Planning", accent: "var(--fg-cyan)", anchor: "channels" },
  content_distribution: { icon: Share2, side: "right", order: 7, verb: "Distributing", accent: "var(--fg-green)", anchor: "content-drafts" },
  conversion_agent: { icon: Target, side: "right", order: 8, verb: "Optimizing", accent: "var(--fg-teal)", anchor: "agent-conversion_agent" },
  performance_analyst: { icon: LineChart, side: "right", order: 9, verb: "Analyzing", accent: "var(--fg-cyan)", anchor: "agent-performance_analyst" },
};
