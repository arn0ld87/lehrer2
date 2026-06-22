CREATE TYPE "public"."source_lifecycle" AS ENUM('DISCOVERED', 'UNDER_REVIEW', 'REGISTERED', 'APPROVED', 'INGESTED', 'VERSIONED', 'EVALUATED', 'REVOKED');--> statement-breakpoint
CREATE TABLE "rag_chunk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_ref_id" uuid NOT NULL,
	"chunk_text" text NOT NULL,
	"page_or_section" text NOT NULL,
	"source_version" integer DEFAULT 1 NOT NULL,
	"content_hash" text NOT NULL,
	"embedding_ref" uuid,
	"trust_level" "source_trust" NOT NULL,
	"subject" "subject",
	"confession_context" "confession_context",
	"license" text,
	"retrieved_at" timestamp with time zone,
	"data_class" "data_class" DEFAULT 'INTERNAL' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "rag_chunk_source_hash_version_uniq" UNIQUE("source_ref_id","content_hash","source_version"),
	CONSTRAINT "rag_chunk_text_min_len" CHECK (char_length("rag_chunk"."chunk_text") >= 50)
);
--> statement-breakpoint
ALTER TABLE "source_ref" DROP CONSTRAINT "source_ref_content_hash_unique";--> statement-breakpoint
ALTER TABLE "source_ref" ALTER COLUMN "content_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "source_ref" ALTER COLUMN "source_type" SET DEFAULT 'UNVERIFIED';--> statement-breakpoint
ALTER TABLE "source_ref" ADD COLUMN "author_organization" text;--> statement-breakpoint
ALTER TABLE "source_ref" ADD COLUMN "published_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "source_ref" ADD COLUMN "license_info" text;--> statement-breakpoint
ALTER TABLE "source_ref" ADD COLUMN "license_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "source_ref" ADD COLUMN "valid_from" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "source_ref" ADD COLUMN "valid_to" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "source_ref" ADD COLUMN "subject_alignment" "subject";--> statement-breakpoint
ALTER TABLE "source_ref" ADD COLUMN "confession_context" "confession_context";--> statement-breakpoint
ALTER TABLE "source_ref" ADD COLUMN "lifecycle_status" "source_lifecycle" DEFAULT 'DISCOVERED' NOT NULL;--> statement-breakpoint
ALTER TABLE "source_ref" ADD COLUMN "approval_metadata" jsonb;--> statement-breakpoint
ALTER TABLE "source_ref" ADD COLUMN "retrieved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "source_ref" ADD COLUMN "source_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "rag_chunk" ADD CONSTRAINT "rag_chunk_source_ref_id_source_ref_id_fk" FOREIGN KEY ("source_ref_id") REFERENCES "public"."source_ref"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "source_ref_content_hash_uniq" ON "source_ref" USING btree ("content_hash") WHERE "source_ref"."content_hash" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "source_ref" ADD CONSTRAINT "source_confession_subject_valid" CHECK ((
        "source_ref"."subject_alignment" IS NULL
        OR ("source_ref"."subject_alignment" = 'RELIGION' AND "source_ref"."confession_context" IN ('EVANGELISCH','KATHOLISCH','KONFESSIONSSENSIBEL_UEBERGREIFEND'))
        OR ("source_ref"."subject_alignment" = 'ETHIK' AND "source_ref"."confession_context" IN ('RELIGIONSKUNDLICH','NICHT_ANWENDBAR'))
        OR ("source_ref"."subject_alignment" = 'DEUTSCH' AND "source_ref"."confession_context" = 'NICHT_ANWENDBAR')
      ));