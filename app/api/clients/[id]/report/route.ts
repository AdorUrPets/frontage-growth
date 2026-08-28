import { NextRequest, NextResponse } from "next/server";
import { buildClientReportData } from "@/lib/reports/report";
import { renderClientReportPdf } from "@/lib/reports/pdf";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = buildClientReportData(id);
  if (!data) {
    return NextResponse.json({ error: "Client not found or has no site on file." }, { status: 404 });
  }

  const pdf = await renderClientReportPdf(data);
  const filename = `${data.client.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-seo-report.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
