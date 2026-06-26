import PDFDocument from "pdfkit";
import type { ExportableWorksheet, ExportResult } from "./types";
import { buildFooter } from "./footer";
import { slug } from "./util";

export function renderPdf(ws: ExportableWorksheet): Promise<ExportResult> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () =>
      resolve({ format: "pdf", filename: `${slug(ws.title)}.pdf`, bytes: Buffer.concat(chunks) }),
    );
    doc.on("error", reject);

    doc.fontSize(18).text(ws.title);
    if (ws.instructions) doc.moveDown(0.5).fontSize(11).text(ws.instructions);
    doc.moveDown();
    ws.tasks.forEach((t, i) => {
      const prefix = t.difficulty ? `[${t.difficulty}] ` : "";
      doc.fontSize(11).text(`${i + 1}. ${prefix}${t.prompt}`);
    });
    doc.moveDown();
    doc.fontSize(8).fillColor("#555").text(buildFooter(ws));
    doc.end();
  });
}
