/**
 * Öffentliche Datenzugriffsschicht der UI.
 *
 * Komponenten importieren von hier — nie direkt von den Mock-Factories.
 * So bleibt der Übergang auf echte Implementierungen (DB/RAG) later lokal.
 *
 * MARKER: Aktuell ausschließlich Mock-Daten (M1, Schritt 1 — nur UI-Struktur).
 */

export type {
  CorrectionRepository,
  DashboardRepository,
  PlanningRepository,
  SourcesRepository,
  UserContextRepository,
  WorksheetRepository,
} from "../repositories";

export {
  mockCorrectionRepository,
  mockDashboardRepository,
  mockPlanningRepository,
  mockSourcesRepository,
  mockUserContextRepository,
  mockWorksheetRepository,
} from "./repositories";

export type {
  Activity,
  CurriculumFit,
  DashboardMetric,
  DraftStatus,
  Grade,
  MockUser,
  PlanningStep,
  RagQuality,
  RecentWork,
  RubricScore,
  SchoolForm,
  SourceEntry,
  SourceQuickAccess,
  SourceStatus,
  SourceTrust,
  StructurePhase,
  Subject,
  TrustPrinciple,
  UserContext,
} from "../types";