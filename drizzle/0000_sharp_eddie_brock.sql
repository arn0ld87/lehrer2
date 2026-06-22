CREATE TYPE "public"."audit_severity" AS ENUM('info', 'warning', 'error', 'critical');--> statement-breakpoint
CREATE TYPE "public"."confession_context" AS ENUM('EVANGELISCH', 'KATHOLISCH', 'KONFESSIONSSENSIBEL_UEBERGREIFEND', 'RELIGIONSKUNDLICH', 'NICHT_ANWENDBAR');--> statement-breakpoint
CREATE TYPE "public"."curriculum_status" AS ENUM('DRAFT', 'ACTIVE', 'RETIRED');--> statement-breakpoint
CREATE TYPE "public"."data_class" AS ENUM('PUBLIC', 'INTERNAL', 'PERSONAL_TEACHER', 'SENSITIVE_STUDENT');--> statement-breakpoint
CREATE TYPE "public"."difficulty" AS ENUM('EASY', 'MEDIUM', 'HARD');--> statement-breakpoint
CREATE TYPE "public"."education_track" AS ENUM('HAUPTSCHULBILDUNGSGANG', 'REALSCHULBILDUNGSGANG', 'GYMNASIALER_BILDUNGSGANG');--> statement-breakpoint
CREATE TYPE "public"."generation_artifact_type" AS ENUM('TEACHING_UNIT', 'LESSON', 'WORKSHEET', 'TASK', 'EXPECTATION_HORIZON', 'RUBRIC', 'CORRECTION_DRAFT', 'STUDENT_FEEDBACK');--> statement-breakpoint
CREATE TYPE "public"."grade_band" AS ENUM('KS5', 'KS6', 'KS7', 'KS8', 'KS9', 'KS10');--> statement-breakpoint
CREATE TYPE "public"."rubric_scale_type" AS ENUM('ANALYTIC', 'HOLISTIC');--> statement-breakpoint
CREATE TYPE "public"."rubric_scope" AS ENUM('UNIT', 'TASK');--> statement-breakpoint
CREATE TYPE "public"."school_form" AS ENUM('GESAMTSCHULE', 'GEMEINSCHAFTSSCHULE');--> statement-breakpoint
CREATE TYPE "public"."school_stage" AS ENUM('SEK_I', 'SEK_II');--> statement-breakpoint
CREATE TYPE "public"."source_trust" AS ENUM('OFFICIAL_BINDING', 'OFFICIAL_GUIDANCE', 'OPEN_CURATED', 'USER_APPROVED', 'UNVERIFIED');--> statement-breakpoint
CREATE TYPE "public"."subject" AS ENUM('DEUTSCH', 'RELIGION', 'ETHIK');--> statement-breakpoint
CREATE TYPE "public"."task_type" AS ENUM('MULTIPLE_CHOICE', 'SHORT_ANSWER', 'ESSAY', 'STRUCTURED_REASONING', 'MEDIA_ANALYSIS');--> statement-breakpoint
CREATE TYPE "public"."teaching_unit_status" AS ENUM('DRAFT', 'ACTIVE', 'ARCHIVED');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"school_id" uuid NOT NULL,
	"role" text DEFAULT 'LEHRKRAFT' NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teacher_profile_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "curriculum_node" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"strand_id" uuid NOT NULL,
	"parent_id" uuid,
	"grade_band" "grade_band",
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"competence_area" text,
	CONSTRAINT "node_code_per_strand" UNIQUE("strand_id","code"),
	CONSTRAINT "node_id_strand" UNIQUE("id","strand_id")
);
--> statement-breakpoint
CREATE TABLE "curriculum_strand" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" "subject" NOT NULL,
	"confession_context" "confession_context" NOT NULL,
	"school_form" "school_form",
	"education_track" "education_track",
	"school_stage" "school_stage" NOT NULL,
	"framework_authority" text NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"version" text NOT NULL,
	"supersedes_id" uuid,
	"status" "curriculum_status" DEFAULT 'DRAFT' NOT NULL,
	CONSTRAINT "strand_id_unique" UNIQUE("id"),
	CONSTRAINT "confession_subject_valid" CHECK ((
        ("curriculum_strand"."subject" = 'RELIGION' AND "curriculum_strand"."confession_context" IN ('EVANGELISCH','KATHOLISCH','KONFESSIONSSENSIBEL_UEBERGREIFEND'))
        OR ("curriculum_strand"."subject" = 'ETHIK' AND "curriculum_strand"."confession_context" IN ('RELIGIONSKUNDLICH','NICHT_ANWENDBAR'))
        OR ("curriculum_strand"."subject" = 'DEUTSCH' AND "curriculum_strand"."confession_context" = 'NICHT_ANWENDBAR')
      )),
	CONSTRAINT "form_track_only_sek_i" CHECK (("curriculum_strand"."school_stage" = 'SEK_I') OR ("curriculum_strand"."school_form" IS NULL AND "curriculum_strand"."education_track" IS NULL)),
	CONSTRAINT "track_requires_form" CHECK ("curriculum_strand"."education_track" IS NULL OR "curriculum_strand"."school_form" IS NOT NULL),
	CONSTRAINT "valid_to_after_valid_from" CHECK ("curriculum_strand"."valid_to" IS NULL OR "curriculum_strand"."valid_to" >= "curriculum_strand"."valid_from")
);
--> statement-breakpoint
CREATE TABLE "expectation_horizon" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"model_solution" text,
	"acceptance_criteria" jsonb,
	"partial_credit_rules" jsonb,
	"owner_teacher_id" text NOT NULL,
	"data_class" "data_class" DEFAULT 'INTERNAL' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "expectation_horizon_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "lesson" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"objectives" text,
	"phase_plan" jsonb,
	"owner_teacher_id" text NOT NULL,
	"data_class" "data_class" DEFAULT 'INTERNAL' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "lesson_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "lesson_curriculum_node" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"curriculum_node_id" uuid NOT NULL,
	CONSTRAINT "lesson_curriculum_node_unique" UNIQUE("lesson_id","curriculum_node_id")
);
--> statement-breakpoint
CREATE TABLE "rubric" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" "rubric_scope" NOT NULL,
	"target_id" uuid NOT NULL,
	"scale_type" "rubric_scale_type" NOT NULL,
	"total_points" integer,
	"owner_teacher_id" text NOT NULL,
	"data_class" "data_class" DEFAULT 'INTERNAL' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "rubric_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "rubric_criterion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rubric_id" uuid NOT NULL,
	"label" text NOT NULL,
	"weight" double precision NOT NULL,
	"level_descriptors" jsonb NOT NULL,
	"owner_teacher_id" text NOT NULL,
	"data_class" "data_class" DEFAULT 'INTERNAL' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "rubric_criterion_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "source_ref" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_hash" text NOT NULL,
	"source_type" "source_trust" NOT NULL,
	"title" text NOT NULL,
	"uri" text,
	"confidence" double precision,
	"owner_teacher_id" text,
	"data_class" "data_class" DEFAULT 'INTERNAL' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "source_ref_content_hash_unique" UNIQUE("content_hash"),
	CONSTRAINT "source_ref_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"worksheet_id" uuid NOT NULL,
	"prompt" text NOT NULL,
	"task_type" "task_type" NOT NULL,
	"difficulty" "difficulty" NOT NULL,
	"expected_competence_node_id" uuid,
	"points" integer,
	"owner_teacher_id" text NOT NULL,
	"data_class" "data_class" DEFAULT 'INTERNAL' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "task_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "task_source_ref" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"source_ref_id" uuid NOT NULL,
	CONSTRAINT "task_source_ref_unique" UNIQUE("task_id","source_ref_id")
);
--> statement-breakpoint
CREATE TABLE "teaching_unit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"strand_id" uuid NOT NULL,
	"grade_band" text NOT NULL,
	"goals" text,
	"sequence_order" integer,
	"status" "teaching_unit_status" DEFAULT 'DRAFT' NOT NULL,
	"owner_teacher_id" text NOT NULL,
	"data_class" "data_class" DEFAULT 'INTERNAL' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "unit_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "worksheet" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"title" text NOT NULL,
	"instructions" text,
	"layout_ref" text,
	"license" text,
	"derivation_source" text,
	"owner_teacher_id" text NOT NULL,
	"data_class" "data_class" DEFAULT 'INTERNAL' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "worksheet_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "worksheet_source_ref" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"worksheet_id" uuid NOT NULL,
	"source_ref_id" uuid NOT NULL,
	CONSTRAINT "worksheet_source_ref_unique" UNIQUE("worksheet_id","source_ref_id")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"event_type" text NOT NULL,
	"actor_id" text,
	"school_id" uuid,
	"subject" text,
	"details" jsonb,
	"severity" "audit_severity" DEFAULT 'info' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_provenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artifact_type" "generation_artifact_type" NOT NULL,
	"artifact_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt_hash" text NOT NULL,
	"redaction_applied" boolean NOT NULL,
	"source_refs" uuid[],
	"confidence_state" jsonb,
	"owner_teacher_id" text NOT NULL,
	"data_class" "data_class" DEFAULT 'INTERNAL' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_profile" ADD CONSTRAINT "teacher_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_profile" ADD CONSTRAINT "teacher_profile_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_node" ADD CONSTRAINT "curriculum_node_strand_id_curriculum_strand_id_fk" FOREIGN KEY ("strand_id") REFERENCES "public"."curriculum_strand"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_node" ADD CONSTRAINT "node_parent_same_strand_fk" FOREIGN KEY ("parent_id","strand_id") REFERENCES "public"."curriculum_node"("id","strand_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_strand" ADD CONSTRAINT "strand_supersedes_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."curriculum_strand"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expectation_horizon" ADD CONSTRAINT "expectation_horizon_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expectation_horizon" ADD CONSTRAINT "expectation_horizon_owner_teacher_id_user_id_fk" FOREIGN KEY ("owner_teacher_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_unit_id_teaching_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."teaching_unit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_owner_teacher_id_user_id_fk" FOREIGN KEY ("owner_teacher_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_curriculum_node" ADD CONSTRAINT "lesson_curriculum_node_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_curriculum_node" ADD CONSTRAINT "lesson_curriculum_node_curriculum_node_id_curriculum_node_id_fk" FOREIGN KEY ("curriculum_node_id") REFERENCES "public"."curriculum_node"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rubric" ADD CONSTRAINT "rubric_owner_teacher_id_user_id_fk" FOREIGN KEY ("owner_teacher_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rubric_criterion" ADD CONSTRAINT "rubric_criterion_rubric_id_rubric_id_fk" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubric"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rubric_criterion" ADD CONSTRAINT "rubric_criterion_owner_teacher_id_user_id_fk" FOREIGN KEY ("owner_teacher_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_ref" ADD CONSTRAINT "source_ref_owner_teacher_id_user_id_fk" FOREIGN KEY ("owner_teacher_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_worksheet_id_worksheet_id_fk" FOREIGN KEY ("worksheet_id") REFERENCES "public"."worksheet"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_expected_competence_node_id_curriculum_node_id_fk" FOREIGN KEY ("expected_competence_node_id") REFERENCES "public"."curriculum_node"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_owner_teacher_id_user_id_fk" FOREIGN KEY ("owner_teacher_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_source_ref" ADD CONSTRAINT "task_source_ref_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_source_ref" ADD CONSTRAINT "task_source_ref_source_ref_id_source_ref_id_fk" FOREIGN KEY ("source_ref_id") REFERENCES "public"."source_ref"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teaching_unit" ADD CONSTRAINT "teaching_unit_strand_id_curriculum_strand_id_fk" FOREIGN KEY ("strand_id") REFERENCES "public"."curriculum_strand"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teaching_unit" ADD CONSTRAINT "teaching_unit_owner_teacher_id_user_id_fk" FOREIGN KEY ("owner_teacher_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worksheet" ADD CONSTRAINT "worksheet_unit_id_teaching_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."teaching_unit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worksheet" ADD CONSTRAINT "worksheet_owner_teacher_id_user_id_fk" FOREIGN KEY ("owner_teacher_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worksheet_source_ref" ADD CONSTRAINT "worksheet_source_ref_worksheet_id_worksheet_id_fk" FOREIGN KEY ("worksheet_id") REFERENCES "public"."worksheet"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worksheet_source_ref" ADD CONSTRAINT "worksheet_source_ref_source_ref_id_source_ref_id_fk" FOREIGN KEY ("source_ref_id") REFERENCES "public"."source_ref"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");