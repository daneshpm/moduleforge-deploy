# Database migrations (Prisma Migrate)

Production runs on **Postgres (Neon)**. Until now the build ran `prisma db push`, which has no history and no
review step. This repo now contains a Postgres **baseline migration** (`server/prisma/migrations/0_init`) so
schema changes can be reviewed in git and applied with `prisma migrate deploy`.

The build keeps using strict `db push` **until you set `USE_MIGRATE=true`** in Vercel. Do not set it before
completing Part A.

## How the schema files work

| File | Provider | Purpose |
|---|---|---|
| `server/prisma/schema.prisma` | `postgresql` | **Source of truth** (committed). Production + migrations. |
| `server/prisma/schema.sqlite.prisma` | `sqlite` | **Generated** by `scripts/make-sqlite-schema.js` (committed, never hand-edited). Local dev + tests. |
| `server/prisma/migrations/` | Postgres SQL | Migration history. `0_init` = baseline of the current schema. |

`vercel-build.js` no longer rewrites `schema.prisma`. A `postgres://` URL uses `schema.prisma`; a `file:` URL (local
build only) uses the sqlite schema.

---

## Part A — Owner runbook: moving the live Neon DB onto Prisma Migrate

Why this is needed: the live DB was created by older `db push` runs, so it already has tables. `migrate deploy`
would try to run `0_init` (`CREATE TABLE ...`) and fail on existing tables. So we (1) bring live up to the
current schema, then (2) tell Prisma "`0_init` is already applied".

Run everything from the repo root (`npm install` done). Use PowerShell or bash; examples show bash.

### A1. Back up first (Neon)
1. Neon console -> your project -> **Branches** -> **Create branch** from `main` (the production branch), name it
   `pre-migrate-YYYYMMDD`. This is an instant copy-on-write snapshot; it is your rollback point (see Rollback).
2. Optionally also create a second branch `migrate-rehearsal` — you will rehearse on it first.
3. Copy the connection string of the **rehearsal** branch (Connection Details -> pick the branch).

### A2. Rehearse on the branch, not production
Do steps A3–A6 against the `migrate-rehearsal` URL first. Only repeat on production when it is clean.

### A3. See what the live DB lacks (read-only)
The helper never prints the URL and runs only `prisma migrate diff`, which introspects and executes no DDL.
```bash
# bash
export LIVE_DATABASE_URL='postgresql://USER:PASSWORD@HOST/DB?sslmode=require'
node scripts/db-diff-live.js --out live-to-current.sql
unset LIVE_DATABASE_URL
```
```powershell
# PowerShell
$env:LIVE_DATABASE_URL = 'postgresql://USER:PASSWORD@HOST/DB?sslmode=require'
node scripts/db-diff-live.js --out live-to-current.sql
Remove-Item Env:LIVE_DATABASE_URL
```
(Use `DIFF_URL_VAR=OTHER_NAME` if you prefer a different variable name. Don't commit `live-to-current.sql`;
it is in your working dir only.)

Read `live-to-current.sql`. Expected: `ALTER TABLE ... ADD COLUMN` for newer fields (contract columns, install
fields, `contentHash`, etc.) and possibly new tables/indexes. **Red flags — stop and ask a developer:**
`DROP TABLE`, `DROP COLUMN`, `ALTER COLUMN ... TYPE`, or `SET NOT NULL` on a column with existing rows (adding a
NOT NULL column without a default fails on non-empty tables). The diff is empty (`-- This is an empty migration.`)
if the live DB already matches.

### A4. Decide how to apply the sync
Keep only `0_init` in git. The baseline already equals the current schema; `live-to-current.sql` is a one-off
that makes the *live* DB match it, so it is applied by hand (A5) and not committed as a migration. (Committing it
as `1_sync_to_current` would break fresh databases, where `0_init` already creates those columns.)

### A5. Apply the diff SQL to the live DB (manual)
Use the Neon SQL Editor (select the right branch!) or `psql`:
```bash
psql "$LIVE_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f live-to-current.sql
```
`--single-transaction` makes it all-or-nothing. Re-run A3 afterwards: the output must now be empty
(`-- This is an empty migration.`). If not, do not continue.

### A6. Mark the baseline as applied
This only writes a row into `_prisma_migrations`; it runs no schema SQL.
```bash
export DATABASE_URL="$LIVE_DATABASE_URL"
npx prisma migrate resolve --applied 0_init --schema server/prisma/schema.prisma
npx prisma migrate status --schema server/prisma/schema.prisma   # expect: "Database schema is up to date!"
unset DATABASE_URL
```

### A7. Switch the build over
1. After rehearsing on the branch and doing A3–A6 on production, in Vercel -> Settings -> Environment Variables add
   `USE_MIGRATE=true` (Production first).
2. Redeploy. The build log should say `step: migrate-deploy` and then `prisma migrate deploy`: "No pending migrations".
3. From now on, every schema change is a reviewed migration file in git; the build applies pending ones.

