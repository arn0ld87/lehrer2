import { pgEnum } from "drizzle-orm/pg-core";

export const subjectEnum = pgEnum("subject", ["DEUTSCH", "RELIGION", "ETHIK"]);
export const confessionContextEnum = pgEnum("confession_context", [
  "EVANGELISCH",
  "KATHOLISCH",
  "KONFESSIONSSENSIBEL_UEBERGREIFEND",
  "RELIGIONSKUNDLICH",
  "NICHT_ANWENDBAR",
]);
export const schoolFormEnum = pgEnum("school_form", ["GESAMTSCHULE", "GEMEINSCHAFTSSCHULE"]);
export const educationTrackEnum = pgEnum("education_track", [
  "HAUPTSCHULBILDUNGSGANG",
  "REALSCHULBILDUNGSGANG",
  "GYMNASIALER_BILDUNGSGANG",
]);
export const schoolStageEnum = pgEnum("school_stage", ["SEK_I", "SEK_II"]);
export const gradeBandEnum = pgEnum("grade_band", ["KS5", "KS6", "KS7", "KS8", "KS9", "KS10"]);
export const dataClassEnum = pgEnum("data_class", [
  "PUBLIC",
  "INTERNAL",
  "PERSONAL_TEACHER",
  "SENSITIVE_STUDENT",
]);
export const sourceTrustEnum = pgEnum("source_trust", [
  "OFFICIAL_BINDING",
  "OFFICIAL_GUIDANCE",
  "OPEN_CURATED",
  "USER_APPROVED",
  "UNVERIFIED",
]);
export const curriculumStatusEnum = pgEnum("curriculum_status", ["DRAFT", "ACTIVE", "RETIRED"]);
export const teachingUnitStatusEnum = pgEnum("teaching_unit_status", ["DRAFT", "ACTIVE", "ARCHIVED"]);
export const taskTypeEnum = pgEnum("task_type", [
  "MULTIPLE_CHOICE",
  "SHORT_ANSWER",
  "ESSAY",
  "STRUCTURED_REASONING",
  "MEDIA_ANALYSIS",
]);
export const difficultyEnum = pgEnum("difficulty", ["EASY", "MEDIUM", "HARD"]);
export const rubricScopeEnum = pgEnum("rubric_scope", ["UNIT", "TASK"]);
export const rubricScaleEnum = pgEnum("rubric_scale_type", ["ANALYTIC", "HOLISTIC"]);
export const generationArtifactTypeEnum = pgEnum("generation_artifact_type", [
  "TEACHING_UNIT",
  "LESSON",
  "WORKSHEET",
  "TASK",
  "EXPECTATION_HORIZON",
  "RUBRIC",
  "CORRECTION_DRAFT",
  "STUDENT_FEEDBACK",
]);
export const auditSeverityEnum = pgEnum("audit_severity", ["info", "warning", "error", "critical"]);
export const confidenceLevelEnum = pgEnum("confidence_level", ["HIGH", "MEDIUM", "LOW"]);
export const correctionStatusEnum = pgEnum("correction_status", ["DRAFT", "HUMAN_CONFIRMED", "OVERRIDDEN"]);
export const sourceLifecycleEnum = pgEnum("source_lifecycle", [
  "DISCOVERED",
  "UNDER_REVIEW",
  "REGISTERED",
  "APPROVED",
  "INGESTED",
  "VERSIONED",
  "EVALUATED",
  "REVOKED",
]);

// ─── Privacy / CloudReleaseGrant ─────────────────────────────────────────────

/** Cloud-LLM-Provider (REDACTION_AND_GUARD_SPEC.md §4.1) */
export const cloudProviderEnum = pgEnum("cloud_provider", [
  "openai",
  "anthropic",
  "google",
]);

/** Zulässige Regionen für Cloud-Calls (EU-Datenschutz-Anforderung) */
export const cloudRegionEnum = pgEnum("cloud_region", [
  "eu-central-1",
  "us-east-1",
]);

/** AVV-Status des Cloud-Providers */
export const avvStatusEnum = pgEnum("avv_status", ["signed", "pending"]);

/** Rolle des Grant-Ausstellers */
export const grantIssuerRoleEnum = pgEnum("grant_issuer_role", [
  "SCHOOL_ADMIN",
  "DSB",
]);
