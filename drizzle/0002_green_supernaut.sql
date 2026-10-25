CREATE TABLE "cash_flows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"external_id" text,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cash_flows" ADD CONSTRAINT "cash_flows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_flows" ADD CONSTRAINT "cash_flows_account_id_trading_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cash_flows_user_idx" ON "cash_flows" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cash_flows_account_occurred_idx" ON "cash_flows" USING btree ("account_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_flows_source_idx" ON "cash_flows" USING btree ("user_id","account_id","external_id");