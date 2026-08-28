import PDFDocument from "pdfkit";
import type { ClientReportData } from "./report";

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "#b91c1c",
  HIGH: "#c2410c",
  MEDIUM: "#a16207",
  LOW: "#57606a",
};

const PAGE_WIDTH = 545;

// Renders the same findings/proposals already visible in the app into a
// portable PDF — pure presentation, no new analysis happens here.
export function renderClientReportPdf(data: ClientReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4", bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const { client, findings, schemaProposals, pendingChanges, contentOpportunities } = data;

    doc.fontSize(18).fillColor("#111").text("Frontage Growth — SEO Findings Report");
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor("#444").text(`${client.name}${client.business_name ? ` (${client.business_name})` : ""}`);
    doc.fontSize(10).fillColor("#666").text(client.site?.url ?? "");
    doc.fontSize(9).fillColor("#888").text(`Generated ${new Date(data.generatedAt).toLocaleString()}`);

    function sectionHeader(title: string, count: number) {
      doc.moveDown(1);
      doc.fontSize(13).fillColor("#111").text(`${title} (${count})`);
      const y = doc.y + 2;
      doc.moveTo(50, y).lineTo(PAGE_WIDTH, y).strokeColor("#ddd").lineWidth(1).stroke();
      doc.moveDown(0.5);
    }

    function emptyLine(text: string) {
      doc.fontSize(10).fillColor("#888").text(text);
    }

    sectionHeader("Findings — what needs fixing", findings.length);
    if (findings.length === 0) emptyLine("No open findings.");
    for (const f of findings) {
      doc.fontSize(10).fillColor(SEVERITY_COLOR[f.severity] ?? "#333").text(`[${f.severity}] [${f.category}] ${f.finding}`);
      if (f.url) doc.fontSize(8).fillColor("#888").text(f.url);
      doc.moveDown(0.35);
    }

    sectionHeader("Proposed structured data (schema)", schemaProposals.length);
    if (schemaProposals.length === 0) emptyLine("No schema proposals pending.");
    for (const s of schemaProposals) {
      doc.fontSize(10).fillColor("#111").text(`${s.schemaType} schema proposed`);
      doc.fontSize(8).fillColor("#888").text(s.url);
      doc.moveDown(0.35);
    }

    sectionHeader("Pending on-page changes (awaiting approval)", pendingChanges.length);
    if (pendingChanges.length === 0) emptyLine("None pending.");
    for (const c of pendingChanges) {
      doc.fontSize(10).fillColor("#111").text(`${c.field}: "${c.before ?? "(empty)"}" -> "${c.after ?? "(empty)"}"`);
      doc.fontSize(8).fillColor("#888").text(c.url);
      doc.moveDown(0.35);
    }

    sectionHeader("Content opportunities", contentOpportunities.length);
    if (contentOpportunities.length === 0) emptyLine("None proposed.");
    for (const o of contentOpportunities) {
      doc.fontSize(10).fillColor("#111").text(o.title);
      if (o.opportunity) doc.fontSize(9).fillColor("#555").text(o.opportunity);
      if (o.url) doc.fontSize(8).fillColor("#888").text(o.url);
      doc.moveDown(0.35);
    }

    doc.end();
  });
}
