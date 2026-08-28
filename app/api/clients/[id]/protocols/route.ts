import { NextRequest, NextResponse } from "next/server";
import { startProtocol } from "@/lib/missions/runner";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const protocol = typeof body.protocol === "string" ? body.protocol : "";
  if (!protocol) return NextResponse.json({ error: "protocol is required." }, { status: 400 });

  try {
    const missionId = startProtocol(id, protocol);
    return NextResponse.json({ missionId }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to start protocol." }, { status: 400 });
  }
}
