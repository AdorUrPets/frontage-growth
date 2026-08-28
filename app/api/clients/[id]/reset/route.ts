import { NextRequest, NextResponse } from "next/server";
import { clearGrowthData } from "@/lib/db/clients";

// Wipes all reports/findings for this client's site so it can be rescanned
// from scratch. See lib/db/clients.ts#clearGrowthData for exactly what is
// and isn't cleared.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = clearGrowthData(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 404 });
}
