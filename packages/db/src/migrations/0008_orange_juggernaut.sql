ALTER TABLE "users" ADD COLUMN "plan_override_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "restore_plan" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "restore_plan_source" text;