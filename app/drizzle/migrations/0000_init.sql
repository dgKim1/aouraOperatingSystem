CREATE TABLE "approval_replies" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text,
	"ord" integer NOT NULL,
	"request_id" text,
	"respondent_role" text,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text,
	"ord" integer NOT NULL,
	"subject_type" text,
	"required_role" text,
	"assessment_id" text,
	"supersedes_id" text,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text,
	"ord" integer NOT NULL,
	"subject_type" text,
	"ai_mode" text,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assumptions" (
	"id" text PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"reason" text NOT NULL,
	"used_in" text NOT NULL,
	"source" text DEFAULT 'assumption' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"ord" integer NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"actor_role" text NOT NULL,
	"actor_kind" text NOT NULL,
	"rule_ids" jsonb NOT NULL,
	"event_id" text,
	"reason" text NOT NULL,
	"sim_at" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"snapshot" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text,
	"ord" integer NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"ord" integer NOT NULL,
	"type" text NOT NULL,
	"label" text NOT NULL,
	"sim_at" text NOT NULL,
	"created_by" text NOT NULL,
	"payload" jsonb,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expansion_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text,
	"ord" integer NOT NULL,
	"required_role" text,
	"contract_deadline" text,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notice_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text,
	"ord" integer NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notices" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text,
	"ord" integer NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_files" (
	"file" text PRIMARY KEY NOT NULL,
	"header" jsonb NOT NULL,
	"row_count" integer NOT NULL,
	"scale" text NOT NULL,
	"label" text NOT NULL,
	"source" text DEFAULT 'original' NOT NULL,
	"loaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_rows" (
	"src_file" text NOT NULL,
	"src_row" integer NOT NULL,
	"values" jsonb NOT NULL,
	CONSTRAINT "raw_rows_src_file_src_row_pk" PRIMARY KEY("src_file","src_row")
);
--> statement-breakpoint
CREATE TABLE "replenishment_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text,
	"ord" integer NOT NULL,
	"required_role" text,
	"trigger_line_id" text,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sim_state" (
	"id" integer PRIMARY KEY NOT NULL,
	"sim_now" text NOT NULL,
	"version" integer NOT NULL,
	"preset" text,
	"forecast" jsonb NOT NULL,
	"ar_due_overrides" jsonb NOT NULL,
	"seq" jsonb NOT NULL,
	"proposal" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text,
	"ord" integer NOT NULL,
	"type" text,
	"owner_role" text,
	"subject_id" text,
	"due_at" text,
	"data" jsonb NOT NULL
);
