import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import type { ExportableWorksheet, ExportResult } from "./types";
import { buildFooter } from "./footer";
import { slug } from "./util";

export async function renderDocx(ws: ExportableWorksheet): Promise<ExportResult> {
  const children: Paragraph[] = [
    new Paragraph({ text: ws.title, heading: HeadingLevel.HEADING_1 }),
  ];
  if (ws.instructions) children.push(new Paragraph({ text: ws.instructions }));
  ws.tasks.forEach((t, i) => {
    const prefix = t.difficulty ? `[${t.difficulty}] ` : "";
    children.push(
      new Paragraph({ children: [new TextRun({ text: `${i + 1}. ${prefix}${t.prompt}` })] }),
    );
  });
  buildFooter(ws).split("\n").forEach((line) =>
    children.push(new Paragraph({ children: [new TextRun({ text: line, italics: true, size: 18 })] })),
  );
  const doc = new Document({ sections: [{ children }] });
  const bytes = await Packer.toBuffer(doc);
  return { format: "docx", filename: `${slug(ws.title)}.docx`, bytes };
}
