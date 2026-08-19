CREATE TABLE "shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"render_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shares_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "shares" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "remixes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_render_id" uuid NOT NULL,
	"child_project_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "remixes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "likes" (
	"user_id" uuid NOT NULL,
	"render_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "likes_user_id_render_id_pk" PRIMARY KEY("user_id","render_id")
);
--> statement-breakpoint
ALTER TABLE "likes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_render_id_renders_id_fk" FOREIGN KEY ("render_id") REFERENCES "public"."renders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remixes" ADD CONSTRAINT "remixes_parent_render_id_renders_id_fk" FOREIGN KEY ("parent_render_id") REFERENCES "public"."renders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remixes" ADD CONSTRAINT "remixes_child_project_id_projects_id_fk" FOREIGN KEY ("child_project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_render_id_renders_id_fk" FOREIGN KEY ("render_id") REFERENCES "public"."renders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "shares_select_public" ON "shares" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "remixes_select_public" ON "remixes" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "likes_select_own" ON "likes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (auth.uid() = user_id);