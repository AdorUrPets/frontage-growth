import { NextRequest, NextResponse } from "next/server";
import { removeKey, setKeyEnabled, setKeyPriority, renameKey } from "@/lib/db/keys";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (typeof body.enabled === "boolean") setKeyEnabled(id, body.enabled);
  if (typeof body.priority === "number") setKeyPriority(id, body.priority);
  if (typeof body.label === "string") renameKey(id, body.label.trim());

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  removeKey(id);
  return NextResponse.json({ ok: true });
}
