import { boolean, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { artifactTimestamps } from "../columns";
import { auditSeverityEnum, generationArtifactTypeEnum } from "../enums";

export const generationProvenance = pgTable("generation_provenance", {
  id: uuid("id").primaryKey().defaultRandom(),
  artifactType: generationArtifactTypeEnum("artifact_type").notNull(),
  artifactId: uuid("artifact_id").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  promptHash: text("prompt_hash").notNull(),
  redactionApplied: boolean("redaction_applied").notNull(),
  sourceRefs: uuid("source_refs").array(),
  confidenceState: jsonb("confidence_state"),
  ownerTeacherId: text("owner_teacher_id").notNull(),
  ...artifactTimestamps,
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  eventType: text("event_type").notNull(),
  actorId: text("actor_id"),
  schoolId: uuid("school_id"),
  subject: text("subject"),
  details: jsonb("details"),
  severity: auditSeverityEnum("severity").notNull().default("info"),
});
