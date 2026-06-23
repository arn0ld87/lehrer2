CREATE TYPE "public"."avv_status" AS ENUM('signed', 'pending');--> statement-breakpoint
CREATE TYPE "public"."cloud_provider" AS ENUM('openai', 'anthropic', 'google');--> statement-breakpoint
CREATE TYPE "public"."cloud_region" AS ENUM('eu-central-1', 'us-east-1');--> statement-breakpoint
CREATE TYPE "public"."confidence_level" AS ENUM('HIGH', 'MEDIUM', 'LOW');--> statement-breakpoint
CREATE TYPE "public"."correction_status" AS ENUM('DRAFT', 'HUMAN_CONFIRMED', 'OVERRIDDEN');--> statement-breakpoint
CREATE TYPE "public"."grant_issuer_role" AS ENUM('SCHOOL_ADMIN', 'DSB');--> statement-breakpoint
CREATE TABLE "correction_draft" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"rubric_id" uuid,
	"ai_suggestion" jsonb NOT NULL,
	"provenance" jsonb NOT NULL,
	"human_decision" jsonb,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"status" "correction_status" DEFAULT 'DRAFT' NOT NULL,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"owner_teacher_id" text NOT NULL,
	"data_class" "data_class" DEFAULT 'INTERNAL' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_submission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"pseudonym_id" text NOT NULL,
	"content_ref" text NOT NULL,
	"ocr_text_ref" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_teacher_id" text NOT NULL,
	"data_class" "data_class" DEFAULT 'INTERNAL' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cloud_release_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"provider" "cloud_provider" NOT NULL,
	"region" "cloud_region" NOT NULL,
	"legal_basis" text NOT NULL,
	"dsfa_id" text NOT NULL,
	"avv_status" "avv_status" DEFAULT 'pending' NOT NULL,
	"scope" jsonb NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"issuer_name" text NOT NULL,
	"issuer_role" "grant_issuer_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pseudonym_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pseudonym_id" text NOT NULL,
	"student_ref" text NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pseudonym_mappings_pseudonym_id_unique" UNIQUE("pseudonym_id")
);
--> statement-breakpoint
ALTER TABLE "correction_draft" ADD CONSTRAINT "correction_draft_submission_id_student_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."student_submission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correction_draft" ADD CONSTRAINT "correction_draft_rubric_id_rubric_id_fk" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubric"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correction_draft" ADD CONSTRAINT "correction_draft_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correction_draft" ADD CONSTRAINT "correction_draft_owner_teacher_id_user_id_fk" FOREIGN KEY ("owner_teacher_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_submission" ADD CONSTRAINT "student_submission_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_submission" ADD CONSTRAINT "student_submission_owner_teacher_id_user_id_fk" FOREIGN KEY ("owner_teacher_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;