# Pre-review briefing — Placemaker.ai

Prepared 2026-09-10 ahead of the technical/security walkthrough call. This is working
notes, not polished documentation. Items marked **[to confirm]** are things Will needs to
verify or decide before/on the call; items marked **not set up** are honest gaps.

A test project can be created for you, or you can use the existing demo project — none of
the current projects are live with real members of the public yet, so nothing you post
reaches a real consultation. **[to confirm: which project / create reviewer account]**

---

## 1. Technology stack, key libraries, third-party services

**Application:** single Next.js 16 app (App Router, TypeScript, React 19), serving three surfaces
from one codebase, split by hostname in middleware:

- `platform.placemakerai.io` — the product (admin dashboard + public embeds/forms)
- `placemakerai.io` / `www` — marketing homepage (same deployment, rewritten route)

**Key libraries:**

| Concern | Library |
|---|---|
| ORM / database | Prisma 5.9 → PostgreSQL |
| Auth | NextAuth 4 (JWT strategy, credentials provider, bcryptjs hashing) |
| Maps | Google Maps JS API (`@react-google-maps/api`); Turf.js for server-side geometry |
| Data fetching | TanStack React Query |
| UI | Tailwind CSS, Lucide icons, framer-motion, Recharts, sonner |
| Email (out + in) | Resend (sending + inbound webhook, svix signature verification) |
| AI | Anthropic SDK — claude-opus-4-8 + Haiku classifier, Batch API for analysis runs |
| File storage | Vercel Blob (admin-uploaded images: tour media, map overlays) |
| Error tracking | @sentry/nextjs (wired client/edge/server; inert until DSN env var set) |
| Tests | Vitest |

*(Updated 2026-09-16: upgraded Next 14.2 → 16.3.5 / React 18 → 19.3 post-review; the unused
Leaflet packages were removed.)*

**Third-party services:** Vercel (hosting, DNS, blob storage, cron), Supabase (managed
Postgres), Resend (email), Anthropic (AI), Google Maps Platform (maps + geocoding),
postcodes.io + UK Parliament API + council ModernGov sites (representative auto-import,
read-only public APIs), Sentry (if activated).

## 2. Hosting, infrastructure, data flow

- **Hosting:** Vercel, serverless functions + edge middleware. DNS is on Vercel.
- **Database:** Supabase managed Postgres, `eu-central-1` (Frankfurt) — EU data residency.
  Move to London (`eu-west-2`) agreed at the review; runbook in
  `docs/database-backups-and-rollback.md`.
- **Data flow:**
  - Public visitors → embed iframes / JSON APIs (`/embed/*`, `/api/embed/*`,
    `/forms/*`) → Next.js API routes → Postgres. CORS is open on public embed APIs by
    design (embeds run on client websites).
  - Admins → dashboard (`/projects/*`) → authenticated API routes → Postgres.
  - AI analysis: admin-triggered → Anthropic Batch API (async) → results cached in
    `AnalysisResult` table. Feedback text is sent to Anthropic for processing.
  - Email out: Resend, from per-project addresses on the platform domain. Email in:
    Resend `email.received` webhook → `/api/inbound/resend` (svix-verified) → enquiry
    threads. MX for placemakerai.io points at Resend.
  - Images: admin uploads → Vercel Blob (public URLs).

## 3. Environments, deployment, rollback

*(Updated 2026-09-10 — the dev/prod split and CI were put in place ahead of this review.)*

- **Local dev** now runs against a local embedded Postgres (`npm run db:dev`, data in
  `.devdb/`, seeded admin user). The production database URL lives only in a gitignored
  `.env.prod` used by an explicit `db:push:prod` command.
- **Vercel preview/development deploys have no database access** — `DATABASE_URL` is
  scoped to Production only. (Previews can later be pointed at a dedicated preview DB.)
- **CI:** GitHub Actions on every push/PR — lint, unit tests, production build, plus an
  `npm audit` of production dependencies (blocking on high/critical since 2026-09-16).
- **Staging environment** agreed at the review; setup + release flow in `docs/staging.md`
  (staging branch → staging.placemakerai.io → own Supabase project). Not yet provisioned.

---

## Agreed actions (review call, 2026-09-16)

| # | Action | Owner | Status |
|---|--------|-------|--------|
| 1 | Share repo access with Ravi (`github.com/willo54321/placemakerai`) | Will | Pending — needs Ravi's GitHub username |
| 2 | Load/stress testing on map + forms; check Vercel monitoring for usage/scaling signals | Ravi | Pending |
| 3 | Upgrade Next.js to latest + resolve CVEs (before beta launch) | Will | **Done 2026-09-16** — Next 16.3.5, React 19.3, `npm audit --omit=dev` clean |
| 4 | Add staging environment; stop audit-driven changes reaching prod untested | Will | Partially done — CI audit now blocking, plan in `docs/staging.md`; Vercel/Supabase provisioning pending |
| 5 | Define Supabase backup + rollback strategy | Will | **Done 2026-09-16** — `docs/database-backups-and-rollback.md`, `npm run db:backup:prod`; PITR enablement pending |
| 6 | Fix placemaker.ai branding references in the UI → placemakerai.io | Will | **Done 2026-09-16** |
| 7 | Move Supabase region Frankfurt → London (no cost difference, UK data residency) | Will | Pending — runbook in `docs/database-backups-and-rollback.md` |   