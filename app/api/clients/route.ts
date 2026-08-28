import { NextResponse } from "next/server";
import { listClients, createClient } from "@/lib/db/clients";

export async function GET() {
  return NextResponse.json({ clients: listClients() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const websiteUrl = typeof body.websiteUrl === "string" ? body.websiteUrl.trim() : "";
  if (!name) return NextResponse.json({ error: "Client name is required." }, { status: 400 });
  if (!websiteUrl) return NextResponse.json({ error: "Website URL is required." }, { status: 400 });

  const client = createClient({
    name,
    websiteUrl,
    businessName: typeof body.businessName === "string" ? body.businessName.trim() : undefined,
    primaryLocation: typeof body.primaryLocation === "string" ? body.primaryLocation.trim() : undefined,
    notes: typeof body.notes === "string" ? body.notes.trim() : undefined,
  });
  return NextResponse.json({ client }, { status: 201 });
}
