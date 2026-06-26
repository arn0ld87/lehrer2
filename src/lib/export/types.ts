export type ExportFormat = "docx" | "pdf";

export interface SourceCitation {
  title: string;
  locator?: string; // Seite/§ (CITATION_STANDARD)
  license?: string;
}

export interface ExportableTask {
  prompt: string;
  /** Optional — Arbeitsblatt-Aufgaben tragen ein Niveau; Planungs-Statements nicht. */
  difficulty?: "EASY" | "MEDIUM" | "HARD";
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

/** Eine quellengebundene Planungs-Aussage für den strukturierten Export. */
export interface ExportablePlanStatement {
  text: string;
  citationRefs: number[];
  /** false → als ENTWURF (nicht quellengestützt) kennzeichnen. */
  grounded: boolean;
}

/**
 * Strukturierte Unterrichtsplanung für den Export (DOCX/PDF).
 * Anders als ExportableWorksheet: mit Rahmendaten-Kopf und nummerierten,
 * quellengebundenen Aussagen statt Aufgaben-mit-Niveau.
 */
export interface ExportablePlan {
  /** Thema der Einheit. */
  topic: string;
  subject: string;
  gradeBand: string;
  schoolForm: string;
  constraints: string[];
  statements: ExportablePlanStatement[];
  sources: (SourceCitation & { index: number })[];
}
