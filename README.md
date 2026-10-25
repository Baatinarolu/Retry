# TradeMind Journal

A private, multi-account trading journal built with Next.js, Neon PostgreSQL, Drizzle ORM, React, and Tailwind CSS. It covers live trades, executions, psychology, chart screenshots, risk rules, strategy versions, manual backtests, analytics, reports, CSV import/export, local drafts, and an optional AI coach.

## What is included

- **Trade journal:** long/short trades, contract/tick/pip specifications, fees, partial fills, tags, strategy links, notes, and psychology records.
- **Execution-led reconciliation:** when fills are supplied, weighted-average entries/exits, realized P&L, remaining quantity, fees, R, and holding time are derived from those fills rather than duplicated summary fields. Invalid over-exits, early exits, reopening, and status mismatches are rejected.
- **Execution review:** ordered-fill price/running-realized-P&L chart, target attainment, execution-observed MAE/MFE, optional manually recorded price paths with recorded-path MAE/MFE and gross best-recorded-exit analysis, and saved review status/next-time actions. No live market feed or unrecorded ticks are inferred.
- **Stop/target history:** timestamped complete snapshots of manual stop/target states, including explicit additions and removals, with deterministic change counts and backup/restore support.
- **Linked reversals:** atomically close an open execution-led position and create a separate opposite-direction trade with explicit prices, quantity, fees, risk levels, and lineage.
- **Correct realized metrics:** open trades are excluded from closed-trade win rate, expectancy, drawdown, and equity statistics. Realized P&L from a partially closed open trade still updates its account balance.
- **Deterministic account ledger:** create/edit/move/delete operations rebuild balances and historical before/after snapshots from the account's starting balance plus realized trade P&L in database transactions. Each trade stores a realization timestamp for its final exit or latest partial reduction.
- **Reporting correctness:** date-only filters and analytics buckets use the workspace timezone with DST-aware boundaries. Same-currency reporting stays native; mixed-account analytics, reports, calendar/dashboard aggregates, and AI facts opt into explicit workspace-base-currency conversion.
- **Auditable FX conversion:** Settings → FX rates stores user-owned, dated manual quotes. Conversion uses the latest effective direct quote or a consistent reciprocal quote at each trade’s realization timestamp; missing or conflicting rates fail closed. Native account balances, stored trade amounts, R multiples, and risk checks are not silently converted.
- **Cash ledger:** deposits, withdrawals, dividends, account-level fees, prop payouts, and signed adjustments are stored separately from trading P&L. Cash movements use the account currency and are included in deterministic balance rebuilds.
- **Risk workspace:** per-account daily/weekly loss limits, trade and loss-streak limits, open-risk limits, position limits, R:R checks, and daily targets.
- **Analysis and review:** dashboard, breakdowns, calendar, reports, strategy statistics, review-status filters, a review queue, leave-one-out outlier sensitivity, reusable saved views, realization-ordered and position-aware behavior sequences, and separate R-based simulated backtests.
- **Data portability:** validated summary and execution CSV previews, reusable broker column-mapping presets with batch snapshots, account-aware source IDs/hashes, atomic import batches with reconciliation and rollback, original-CSV retention, spreadsheet-safe native-currency CSV exports, trade JSON with account currency, and a versioned full-workspace backup/restore with the FX rate book and private attachments.
- **Privacy controls:** authenticated screenshot delivery, image signature checks, opt-in external AI summaries, and session revocation after password resets.
- **PWA basics:** install metadata, local assets, offline draft storage, and a service worker that does not cache authenticated document responses.

## Requirements

