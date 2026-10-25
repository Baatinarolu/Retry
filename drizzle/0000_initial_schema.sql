CREATE TABLE "ai_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"date_from" date,
	"date_to" date,
	"sample_size" integer DEFAULT 0 NOT NULL,
	"content" text NOT NULL,
	"source" text DEFAULT 'rules' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backtest_trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"backtest_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"instrument" text NOT NULL,
	"direction" text NOT NULL,
	"entry_at" timestamp with time zone NOT NULL,
	"exit_at" timestamp with time zone,
	"entry_price" numeric(18, 8) NOT NULL,
	"exit_price" numeric(18, 8),
	"stop_loss" numeric(18, 8),
	"take_profit" numeric(18, 8),
	"result_r" numeric(12, 4) DEFAULT '0' NOT NULL,
	"result_currency" numeric(18, 4) DEFAULT '0' NOT NULL,
	"information_at_decision" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"followed_rules" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backtests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"instrument" text NOT NULL,
	"timeframe" text DEFAULT '15m' NOT NULL,
	"strategy_id" uuid,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"session" text DEFAULT '' NOT NULL,
	"entry_rules" text DEFAULT '' NOT NULL,
	"exit_rules" text DEFAULT '' NOT NULL,
	"risk_model" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_hour" integer NOT NULL,
	"end_hour" integer NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_journals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid,
	"journal_date" date NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"mood" text DEFAULT '' NOT NULL,
	"mistakes" text DEFAULT '' NOT NULL,
	"grade" text DEFAULT '' NOT NULL,
	"followed_rules" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instruments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'forex' NOT NULL,
	"contract_size" numeric(18, 6) DEFAULT '1' NOT NULL,
	"tick_size" numeric(18, 8) DEFAULT '0.00001' NOT NULL,
	"tick_value" numeric(18, 8) DEFAULT '1' NOT NULL,
	"pip_size" numeric(18, 8) DEFAULT '0.0001' NOT NULL,
	"pip_value" numeric(18, 8) DEFAULT '10' NOT NULL,
	"quote_currency" text DEFAULT 'USD' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "psychology_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"emotion_before" text DEFAULT '' NOT NULL,
	"emotion_during" text DEFAULT '' NOT NULL,
	"emotion_after" text DEFAULT '' NOT NULL,
	"confidence" integer DEFAULT 5 NOT NULL,
	"patience" integer DEFAULT 5 NOT NULL,
	"fomo" boolean DEFAULT false NOT NULL,
	"fear" boolean DEFAULT false NOT NULL,
	"greed" boolean DEFAULT false NOT NULL,
	"revenge" boolean DEFAULT false NOT NULL,
	"overtrading" boolean DEFAULT false NOT NULL,
	"hesitation" boolean DEFAULT false NOT NULL,
	"impulsive" boolean DEFAULT false NOT NULL,
	"early_exit" boolean DEFAULT false NOT NULL,
	"moved_stop" boolean DEFAULT false NOT NULL,
	"broke_risk_rules" boolean DEFAULT false NOT NULL,
	"followed_plan" boolean DEFAULT true NOT NULL,
	"lessons" text DEFAULT '' NOT NULL,
	"did_well" text DEFAULT '' NOT NULL,
	"improve" text DEFAULT '' NOT NULL,
	"reflection" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid,
	"default_risk_percent" numeric(8, 4) DEFAULT '0.5' NOT NULL,
	"max_daily_loss" numeric(18, 2) DEFAULT '0' NOT NULL,
	"max_weekly_loss" numeric(18, 2) DEFAULT '0' NOT NULL,
	"max_trades_per_day" integer DEFAULT 5 NOT NULL,
	"max_consecutive_losses" integer DEFAULT 3 NOT NULL,
	"max_open_risk" numeric(18, 2) DEFAULT '0' NOT NULL,
	"min_planned_rr" numeric(8, 2) DEFAULT '2' NOT NULL,
	"daily_profit_target" numeric(18, 2) DEFAULT '0' NOT NULL,
	"max_position_size" numeric(18, 4) DEFAULT '0' NOT NULL,
	"personal_rules" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "screenshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"category" text DEFAULT 'entry' NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"market_conditions" text DEFAULT '' NOT NULL,
	"confirmations" text DEFAULT '' NOT NULL,
	"entry_rules" text DEFAULT '' NOT NULL,
	"stop_loss_rules" text DEFAULT '' NOT NULL,
	"take_profit_rules" text DEFAULT '' NOT NULL,
	"risk_rules" text DEFAULT '' NOT NULL,
	"invalidation" text DEFAULT '' NOT NULL,
	"checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"parent_strategy_id" uuid,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'custom' NOT NULL,
	"color" text DEFAULT '#2dd4bf' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"price" numeric(18, 8) NOT NULL,
	"quantity" numeric(18, 6) NOT NULL,
	"executed_at" timestamp with time zone NOT NULL,
	"fees" numeric(18, 4) DEFAULT '0' NOT NULL,
	"notes" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"strategy_id" uuid,
	"display_id" text NOT NULL,
	"instrument" text NOT NULL,
	"market_category" text DEFAULT 'forex' NOT NULL,
	"direction" text NOT NULL,
	"trade_type" text DEFAULT 'intraday' NOT NULL,
	"session" text DEFAULT 'london' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"entry_at" timestamp with time zone NOT NULL,
	"exit_at" timestamp with time zone,
	"entry_price" numeric(18, 8) NOT NULL,
	"exit_price" numeric(18, 8),
	"stop_loss" numeric(18, 8),
	"take_profit" numeric(18, 8),
	"position_size" numeric(18, 6) DEFAULT '1' NOT NULL,
	"lot_size" numeric(18, 6) DEFAULT '0.1' NOT NULL,
	"contract_size" numeric(18, 6) DEFAULT '1' NOT NULL,
	"tick_size" numeric(18, 8) DEFAULT '0.00001' NOT NULL,
	"tick_value" numeric(18, 8) DEFAULT '1' NOT NULL,
	"pip_size" numeric(18, 8) DEFAULT '0.0001' NOT NULL,
	"pip_value" numeric(18, 8) DEFAULT '10' NOT NULL,
	"commission" numeric(18, 4) DEFAULT '0' NOT NULL,
	"swap" numeric(18, 4) DEFAULT '0' NOT NULL,
	"slippage" numeric(18, 4) DEFAULT '0' NOT NULL,
	"gross_pnl" numeric(18, 4) DEFAULT '0' NOT NULL,
	"net_pnl" numeric(18, 4) DEFAULT '0' NOT NULL,
	"initial_risk" numeric(18, 4) DEFAULT '0' NOT NULL,
	"planned_rr" numeric(12, 4),
	"actual_rr" numeric(12, 4),
	"r_multiple" numeric(12, 4),
	"balance_before" numeric(18, 2),
	"balance_after" numeric(18, 2),
	"status" text DEFAULT 'closed' NOT NULL,
	"result" text DEFAULT 'be' NOT NULL,
	"market_bias" text DEFAULT '' NOT NULL,
	"htf_direction" text DEFAULT '' NOT NULL,
	"entry_timeframe" text DEFAULT '15m' NOT NULL,
	"htf_timeframe" text DEFAULT '4h' NOT NULL,
	"market_structure" text DEFAULT '' NOT NULL,
	"entry_model" text DEFAULT '' NOT NULL,
	"confluence" text DEFAULT '' NOT NULL,
	"entry_reason" text DEFAULT '' NOT NULL,
	"sl_justification" text DEFAULT '' NOT NULL,
	"tp_justification" text DEFAULT '' NOT NULL,
	"invalidation" text DEFAULT '' NOT NULL,
	"planned_exit" text DEFAULT '' NOT NULL,
	"followed_plan" boolean DEFAULT true NOT NULL,
	"news_related" boolean DEFAULT false NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"holding_minutes" integer,
	"pnl_overridden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trading_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"broker" text DEFAULT '' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"starting_balance" numeric(18, 2) NOT NULL,
	"current_balance" numeric(18, 2) NOT NULL,
	"account_type" text DEFAULT 'live' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"session_version" integer DEFAULT 0 NOT NULL,
	"name" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"timezone" text DEFAULT 'Africa/Lagos' NOT NULL,
	"theme" text DEFAULT 'dark' NOT NULL,
	"date_format" text DEFAULT 'yyyy-MM-dd' NOT NULL,
	"time_format" text DEFAULT 'HH:mm' NOT NULL,
	"base_currency" text DEFAULT 'USD' NOT NULL,
	"ai_permission" boolean DEFAULT false NOT NULL,
	"demo_mode" boolean DEFAULT false NOT NULL,
	"onboarding_complete" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "ai_reviews" ADD CONSTRAINT "ai_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backtest_trades" ADD CONSTRAINT "backtest_trades_backtest_id_backtests_id_fk" FOREIGN KEY ("backtest_id") REFERENCES "public"."backtests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backtest_trades" ADD CONSTRAINT "backtest_trades_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backtests" ADD CONSTRAINT "backtests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backtests" ADD CONSTRAINT "backtests_strategy_id_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_sessions" ADD CONSTRAINT "custom_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_journals" ADD CONSTRAINT "daily_journals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_journals" ADD CONSTRAINT "daily_journals_account_id_trading_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instruments" ADD CONSTRAINT "instruments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychology_records" ADD CONSTRAINT "psychology_records_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychology_records" ADD CONSTRAINT "psychology_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_settings" ADD CONSTRAINT "risk_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_settings" ADD CONSTRAINT "risk_settings_account_id_trading_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenshots" ADD CONSTRAINT "screenshots_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenshots" ADD CONSTRAINT "screenshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_executions" ADD CONSTRAINT "trade_executions_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_executions" ADD CONSTRAINT "trade_executions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_tags" ADD CONSTRAINT "trade_tags_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_tags" ADD CONSTRAINT "trade_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_account_id_trading_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_strategy_id_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_accounts" ADD CONSTRAINT "trading_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_reviews_user_idx" ON "ai_reviews" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "backtest_trades_bt_idx" ON "backtest_trades" USING btree ("backtest_id");--> statement-breakpoint
