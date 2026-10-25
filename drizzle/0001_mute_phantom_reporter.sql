ALTER TABLE "trades" ADD COLUMN "realized_at" timestamp with time zone;--> statement-breakpoint
UPDATE "trades" SET "realized_at" = COALESCE("exit_at", "entry_at") WHERE "status" = 'closed';--> statement-breakpoint
UPDATE "trades" AS t
SET "realized_at" = x."latest"
FROM (
  SELECT "trade_id", MAX("executed_at") AS "latest"
  FROM "trade_executions"
  WHERE "type" IN ('scale_out', 'exit')
  GROUP BY "trade_id"
) AS x
WHERE t."id" = x."trade_id";--> statement-breakpoint
CREATE INDEX "trades_user_realized_idx" ON "trades" USING btree ("user_id","realized_at");