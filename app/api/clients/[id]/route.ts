import { NextRequest, NextResponse } from "next/server";
import { getClient, updateClient, deleteClient } from "@/lib/db/clients";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = getClient(id);
  if (!client) return NextResponse.json({ error: "Client not found." }, { status: 404 });
  return NextResponse.json({ client });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = getClient(id);
  if (!existing) return NextResponse.json({ error: "Client not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  if (name !== undefined && name.length === 0) {
    return NextResponse.json({ error: "Client name cannot be empty." }, { status: 400 });
  }
  const websiteUrl = typeof body.websiteUrl === "string" ? body.websiteUrl.trim() : undefined;
  if (websiteUrl !== undefined && websiteUrl.length === 0) {
    return NextResponse.json({ error: "Website URL cannot be empty." }, { status: 400 });
  }

  const client = updateClient(id, {
    name,
    websiteUrl,
    businessName: typeof body.businessName === "string" ? body.businessName.trim() : body.businessName === null ? null : undefined,
    primaryLocation:
      typeof body.primaryLocation === "string" ? body.primaryLocation.trim() : body.primaryLocation === null ? null : undefined,
    notes: typeof body.notes === "string" ? body.notes.trim() : body.notes === null ? null : undefined,
    repoLocalPath:
      typeof body.repoLocalPath === "string" ? body.repoLocalPath.trim() : body.repoLocalPath === null ? null : undefined,
  });
  return NextResponse.json({ client });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = getClient(id);
  if (!existing) return NextResponse.json({ error: "Client not found." }, { status: 404 });
  deleteClient(id);
  return NextResponse.json({ ok: true });
}
