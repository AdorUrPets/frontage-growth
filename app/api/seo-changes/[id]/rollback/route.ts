import { NextRequest, NextResponse } from "next/server";
import { rollbackSeoChange } from "@/lib/agents/seoPublisher";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await rollbackSeoChange(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
