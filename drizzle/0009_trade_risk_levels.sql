CREATE TABLE "trade_risk_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"stop_loss" numeric(18, 8),
	"take_profit" numeric(18, 8),
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trade_risk_levels" ADD CONSTRAINT "trade_risk_levels_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_risk_levels" ADD CONSTRAINT "trade_risk_levels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "risk_levels_trade_idx" ON "trade_risk_levels" USING btree ("trade_id");--> statement-breakpoint
CREATE INDEX "risk_levels_user_idx" ON "trade_risk_levels" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "risk_levels_trade_time_idx" ON "trade_risk_levels" USING btree ("trade_id","effective_at");