CREATE INDEX "backtests_user_idx" ON "backtests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "custom_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "journals_user_idx" ON "daily_journals" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "journals_user_date_idx" ON "daily_journals" USING btree ("user_id","journal_date");--> statement-breakpoint
CREATE INDEX "instruments_user_idx" ON "instruments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "instruments_user_symbol_idx" ON "instruments" USING btree ("user_id","symbol");--> statement-breakpoint
CREATE INDEX "password_reset_user_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_token_idx" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "psych_user_idx" ON "psychology_records" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "psych_trade_idx" ON "psychology_records" USING btree ("trade_id");--> statement-breakpoint
CREATE INDEX "risk_user_idx" ON "risk_settings" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "risk_account_idx" ON "risk_settings" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "screenshots_trade_idx" ON "screenshots" USING btree ("trade_id");--> statement-breakpoint
CREATE INDEX "screenshots_user_idx" ON "screenshots" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "strategies_user_idx" ON "strategies" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tags_user_idx" ON "tags" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_user_name_idx" ON "tags" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "executions_trade_idx" ON "trade_executions" USING btree ("trade_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trade_tags_unique" ON "trade_tags" USING btree ("trade_id","tag_id");--> statement-breakpoint
CREATE INDEX "trades_user_idx" ON "trades" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trades_user_entry_idx" ON "trades" USING btree ("user_id","entry_at");--> statement-breakpoint
CREATE INDEX "trades_account_idx" ON "trades" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "trades_instrument_idx" ON "trades" USING btree ("user_id","instrument");--> statement-breakpoint
CREATE UNIQUE INDEX "trades_user_display_idx" ON "trades" USING btree ("user_id","display_id");--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "trading_accounts" USING btree ("user_id");