/**
 * Domain-Typen für die UI-Shell (M1, Schritt 1).
 *
 * WICHTIG: Dies ist nur die UI-Struktur. Keine echten RAG-/LLM-/DB-Funktionen.
 * Die Typen beschreiben Shape und Statuszustände, die die Oberfläche braucht,
 * damit Quellen- und Unsicherheitszustände nie verdeckt werden.
 *
 * Keine echten Schülerdaten, Tokens oder Lehrplandokumente — alle Werte
 * stammen aus Mock-Factories und sind synthetisch.
 */

/** Fächer — Religion wird konfessionssensibel getrennt; Ethik ist eigenes Fach. */
export type Subject = "deutsch" | "evangelische-religion" | "katholische-religion" | "ethik";

/** Auswählbares Fach für die UI (nur Fächer mit vorhandenem Lehrplan-Strang). */
export interface SubjectOption {
  value: Subject;
  label: string;
}

/** Schulformen in Sachsen-Anhalt. */
export type SchoolForm = "gemeinschaftsschule" | "gymnasialer-bildungsgang";

/** Klassenstufen — MVP Kl. 5–10 (Sek-I-Scope, ADR 0006). */
export type Grade = 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/** Vertrauens-/Verifizierungsstufe einer Quelle (ADR 0003, Source-Governance). */
export type SourceTrust =
  | "OFFICIAL_BINDING"
  | "OFFICIAL_GUIDANCE"
  | "OPEN_CURATED"
  | "USER_APPROVED"
  | "UNVERIFIED";

/** Freigabestatus einer Quelle — UNVERIFIED darf nie produktiv im RAG stehen. */
export type SourceStatus = "active" | "pending-review" | "waiting" | "rejected";

/** Status einer Planung / eines Entwurfs. */
export type DraftStatus = "draft" | "progress" | "ready" | "review";

/** RAG-/Qualitätsindikatoren (gemessen, nicht beschworen). */
export interface RagQuality {
  metadataCoverage: number; // Prozent
  goldenQuestionRecall: number; // Prozent
  sourcesNeedingReview: number; // absolute Zahl
  indexFreshness: string; // Anzeige-String
}

/** Lehrplanbezug einer Kompetenz — Fundstelle wird erst bei Freigabe belegt. */
export interface CurriculumFit {
  id: string;
  label: string;
  detail: string;
  status: "belegt" | "pruefen";
  sourceHint: string;
}

/** Eine Aktivität im Verlauf — nachvollziehbar, nicht mystisch. */
export interface Activity {
  id: string;
  title: string;
  detail: string;
  icon: "ok" | "warn" | "info";
  timestamp: string; // Anzeige-String (Mock)
}

/** Eintrag „Weiterarbeiten” — kontextbezogener Entwurf. */
export interface RecentWork {
  id: string;
  title: string;
  subtitle: string;
  subject: Subject;
  icon: "calendar" | "file" | "wand";
  modifiedAt: string; // Anzeige-String (Mock)
  tab: "zuletzt" | "geplant" | "favoriten";
}

/** KPI-Metriken für das Dashboard. */
export interface DashboardMetric {
  id: string;
  kicker: string;
  value: number | string;
  foot: string;
  icon: "calendar" | "file" | "wand" | "layers";
  accent: "purple" | "green" | "orange" | "blue";
  href: string;
}

/** Schnellzugriff auf einen Lehrplan / eine Quelle. */
export interface SourceQuickAccess {
  id: string;
  title: string;
  subtitle: string;
  accent: "primary" | "green";
}

/** Vertrauensgrundsatz (Trust-Row). */
export interface TrustPrinciple {
  id: string;
  icon: "shield" | "file" | "user";
  title: string;
  detail: string;
}

/** Planungsfortschritt — Timeline-Schritte. */
export interface PlanningStep {
  id: string;
  title: string;
  detail: string;
  done: boolean;
}

/** Vorgeschlagene Strukturphase einer Unterrichtseinheit. */
export interface StructurePhase {
  id: string;
  title: string;
  detail: string;
}

/** Korrektur-Kriterium im rasterbasierten Vorschlag. */
export interface RubricScore {
  id: string;
  criterion: string;
  achieved: number;
  max: number;
  note: string;
  confidence?: Confidence;
}

/** Sicherheitseinstufung einer Aussage. */
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

/** Strukturierte Unsicherheit. */
export interface Confidence {
  level: ConfidenceLevel;
  reasoning: string;
}

/** Art des Belegs. */
export type EvidenceType = "STUDENT_TEXT" | "CURRICULUM" | "OTHER";

/** Ein Beleg für eine Feedback-Aussage. */
export interface FeedbackEvidence {
  type: EvidenceType;
  reference: string;
  content?: string;
  sourceRefId?: string;
  label?: string;
}

/** Status einer Feedback-Aussage. */
export type FeedbackStatementStatus = "AI_GENERATED" | "HUMAN_APPROVED" | "HUMAN_EDITED";

/** Eine einzelne Feedback-Aussage. */
export interface FeedbackStatement {
  id: string;
  text: string;
  evidence: FeedbackEvidence[];
  confidence: Confidence;
  status: FeedbackStatementStatus;
}

/** Phasen des Korrekturverlaufs. */
export type CorrectionHistoryAction = "CREATE_DRAFT" | "EDIT_STATEMENT" | "APPROVE_FEEDBACK" | "REJECT_FEEDBACK";

/** Ein Eintrag im Korrekturverlauf. */
export interface FeedbackHistoryEntry {
  timestamp: string;
  actor: string;
  action: CorrectionHistoryAction;
  changeSummary: string;
  targetId?: string;
  originalText?: string;
  newText?: string;
}

/** Quellenregister-Eintrag. */
export interface SourceEntry {
  id: string;
  title: string;
  origin: string; // Herausgeber / Herkunft
  subject: Subject;
  gradeRange: string; // Anzeige-String
  trust: SourceTrust;
  version: string;
  license: string;
  status: SourceStatus;
  lifecycleStatus?: string; // Optional: DISCOVERED, UNDER_REVIEW, REGISTERED, APPROVED, REVOKED, INGESTED
}

/** Kontext-Switcher-Werte (Fach / Schulform / Klasse) — UI-State, nicht persistent. */
export interface UserContext {
  subject: Subject;
  schoolForm: SchoolForm;
  grade: Grade;
}

/** Mock-Nutzer (kein realer Account). */
export interface MockUser {
  initials: string;
  name: string;
  role: string;
}

/** Navigationsroute. */
export interface NavRoute {
  href: string;
  label: string;
  icon: "home" | "calendar" | "file" | "wand" | "layers" | "sparkles";
}