**Order matters:** do A3–A6 *before* setting `USE_MIGRATE=true`. If you set it first, `migrate deploy` fails with
P3005 ("database schema is not empty") and the build is aborted (safe: nothing is changed).

### Preview deployments
Preview builds with `USE_MIGRATE=true` would run `migrate deploy` against whatever `DATABASE_URL` Preview has.
Point Preview at a **Neon branch** (Neon's Vercel integration can create one branch per preview), never at the
production DB. Baseline the branch the same way (A6) — branches created *after* A6 inherit `_prisma_migrations`
and need nothing. Leave `USE_MIGRATE` unset for Preview if you want the old `db push` behaviour there.

### Rollback
- **Before A5/A6**: nothing changed; just stop.
- **A5 failed**: `--single-transaction` rolled back; fix the SQL and retry.
- **A5 succeeded but the app misbehaves**: the diff was additive (new nullable/defaulted columns, tables) so the
  previous app version still works against it; redeploy the previous Vercel deployment. To fully revert the data,
  use Neon: restore `main` from branch `pre-migrate-YYYYMMDD` (Neon **Restore** / swap branch). This loses writes made since.
- **Wrong `resolve`**: remove the bookkeeping row: `DELETE FROM "_prisma_migrations" WHERE migration_name = '0_init';`
  (or `migrate resolve --rolled-back 0_init`). Schema is untouched.
- **Turn the new path off**: unset `USE_MIGRATE` in Vercel and redeploy -> back to strict `db push`.
- A failed `migrate deploy` in the build leaves the migration marked failed; fix, then
  `prisma migrate resolve --rolled-back <name>` and redeploy. Prisma Migrate has no automatic "down" migrations —
  write a new forward migration to undo a change.

---

## Part B — Developer workflow (the `migrate dev` equivalent)

`prisma migrate dev` needs a Postgres shadow DB and would try to use the sqlite schema locally, so we use an
offline diff instead.

### Adding a schema change
1. Edit **`server/prisma/schema.prisma`** (Postgres; never edit `schema.sqlite.prisma`).
2. Generate the migration *before committing the schema change* (it diffs `HEAD:schema.prisma` -> your working copy):
   ```bash
   npm run db:new-migration -- add_widget_table
   ```
   This writes `server/prisma/migrations/<timestamp>_add_widget_table/migration.sql`. **Read the SQL.** Make
   additive/backward-compatible changes where possible (new columns nullable or with a default; two-step renames);
   Vercel runs the migration before the new code goes live, and old code keeps serving during the build.
3. Regenerate the sqlite schema and client for local dev/tests:
   ```bash
   npm run db:sqlite-schema
   cd server && npm run prisma:generate && cd ..
   ```
4. Run `npm run db:check-schema` and `cd server && DATABASE_URL=file:./dev.db npm test`; commit schema.prisma,
   schema.sqlite.prisma and the migration folder together.

(If you already committed the schema change, diff against the earlier commit manually:
`git show <old>:server/prisma/schema.prisma > old.prisma` then
`npx prisma migrate diff --from-schema-datamodel old.prisma --to-schema-datamodel server/prisma/schema.prisma --script`.)

### Local dev / tests
- `server` scripts `prisma:generate` / `prisma:push` use `schema.sqlite.prisma`; `npm test` runs `pretest`
  (regenerates the sqlite schema + client), and the tests `db push` the sqlite schema into a local file DB.
- Local `DATABASE_URL` stays `file:./dev.db`. Local DB is built with `db push` (throwaway); only Postgres uses migrations.
- The generated Prisma client is shared in `node_modules`: after running `prisma generate` for the Postgres schema
  (`npm run prisma:generate:pg --prefix server`, or a local `vercel-build` with a postgres URL), re-run
  `npm run prisma:generate --prefix server` before tests/dev (`npm test` does this automatically).

### CI
```bash
npm run db:check-schema      # fails if schema.sqlite.prisma drifted from schema.prisma, or provider != postgresql
npm run test:scripts         # unit tests for the build's db-step decision logic
```

### Provider differences to keep in mind
Query behaviour was not changed. Things that behave differently between SQLite (tests) and Postgres (prod):
- String `contains`/`startsWith`/`equals` filters are **case-sensitive on Postgres**, case-insensitive (ASCII) on SQLite.
  `mode: 'insensitive'` exists only on Postgres (not used in the code today; adding it would break sqlite typings/tests).
- `@db.*` native types are Postgres-only; `make-sqlite-schema.js` strips them, so they are safe to add.
- JSON is stored as `String?` columns (e.g. `moduleJson`) in both; no `Json` type is used. Prisma `Json`, scalar
  lists and enums would not work on SQLite — avoid them or the tests stop working.
- Tests cannot catch Postgres-specific SQL errors (e.g. NOT NULL additions on non-empty tables) — review migration SQL.
