/**
 * Repository-Interfaces — Verträge, die die UI gegenüber der Datenbasis stellt.
 *
 * Im M1-Schritt 1 werden diese ausschließlich von Mock-Factories bedient
 * (siehe ./mock). Kein DB-/RAG-/LLM-Anschluss. Wenn später echte Quellen
 * angebunden werden, bleiben die Komponenten stabil; nur die Implementierung
 * dieser Interfaces ändert sich.
 */

import type {
  Activity,
  CurriculumFit,
  DashboardMetric,
  DraftStatus,
  MockUser,
  PlanningStep,
  RagQuality,
  RecentWork,
  RubricScore,
  SourceEntry,
  SourceQuickAccess,
  StructurePhase,
  TrustPrinciple,
  UserContext,
} from "./types";

export interface DashboardRepository {
  metrics(): DashboardMetric[];
  recentWork(tab?: RecentWork["tab"]): RecentWork[];
  activities(): Activity[];
  sourceQuickAccess(): SourceQuickAccess[];
  trustPrinciples(): TrustPrinciple[];
}

export interface PlanningRepository {
  steps(): PlanningStep[];
  structureProposal(): StructurePhase[];
  curriculumFit(): CurriculumFit[];
}

export interface WorksheetRepository {
  // Im UI-Schritt nur Konfigurations-Meta, kein Generierungsergebnis.
  types(): { id: string; label: string; detail: string }[];
  differentiationOptions(): string[];
  toneOptions(): string[];
}

export interface CorrectionRepository {
  submissionMeta(): {
    title: string;
    subjectLabel: string;
    submittedAt: string;
    pseudonym: string; // synthetisch, kein echter Schüler
    status: DraftStatus;
  };
  rubricScores(): RubricScore[];
  feedbackDraft(): string;
}

export interface SourcesRepository {
  ragQuality(): RagQuality;
  entries(): SourceEntry[];
  governanceChecks(): { id: string; title: string; detail: string }[];
}

export interface UserContextRepository {
  current(): UserContext;
  user(): MockUser;
}

/**
 * Schmales async-Interface für DB-gestützte Quellenabfragen (M1/M2).
 *
 * Nur `entries()` ist in M1 DB-seitig bedienbar. `ragQuality()` und
 * `governanceChecks()` hängen am RAG-Layer (M2) und sind absichtlich
 * ausgeschlossen — kein Fake-Daten-Pfad.
 *
 * Implementierungen: PgSourcesRepository (DB), factory.getSourceEntriesReader() (Mock-Adapter).
 */
export interface SourceEntriesReader {
  entries(): Promise<SourceEntry[]>;
}