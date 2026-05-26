ALTER TABLE "content_posts" ADD COLUMN "last_update_type" text;--> statement-breakpoint
ALTER TABLE "content_posts" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_number" varchar(50) DEFAULT '';