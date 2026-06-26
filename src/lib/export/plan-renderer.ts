import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
} from "docx";
import PDFDocument from "pdfkit";
import type { ExportablePlan, ExportResult } from "./types";

const HINT =
  "Quellengebundener Entwurf. Vor dem Einsatz gegen den geltenden Lehrplan Sachsen-Anhalt prüfen — die Letztentscheidung liegt bei der Lehrkraft.";

function planSlug(topic: string): string {
  const s = topic
    .toLowerCase()
    .replace(/[äöü]/g, (m) => ({ ä: "ae", ö: "oe", ü: "ue" })[m] ?? m)
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `unterrichtsplanung-${s || "einheit"}`;
}

/** Rahmendaten-Zeilen (Label: Wert), leere Werte werden ausgelassen. */
function frameworkRows(plan: ExportablePlan): [string, string][] {
  const rows: [string, string][] = [
    ["Fach", plan.subject],
    ["Klasse / Stufe", plan.gradeBand],
    ["Bildungsgang", plan.schoolForm],
    ["Thema", plan.topic],
  ];
  if (plan.constraints.length > 0) {
    rows.push(["Rahmenbedingungen", plan.constraints.join(" · ")]);
  }
  return rows.filter(([, v]) => v && v.trim().length > 0);
}

function statementLine(
  s: ExportablePlan["statements"][number],
  i: number,
): string {
  const refs = s.citationRefs.length ? ` [${s.citationRefs.join(", ")}]` : "";
  const draft = s.grounded ? "" : " (ENTWURF — nicht quellengestützt)";
  return `${i + 1}. ${s.text}${refs}${draft}`;
}

function sourceLine(src: ExportablePlan["sources"][number]): string {
  const loc = src.locator ? `, ${src.locator}` : "";
  const lic = src.license ? ` — ${src.license}` : "";
  return `[${src.index}] ${src.title}${loc}${lic}`;
}

export async function renderPlanDocx(plan: ExportablePlan): Promise<ExportResult> {
  const children: Paragraph[] = [
    new Paragraph({
      text: `Unterrichtsplanung – ${plan.topic}`,
      heading: HeadingLevel.HEADING_1,
    }),
  ];

  children.push(
    new Paragraph({ text: "Rahmendaten", heading: HeadingLevel.HEADING_2 }),
  );
  for (const [label, value] of frameworkRows(plan)) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${label}: `, bold: true }),
          new TextRun({ text: value }),
        ],
      }),
    );
  }

  children.push(
    new Paragraph({
      text: "Lernziele & Stundenstruktur",
      heading: HeadingLevel.HEADING_2,
    }),
  );
  if (plan.statements.length === 0) {
    children.push(new Paragraph({ text: "— keine Aussagen generiert —" }));
  }
  plan.statements.forEach((s, i) =>
    children.push(new Paragraph({ text: statementLine(s, i) })),
  );

  children.push(
    new Paragraph({
      text: "Lehrplanbezug (Quellen)",
      heading: HeadingLevel.HEADING_2,
    }),
  );
  if (plan.sources.length === 0) {
    children.push(new Paragraph({ text: "— keine Quellen —" }));
  }
  plan.sources.forEach((src) =>
    children.push(new Paragraph({ text: sourceLine(src) })),
  );

  children.push(
    new Paragraph({
      spacing: { before: 240 },
      children: [new TextRun({ text: HINT, italics: true, size: 18 })],
    }),
  );

  const doc = new Document({ sections: [{ children }] });
  const bytes = await Packer.toBuffer(doc);
  return { format: "docx", filename: `${planSlug(plan.topic)}.docx`, bytes };
}

export function renderPlanPdf(plan: ExportablePlan): Promise<ExportResult> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 54 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () =>
      resolve({
        format: "pdf",
        filename: `${planSlug(plan.topic)}.pdf`,
        bytes: Buffer.concat(chunks),
      }),
    );
    doc.on("error", reject);

    const heading = (text: string) =>
      doc.moveDown(0.8).font("Helvetica-Bold").fontSize(13).fillColor("#1a1a2e").text(text);
    const body = () => doc.font("Helvetica").fontSize(11).fillColor("#000000");

    doc.font("Helvetica-Bold").fontSize(19).fillColor("#1a1a2e").text(`Unterrichtsplanung – ${plan.topic}`);

    heading("Rahmendaten");
    for (const [label, value] of frameworkRows(plan)) {
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#000000").text(`${label}: `, { continued: true });
      doc.font("Helvetica").text(value);
    }

    heading("Lernziele & Stundenstruktur");
    body();
    if (plan.statements.length === 0) doc.text("— keine Aussagen generiert —");
    plan.statements.forEach((s, i) => doc.moveDown(0.2).text(statementLine(s, i)));

    heading("Lehrplanbezug (Quellen)");
    body();
    if (plan.sources.length === 0) doc.text("— keine Quellen —");
    plan.sources.forEach((src) => doc.moveDown(0.2).text(sourceLine(src)));

    doc.moveDown(1).font("Helvetica-Oblique").fontSize(8).fillColor("#555555").text(HINT);
    doc.end();
  });
}
