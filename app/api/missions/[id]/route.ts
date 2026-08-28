import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const mission = db.prepare(`SELECT * FROM missions WHERE id = ?`).get(id);
  if (!mission) return NextResponse.json({ error: "Mission not found." }, { status: 404 });

  const steps = db
    .prepare(
      `SELECT ms.*, a.name as agent_name, a.code as agent_code
       FROM mission_steps ms LEFT JOIN agents a ON a.id = ms.agent_id
       WHERE ms.mission_id = ? ORDER BY ms.step_order ASC`
    )
    .all(id);

  const runs = db
    .prepare(
      `SELECT ar.* FROM agent_runs ar
       WHERE ar.mission_step_id IN (SELECT id FROM mission_steps WHERE mission_id = ?)`
    )
    .all(id);

  return NextResponse.json({ mission, steps, runs });
}
