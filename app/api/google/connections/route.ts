import { NextRequest, NextResponse } from "next/server";
import { listGoogleConnections, deleteGoogleConnection } from "@/lib/db/googleAuth";

export async function GET() {
  return NextResponse.json({ connections: listGoogleConnections() });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  deleteGoogleConnection(id);
  return NextResponse.json({ ok: true });
}
