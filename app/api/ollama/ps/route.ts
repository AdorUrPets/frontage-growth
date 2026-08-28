import { NextResponse } from "next/server";
import { getOllamaRunningModels } from "@/lib/ai/providers/ollama";

export async function GET() {
  const result = await getOllamaRunningModels();
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error, models: [] });
  return NextResponse.json({ ok: true, models: result.models });
}
