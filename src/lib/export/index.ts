import type {
  ExportableWorksheet,
  ExportablePlan,
  ExportFormat,
  ExportResult,
} from "./types";
import { renderDocx } from "./docx-renderer";
import { renderPdf } from "./pdf-renderer";
import { renderPlanDocx, renderPlanPdf } from "./plan-renderer";

export async function exportArtifact(ws: ExportableWorksheet, format: ExportFormat): Promise<ExportResult> {
  switch (format) {
    case "docx": return renderDocx(ws);
    case "pdf": return renderPdf(ws);
  }
}

/** Strukturierter Export einer Unterrichtsplanung (Rahmendaten + Struktur + Quellen). */
export async function exportPlan(plan: ExportablePlan, format: ExportFormat): Promise<ExportResult> {
  switch (format) {
    case "docx": return renderPlanDocx(plan);
    case "pdf": return renderPlanPdf(plan);
  }
}

export type { ExportableWorksheet, ExportablePlan, ExportFormat, ExportResult } from "./types";
