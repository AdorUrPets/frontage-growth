/**
 * Per-agent role copy for the agent detail pages.
 *
 * This is authored documentation of what each agent's implementation in
 * `lib/agents/` actually does — `role` restates its job, `why` explains why
 * that job exists in the pipeline, and `produces` names the real table(s) it
 * writes (verified against the INSERT statements in each module). It is
 * descriptive copy only: every number, status and log entry rendered on the
 * page comes from the live `agents` / `agent_runs` tables, never from here.
 */
export interface AgentProfile {
  role: string;
  why: string;
  produces: string;
  gated: boolean; // sits inside the human-approved protocol sequence
}

export const AGENT_PROFILES: Record<string, AgentProfile> = {
  growth_commander: {
    role: "Reads everything the specialists have stored for a client and synthesizes a ranked list of next-best actions, each tied to the evidence behind it.",
    why: "Nineteen agents produce a lot of separate findings. Without a coordinator you get a pile of data and no decision. This turns stored evidence into an ordered plan you can act on.",
    produces: "Next-best-action list (returned per run, not persisted to its own table)",
    gated: false,
  },
  site_recon: {
    role: "Crawls the client's site — sitemap first, including sitemap indexes — and records every page with its title, meta, status code, page type and real extracted price.",
    why: "Every other SEO agent reasons about pages it can actually see. If recon misses pages, everything downstream silently works from an incomplete picture of the site.",
    produces: "crawls, crawl_pages, pages",
    gated: true,
  },
  business_understanding: {
    role: "Reads the crawled pages and derives the business profile: industry, services, service area, likely customers and primary/secondary conversions.",
    why: "SEO advice that ignores what the business actually sells is generic. This grounds every later agent in what this specific business does and who buys from it.",
    produces: "business_profiles",
    gated: true,
  },
  search_intelligence: {
    role: "Runs live Google searches through SerpApi for the client's real search environment and stores the actual result sets.",
    why: "Keyword work built on guesses is worthless. This is the agent that touches real search data, so later keyword and gap analysis is grounded in what Google actually returns.",
    produces: "keywords, serp_results",
    gated: true,
  },
  keyword_research: {
    role: "Groups the real search results into keyword clusters with intent, priority and the evidence behind each choice.",
    why: "Raw keywords are noise until they're grouped by what the searcher actually wants. Clusters are what content and on-page work get planned against.",
    produces: "keyword_clusters",
    gated: true,
  },
  serp_analysis: {
    role: "Inspects who ranks in the real result sets and records the competing domains showing up for the client's terms.",
    why: "Tells you who you are actually competing with in search — which is often not who the client thinks their competitors are.",
    produces: "competitors",
    gated: true,
  },
  technical_seo: {
    role: "Audits crawlability, indexability, duplicate titles and metadata, HTTPS, sitemap health and markup problems across every crawled page.",
    why: "Technical faults cap everything else. There is no point optimising copy on pages Google cannot crawl, index or tell apart.",
    produces: "technical_findings",
    gated: true,
  },
  onpage_seo: {
    role: "Proposes improved titles and meta descriptions for every crawled page, processing the full set in batches rather than a sample.",
    why: "This is where most real ranking and click-through movement comes from. Proposals stay as proposals until you approve them — nothing edits the live site here.",
    produces: "seo_changes (pending your approval)",
    gated: true,
  },
  schema_agent: {
    role: "Builds structured-data proposals from real page facts only — including genuine extracted product prices.",
    why: "Schema drives rich results, but invented ratings or reviews are a manual-action risk. This only emits fields backed by something actually on the page.",
    produces: "schema_findings",
    gated: true,
  },
  local_seo: {
    role: "Checks local-business signals: NAP consistency, service area coverage, local landing pages and local structured data.",
    why: "For a business serving a physical area, local signals decide whether it appears in the searches that actually convert. Skips cleanly when the client isn't a local business.",
    produces: "technical_findings (category: local)",
    gated: true,
  },
  content_opportunity: {
    role: "Identifies genuinely missing pages that real search demand supports, with the business relevance for each.",
    why: "Stops content plans from becoming filler. Every opportunity has to trace back to demand seen in real search data and to what the business actually sells.",
    produces: "content_opportunities",
    gated: true,
  },
  seo_writer: {
    role: "Drafts approved content opportunities end to end.",
    why: "Turns an approved opportunity into an actual draft. Output is a draft for review — it is never published automatically.",
    produces: "content_assets",
    gated: true,
  },
  seo_qa: {
    role: "Reviews drafts for factual accuracy, SEO problems, duplication, grammar, location correctness, intent match and brand fit before anything reaches you.",
    why: "The last automated check before a human sees a draft. Catches the failure modes that make AI content obviously AI content.",
    produces: "QA verdict on each draft (flags the asset's status)",
    gated: true,
  },
  audience_discovery: {
    role: "Determines who the client's real customers are and which segments are worth pursuing.",
    why: "Channel and content decisions are guesses until you know who you're targeting. This defines the segments the traffic work is aimed at.",
    produces: "audiences",
    gated: true,
  },
  traffic_strategist: {
    role: "Evaluates which organic channels are genuinely relevant for this business and explains the reasoning per channel.",
    why: "Most businesses do not belong on most channels. This rules channels in or out with a reason rather than defaulting to 'post everywhere'.",
    produces: "channels",
    gated: true,
  },
  content_distribution: {
    role: "Adapts an approved piece of content into channel-specific formats for the channels marked relevant.",
    why: "One asset should not be posted identically everywhere. Drafts per channel — publishing to social is not wired up, so these stay drafts.",
    produces: "content_assets (channel drafts)",
    gated: true,
  },
  conversion_agent: {
    role: "Analyses recorded conversion events against traffic to find friction and opportunity.",
    why: "Rankings that don't convert aren't growth. Reports honestly that it has nothing to measure until real conversion events are being recorded.",
    produces: "Conversion analysis (reads the conversions table)",
    gated: false,
  },
  performance_analyst: {
    role: "Tracks real measurable outcomes over time from synced Search Console data — clicks, impressions, CTR and average position per query.",
    why: "Closes the loop: proves whether the changes you approved actually moved anything. Says so plainly when Search Console isn't connected rather than estimating.",
    produces: "Performance report (reads search_console_snapshots)",
    gated: false,
  },
};
