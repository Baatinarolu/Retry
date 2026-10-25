ALTER TABLE "trades" ADD COLUMN "review_status" text DEFAULT 'unreviewed' NOT NULL;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "next_action" text DEFAULT '' NOT NULL;