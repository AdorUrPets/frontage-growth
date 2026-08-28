// A "protocol" is a named, human-gated phase of the growth mission. Each
// protocol runs its agents in order, then the mission stops and waits for
// an explicit approval before the next protocol can be started. Nothing
// after the first protocol runs automatically — see lib/missions/runner.ts.

export interface ProtocolDefinition {
  code: string;
  label: string;
  description: string;
  agentCodes: string[];
}

export const PROTOCOL_SEQUENCE: ProtocolDefinition[] = [
  {
    code: "seo",
    label: "SEO",
    description: "Recon, business understanding, real keyword research, SERP gap analysis, technical + local audit, on-page proposals and schema — all free, no ad spend.",
    agentCodes: [
      "site_recon",
      "business_understanding",
      "search_intelligence",
      "keyword_research",
      "serp_analysis",
      "technical_seo",
      "local_seo",
      "onpage_seo",
      "schema_agent",
    ],
  },
  {
    code: "traffic",
    label: "Traffic",
    description: "Who the real customers are and which organic channels are actually worth the client's time.",
    agentCodes: ["audience_discovery", "traffic_strategist"],
  },
  {
    code: "content",
    label: "Content",
    description: "Real content gaps (from the keywords already researched), full drafts, QA, and channel-specific distribution for whatever channels Traffic marked relevant.",
    agentCodes: ["content_opportunity", "seo_writer", "seo_qa", "content_distribution"],
  },
];

export function getProtocol(code: string): ProtocolDefinition | undefined {
  return PROTOCOL_SEQUENCE.find((p) => p.code === code);
}

export function nextProtocolAfter(code: string | null): ProtocolDefinition | null {
  if (!code) return PROTOCOL_SEQUENCE[0];
  const i = PROTOCOL_SEQUENCE.findIndex((p) => p.code === code);
  if (i === -1 || i === PROTOCOL_SEQUENCE.length - 1) return null;
  return PROTOCOL_SEQUENCE[i + 1];
}
