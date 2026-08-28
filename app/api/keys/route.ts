import { NextResponse } from "next/server";
import { listKeys, addKey } from "@/lib/db/keys";
import type { ProviderCode } from "@/lib/types";

const VALID_PROVIDERS: ProviderCode[] = ["gemini", "openrouter", "serpapi"];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider") as ProviderCode | null;
  if (!provider || !VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Valid ?provider= is required." }, { status: 400 });
  }
  return NextResponse.json({ keys: listKeys(provider) });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const provider = body.provider as ProviderCode;
  const value = typeof body.value === "string" ? body.value.trim() : "";
  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "provider must be one of gemini, openrouter, serpapi." }, { status: 400 });
  }
  if (value.length < 8) {
    return NextResponse.json({ error: "Key value looks too short." }, { status: 400 });
  }
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : undefined;
  const key = addKey(provider, value, label);
  return NextResponse.json({ key }, { status: 201 });
}
