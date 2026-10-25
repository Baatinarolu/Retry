# Maintenance and bug audit

Review date: 2026-10-24

## Completed fixes

| Area | Finding | Resolution |
| --- | --- | --- |
| Dependencies | The pinned Next.js/PostCSS dependency tree included critical and high-severity advisories. | Upgraded Next.js and its ESLint config to 16.4.3, PostCSS to 8.5.31, and related patched packages. Production audit now reports zero findings. |
| Build | Production builds fetched Google Fonts and failed in restricted/offline environments. | Removed build-time font downloads and added deterministic local font stacks. |
| Account balances | Editing a trade after changing its account subtracted old P&L from the destination account. Reopening and deleting records also lacked consistent transactional updates. | Create, update, move, reopen, and delete now use database transactions, row locks, decimal arithmetic, and correct old/destination account adjustments. |
| Partial writes | Trades, balances, tags, executions, and psychology could be left partially written after a failure. | The complete trade write is atomic. Screenshot database failures clean up newly written files. |
| Trade IDs | Count-based IDs could collide after deletion or concurrent creates. | IDs use the highest existing yearly sequence while writes are serialized per user. |
| Analytics | Open trades were counted as break-even closed trades, distorting win rate, expectancy, and daily/equity output. | Realized analytics include closed trades only, with regression coverage. |
| Drawdown | Maximum drawdown percent used a later peak and could understate historical drawdown. | The percentage now uses the peak associated with the actual maximum drawdown. |
| Validation | Invalid dates, non-finite numbers, missing closed-trade exits, and zero-value edge cases could reach the database. | Added shared Zod validation, real calendar/date checks, ordered exits, finite decimal checks, and explicit override rules. |
| Ownership | Client-supplied strategy, tag, journal-account, backtest-strategy, and risk-account IDs were not consistently checked. | Related records are verified against the authenticated user; unknown accounts no longer fall back silently. |
| Authentication | A known fallback signing secret could be used in production; reset tokens were returned by the API; token consumption was racy; old sessions survived resets. | Production requires a strong secret, tokens are only returned in development, reset consumption is atomic, and session versions revoke old JWTs after reset. |
| Login redirect | The post-login target was accepted without a local-path check. | External and protocol-relative targets now fall back to the dashboard. |
| Import/export | CSV quoted newlines failed, same-file duplicates were missed, commit trusted preview flags, all instruments used forex-like defaults, and export escaping was incomplete. | Added a real CSV parser/serializer, commit-time revalidation and duplicate checks, instrument/specification mapping, import limits, and spreadsheet-formula protection. |
| Risk checks | Account filters were inconsistent, open trades interrupted loss streaks, and configured open-risk/profit-target rules were unused. | Risk queries are account-aware and bounded to the current UTC day/week; all configured rules now participate. |
| Backtesting | The form omitted the API-required entry price, and profit factor mixed R outcomes with missing currency amounts. | Completed the simulated-trade form and made backtest statistics explicitly R-based. |
| Calendar | Heat maps used exit dates but day details queried entry dates and dropped active filters. | Details now use exit-date filters and inherit the workspace filter state. |
| UI reliability | Failed requests could leave permanent spinners; edits could lose local time or draft executions; save failures left buttons stuck. | Added abortable requests, visible errors, complete draft restore, local-time conversion, and safe submit/upload cleanup. |
| Screenshots/PWA | MIME was trusted without content checks, missing assets broke service-worker installation, authenticated documents could be cached, and local files were not Vercel-persistent. | Added image signatures and nosniff headers, local brand/PWA assets, private-file cleanup, private Vercel Blob streaming/cleanup with local fallback, a 4 MB serverless-safe upload cap, and a safer service-worker cache policy. |
| Database setup | No checked-in migration or environment documentation was present. | Added an initial Drizzle migration, environment example, scripts, and setup/deployment documentation. |

## Verification performed

- `npm test` — 20 tests passing, including AI providers/permissions, Vercel defaults, and screenshot storage fallback.
- `npm run typecheck` — passing.
- `npm run lint` — passing with no warnings.
- `npm ci` — clean Vercel-style dependency installation passing.
- `VERCEL=1 VERCEL_URL=… npm run build` — production build passing on Next.js 16.4.3 with Vercel environment detection.
- `npm audit --omit=dev` — zero production dependency findings.
- `npm run db:generate -- --name initial_schema` — initial migration generated successfully from all 17 tables.

A live Neon/PostgreSQL instance was not available in this review environment. Run migration and API integration tests against a separate Neon staging branch before production rollout, especially account-move/reopen/delete flows and password-reset revocation.

The Ollama provider is covered by mocked regression tests, but live model inference was not run because Ollama and its model are not installed in this environment. A private Vercel Blob store was not connected, so remote Blob upload/streaming still requires a deployment smoke test.

## Remaining recommendations

1. **Email delivery:** connect a production password-reset email provider. Production intentionally does not expose reset tokens.
2. **Shared infrastructure:** replace process-local rate limiting before running multiple app instances. Vercel deployments now use private Blob storage; other multi-instance hosts still need shared object storage.
3. **Demo isolation:** the demo workspace is shared and now labeled accordingly. Make it read-only or provision isolated demos for a public service.
4. **Currency and timezones:** completed for reporting: dated, user-supplied FX rates explicitly convert mixed-account analytics, reports, Strategy Lab, dashboard/calendar aggregates, and AI facts into the workspace base currency; missing or conflicting rates fail closed. Native ledgers and raw exports remain in account currency, and all-account risk checks still refuse mixed native currencies. Timezone-aware reporting boundaries are covered by the reporting regressions.
5. **Integration tests:** add Neon/PostgreSQL-backed tests for transaction concurrency, migrations, authentication, and uploads.
6. **Development dependency audit:** the full audit retains four moderate findings in Drizzle Kit's deprecated esbuild loader chain. These are development-only; track an upstream cleanup rather than applying an untested forced downgrade/override.
7. **ESLint major upgrade:** remain on the compatible ESLint 9 line until the Next.js plugin stack officially supports ESLint 10 without peer conflicts.
