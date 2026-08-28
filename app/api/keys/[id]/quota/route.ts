import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { testDecryptKey } from "@/lib/db/keys";
import { getProviderQuota } from "@/lib/ai/test";
import type { ApiKeyRow } from "@/lib/types";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = getDb().prepare(`SELECT * FROM api_keys WHERE id = ?`).get(id) as ApiKeyRow | undefined;
  if (!row) return NextResponse.json({ error: "Key not found." }, { status: 404 });

  const value = testDecryptKey(id);
  const quota = await getProviderQuota(row.provider_code, value);
  return NextResponse.json(quota);
}
