CREATE TABLE "attendance_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"note" text DEFAULT '',
	"reason" text DEFAULT '',
	"updated_by_user_id" integer,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "attendance_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer,
	"title" varchar(255) NOT NULL,
	"meeting_date" date NOT NULL,
	"instructions" text DEFAULT '',
	"is_active" boolean DEFAULT false NOT NULL,
	"created_by_user_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "content_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform" varchar(50) DEFAULT 'instagram' NOT NULL,
	"caption" text NOT NULL,
	"date" date NOT NULL,
	"time" varchar(10) DEFAULT '',
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"notes" text DEFAULT '',
	"owner_user_ids" integer[] DEFAULT '{}' NOT NULL,
	"owner_user_id" integer,
	"approval_status" varchar(50) DEFAULT 'not_requested' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "daily_briefings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"briefing_date" date NOT NULL,
	"briefing" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"date" date NOT NULL,
	"time" varchar(10) DEFAULT '',
	"end_time" varchar(10) DEFAULT '',
	"location" varchar(255) DEFAULT '',
	"department" varchar(50) DEFAULT 'other' NOT NULL,
	"description" text DEFAULT '',
	"owner_user_ids" integer[] DEFAULT '{}' NOT NULL,
	"owner_user_id" integer,
	"last_update_type" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"description" varchar(255) NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"category" varchar(50) DEFAULT 'other' NOT NULL,
	"date" date NOT NULL,
	"paid_by" varchar(255) DEFAULT '',
	"notes" text DEFAULT '',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "follower_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer,
	"followers" integer NOT NULL,
	"total_likes" integer,
	"posts_count" integer,
	"recorded_date" date NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "impact_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"project_name" varchar(255) NOT NULL,
	"activity_type" varchar(50) DEFAULT 'other' NOT NULL,
	"people_reached" integer DEFAULT 0 NOT NULL,
	"date" date NOT NULL,
	"result_summary" text DEFAULT '',
	"evidence_link" text DEFAULT '',
	"notes" text DEFAULT '',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inventory_checkouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"person" varchar(255) NOT NULL,
	"checkout_date" date NOT NULL,
	"return_date" date,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(50) DEFAULT 'other' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"status" varchar(50) DEFAULT 'available' NOT NULL,
	"location" varchar(255) DEFAULT '',
	"condition" varchar(255) DEFAULT '',
	"notes" text DEFAULT '',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "news_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text DEFAULT '',
	"created_by_user_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text DEFAULT '',
	"status" varchar(50) DEFAULT 'planning' NOT NULL,
	"priority" varchar(50) DEFAULT 'medium' NOT NULL,
	"deadline" date,
	"team" varchar(255) DEFAULT '',
	"tags" text[] DEFAULT '{}',
	"owner_user_ids" integer[] DEFAULT '{}' NOT NULL,
	"owner_user_id" integer,
	"review_status" varchar(50) DEFAULT 'not_requested' NOT NULL,
	"last_update_type" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text DEFAULT '',
	"topic_news" boolean DEFAULT true NOT NULL,
	"topic_events" boolean DEFAULT true NOT NULL,
	"topic_projects" boolean DEFAULT true NOT NULL,
	"topic_attendance" boolean DEFAULT true NOT NULL,
	"topic_content" boolean DEFAULT true NOT NULL,
	"last_success_at" timestamp,
	"last_failure_at" timestamp,
	"last_failure_reason" text DEFAULT '',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "review_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" integer NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"submitted_by" integer,
	"reviewed_by" integer,
	"feedback" text DEFAULT '',
	"created_at" timestamp DEFAULT now(),
	"reviewed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "social_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform" varchar(50) NOT NULL,
	"name" varchar(255),
	"url" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"session_id" integer,
	"action" varchar(255) NOT NULL,
	"path" varchar(255) DEFAULT '',
	"details" jsonb DEFAULT '{}'::jsonb,
	"ip_address" varchar(45) DEFAULT '',
	"user_agent" text DEFAULT '',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"start_time" timestamp DEFAULT now(),
	"last_ping" timestamp DEFAULT now(),
	"duration_seconds" integer DEFAULT 0,
	"ip_address" varchar(45) DEFAULT '',
	"user_agent" text DEFAULT '',
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255),
	"full_name" varchar(255) NOT NULL,
	"role" varchar(50) NOT NULL,
	"department" varchar(100) NOT NULL,
	"position" varchar(255) DEFAULT '',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_session_id_attendance_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."attendance_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_briefings" ADD CONSTRAINT "daily_briefings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follower_history" ADD CONSTRAINT "follower_history_account_id_social_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impact_records" ADD CONSTRAINT "impact_records_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_checkouts" ADD CONSTRAINT "inventory_checkouts_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_posts" ADD CONSTRAINT "news_posts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_session_id_user_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."user_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_records_session_user_idx" ON "attendance_records" USING btree ("session_id","user_id");--> statement-breakpoint
CREATE INDEX "attendance_records_user_status_idx" ON "attendance_records" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "attendance_sessions_event_id_idx" ON "attendance_sessions" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "attendance_sessions_active_idx" ON "attendance_sessions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "content_posts_date_time_idx" ON "content_posts" USING btree ("date","time");--> statement-breakpoint
CREATE INDEX "content_posts_approval_status_idx" ON "content_posts" USING btree ("approval_status");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_briefings_user_id_briefing_date_key" ON "daily_briefings" USING btree ("user_id","briefing_date");--> statement-breakpoint
CREATE INDEX "daily_briefings_user_date_idx" ON "daily_briefings" USING btree ("user_id","briefing_date");--> statement-breakpoint
CREATE INDEX "events_date_idx" ON "events" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "follower_history_account_id_recorded_date_key" ON "follower_history" USING btree ("account_id","recorded_date");--> statement-breakpoint
CREATE INDEX "follower_history_account_recorded_date_idx" ON "follower_history" USING btree ("account_id","recorded_date");--> statement-breakpoint
CREATE INDEX "impact_records_project_id_idx" ON "impact_records" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "news_posts_created_at_idx" ON "news_posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "projects_review_status_idx" ON "projects" USING btree ("review_status");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "review_requests_entity_lookup_idx" ON "review_requests" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "review_requests_status_created_at_idx" ON "review_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "user_activities_user_id_idx" ON "user_activities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_activities_action_idx" ON "user_activities" USING btree ("action");--> statement-breakpoint
CREATE INDEX "user_activities_created_at_idx" ON "user_activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_sessions_start_time_idx" ON "user_sessions" USING btree ("start_time");