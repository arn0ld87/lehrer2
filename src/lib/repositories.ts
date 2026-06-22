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
  SourceTrust,
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

// ---------------------------------------------------------------------------
// Typen für SourceRepository-Inputs (M2)
// ---------------------------------------------------------------------------

/** Input für create() — legt eine neue Quelle mit Status DISCOVERED an. */
export interface SourceCreateInput {
  title: string;
  uri?: string;
  sourceType: SourceTrust;
  subjectAlignment?: string;
  confessionContext?: string;
  licenseInfo?: string;
}

/** Metadaten für register() — Übergang DISCOVERED/UNDER_REVIEW → REGISTERED. */
export interface SourceRegisterMeta {
  licenseInfo?: string;
  licenseVerified?: boolean;
  approvalMetadata?: Record<string, unknown>;
}

/** Metadaten für approve() — Übergang REGISTERED → APPROVED (fail-closed). */
export interface SourceApproveMeta {
  approvalMetadata?: Record<string, unknown>;
}

/**
 * Vollständiges async-Repository für Quellen-Lifecycle (M2).
 *
 * Extends SourceEntriesReader; der schreibende Pfad ergänzt den Lesevertrag.
 * Jede Transition ist namentlich benannt und setzt Vorbedingungen durch
 * (fail-closed: kein ad-hoc-Update beliebiger Spalten).
 *
 * approve() wirft einen Error, wenn:
 *   - lifecycleStatus !== "REGISTERED", ODER
 *   - licenseVerified !== true, ODER
 *   - sourceType === "UNVERIFIED"
 */
export interface SourceRepository extends SourceEntriesReader {
  /** Gibt alle Quellen zurück (deletedAt IS NULL). */
  list(): Promise<SourceEntry[]>;

  /** Liefert eine Quelle per ID oder null. */
  get(id: string): Promise<SourceEntry | null>;

  /** Legt eine neue Quelle mit Status DISCOVERED an. Gibt die neue ID zurück. */
  create(input: SourceCreateInput): Promise<string>;

  /**
   * DISCOVERED / UNDER_REVIEW → REGISTERED.
   * Setzt Lizenz-Metadaten; fail, wenn Ausgangsstatus unzulässig.
   */
  register(id: string, meta: SourceRegisterMeta): Promise<void>;

  /**
   * REGISTERED → APPROVED.
   * FAIL-CLOSED: wirft Error wenn lifecycleStatus !== "REGISTERED"
   * ODER licenseVerified !== true ODER sourceType === "UNVERIFIED".
   */
  approve(id: string, meta: SourceApproveMeta): Promise<void>;

  /** Jeder Status → REVOKED. */
  revoke(id: string): Promise<void>;

  /** APPROVED → INGESTED. Fail, wenn Ausgangsstatus !== "APPROVED". */
  ingestMark(id: string): Promise<void>;
}