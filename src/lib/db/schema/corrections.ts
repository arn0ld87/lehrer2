import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { correctionStatusEnum } from "../enums";
import { artifactTimestamps } from "../columns";
import { task, rubric } from "./artifacts";
import { user } from "./auth";

/**
 * StudentSubmission (Schülereingabe)
 * Pseudonymisierte Einreichung einer Arbeit.
 */
export const studentSubmission = pgTable("student_submission", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => task.id, { onDelete: "restrict" }),
  pseudonymId: text("pseudonym_id").notNull(), // z.B. SCHUELER_08_017
  contentRef: text("content_ref").notNull(), // MinIO Path
  ocrTextRef: text("ocr_text_ref"), // Optional: OCR-Ergebnis
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  ownerTeacherId: text("owner_teacher_id")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  ...artifactTimestamps,
});

/**
 * CorrectionDraft (Korrekturvorschlag & Entscheidung)
 * Strukturierte KI-Rückmeldung mit menschlicher Finalisierung.
 */
export const correctionDraft = pgTable("correction_draft", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionId: uuid("submission_id")
    .notNull()
    .references(() => studentSubmission.id, { onDelete: "cascade" }),
  rubricId: uuid("rubric_id").references(() => rubric.id, { onDelete: "set null" }),

  // KI-Vorschlag (strukturiert gemäß FEEDBACK_FORMAT.md)
  aiSuggestion: jsonb("ai_suggestion").notNull(),

  // Herkunft & Audit
  provenance: jsonb("provenance").notNull(),

  // Menschliche Entscheidung
  humanDecision: jsonb("human_decision"),
  decidedBy: text("decided_by").references(() => user.id, { onDelete: "set null" }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),

  status: correctionStatusEnum("status").notNull().default("DRAFT"),

  // Verlauf (History)
  history: jsonb("history").notNull().default([]),

  ownerTeacherId: text("owner_teacher_id")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  ...artifactTimestamps,
});
