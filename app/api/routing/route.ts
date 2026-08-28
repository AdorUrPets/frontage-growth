import { NextResponse } from "next/server";
import { listRoutingRules, setRoutingChain } from "@/lib/db/providers";

export async function GET() {
  return NextResponse.json({ rules: listRoutingRules() });
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const taskType = typeof body.taskType === "string" ? body.taskType : "";
  const chain = Array.isArray(body.chain) ? body.chain : null;
  if (!taskType || !chain) {
    return NextResponse.json({ error: "taskType and chain[] are required." }, { status: 400 });
  }
  setRoutingChain(taskType, chain);
  return NextResponse.json({ ok: true });
}
