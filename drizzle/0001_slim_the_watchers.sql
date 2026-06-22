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
	CONSTRAINT "track_requires_form" CHECK ("curriculum_strand"."education_track" IS NULL OR "curriculum_strand"."school_form" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "curriculum_node" ADD CONSTRAINT "curriculum_node_strand_id_curriculum_strand_id_fk" FOREIGN KEY ("strand_id") REFERENCES "public"."curriculum_strand"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_node" ADD CONSTRAINT "node_parent_same_strand_fk" FOREIGN KEY ("parent_id","strand_id") REFERENCES "public"."curriculum_node"("id","strand_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_strand" ADD CONSTRAINT "strand_supersedes_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."curriculum_strand"("id") ON DELETE no action ON UPDATE no action;