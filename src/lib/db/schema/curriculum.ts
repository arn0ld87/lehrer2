import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import {
  confessionContextEnum,
  curriculumStatusEnum,
  educationTrackEnum,
  gradeBandEnum,
  schoolFormEnum,
  schoolStageEnum,
  subjectEnum,
} from "../enums";

export const curriculumStrand = pgTable(
  "curriculum_strand",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subject: subjectEnum("subject").notNull(),
    confessionContext: confessionContextEnum("confession_context").notNull(),
    schoolForm: schoolFormEnum("school_form"),
    educationTrack: educationTrackEnum("education_track"),
    schoolStage: schoolStageEnum("school_stage").notNull(),
    frameworkAuthority: text("framework_authority").notNull(),
    validFrom: date("valid_from").notNull(),
    validTo: date("valid_to"),
    version: text("version").notNull(), // SemVer des Lehrplans
    supersedesId: uuid("supersedes_id"),
    status: curriculumStatusEnum("status").notNull().default("DRAFT"),
  },
  (t) => [
    // Konfessions-Invariante (DATA_MODEL.md): subject ⟹ erlaubte confessionContexts
    check(
      "confession_subject_valid",
      sql`(
        (${t.subject} = 'RELIGION' AND ${t.confessionContext} IN ('EVANGELISCH','KATHOLISCH','KONFESSIONSSENSIBEL_UEBERGREIFEND'))
        OR (${t.subject} = 'ETHIK' AND ${t.confessionContext} IN ('RELIGIONSKUNDLICH','NICHT_ANWENDBAR'))
        OR (${t.subject} = 'DEUTSCH' AND ${t.confessionContext} = 'NICHT_ANWENDBAR')
      )`,
    ),
    // Schulform/Bildungsgang nur bei Sek I
    check(
      "form_track_only_sek_i",
      sql`(${t.schoolStage} = 'SEK_I') OR (${t.schoolForm} IS NULL AND ${t.educationTrack} IS NULL)`,
    ),
    // Bildungsgang setzt Schulform voraus
    check(
      "track_requires_form",
      sql`${t.educationTrack} IS NULL OR ${t.schoolForm} IS NOT NULL`,
    ),
    foreignKey({
      columns: [t.supersedesId],
      foreignColumns: [t.id],
      name: "strand_supersedes_fk",
    }),
    unique("strand_id_unique").on(t.id),
  ],
);

export const curriculumNode = pgTable(
  "curriculum_node",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    strandId: uuid("strand_id")
      .notNull()
      .references(() => curriculumStrand.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    gradeBand: gradeBandEnum("grade_band"),
    code: text("code").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    competenceArea: text("competence_area"),
  },
  (t) => [
    // Code eindeutig pro Strang
    unique("node_code_per_strand").on(t.strandId, t.code),
    // Für Composite-FK: (id, strand_id) eindeutig
    unique("node_id_strand").on(t.id, t.strandId),
    // Baum-Invariante: parent muss im SELBEN Strang liegen (Composite-FK statt Trigger)
    foreignKey({
      columns: [t.parentId, t.strandId],
      foreignColumns: [t.id, t.strandId],
      name: "node_parent_same_strand_fk",
    }).onDelete("cascade"),
  ],
);
