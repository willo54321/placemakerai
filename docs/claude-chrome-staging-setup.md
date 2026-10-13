# Claude in Chrome — finish the staging environment setup

Paste this whole document into Claude in Chrome. Will stays present throughout — he
handles logins and confirms anything flagged below.

## Context (already done — do not redo)

You are completing the staging environment for Placemaker.ai (plan: `docs/staging.md`).
Already in place:

- `staging` git branch exists and deploys to Vercel previews (latest deploy is Ready).
- Vercel env vars `NEXTAUTH_URL` and `NEXTAUTH_SECRET` already exist scoped to
  Preview → `staging` branch. **Do not create or edit these.**
- CI runs on the `staging` branch.

Your job is only the dashboard steps below, in order.

## Hard rules

1. **Never touch the production Supabase project** (`wcycfjiagksjcxafcpma`, Frankfurt /
   eu-central-1). You are creating a *new* project; nothing in the existing one gets
   opened, edited, paused, or deleted.
2. **Never edit or delete any Production-scoped Vercel env var.** You are adding one new
   var scoped to Preview + the `staging` branch only.
3. Nothing destructive, nothing billing-related, without Will's explicit OK in the moment.
4. Never paste connection strings, passwords, or secrets into the chat transcript — move
   them dashboard-to-dashboard via copy/paste only.
5. If a screen doesn't match these instructions, stop and ask Will rather than improvising.

## Step 1 — Create the staging Supabase project

1. Go to https://supabase.com/dashboard (Will logs in if needed).
2. In the same organisation as the existing project, click **New project**.
3. Settings:
   - Name: `placemaker-staging`
   - Database password: use **Generate a password**, and have Will save it in his
     password manager before continuing.
   - Region: **West EU (London)** / `eu-west-2` — this is deliberate; do not pick
     Frankfurt. (London-first doubles as the rehearsal for the planned prod region move.)
   - Plan/compute: smallest available tier. If any choice affects billing, confirm with
     Will first.
4. Create it and wait until provisioning finishes.

## Step 2 — Copy the connection string

1. In the new `placemaker-staging` project, click **Connect** (top bar).
2. Copy the **Session pooler** connection string (the pooler host on port **5432** —
   username looks like `postgres.<project-ref>`). This matches how production connects.
3. Replace the `[YOUR-PASSWORD]` placeholder with the password from Step 1. Keep this
   string on the clipboard for Steps 3 and for Will's `.env.staging` afterwards.

## Step 3 — Add DATABASE_URL to Vercel

1. Go to https://vercel.com → team **will neale's projects** → project **placemakerai**
   → **Settings → Environment Variables**.
2. **Add new** variable:
   - Key: `DATABASE_URL`
   - Value: the connection string from Step 2
   - Environments: **Preview only** — untick Production and Development.
   - In the Preview branch selector, restrict it to branch **`staging`**.
3. Save, then verify in the list: the new row must read `DATABASE_URL — Preview (staging)`.
   The existing `DATABASE_URL — Production` row must be untouched.

## Step 4 — Add the staging domain

1. Still in the Vercel project: **Settings → Domains → Add**.
2. Domain: `staging.placemakerai.io`
3. When asked which environment/branch it connects to, choose **Preview** / git branch
   **`staging`** (not Production). DNS is already on Vercel, so the record is created
   automatically — no registrar work needed.

## Step 5 — Redeploy staging so the new env var takes effect

Env vars only apply to deployments created after they're added.

1. Go to the **Deployments** tab, filter/find the most recent **Preview** deployment of
   the `staging` branch.
2. Open its ⋯ menu → **Redeploy** (reuse the same commit; no need to rebuild cache).
3. Wait for it to reach **Ready**.

## Step 6 — Verify

1. Visit https://staging.placemakerai.io — expect either the Placemaker homepage or a
   Vercel SSO login screen (deployment protection; Will logs in with his Vercel account).
   Either is success. A `DEPLOYMENT_NOT_FOUND` error is failure → recheck Step 4's branch
   assignment.
2. The login page will load but signing in won't work yet — the staging database has no
   schema or users until Will runs the local steps below. That's expected.

## Done — hand back to Will / Claude Code

The remaining steps are terminal work (not browser), back in the repo with Claude Code:

1. Create gitignored `.env.staging` containing the Step 2 connection string as
   `DATABASE_URL=...`
2. `npm run db:push:staging` (pushes the Prisma schema to the staging DB)
3. Seed a staging admin user
4. Log in at https://staging.placemakerai.io to confirm end-to-end.

## Optional extras (only if Will says so, each needs his go-ahead)

- **Deployment protection:** Vercel → Settings → Deployment Protection. Current standard
  protection keeps staging behind Vercel SSO — recommended to leave as-is. Only change it
  if Will explicitly wants staging publicly reachable.
- **Supabase PITR on production:** has billing implications and touches the production
  project — only with Will's explicit confirmation, and only the PITR add-on toggle,
  nothing else.
- **Invite Ravi to the repo:** https://github.com/willo54321/placemakerai → Settings →
  Collaborators → invite (Will supplies the GitHub username; **Read** access unless he
  says otherwise).
