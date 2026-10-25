# TradeMind Journal

A private, multi-account trading journal built with Next.js, Neon PostgreSQL, Drizzle ORM, React, and Tailwind CSS. It covers live trades, executions, psychology, chart screenshots, risk rules, strategy versions, manual backtests, analytics, reports, CSV import/export, local drafts, and an optional AI coach.

## What is included

- **Trade journal:** long/short trades, contract/tick/pip specifications, fees, partial fills, tags, strategy links, notes, and psychology records.
- **Execution-led reconciliation:** when fills are supplied, weighted-average entries/exits, realized P&L, remaining quantity, fees, R, and holding time are derived from those fills rather than duplicated summary fields. Invalid over-exits, early exits, reopening, and status mismatches are rejected.
- **Correct realized metrics:** open trades are excluded from closed-trade win rate, expectancy, drawdown, and equity statistics. Realized P&L from a partially closed open trade still updates its account balance.
- **Deterministic account ledger:** create/edit/move/delete operations rebuild balances and historical before/after snapshots from the account's starting balance plus realized trade P&L in database transactions.
- **Risk workspace:** per-account daily/weekly loss limits, trade and loss-streak limits, open-risk limits, position limits, R:R checks, and daily targets.
- **Analysis and review:** dashboard, breakdowns, calendar, reports, strategy statistics, and separate R-based simulated backtests.
- **Data portability:** validated CSV previews, duplicate detection, spreadsheet-safe CSV exports, and JSON trade export.
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
npm test            # Calculation, CSV, and validation tests
```

The build needs `DATABASE_URL` at module initialization. Use a real database URL in deployment; no database connection is needed for the purely unit-tested calculation modules.

## Useful scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` / `npm run typecheck` | Static checks |
| `npm test` / `npm run test:watch` | Regression tests |
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
- `NEXT_PUBLIC_APP_URL` — canonical public URL used in metadata.
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

- **Password resets:** development can display a one-time token because no email provider is bundled. Production never returns reset tokens in API responses; connect an email delivery flow before enabling public self-service resets.
- **Database:** apply migrations before starting the new version. This release adds session versions and additional uniqueness constraints.
- **Uploads:** Vercel uses a private Blob store automatically. Outside Vercel, screenshots use `data/uploads` unless Blob credentials are configured; back up that directory and use a persistent volume for self-hosting.
- **Rate limits:** the built-in limiter is process-local. Use a shared Redis/database limiter at the edge when running multiple instances.
- **Demo mode:** the demo is a shared sample workspace. Its UI warns users not to enter private data; isolate or make it read-only for a public deployment.
- **Execution ledger:** weighted-average cost is currently used within a same-direction trade. A flat trade cannot be reopened; start a new trade for the next round trip. Reversals and stop/target change history remain separate feature work. Existing execution-based records retain their prior values until they are next saved; new and edited records reconcile from fills.
- **Reporting:** use an account filter when accounts have different currencies. Automatic FX conversion and user-timezone period boundaries remain separate feature work; current cross-account totals are raw numeric sums and period boundaries are UTC. Closed-trade analytics intentionally exclude positions that remain open, including any partially realized amount already reflected in the account balance.
- **Environment:** The project owner has chosen to track `.env` in this repository. Everyone with repository access can read and use the included database and session credentials.

## Security and dependency status

The production dependency audit is clean after the Next.js/PostCSS upgrade. The full audit currently reports only moderate development-tool findings in Drizzle Kit's deprecated esbuild loader chain; avoid forcing unrelated overrides and re-check upstream updates regularly.

See [`AUDIT.md`](./AUDIT.md) for the completed review and remaining recommendations.
