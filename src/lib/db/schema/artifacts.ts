import { relations } from "drizzle-orm";
import {
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import {
  difficultyEnum,
  rubricScopeEnum,
  rubricScaleEnum,
  sourceTrustEnum,
  taskTypeEnum,
  teachingUnitStatusEnum,
} from "../enums";
import { artifactTimestamps } from "../columns";
import { curriculumNode, curriculumStrand } from "./curriculum";
import { user } from "./auth";

/**
 * TeachingUnit (Unterrichtssequenz)
 * Root artifact; 1:n → Lesson, Worksheet
 */
export const teachingUnit = pgTable(
  "teaching_unit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    strandId: uuid("strand_id")
      .notNull()
      .references(() => curriculumStrand.id, { onDelete: "restrict" }),
    gradeBand: text("grade_band").notNull(), // Zieljahrgang (e.g., "KS9")
    goals: text("goals"),
    sequenceOrder: integer("sequence_order"),
    status: teachingUnitStatusEnum("status").notNull().default("DRAFT"),
    ownerTeacherId: text("owner_teacher_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    ...artifactTimestamps,
  },
  (t) => [
    unique("unit_id_unique").on(t.id),
  ],
);

/**
 * Lesson (Schulstunde / Unterrichtsstunde)
 * Part of TeachingUnit; 1:1 relationship in this model
 */
export const lesson = pgTable(
  "lesson",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => teachingUnit.id, { onDelete: "cascade" }),
    objectives: text("objectives"),
    phasePlan: jsonb("phase_plan"), // JSON: Ablauf (Einstieg, Erarbeitung, Sicherung, Hausaufgabe)
    ownerTeacherId: text("owner_teacher_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    ...artifactTimestamps,
  },
  (t) => [
    unique("lesson_id_unique").on(t.id),
  ],
);

/**
 * Worksheet (Arbeitsblatt)
 * Part of TeachingUnit; 1:n → Task
 */
export const worksheet = pgTable(
  "worksheet",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => teachingUnit.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    instructions: text("instructions"),
    layoutRef: text("layout_ref"), // Designvorlage (optional)
    license: text("license"), // z.B. "CC-BY-SA"
    derivationSource: text("derivation_source"),
    ownerTeacherId: text("owner_teacher_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    ...artifactTimestamps,
  },
  (t) => [
    unique("worksheet_id_unique").on(t.id),
  ],
);

/**
 * Task (Aufgabe / Übung)
 * Part of Worksheet; 1:n → ExpectationHorizon
 */
export const task = pgTable(
  "task",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    worksheetId: uuid("worksheet_id")
      .notNull()
      .references(() => worksheet.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    taskType: taskTypeEnum("task_type").notNull(),
    difficulty: difficultyEnum("difficulty").notNull(),
    expectedCompetenceNodeId: uuid("expected_competence_node_id").references(
      () => curriculumNode.id,
      { onDelete: "set null" },
    ),
    points: integer("points"),
    ownerTeacherId: text("owner_teacher_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    ...artifactTimestamps,
  },
  (t) => [
    unique("task_id_unique").on(t.id),
  ],
);

/**
 * ExpectationHorizon (Musterlösung & Bewertungskriterien)
 * 1:1 to Task (implicit: one per task, optional)
 */
export const expectationHorizon = pgTable(
  "expectation_horizon",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    modelSolution: text("model_solution"),
    acceptanceCriteria: jsonb("acceptance_criteria"), // JSON: strukturierte Kriterien
    partialCreditRules: jsonb("partial_credit_rules"), // JSON: Regeln für Teilpunkte
    ownerTeacherId: text("owner_teacher_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    ...artifactTimestamps,
  },
  (t) => [
    unique("expectation_horizon_id_unique").on(t.id),
  ],
);

/**
 * Rubric (Bewertungsmatrix)
 * Standalone; scope can be UNIT or TASK (target_id references teaching_unit or task)
 */
export const rubric = pgTable(
  "rubric",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scope: rubricScopeEnum("scope").notNull(), // UNIT or TASK
    targetId: uuid("target_id").notNull(), // FK to teaching_unit or task (constraint at DB level would be complex, so we leave it flexible)
    scaleType: rubricScaleEnum("scale_type").notNull(), // ANALYTIC or HOLISTIC
    totalPoints: integer("total_points"),
    ownerTeacherId: text("owner_teacher_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    ...artifactTimestamps,
  },
  (t) => [
    unique("rubric_id_unique").on(t.id),
  ],
);

/**
 * RubricCriterion (Bewertungskriterium)
 * 1:n → Rubric
 */
export const rubricCriterion = pgTable(
  "rubric_criterion",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rubricId: uuid("rubric_id")
      .notNull()
      .references(() => rubric.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    weight: doublePrecision("weight").notNull(), // numeric weight (e.g., 0.5)
    levelDescriptors: jsonb("level_descriptors").notNull(), // JSON Array: descriptors per level
    ownerTeacherId: text("owner_teacher_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    ...artifactTimestamps,
  },
  (t) => [
    unique("rubric_criterion_id_unique").on(t.id),
  ],
);

/**
 * SourceRef (Quellenreferenz / RAG-Quelle)
 * Standalone; used via join tables (worksheet_source_ref, task_source_ref)
 */
export const sourceRef = pgTable(
  "source_ref",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contentHash: text("content_hash").notNull().unique(), // Fingerprint for deduplication
    sourceType: sourceTrustEnum("source_type").notNull(),
    title: text("title").notNull(),
    uri: text("uri"), // URL or DOI
    confidence: doublePrecision("confidence"), // Float (0–1), nullable
    ownerTeacherId: text("owner_teacher_id").references(() => user.id, {
      onDelete: "set null",
    }), // Only for USER_APPROVED
    ...artifactTimestamps,
  },
  (t) => [
    unique("source_ref_id_unique").on(t.id),
  ],
);

/**
 * WorksheetSourceRef (n:m join: Worksheet ↔ SourceRef)
 */
export const worksheetSourceRef = pgTable(
  "worksheet_source_ref",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    worksheetId: uuid("worksheet_id")
      .notNull()
      .references(() => worksheet.id, { onDelete: "cascade" }),
    sourceRefId: uuid("source_ref_id")
      .notNull()
      .references(() => sourceRef.id, { onDelete: "cascade" }),
  },
  (t) => [
    unique("worksheet_source_ref_unique").on(t.worksheetId, t.sourceRefId),
  ],
);

