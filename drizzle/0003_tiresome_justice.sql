CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"file_name" text DEFAULT '' NOT NULL,
	"file_hash" text NOT NULL,
	"original_csv" text NOT NULL,
	"status" text DEFAULT 'preview' NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"imported_rows" integer DEFAULT 0 NOT NULL,
	"rejected_rows" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"committed_at" timestamp with time zone,
	"rolled_back_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "import_batch_id" uuid;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "source_key" text;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "source_hash" text;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_account_id_trading_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "import_batches_user_idx" ON "import_batches" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "import_batches_account_idx" ON "import_batches" USING btree ("account_id");--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trades_import_batch_idx" ON "trades" USING btree ("import_batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trades_source_idx" ON "trades" USING btree ("user_id","account_id","source_key");