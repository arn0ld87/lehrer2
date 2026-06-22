CREATE TABLE "expectation_horizon" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"model_solution" text,
	"acceptance_criteria" json,
	"partial_credit_rules" json,
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
	"phase_plan" json,
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
	"weight" json,
	"level_descriptors" json,
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
	"confidence" json,
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
ALTER TABLE "worksheet_source_ref" ADD CONSTRAINT "worksheet_source_ref_source_ref_id_source_ref_id_fk" FOREIGN KEY ("source_ref_id") REFERENCES "public"."source_ref"("id") ON DELETE cascade ON UPDATE no action;