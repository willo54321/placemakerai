# Staging environment & release flow

Agreed at the 2026-09-16 review: nothing should reach production untested — including
dependency and security bumps (the `npm audit` concern). Vercel previews alone don't cover
this because they have no database. This sets up a real staging environment.

## Model

- **`staging` git branch** → auto-deploys to a fixed staging domain with its own database.
- **`main`** → production, as today.
- CI (lint, tests, build, blocking `npm audit`) runs on every PR and on pushes to both
  `staging` and `main` (already configured in `.github/workflows/ci.yml`).

## One-time setup (Will — Vercel + Supabase dashboards)

1. **Staging database:** create a second Supabase project, region **London (`eu-west-2`)**.
   Creating staging in London first doubles as a rehearsal for the production region move
   (see `docs/database-backups-and-rollback.md`).
2. **Staging env vars in Vercel:** Project → Settings → Environment Variables → add
   Preview-scoped vars limited to the `staging` branch:
   - `DATABASE_URL` → the staging Supabase connection string
   - `NEXTAUTH_URL=https://staging.placemakerai.io`
   - `NEXTAUTH_SECRET` → a fresh secret (not the production one)
   - `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, etc. as needed — prefer separate/sandbox keys
     where the service offers them. Leave `RESEND_WEBHOOK_SECRET` unset on staging unless
     inbound email is being tested.
3. **Staging domain:** Project → Settings → Domains → add `staging.placemakerai.io`,
   assign it to the `staging` branch.
4. **Branch:** `git checkout main && git checkout -b staging && git push -u origin staging`.
5. **Schema:** create a gitignored `.env.staging` with the staging `DATABASE_URL`, then
   `npm run db:push:staging`. Seed a staging admin user manually or via Prisma Studio.

## Release flow

1. Feature branch → PR → CI must pass (audit is now blocking).
2. Merge to `staging` → verify on `staging.placemakerai.io` against the staging DB.
3. Merge `staging` into `main` → production deploy.
4. Dependency/security bumps follow the same path — never `npm audit fix` straight to
   `main`.
5. Schema changes: `db:push:staging` alongside the staging deploy, `db:push:prod` (Will
   runs this) alongside the production merge, after `npm run db:backup:prod`.
