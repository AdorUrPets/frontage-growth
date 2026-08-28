import crypto from "crypto";
import { getDb } from "./client";
import type { SiteRow } from "../types";

// Per-site bearer token for the Growth Agent pull API — a live client site
// (not necessarily Shopify) presents this to fetch its own currently-approved
// SEO overrides. Stored as a hash only (like a GitHub personal access token):
// the raw token is shown exactly once at generation and is never retrievable
// again, and verification is a hash lookup rather than a decrypt.
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateGrowthAgentToken(siteId: string): string {
  const token = `fg_live_${crypto.randomBytes(32).toString("hex")}`;
  getDb()
    .prepare(`UPDATE sites SET growth_agent_token_hash = ?, growth_agent_token_created_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`)
    .run(hashToken(token), siteId);
  return token;
}

export function revokeGrowthAgentToken(siteId: string): void {
  getDb()
    .prepare(`UPDATE sites SET growth_agent_token_hash = NULL, growth_agent_token_created_at = NULL, updated_at = datetime('now') WHERE id = ?`)
    .run(siteId);
}

export interface GrowthAgentStatus {
  issued: boolean;
  issuedAt: string | null;
}

export function getGrowthAgentStatus(siteId: string): GrowthAgentStatus {
  const row = getDb().prepare(`SELECT growth_agent_token_hash, growth_agent_token_created_at FROM sites WHERE id = ?`).get(siteId) as
    | { growth_agent_token_hash: string | null; growth_agent_token_created_at: string | null }
    | undefined;
  return { issued: !!row?.growth_agent_token_hash, issuedAt: row?.growth_agent_token_created_at ?? null };
}

export function verifyGrowthAgentToken(token: string): SiteRow | null {
  if (!token) return null;
  const site = getDb().prepare(`SELECT * FROM sites WHERE growth_agent_token_hash = ?`).get(hashToken(token)) as SiteRow | undefined;
  return site ?? null;
}
