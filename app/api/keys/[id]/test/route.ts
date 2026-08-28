import { NextRequest, NextResponse } from "next/server";
import { testDecryptKey, setKeyStatus, recordKeySuccess, recordKeyFailure } from "@/lib/db/keys";
import { getDb } from "@/lib/db/client";
import { testProviderKey } from "@/lib/ai/test";
import type { ApiKeyRow } from "@/lib/types";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = getDb().prepare(`SELECT * FROM api_keys WHERE id = ?`).get(id) as ApiKeyRow | undefined;
  if (!row) return NextResponse.json({ error: "Key not found." }, { status: 404 });

  setKeyStatus(id, "busy");
  const value = testDecryptKey(id);
  const result = await testProviderKey(row.provider_code, value);

  if (result.ok) {
    recordKeySuccess(id);
  } else {
    recordKeyFailure(id, "error", null);
  }

  return NextResponse.json({ ok: result.ok, error: result.error });
}
