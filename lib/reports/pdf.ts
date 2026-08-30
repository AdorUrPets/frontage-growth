import fs from "node:fs";
import PDFDocument from "pdfkit";
import type { ClientReportData, ReportFinding } from "./report";

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "#b91c1c",
  HIGH: "#c2410c",
  MEDIUM: "#a16207",
  LOW: "#57606a",
};

const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const PAGE_WIDTH = 545;

// pdfkit's built-in Helvetica only covers WinAnsi (Latin-1-ish) — any
// character outside that (macrons in NZ place names like "Ōmokoroa", smart
// quotes, em dashes) silently renders as garbage glyphs instead of erroring,
// which is worse than a crash because it's easy to miss. Point pdfkit at a
// real system font with full Unicode coverage instead. Referenced from the
// OS install, never copied into the repo — this only ever runs on a Windows
// machine that already has these fonts licensed, so nothing is redistributed.
// Falls back to pdfkit's default if neither is found (e.g. a future non-
// Windows environment) rather than failing the whole report.
const UNICODE_FONT_CANDIDATES = ["C:\\Windows\\Fonts\\segoeui.ttf", "C:\\Windows\\Fonts\\arial.ttf"];

function resolveUnicodeFont(): string | null {
  for (const candidate of UNICODE_FONT_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

// Renders the open findings as a fix list, grouped by severity — a
// standalone document meant to be handed off (to a developer, or to
// Claude) as the work order for what needs fixing on this site, with
// enough detail per finding that no further digging is needed.
export function renderClientReportPdf(data: ClientReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4", bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const unicodeFont = resolveUnicodeFont();
    if (unicodeFont) doc.font(unicodeFont);

    const { client, findings } = data;

    doc.fontSize(18).fillColor("#111").text("Frontage Growth — Fix List");
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor("#444").text(`${client.name}${client.business_name ? ` (${client.business_name})` : ""}`);
    doc.fontSize(10).fillColor("#666").text(client.site?.url ?? "");
    doc.fontSize(9).fillColor("#888").text(`Generated ${new Date(data.generatedAt).toLocaleString()}`);

    const counts = SEVERITY_ORDER.map((s) => ({ severity: s, n: findings.filter((f) => f.severity === s).length }));
    doc.moveDown(0.6);
    doc.fontSize(10).fillColor("#333").text(counts.map((c) => `${c.severity}: ${c.n}`).join("   ·   "));

    if (findings.length === 0) {
      doc.moveDown(1);
      doc.fontSize(11).fillColor("#555").text("No open findings — nothing to fix right now.");
      doc.end();
      return;
    }

    function severityHeader(severity: string, count: number) {
      doc.moveDown(1);
      doc.fontSize(13).fillColor(SEVERITY_COLOR[severity] ?? "#111").text(`${severity} (${count})`);
      const y = doc.y + 2;
      doc.moveTo(50, y).lineTo(PAGE_WIDTH, y).strokeColor("#ddd").lineWidth(1).stroke();
      doc.moveDown(0.5);
    }

    function renderFinding(f: ReportFinding, index: number) {
      doc.fontSize(10).fillColor("#111").text(`${index}. [${f.category}] ${f.finding}`);
      if (f.url) doc.fontSize(8.5).fillColor("#777").text(f.url);
      for (const detail of f.details) {
        doc.fontSize(9).fillColor("#3a3a3a").text(detail, { indent: 10 });
      }
      doc.moveDown(0.45);
    }

    for (const severity of SEVERITY_ORDER) {
      const group = findings.filter((f) => f.severity === severity);
      if (group.length === 0) continue;
      severityHeader(severity, group.length);
      group.forEach((f, i) => renderFinding(f, i + 1));
    }

    doc.end();
  });
}
