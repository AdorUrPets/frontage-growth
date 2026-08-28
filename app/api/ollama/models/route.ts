import { NextResponse } from "next/server";
import { discoverOllamaModels } from "@/lib/ai/providers/ollama";
import { refreshProviderCounts } from "@/lib/db/providers";

export async function GET() {
  const result = await discoverOllamaModels();
  if (!result.ok) {
    refreshProviderCounts("ollama", 0, 0);
    return NextResponse.json({ ok: false, error: result.error, models: [] });
  }
  refreshProviderCounts("ollama", result.models.length, result.models.length);
  return NextResponse.json({ ok: true, models: result.models });
}
