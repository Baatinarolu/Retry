CREATE TABLE "fx_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"from_currency" text NOT NULL,
	"to_currency" text NOT NULL,
	"rate" numeric(24, 12) NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fx_rates" ADD CONSTRAINT "fx_rates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fx_rates_user_idx" ON "fx_rates" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fx_rates_pair_time_unique" ON "fx_rates" USING btree ("user_id","from_currency","to_currency","effective_at");