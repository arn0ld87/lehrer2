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