/**
 * TaskSourceRef (n:m join: Task ↔ SourceRef)
 */
export const taskSourceRef = pgTable(
  "task_source_ref",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    sourceRefId: uuid("source_ref_id")
      .notNull()
      .references(() => sourceRef.id, { onDelete: "cascade" }),
  },
  (t) => [
    unique("task_source_ref_unique").on(t.taskId, t.sourceRefId),
  ],
);

/**
 * LessonCurriculumNode (n:m join: Lesson ↔ CurriculumNode)
 * Kompetenzzuordnung
 */
export const lessonCurriculumNode = pgTable(
  "lesson_curriculum_node",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lesson.id, { onDelete: "cascade" }),
    curriculumNodeId: uuid("curriculum_node_id")
      .notNull()
      .references(() => curriculumNode.id, { onDelete: "cascade" }),
  },
  (t) => [
    unique("lesson_curriculum_node_unique").on(t.lessonId, t.curriculumNodeId),
  ],
);

/**
 * Relations
 */
export const teachingUnitRelations = relations(teachingUnit, ({ many, one }) => ({
  lessons: many(lesson),
  worksheets: many(worksheet),
  owner: one(user, {
    fields: [teachingUnit.ownerTeacherId],
    references: [user.id],
  }),
  strand: one(curriculumStrand, {
    fields: [teachingUnit.strandId],
    references: [curriculumStrand.id],
  }),
}));

export const lessonRelations = relations(lesson, ({ many, one }) => ({
  unit: one(teachingUnit, {
    fields: [lesson.unitId],
    references: [teachingUnit.id],
  }),
  curriculumNodes: many(lessonCurriculumNode),
  owner: one(user, {
    fields: [lesson.ownerTeacherId],
    references: [user.id],
  }),
}));

export const worksheetRelations = relations(worksheet, ({ many, one }) => ({
  unit: one(teachingUnit, {
    fields: [worksheet.unitId],
    references: [teachingUnit.id],
  }),
  tasks: many(task),
  sourceRefs: many(worksheetSourceRef),
  owner: one(user, {
    fields: [worksheet.ownerTeacherId],
    references: [user.id],
  }),
}));

export const taskRelations = relations(task, ({ many, one }) => ({
  worksheet: one(worksheet, {
    fields: [task.worksheetId],
    references: [worksheet.id],
  }),
  expectationHorizon: many(expectationHorizon),
  sourceRefs: many(taskSourceRef),
  owner: one(user, {
    fields: [task.ownerTeacherId],
    references: [user.id],
  }),
}));

export const expectationHorizonRelations = relations(
  expectationHorizon,
  ({ one }) => ({
    task: one(task, {
      fields: [expectationHorizon.taskId],
      references: [task.id],
    }),
    owner: one(user, {
      fields: [expectationHorizon.ownerTeacherId],
      references: [user.id],
    }),
  }),
);

export const rubricRelations = relations(rubric, ({ many, one }) => ({
  criteria: many(rubricCriterion),
  owner: one(user, {
    fields: [rubric.ownerTeacherId],
    references: [user.id],
  }),
}));

export const rubricCriterionRelations = relations(rubricCriterion, ({ one }) => ({
  rubric: one(rubric, {
    fields: [rubricCriterion.rubricId],
    references: [rubric.id],
  }),
  owner: one(user, {
    fields: [rubricCriterion.ownerTeacherId],
    references: [user.id],
  }),
}));

export const sourceRefRelations = relations(sourceRef, ({ many, one }) => ({
  worksheets: many(worksheetSourceRef),
  tasks: many(taskSourceRef),
  owner: one(user, {
    fields: [sourceRef.ownerTeacherId],
    references: [user.id],
  }),
}));

export const worksheetSourceRefRelations = relations(
  worksheetSourceRef,
  ({ one }) => ({
    worksheet: one(worksheet, {
      fields: [worksheetSourceRef.worksheetId],
      references: [worksheet.id],
    }),
    sourceRef: one(sourceRef, {
      fields: [worksheetSourceRef.sourceRefId],
      references: [sourceRef.id],
    }),
  }),
);

export const taskSourceRefRelations = relations(taskSourceRef, ({ one }) => ({
  task: one(task, {
    fields: [taskSourceRef.taskId],
    references: [task.id],
  }),
  sourceRef: one(sourceRef, {
    fields: [taskSourceRef.sourceRefId],
    references: [sourceRef.id],
  }),
}));

export const lessonCurriculumNodeRelations = relations(
  lessonCurriculumNode,
  ({ one }) => ({
    lesson: one(lesson, {
      fields: [lessonCurriculumNode.lessonId],
      references: [lesson.id],
    }),
    curriculumNode: one(curriculumNode, {
      fields: [lessonCurriculumNode.curriculumNodeId],
      references: [curriculumNode.id],
    }),
  }),
);
