import type { ExportableWorksheet, ExportFormat, ExportResult } from "./types";
import { renderDocx } from "./docx-renderer";
import { renderPdf } from "./pdf-renderer";

export async function exportArtifact(ws: ExportableWorksheet, format: ExportFormat): Promise<ExportResult> {
  switch (format) {
    case "docx": return renderDocx(ws);
    case "pdf": return renderPdf(ws);
  }
}

export type { ExportableWorksheet, ExportFormat, ExportResult } from "./types";
