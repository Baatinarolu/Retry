CREATE TABLE "import_mapping_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"mapping" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "import_batches" ADD COLUMN "column_mapping" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "import_mapping_presets" ADD CONSTRAINT "import_mapping_presets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "import_mapping_presets_user_idx" ON "import_mapping_presets" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "import_mapping_presets_user_name_idx" ON "import_mapping_presets" USING btree ("user_id","name");