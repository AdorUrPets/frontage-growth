import { NextRequest, NextResponse } from "next/server";
import { runStandaloneAgent } from "@/lib/missions/runner";
import { getDb } from "@/lib/db/client";

const STANDALONE_AGENTS = new Set(["growth_commander", "conversion_agent", "performance_analyst", "email_dns_health"]);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; code: string }> }) {
  const { id, code } = await params;
  const db = getDb();
  const site = db.prepare(`SELECT id FROM sites WHERE client_id = ? ORDER BY created_at ASC LIMIT 1`).get(id) as { id: string } | undefined;
  if (!site) return NextResponse.json({ run: null });

  const run = db
    .prepare(
      `SELECT ar.* FROM agent_runs ar JOIN agents a ON a.id = ar.agent_id
       WHERE a.code = ? AND ar.site_id = ? ORDER BY ar.created_at DESC LIMIT 1`
    )
    .get(code, site.id);
  return NextResponse.json({ run: run ?? null });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; code: string }> }) {
  const { id, code } = await params;
  if (!STANDALONE_AGENTS.has(code)) {
    return NextResponse.json({ error: `"${code}" is not a standalone agent.` }, { status: 400 });
  }
  try {
    const outcome = await runStandaloneAgent(code, id);
    return NextResponse.json(outcome, { status: outcome.ok ? 200 : 502 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Agent run failed." }, { status: 400 });
  }
}
