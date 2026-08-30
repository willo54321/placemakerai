# Resend email setup — guide for Claude in browser

This is a step-by-step task list for setting up email delivery for Placemaker.
It is written to be executed by Claude operating in a browser (or by a human
following along). Total time: ~20 minutes plus DNS propagation.

**Outcome:** invite emails, password-reset emails, contact-form notifications
and ops alerts all start working. The code is already deployed and waiting —
it activates the moment the environment variables below exist. No code
changes are needed.

**Accounts required:** access to (1) resend.com signup, (2) the Vercel
dashboard for the `placemakerai` project. DNS for placemakerai.io is hosted
at Vercel (nameservers point at vercel-dns.com), so everything happens in
these two dashboards.

---

## Part 1 — Create the Resend account

1. Go to https://resend.com and sign up (use the same email as the Vercel
   account for simplicity). The **free tier is sufficient**: 3,000
   emails/month, 100/day, 1 verified domain. Do not enter payment details.
2. Verify the signup email if prompted.

## Part 2 — Verify the placemakerai.io domain

1. In the Resend dashboard, go to **Domains → Add Domain**.
2. Enter `placemakerai.io`. Region: choose **eu-west-1 (Ireland)** if offered
   — keeps email processing in the EU, consistent with the privacy policy.
3. Resend will show a set of DNS records to add (typically: an MX + TXT
   record for the sending subdomain like `send.placemakerai.io`, a DKIM
   TXT record like `resend._domainkey`, and possibly a DMARC suggestion).
   **Keep this tab open.**
4. In a new tab, open the Vercel dashboard → the team/account that owns
   `placemakerai.io` → **Domains → placemakerai.io → DNS Records** (or
   Project → Settings → Domains → Edit DNS).
5. For each record Resend listed, click **Add Record** in Vercel and copy the
   **Type**, **Name** and **Value** exactly. Watch two traps:
   - Vercel wants the name *without* the domain suffix (enter `send`, not
     `send.placemakerai.io`).
   - TXT values must be pasted whole, including `p=` keys, no added quotes.
6. If Resend suggests a DMARC record and none exists yet, add:
   Type `TXT`, Name `_dmarc`, Value `v=DMARC1; p=none;` (start permissive;
   tighten later).
7. Back in the Resend tab, click **Verify DNS Records**. Vercel DNS
   propagates fast — usually under 5 minutes. Retry until all records show
   **Verified**. If still failing after 15 minutes, re-check each record for
   the traps in step 5.

## Part 3 — Create the API key

1. Resend dashboard → **API Keys → Create API Key**.
2. Name: `placemaker-production`. Permission: **Sending access** only.
   Domain: restrict to `placemakerai.io` if the option is offered.
3. Copy the key (starts `re_`). It is shown once. Do not paste it into chat
   or save it in a file — it goes straight into Vercel in the next step.

## Part 4 — Set the environment variables in Vercel

Vercel dashboard → project **placemakerai** → **Settings → Environment
Variables**. Add these three, each scoped to **Production** (add to Preview
too if desired):

| Name | Value |
|---|---|
| `RESEND_API_KEY` | the `re_...` key from Part 3 |
| `EMAIL_FROM` | `Placemaker <hello@placemakerai.io>` |
| `CONTACT_NOTIFY_EMAIL` | the email address that should receive contact-form leads and ops alerts (Will's real inbox) |

Then trigger a redeploy: **Deployments → ⋯ on the latest deployment →
Redeploy** (env vars only apply to new deployments).

## Part 5 — Verify everything works

Run these checks in order:

1. **Password reset:** go to https://platform.placemakerai.io/forgot-password,
   enter the admin email, submit. The reset email should arrive from
   `hello@placemakerai.io` within a minute. Check spam the first time.
2. **Contact notification:** go to https://placemakerai.io, scroll to
   Start a Project, submit a test message (name it TEST so it's obvious).
   Confirm (a) it appears at https://platform.placemakerai.io/admin/messages
   and (b) a notification email arrives at `CONTACT_NOTIFY_EMAIL` — and that
   hitting Reply on that notification addresses the test submitter.
3. **Invite flow:** at https://platform.placemakerai.io/admin/users, create a
   test user with no password. An invite email with a Set Your Password link
   should arrive at that address.
4. In the Resend dashboard → **Emails**, all test sends should show as
   Delivered.
5. Delete the test user and test contact message afterwards.

## Troubleshooting

- **Emails not sending, no errors visible:** the redeploy step was probably
  skipped, or the key was added to the wrong environment scope. The code
  logs `RESEND_API_KEY not configured, skipping...` in Vercel function logs
  when the key is absent.
- **"Domain not verified" errors from Resend:** `EMAIL_FROM` must use the
  verified domain. Until verification completes, the code falls back to
  Resend's shared `onboarding@resend.dev` sender, which only delivers to the
  account owner's own address.
- **Delivered but in spam:** normal for a fresh domain; improves with
  volume. Confirm DKIM shows "pass" in the received email headers.

## While you're in these dashboards (optional, from the ops checklist)

- **Sentry:** create a project at sentry.io (free tier), copy the DSN, add
  `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` to Vercel env vars, redeploy.
  Error tracking is already wired in the code and inert without these.
- **Supabase Pro ($25/mo):** supabase.com dashboard → project
  `wcycfjiagksjcxafcpma` → upgrade. Buys daily backups and removes the
  free-tier pausing risk. Recommended before the first real client.
- **Vercel Pro ($20/mo):** Hobby plan is licensed for non-commercial use;
  upgrade when the product is charging. Also enables Firewall rules — turn
  on bot protection under the Firewall tab while there.

## What this unlocks next (no action needed)

With the key in place, the codebase is ready for Phase 1 of the enquiry
tracker (replies to public enquiries sent from inside Placemaker) — see the
session notes / ask Claude Code to "start Phase 1 of the enquiry tracker".
