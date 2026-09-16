# Database backups, rollback strategy & London region move

Agreed at the 2026-09-16 review. Vercel's instant rollback covers application code only;
this defines the database side so the two can be coordinated.

## Current state

- Supabase managed Postgres, `eu-central-1` (Frankfurt) — moving to London, see below.
- Schema is applied with `prisma db push` (imperative, no versioned migrations, no down
  migrations). This is the main rollback gap.
- All uploaded files live in Vercel Blob, auth is NextAuth JWT — the database is the only
  stateful store to protect.

## Backup layers

1. **Supabase automated backups** — confirm the project is on a plan with daily backups,
   and enable **PITR (point-in-time recovery)** before beta launch. This is the primary
   safety net for data-loss incidents.
2. **Manual snapshot before every schema push:** `npm run db:backup:prod` runs
   `pg_dump -Fc` against the production URL from `.env.prod` into the gitignored
   `backups/` directory. Requires `pg_dump` locally (`brew install libpq`, then add it to
   PATH or `brew link --force libpq`). Run it immediately before every `db:push:prod`.
3. Optionally, a periodic off-platform dump (same command, cron/reminder) kept in
   encrypted storage, as insurance independent of Supabase.

## Rollback strategy

- **App-only bug:** Vercel instant rollback. Safe *provided schema changes are always
  backward-compatible* (see rule below) — the previous app version keeps working against
  the current schema.
- **Golden rule — expand/contract:** every schema push must be compatible with the
  previous deploy. Add tables and nullable/defaulted columns freely; never drop or rename
  a column/table in the same release as the code that stops using it. Do the destructive
  half in a later release once the code no longer references it. This keeps Vercel
  rollback safe on its own for almost every incident.
- **Bad migration / data corruption:** restore the pre-push `pg_dump` snapshot
  (`pg_restore --clean --if-exists -d <DATABASE_URL> <file>.dump`) or use PITR to the
  minute before the incident, then roll the app back to the matching version. Accept that
  writes after the restore point are lost — announce a brief freeze first (trivial while
  no consultations are live).
- **Recommended before beta:** switch from `prisma db push` to `prisma migrate` so schema
  changes become versioned SQL files, reviewable in PRs and applied deterministically
  (`prisma migrate deploy`) as part of the release flow instead of ad-hoc pushes.

## Region move: Frankfurt → London (`eu-west-2`)

Supabase cannot change a project's region in place — this is a migration to a new
project. **Do it before beta launch while nothing is live and the dataset is small**; the
whole thing is a ~30-minute maintenance window today.

1. Create a new Supabase project in **London (`eu-west-2`)**, same Postgres major version.
2. Take a fresh dump of Frankfurt: `npm run db:backup:prod`.
3. Restore into the London project:
   `pg_restore --no-owner --no-privileges -d "<LONDON_DATABASE_URL>" backups/prod-<ts>.dump`
4. Verify: spot-check row counts (`User`, `Project`, `PublicPin`, `Enquiry`, `Subscriber`),
   log into the app locally pointed at the London URL.
5. Update `DATABASE_URL` in Vercel (Production scope) and in `.env.prod`, redeploy, and
   smoke-test platform.placemakerai.io (login, map embed, enquiry submit).
6. Pause the Frankfurt project and keep it for a week as a fallback, then delete it.
7. Use the pooled (pgbouncer) connection string from the new project if the old one did —
   check which form the current `DATABASE_URL` uses before swapping.

Notes: the app has no other Supabase coupling (no Supabase Auth/Storage/Realtime), so the
move is Postgres-only. New project means new connection string and database password —
nothing else references the old project.