- Node.js 22 (also pinned for Vercel)
- A [Neon](https://console.neon.tech/) PostgreSQL project
- npm

## Local setup

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Create a Neon project and open its **Connect** dialog. Copy the **pooled connection string** (its host normally includes `-pooler`), then configure the environment:

   ```bash
   cp .env.example .env
   ```

   Set `DATABASE_URL` to the pooled Neon URL. The app uses Neon’s transaction-capable WebSocket pool rather than the HTTP-only query driver. Development has a local-only JWT fallback, but you should still generate a strong secret:

   ```bash
   openssl rand -base64 48
   ```

   Put the generated value in `AUTH_SECRET`. **Production refuses to sign sessions without a configured secret of at least 32 characters.**

3. Apply the checked-in migration:

   ```bash
   npm run db:migrate
   ```

   For local schema prototyping, `npm run db:push` is also available. Generate a new migration for intentional schema changes with `npm run db:generate`.

4. Start the app:

   ```bash
   npm run dev
   ```

   Open `http://localhost:3000`.

## Free local AI coach

The default AI provider is [Ollama](https://ollama.com/), with no API key or per-request charges. You provide the computer and memory needed to run the model.

1. Install and start Ollama on the same machine as the Next.js server.
2. Pull the configured model:

   ```bash
   ollama pull qwen2.5:3b
   ```

3. Keep `AI_PROVIDER=ollama` and enable **AI permission** in Settings. If Ollama is unavailable, the app returns its free rule-based review instead of failing.

For a deployed app, `OLLAMA_BASE_URL` must point to an Ollama server reachable from the app over private networking; `127.0.0.1` refers to the app server itself. Do not expose an unauthenticated Ollama port publicly. Set `AI_PROVIDER=rules` to disable language-model calls entirely. Hosted AI free tiers are not required.

## Quality checks

```bash
npm run check       # TypeScript + ESLint + regression tests
npm run build       # Production Next.js build
npm test            # Calculation, CSV, golden-file, and validation tests
TRADEMIND_TEST_DATABASE_URL=... npm run test:integration  # Opt-in real PostgreSQL checks
```

The two committed import fixtures under `tests/fixtures/import/` pin canonical summary and execution preparation, including source hashes and scaled fills. The integration suite is skipped without `TRADEMIND_TEST_DATABASE_URL`; when enabled it applies every checked-in migration to a **dedicated disposable test database**, verifies concurrent rate-limit atomicity and hashed keys, exercises the live mixed-currency reporting context, and performs an export/delete/restore cycle for accounts and FX rates. Never point it at production or the application's configured database. It is not a substitute for a production migration/restore drill.

The build needs `DATABASE_URL` at module initialization. Use a real database URL in deployment; no database connection is needed for the purely unit-tested calculation modules.

## Useful scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` / `npm run typecheck` | Static checks |
| `npm test` / `npm run test:watch` | Regression and golden-file tests |
| `npm run test:integration` | Opt-in tests against a dedicated PostgreSQL test database |
| `npm run db:generate` | Generate a Drizzle migration from schema changes |
| `npm run db:migrate` | Apply checked-in migrations |
| `npm run db:push` | Push the schema directly during local development |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run assets:generate` | Regenerate the local logo and illustration assets |

## Environment variables

See `.env.example`.

- `DATABASE_URL` — required pooled Neon connection string used by the app and Drizzle Kit. Store the real value only in `.env` or deployment secrets.
- `AUTH_SECRET` — required in production; use a random value of at least 32 characters.
- `NEXT_PUBLIC_APP_NAME` — public product name.
- `NEXT_PUBLIC_APP_URL` — canonical public URL used in metadata and production password-reset links.
- `RESEND_API_KEY` and `PASSWORD_RESET_FROM_EMAIL` — optional server-only Resend HTTPS delivery settings. Configure both together; production reset requests fail closed with 503 until they are present. No email SDK or client credential is required.
- `AI_PROVIDER` — defaults to `ollama` locally and `rules` on Vercel; `openai` is the optional paid provider.
- `OLLAMA_BASE_URL` and `OLLAMA_MODEL` — local Ollama endpoint and model; no API key required.
- `OPENAI_API_KEY` and `OPENAI_MODEL` — optional paid external coach. No language model is called unless the signed-in user has explicitly enabled AI permission.
- `BLOB_READ_WRITE_TOKEN`, `BLOB_STORE_ID`, and `VERCEL_OIDC_TOKEN` — normally supplied by the connected private Vercel Blob store; do not invent these values.

## Deploy to Vercel

`vercel.json` configures the Next.js build with npm and Node 22. No custom output directory or standalone server is required.

1. Import the repository into Vercel. Set these project environment variables for **Production** and, with a separate Neon branch, **Preview**:
   - `DATABASE_URL` — the Neon pooled connection string.
   - `AUTH_SECRET` — the same strong session secret used by the relevant environment.
   - `NEXT_PUBLIC_APP_NAME` and, for production, `NEXT_PUBLIC_APP_URL=https://your-domain`.
2. In **Storage**, create a **private Blob store** and connect it to the project. Vercel injects the Blob settings and uses automatically rotated OIDC credentials at runtime. Private charts are streamed through the existing authenticated screenshot route. Server uploads are capped at 4 MB to stay below Vercel's function request limit.
3. Apply migrations locally with `npm run db:migrate`, or use the manual GitHub Actions workflow below before opening the deployment.

   Do not run production migrations automatically in every Preview build. Use a separate Neon branch for Preview.
4. Deploy with the normal Vercel Git workflow.

On Vercel, the coach defaults to `AI_PROVIDER=rules` because Ollama is not available inside the function. To use a model, explicitly configure a reachable provider; never point `OLLAMA_BASE_URL` at your own computer's localhost from Vercel. Local development continues to use Ollama by default.

## Run migrations with GitHub Actions

A ready-to-use workflow template is included at `docs/db-migrate.yml`. It runs only when manually started and prevents overlapping migration runs.

1. In GitHub, open **Settings → Secrets and variables → Actions → New repository secret**. Add `DATABASE_URL` using the existing Neon pooled connection string. The migration does not need `AUTH_SECRET`, Blob credentials, or AI keys.
2. Merge the application into the default branch so the workflow can check out `package.json` and the migration files. If `.github/workflows/db-migrate.yml` is not already present, open the template, copy its contents, and use GitHub's **Add file → Create new file** action to create that workflow path on the default branch. Committing through your own GitHub web session does not require GitHub App workflow permission.
3. Open **Actions → Migrate Neon database → Run workflow**, select the default branch, and confirm. The runner installs Node 22 and dependencies, then executes `npm run db:migrate` with the secret.
4. Check the job log for a successful migration before deploying the app. Re-run it only when new migration files need to be applied.

## Production notes

- **Password resets:** development displays a one-time token only when no email provider is configured. With `RESEND_API_KEY`, `PASSWORD_RESET_FROM_EMAIL`, and a valid `NEXT_PUBLIC_APP_URL`, the server sends a 30-minute reset link through Resend's HTTPS API; production responses never contain tokens. Missing production configuration returns 503 before token creation, and failed deliveries invalidate the new token. Live email delivery has not been tested in this sandbox.
- **Database:** apply migrations before starting the new version. Migration 0001 adds and backfills `trades.realized_at` plus its reporting index; migration 0002 adds the separate `cash_flows` ledger and its idempotency/index constraints; migration 0003 adds import provenance, retained batches, and account-aware source uniqueness; migration 0004 adds shared rate-limit buckets; migration 0005 adds trade review status, last-reviewed timestamps, and next-action text; migration 0006 adds workspace-owned saved views; migration 0007 adds import mapping presets and the mapping snapshot retained by each import batch; migration 0008 adds owned, timestamp-ordered trade price points for recorded-path review; migration 0009 adds owned stop/target history snapshots; migration 0010 adds one-to-one reversal lineage between trades; migration 0011 adds the user-owned dated FX rate book. Existing closed trades and execution reductions are covered by the 0001 backfill.
- **Uploads:** Vercel uses a private Blob store automatically. Outside Vercel, screenshots use `data/uploads` unless Blob credentials are configured; back up that directory and use a persistent volume for self-hosting.
- **Rate limits:** auth and AI requests use an atomic fixed-window limiter in PostgreSQL, shared across application instances. Raw IP/user keys are hashed before storage, expired buckets are cleaned opportunistically, and limiter outages return 503 rather than silently bypassing protection. Apply migration 0004 before deploying these code paths.
- **Demo mode:** the demo is a shared, read-only sample workspace. Every workspace-mutating API handler rejects demo writes with 403; read-only risk checks and exports remain available. The UI tells users to create their own workspace to save changes.
- **Execution review:** running P&L is realized-only and includes recorded fill fees; final points reconcile to the execution ledger, including trade-level costs and manual net overrides. Execution-observed MAE/MFE remain separate from recorded-market-path metrics.
- **Recorded price paths:** execution-led trades can store up to 500 manually recorded prices with distinct timestamps inside the entry/exit range (or up to now for open trades). Recorded-path MAE/MFE replay weighted-average open exposure at each observation. Best recorded exit is a closed-trade gross counterfactual using realized prior exits plus remaining open exposure, without invented fees or slippage; it is not a complete market replay or a guaranteed executable exit. Entries apply before same-time observations and reductions afterward. The actual-gross/best-recorded-gross ratio can exceed 100% when the path is incomplete. Open trades do not receive a final-exit counterfactual, and unrecorded ticks are never inferred. Paths are included in workspace backup/restore.
- **Review analytics:** review filters and the dashboard queue include open and closed trades. Outlier dependence is a descriptive leave-one-out sensitivity check: shares use gross profit/loss, while net P&L and expectancy are recalculated after removing the selected record. It does not establish causation.
- **Behavior sequences:** next-trade comparisons use closed-trade realization order and complementary samples for loss/win, plan-break, FOMO, revenge, and early-exit events. The optional next-new-position mode instead chooses the earliest closed trade entered strictly after the event's realization, skipping overlapping positions and excluding equal timestamps as ambiguous; a following position can be shared by multiple events. Both views are correlations, not causal findings, and neither is a complete market or position-history reconstruction.
- **Saved views:** up to 30 named filter sets per workspace are stored server-side, included in full-workspace backup/restore, and writable only by non-demo users. Applying a view resets omitted fields to their empty defaults.
- **Stop/target history:** any trade can store up to 200 complete snapshots with distinct effective timestamps inside its entry/exit range (or up to now for open trades). Blank stop/target values explicitly mean no level; they do not mean unknown. Change counts include additions, removals, and numeric changes after the first snapshot, but do not infer why a level moved. These are manual journal records, not broker order events, and they do not alter the current stop/target fields, planned R, or target attainment. Histories are included in workspace backup/restore.
- **Reversals:** an open execution-led trade can be reversed once into a linked opposite-direction trade. The original's full remaining quantity closes and the new position uses its own explicitly recorded quantity, entry price, fees, stop, target, and round trip; close and entry prices may differ. Reversal time must be later than the last existing fill so same-time execution IDs cannot reorder the close on reload. The write, lineage, and account-balance rebuild are atomic. Original price paths/risk snapshots must remain within the new exit bound, and prior manual net overrides or trade-level costs are not copied to the new trade. Imported execution groups remain same-direction; reversal is an explicit journal action rather than an inferred CSV fill type. Lineage is included in workspace backup/restore.
- **Execution ledger:** weighted-average cost is used within each same-direction trade. A flat trade cannot be reopened inside its own execution stream; use a new trade for the next round trip or the linked reversal action for an opposite position. Existing execution-based records retain their prior values until they are next saved; new and edited records reconcile from fills.
- **Reporting:** timestamps remain UTC instants in PostgreSQL, while date-only filters, daily/monthly buckets, calendar details, AI review periods, and risk windows use the user's IANA timezone. `dateField=exit` means the realization timestamp (final exit or latest partial reduction); entry-date filtering remains available. Same-currency analytics remain native. For mixed accounts, analytics, reports, Strategy Lab, dashboard/calendar aggregates, and AI facts explicitly convert closed-trade P&L into the workspace base currency using dated rates effective at realization; converted rows are labeled with the reporting currency and conversion notices identify the method. Starting balances use the report timestamp. Missing or conflicting rates reject the report rather than guessing, and all-account risk checks remain fail-closed for mixed native currencies. Native trade lists/details and raw CSV/JSON exports retain account currency and original amounts; converted analytics never overwrite them. Cash movements affect account balances but are deliberately excluded from trading P&L statistics. Closed-trade analytics intentionally exclude positions that remain open, including any partially realized amount already reflected in the account balance.
- **Backups:** `/api/backup` exports a versioned workspace envelope covering accounts, cash movements, executions, price paths, stop/target histories, reversal lineage, the user-owned FX rate book, strategies, journals, psychology, backtests, settings, import batches, and base64-encoded private image attachments. Passwords, session tokens, reset tokens, and the server-controlled demo role are never exported or restored. Restore requires the exact `RESTORE WORKSPACE` confirmation, validates references and image signatures before replacement, stages new files, rebuilds account balances, and rolls back database changes on failure. Portable backups are capped at 48 MB total and 32 MB of attachment bytes; Vercel's smaller function request limits may require a self-hosted/segmented backup for large workspaces. A live restore drill remains outstanding.
- **Imports:** summary rows without an explicit `source_id`/`trade_id` use an exact canonical-row hash; look-alike trades with different economics are not rejected. Execution CSV requires a parent `trade_id` or `position_id` on every fill and an `execution_type` of `entry`, `scale_in`, `scale_out`, or `exit`. Use `total_pnl` for an optional broker net-P&L override and `total_commission` for a parent-level charge; per-fill `commission`/`fees` belong to executions. In Reports, explicit canonical-to-CSV mappings can be saved as up to 30 workspace presets; mapping values use the parser's normalized headers (lowercase, spaces converted to underscores). Preview retains the original CSV and exact mapping snapshot in the database, so later preset edits cannot change a batch's commit; commit writes valid records in one transaction, and rollback deletes that batch's trades and rebuilds balances. Presets and batch snapshots are included in workspace backup/restore. Rows imported before migration 0003 have no source identity and may need a one-time duplicate review. Live database reconciliation drills remain follow-up work.
- **Environment:** The project owner has chosen to track `.env` in this repository. Everyone with repository access can read and use the included database and session credentials.

## Security and dependency status

The production dependency audit is clean after the Next.js/PostCSS upgrade. The full audit currently reports only moderate development-tool findings in Drizzle Kit's deprecated esbuild loader chain; avoid forcing unrelated overrides and re-check upstream updates regularly.

See [`AUDIT.md`](./AUDIT.md) for the completed review and remaining recommendations.
