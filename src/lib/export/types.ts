export type ExportFormat = "docx" | "pdf";

export interface SourceCitation {
  title: string;
  locator?: string; // Seite/§ (CITATION_STANDARD)
  license?: string;
}

export interface ExportableTask {
  prompt: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
}

export interface ExportableWorksheet {
  title: string;
  instructions?: string;
  tasks: ExportableTask[];
  license?: string;
  derivationSource?: string;
  sources: SourceCitation[];
}

export interface ExportResult {
  format: ExportFormat;
  filename: string;
  bytes: Buffer;
}
