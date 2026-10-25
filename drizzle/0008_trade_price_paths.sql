CREATE TABLE "trade_price_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"price" numeric(18, 8) NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trade_price_points" ADD CONSTRAINT "trade_price_points_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_price_points" ADD CONSTRAINT "trade_price_points_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "price_points_trade_idx" ON "trade_price_points" USING btree ("trade_id");--> statement-breakpoint
CREATE INDEX "price_points_user_idx" ON "trade_price_points" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "price_points_trade_time_idx" ON "trade_price_points" USING btree ("trade_id","observed_at");