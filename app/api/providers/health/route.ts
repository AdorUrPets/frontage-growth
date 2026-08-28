import { NextResponse } from "next/server";
import { listProviderHealth, usageSummary } from "@/lib/db/providers";
import { refreshAllProviderHealth } from "@/lib/ai/health";

export async function GET() {
  const { ollama } = await refreshAllProviderHealth();
  return NextResponse.json({
    providers: listProviderHealth(),
    usage: usageSummary(24),
    ollama,
  });
}
